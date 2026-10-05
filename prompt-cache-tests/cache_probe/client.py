"""Thin wrapper over an OpenAI-compatible chat-completions endpoint.

Two things matter here that the plain SDK does not give us:

1. We read the RAW JSON body, not the parsed model. Typed SDK models can drop
   fields the client library does not know about, and unknown cache fields are
   the entire point of this exercise.
2. We tolerate the `max_tokens` / `max_completion_tokens` split without making
   the caller care which dialect the endpoint speaks.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx

from .pacing import WINDOW_SECONDS, TokenBudget
from .usage import CacheUsage, parse_usage

DEFAULT_TIMEOUT = 120.0

# Default to the quota the deployment actually has. Override with TPM_LIMIT or
# --tpm; 0 disables pacing.
DEFAULT_TPM_LIMIT = 20_000

# Pre-flight sizing only. Every reservation is reconciled against the endpoint's
# own count as soon as the response lands, so this being imprecise is fine.
CHARS_PER_TOKEN = 3.6


def estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / CHARS_PER_TOKEN))


class ProbeConfigError(RuntimeError):
    """Raised when the environment is not configured well enough to probe."""


class ContentFilteredError(RuntimeError):
    """The deployment's content filter rejected the prompt.

    Distinct from a generic 400 because it says nothing about caching and
    everything about the prompt text. Azure returns this as a 400 whose body
    carries `finish_reason: content_filter` and a label such as `Jailbreak` —
    high-entropy filler (hex, base64) reliably triggers that label, which is why
    the synthetic corpora are written as plain prose.
    """

    def __init__(self, label: str, detail: str) -> None:
        self.label = label
        self.detail = detail
        super().__init__(
            f"content filter rejected the prompt (label: {label}). {detail}"
        )


def _content_filter_label(body: dict[str, Any]) -> str | None:
    """Return the filter label if this response is a content-filter rejection."""
    for choice in body.get("choices") or []:
        if choice.get("finish_reason") != "content_filter":
            continue
        results = choice.get("content_filter_results") or {}
        error = results.get("error") or {}
        message = error.get("message") or ""
        # "Response content blocked by label 'Jailbreak'."
        if "'" in message:
            return message.split("'")[1]
        for category, detail in results.items():
            if isinstance(detail, dict) and detail.get("filtered"):
                return category
        return "unspecified"
    top = body.get("error") or {}
    if top.get("code") == "content_filter":
        return "unspecified"
    return None


# How to present the key. Azure is inconsistent across surfaces: the Azure
# OpenAI data plane wants `api-key`, the Foundry `/openai/v1` surface accepts
# `Authorization: Bearer`, and some gateways in front of them try to validate a
# Bearer token as an Entra ID JWT and reject a raw key outright. Sending both at
# once is NOT safe for that reason — hence one at a time, with a fallback.
AUTH_STYLES = ("api-key", "bearer", "subscription-key")


def _headers_for(style: str, key: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if not key:
        return headers
    if style == "bearer":
        headers["Authorization"] = f"Bearer {key}"
    elif style == "subscription-key":
        headers["Ocp-Apim-Subscription-Key"] = key
    else:
        headers["api-key"] = key
    return headers


@dataclass(frozen=True)
class Settings:
    base_url: str
    model: str
    api_key: str | None
    api_version: str | None
    auth_style: str = "auto"
    tpm_limit: int = DEFAULT_TPM_LIMIT
    # Length of the provider's rolling quota window. Only worth changing to
    # match a provider that does not use 60s, or to compress the suite's own
    # end-to-end tests.
    pacing_window: float = WINDOW_SECONDS
    timeout: float = DEFAULT_TIMEOUT

    @classmethod
    def from_env(cls) -> "Settings":
        base_url = (os.getenv("OPENAI_BASE_URL") or "").strip().rstrip("/")
        model = (os.getenv("MODEL") or os.getenv("OPENAI_MODEL") or "").strip()
        api_key = (os.getenv("MODEL_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip() or None
        api_version = (os.getenv("OPENAI_API_VERSION") or "").strip() or None
        auth_style = (os.getenv("AUTH_STYLE") or "auto").strip().lower()
        raw_tpm = (os.getenv("TPM_LIMIT") or "").strip()
        try:
            tpm_limit = int(raw_tpm) if raw_tpm else DEFAULT_TPM_LIMIT
        except ValueError:
            raise ProbeConfigError(f"TPM_LIMIT must be an integer — got {raw_tpm!r}") from None

        missing = [
            name
            for name, value in (("OPENAI_BASE_URL", base_url), ("MODEL", model))
            if not value
        ]
        if missing:
            raise ProbeConfigError(
                "Missing required environment variable(s): "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill it in."
            )
        if auth_style not in AUTH_STYLES + ("auto",):
            raise ProbeConfigError(
                f"AUTH_STYLE must be one of auto, {', '.join(AUTH_STYLES)} — got {auth_style!r}"
            )
        return cls(
            base_url=base_url,
            model=model,
            api_key=api_key,
            api_version=api_version,
            auth_style=auth_style,
            tpm_limit=tpm_limit,
            pacing_window=float(os.getenv("PACING_WINDOW_SECONDS") or WINDOW_SECONDS),
        )

    @property
    def initial_auth_style(self) -> str:
        if self.auth_style != "auto":
            return self.auth_style
        # Azure hosts overwhelmingly want the raw key in `api-key`.
        return "api-key" if ".azure.com" in self.base_url else "bearer"


@dataclass
class Call:
    """One completed request: what we sent, what came back, how long it took."""

    label: str
    usage: CacheUsage
    latency_ms: float
    status: int
    body: dict[str, Any]

    def __str__(self) -> str:  # pragma: no cover - display only
        return f"[{self.label}] {self.usage.summary()} in {self.latency_ms:.0f}ms"


class ProbeClient:
    """Issues chat completions and returns normalised cache telemetry."""

    def __init__(self, settings: Settings, budget: "TokenBudget | None" = None) -> None:
        self.settings = settings
        self.auth_style = settings.initial_auth_style
        self._http = httpx.Client(timeout=settings.timeout)
        self._token_field = "max_tokens"
        self._auth_settled = settings.auth_style != "auto"
        self.calls: list[Call] = []
        self.budget = budget or TokenBudget(
            limit=settings.tpm_limit, window=settings.pacing_window
        )
        self.max_429_retries = 3
        self.rate_limit_hits = 0
        self.rate_limit_waited = 0.0
        self._last_estimate = 0

    def close(self) -> None:
        self._http.close()

    # -- internals ---------------------------------------------------------

    @property
    def _url(self) -> str:
        url = f"{self.settings.base_url}/chat/completions"
        if self.settings.api_version:
            url += f"?api-version={self.settings.api_version}"
        return url

    def _send(self, body: str) -> httpx.Response:
        return self._http.post(
            self._url,
            content=body,
            headers=_headers_for(self.auth_style, self.settings.api_key),
        )

    @staticmethod
    def _retry_after(response: httpx.Response, attempt: int) -> float:
        """Seconds to wait after a 429, from the header if the service gave one."""
        header = response.headers.get("retry-after") or response.headers.get(
            "x-ratelimit-reset-requests"
        )
        if header:
            try:
                return min(120.0, max(1.0, float(header)))
            except ValueError:
                pass
        # No guidance: back off geometrically, capped. A TPM window is 60s, so
        # waiting out most of one is the sane default.
        return min(90.0, 20.0 * (attempt + 1))

    def _post(self, payload: dict[str, Any]) -> httpx.Response:
        body = json.dumps(payload)
        response = self._send(body)

        # On `auto`, a 401 usually means we guessed the header wrong rather than
        # that the key is bad. Try the alternatives once, then remember whatever
        # worked for the rest of the run.
        if response.status_code in (401, 403) and not self._auth_settled:
            for style in AUTH_STYLES:
                if style == self.auth_style:
                    continue
                retry = self._http.post(
                    self._url,
                    content=body,
                    headers=_headers_for(style, self.settings.api_key),
                )
                if retry.status_code < 400:
                    self.auth_style = style
                    self._auth_settled = True
                    return retry
            self._auth_settled = True  # none worked; stop burning requests
        elif response.status_code < 400:
            self._auth_settled = True

        # 429 despite pacing: the window is shared with whatever else is hitting
        # this deployment, so our own ledger can only ever be an approximation.
        # Wait it out rather than failing the run — a quota bump mid-suite is
        # not a finding about caching.
        attempt = 0
        while response.status_code == 429 and attempt < self.max_429_retries:
            wait = self._retry_after(response, attempt)
            self.rate_limit_hits += 1
            self.rate_limit_waited += wait
            # Assume the rejected attempt still counted against quota.
            self.budget.charge(self._last_estimate)
            time.sleep(wait)
            attempt += 1
            response = self._send(body)

        return response

    # -- public ------------------------------------------------------------

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        label: str,
        max_output_tokens: int = 16,
        extra_body: dict[str, Any] | None = None,
    ) -> Call:
        """Send one completion and record the normalised usage.

        Output is deliberately tiny — we are measuring input accounting, and
        generated tokens are the expensive half of the bill.
        """
        payload: dict[str, Any] = {
            "model": self.settings.model,
            "messages": messages,
            "temperature": 0,
            self._token_field: max_output_tokens,
        }
        if extra_body:
            payload.update(extra_body)

        # Reserve before sending. We cannot know the true token count until the
        # response arrives, so estimate from the rendered prompt and reconcile
        # afterwards. Output counts against TPM too, hence the ceiling is added.
        rendered = "".join(m.get("content", "") for m in messages)
        self._last_estimate = estimate_tokens(rendered) + max_output_tokens
        self.budget.reserve(self._last_estimate)

        started = time.perf_counter()
        response = self._post(payload)

        # Some newer deployments reject `max_tokens` and demand
        # `max_completion_tokens`. Switch once, remember, retry.
        if response.status_code == 400 and self._token_field == "max_tokens":
            detail = response.text.lower()
            if "max_completion_tokens" in detail or "max_tokens" in detail:
                self._token_field = "max_completion_tokens"
                payload.pop("max_tokens", None)
                payload["max_completion_tokens"] = max_output_tokens
                started = time.perf_counter()
                response = self._post(payload)

        latency_ms = (time.perf_counter() - started) * 1000

        # A content-filter rejection arrives as a 400 with a normal-looking body,
        # so decode before deciding what kind of failure this is.
        try:
            body = response.json()
        except ValueError:
            body = {}

        filter_label = _content_filter_label(body) if body else None
        if filter_label:
            charged = (body.get("usage") or {}).get("prompt_tokens")
            if charged:
                # Filtered prompts are still billed and still count against TPM.
                self.budget.reconcile(charged)
            raise ContentFilteredError(
                filter_label,
                f"[{label}] {charged or 'unknown'} prompt tokens were still charged. "
                "If this is one of the synthetic corpora, the filler text is the "
                "problem, not the endpoint.",
            )

        if response.status_code >= 400:
            raise RuntimeError(
                f"{label}: endpoint returned {response.status_code}: {response.text[:500]}"
            )
        call = Call(
            label=label,
            usage=parse_usage(body),
            latency_ms=latency_ms,
            status=response.status_code,
            body=body,
        )
        # Swap the estimate for what the endpoint actually charged, so the
        # ledger stays accurate over a long run rather than drifting.
        actual = (call.usage.prompt_tokens or 0) + (call.usage.completion_tokens or 0)
        if actual:
            self.budget.reconcile(actual)
        self.calls.append(call)
        return call

    @property
    def total_prompt_tokens(self) -> int:
        return sum(c.usage.prompt_tokens or 0 for c in self.calls)

    @property
    def total_completion_tokens(self) -> int:
        return sum(c.usage.completion_tokens or 0 for c in self.calls)
