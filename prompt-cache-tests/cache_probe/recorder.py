"""Collects observations and renders the verdict.

The suite's real output is not pass/fail — "this endpoint does not cache" is a
legitimate finding. So every test files an Observation, and at the end we write
a JSON record plus a human-readable markdown verdict.
"""

from __future__ import annotations

import json
import platform
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPORTS = Path(__file__).resolve().parent.parent / "reports"


@dataclass
class Observation:
    check: str
    outcome: str  # "cached" | "not-cached" | "inconclusive" | "error"
    detail: str
    data: dict[str, Any] = field(default_factory=dict)


class Recorder:
    def __init__(self, model: str, base_url: str) -> None:
        self.model = model
        self.base_url = base_url
        self.started = datetime.now(timezone.utc)
        self.observations: list[Observation] = []
        self.cache_fields_seen: dict[str, Any] = {}
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.tpm_limit = 0
        self.pacing = ""
        self.rate_limit_hits = 0

    def add(self, check: str, outcome: str, detail: str, **data: Any) -> None:
        self.observations.append(Observation(check, outcome, detail, data))

    def note_fields(self, discovered: dict[str, Any]) -> None:
        for key, value in discovered.items():
            self.cache_fields_seen.setdefault(key, value)

    # -- verdict -----------------------------------------------------------

    @property
    def verdict(self) -> str:
        outcomes = {o.check: o.outcome for o in self.observations}
        if outcomes.get("warm_prefix_hit") == "cached":
            if outcomes.get("suffix_variation_hit") == "cached":
                return "PREFIX CACHING ACTIVE"
            return "CACHING ACTIVE (prefix reuse unconfirmed)"
        if not self.cache_fields_seen:
            return "NO CACHE TELEMETRY — endpoint reports no cache fields at all"
        return "CACHE FIELDS PRESENT BUT NO HITS OBSERVED"

    def _redacted_base_url(self) -> str:
        # Keep the host for context, drop anything that might identify a
        # resource beyond it.
        try:
            scheme, _, rest = self.base_url.partition("://")
            host = rest.split("/", 1)[0]
            return f"{scheme}://{host}/…"
        except Exception:  # pragma: no cover - defensive
            return "…"

    def to_dict(self) -> dict[str, Any]:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "started_at": self.started.isoformat(),
            "model": self.model,
            "endpoint": self._redacted_base_url(),
            "python": platform.python_version(),
            "verdict": self.verdict,
            "cache_fields_seen": self.cache_fields_seen,
            "tokens": {
                "prompt": self.total_prompt_tokens,
                "completion": self.total_completion_tokens,
            },
            "quota": {
                "tpm_limit": self.tpm_limit,
                "pacing": self.pacing,
                "rate_limit_429s": self.rate_limit_hits,
            },
            "observations": [asdict(o) for o in self.observations],
        }

    def to_markdown(self) -> str:
        icon = {
            "cached": "HIT",
            "not-cached": "MISS",
            "inconclusive": "??",
            "error": "ERR",
        }
        lines = [
            "# Prompt cache probe",
            "",
            f"**Verdict: {self.verdict}**",
            "",
            f"- Model: `{self.model}`",
            f"- Endpoint: `{self._redacted_base_url()}`",
            f"- Run: {self.started.isoformat()}",
            f"- Tokens spent: {self.total_prompt_tokens} prompt / "
            f"{self.total_completion_tokens} completion",
            f"- Quota: {self.pacing or 'not recorded'}"
            + (f"; {self.rate_limit_hits} × 429 absorbed" if self.rate_limit_hits else ""),
            "",
            "## Checks",
            "",
            "| Check | Result | Detail |",
            "| --- | --- | --- |",
        ]
        for o in self.observations:
            detail = o.detail.replace("|", "\\|")
            lines.append(f"| {o.check} | {icon.get(o.outcome, o.outcome)} | {detail} |")

        lines += ["", "## Cache fields reported by this endpoint", ""]
        if self.cache_fields_seen:
            for key, value in sorted(self.cache_fields_seen.items()):
                lines.append(f"- `usage.{key}` (example value: `{value}`)")
        else:
            lines.append(
                "_None. No key containing 'cach' appeared anywhere in the usage "
                "object across the whole run._"
            )

        lines += ["", "## What to do with this", ""]
        if self.verdict.startswith("PREFIX CACHING ACTIVE"):
            lines.append(
                "Caching works. Keep the system prompt first and byte-identical, "
                "keep history append-only, and monitor the field(s) above in "
                "production."
            )
        elif self.verdict.startswith("CACHE FIELDS PRESENT"):
            lines.append(
                "The endpoint knows about caching but nothing was reused. Check "
                "whether the cache needs more warm-up traffic, whether the "
                "minimum prompt size was met, and whether the deployment tier "
                "supports it."
            )
        else:
            lines.append(
                "Assume every request is billed at full input rate. Reducing the "
                "size of the fixed context is the only lever available; revisit "
                "when the provider documents caching for this model."
            )
        return "\n".join(lines) + "\n"

    def write(self, directory: Path | None = None) -> tuple[Path, Path]:
        target = directory or REPORTS
        target.mkdir(parents=True, exist_ok=True)
        stamp = self.started.strftime("%Y%m%dT%H%M%SZ")
        json_path = target / f"cache-probe-{stamp}.json"
        md_path = target / "latest.md"
        json_path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
        md_path.write_text(self.to_markdown(), encoding="utf-8")
        return json_path, md_path
