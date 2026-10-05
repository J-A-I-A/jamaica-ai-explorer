"""Find the URL + auth-header combination your deployment actually accepts.

A 401 saying "invalid subscription key or wrong API endpoint" is ambiguous by
design — Azure returns the same message whether the key is wrong, the header
name is wrong, or the host/path is wrong. Rather than guess, this walks the
plausible combinations and reports which one returns 200.

    python scripts/diagnose_auth.py

It sends a deliberately tiny prompt (a few tokens) to each candidate, so a full
sweep costs less than a single normal request. Keys are never printed.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cache_probe.client import AUTH_STYLES, _headers_for  # noqa: E402

TINY = {
    "messages": [{"role": "user", "content": "hi"}],
    "max_tokens": 1,
    "temperature": 0,
}

# Azure exposes several surfaces and the portal shows different ones depending
# on where you look. These are the shapes seen for Foundry deployments.
PATH_TEMPLATES = (
    "{base}/chat/completions",
    "{base}/openai/v1/chat/completions",
    "{base}/v1/chat/completions",
    "{base}/models/chat/completions",
)

API_VERSIONS = (None, "2024-05-01-preview", "2025-04-01-preview")


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        sys.exit(f"No .env found at {path}. Copy .env.example first.")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def candidate_bases(configured: str) -> list[str]:
    """The configured base, plus the bare host in case a suffix is the problem."""
    configured = configured.rstrip("/")
    parsed = urlparse(configured)
    bases = [configured]
    root = f"{parsed.scheme}://{parsed.netloc}"
    for extra in (root, f"{root}/openai", f"{root}/openai/v1", f"{root}/models"):
        if extra not in bases:
            bases.append(extra)
    return bases


def candidate_urls(configured: str) -> list[str]:
    """Every plausible chat-completions URL, deduped and sanity-checked.

    Cross-producing bases with path templates generates nonsense like
    `/openai/v1/openai/v1/...`, so collapse anything with a repeated segment.
    """
    urls: list[str] = []
    seen: set[str] = set()
    for base in candidate_bases(configured):
        for template in PATH_TEMPLATES:
            url = template.format(base=base)
            path = urlparse(url).path
            segments = [s for s in path.split("/") if s]
            # A legitimate path never repeats a segment (…/openai/openai/…)
            # and never stacks two API surfaces (…/models/…/openai/…).
            if len(segments) != len(set(segments)):
                continue
            if "models" in segments and "openai" in segments:
                continue
            if url not in seen:
                seen.add(url)
                urls.append(url)
    return sorted(urls, key=len)


def redact(value: str | None) -> str:
    if not value:
        return "(none)"
    if len(value) < 12:
        return "(set, short)"
    return f"{value[:4]}…{value[-4:]} ({len(value)} chars)"


def main() -> None:
    load_env()
    base = (os.getenv("OPENAI_BASE_URL") or "").strip()
    model = (os.getenv("MODEL") or os.getenv("OPENAI_MODEL") or "").strip()
    key = (os.getenv("MODEL_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip() or None

    if not base or not model:
        sys.exit("OPENAI_BASE_URL and MODEL must both be set in .env")

    parsed = urlparse(base)
    print("Configuration")
    print(f"  host       {parsed.scheme}://{parsed.netloc}")
    print(f"  path       {parsed.path or '/'}")
    print(f"  model      {model}")
    print(f"  key        {redact(key)}")
    print()

    if not key:
        print("No key set. Every attempt will fail unless the endpoint is open.\n")

    payload = dict(TINY, model=model)
    body = json.dumps(payload)
    winners: list[tuple[str, str, str | None]] = []
    urls = candidate_urls(base)
    print(f"Sweeping {len(urls)} candidate URL(s) × {len(API_VERSIONS)} api-version(s) "
          f"× {len(AUTH_STYLES)} auth header(s)\n")

    with httpx.Client(timeout=30.0) as http:
        for url in urls:
            found_for_url = False
            for version in API_VERSIONS:
                if found_for_url:
                    break
                full = url if version is None else f"{url}?api-version={version}"
                for style in AUTH_STYLES:
                    try:
                        r = http.post(full, content=body, headers=_headers_for(style, key))
                    except Exception as exc:  # network / DNS / TLS
                        print(f"  ERR  {style:<17} {url}  ({type(exc).__name__}: {exc})")
                        found_for_url = True  # host unreachable; other tries are pointless
                        break

                    if r.status_code < 400:
                        print(f"  200  {style:<17} {full}")
                        winners.append((full, style, version))
                        # One working style per URL is enough; stop probing it.
                        found_for_url = True
                        break
                    if r.status_code not in (401, 403, 404):
                        # 400/404 are expected while sweeping; anything else is
                        # a real signal worth surfacing (quota, model name, …).
                        detail = r.text[:140].replace("\n", " ")
                        print(f"  {r.status_code}  {style:<17} {full}\n       {detail}")

    print()
    if not winners:
        print("No combination succeeded. In likelihood order:")
        print("  1. The key does not belong to this resource. In the Foundry portal open")
        print("     your deployment and copy the key shown on that deployment's own page —")
        print("     a project-level or a different resource's key will not work.")
        print("  2. The host is wrong. Serverless model deployments often live on")
        print("     https://<deployment>.<region>.models.ai.azure.com rather than on")
        print("     https://<resource>.services.ai.azure.com.")
        print("  3. The deployment name in MODEL does not match the deployment.")
        print("  4. The key was rotated, or the deployment is paused/deleted.")
        print()
        print("The portal's 'Endpoint' panel for the deployment shows the exact URL and")
        print("key pair that belong together — copy both from there, not from two places.")
        return

    url, style, version = winners[0]
    parsed_ok = urlparse(url)
    suggested_base = url.rsplit("/chat/completions", 1)[0]
    print(f"{len(winners)} working combination(s). Put this in .env:\n")
    print(f"OPENAI_BASE_URL={suggested_base}")
    print(f"AUTH_STYLE={style}")
    if version:
        print(f"OPENAI_API_VERSION={version}")
    else:
        print("# OPENAI_API_VERSION not needed")
    print(f"\nThen run: pytest    (host {parsed_ok.netloc})")


if __name__ == "__main__":
    main()
