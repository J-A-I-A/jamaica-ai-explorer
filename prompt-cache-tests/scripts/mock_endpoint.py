"""A fake OpenAI-compatible server that simulates prefix caching.

Used to prove the probe detects caching correctly before it is pointed at a
real, billable endpoint. Run it, point OPENAI_BASE_URL at it, and the suite
should come back with PREFIX CACHING ACTIVE.

    python scripts/mock_endpoint.py --dialect deepseek --port 8099
    OPENAI_BASE_URL=http://127.0.0.1:8099/v1 MODEL=mock-model pytest

--dialect selects which field-naming convention to emit, so you can verify the
normaliser against each one. --no-cache simulates a provider that never caches,
which should produce the NO CACHE TELEMETRY verdict.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

# Crude but adequate: the real endpoint's tokeniser does not need to match ours,
# because the suite only ever compares numbers the server itself reported.
CHARS_PER_TOKEN = 3.6
MIN_CACHEABLE_TOKENS = 1024
BLOCK = 128  # cache granularity, mirroring the 128-token increments docs mention

_state: dict[str, object] = {
    "prefixes": [],
    "dialect": "openai",
    "cache": True,
    "tpm": 0,          # 0 = unlimited
    "ledger": [],      # (timestamp, tokens) inside the rolling window
    "rejections": 0,
    "window": 60.0,
    "content_filter": False,
}


def _tokens(text: str) -> int:
    return max(1, int(len(text) / CHARS_PER_TOKEN))


def _render(messages: list[dict]) -> str:
    return "\n".join(f"{m.get('role')}:{m.get('content')}" for m in messages)


def _longest_shared_prefix(text: str) -> int:
    """Characters shared with the longest previously seen prompt."""
    best = 0
    for seen in _state["prefixes"]:  # type: ignore[union-attr]
        n = 0
        for a, b in zip(text, seen):
            if a != b:
                break
            n += 1
        best = max(best, n)
    return best


def _usage(prompt_tokens: int, cached: int, completion: int) -> dict:
    dialect = _state["dialect"]
    if dialect == "deepseek":
        return {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "total_tokens": prompt_tokens + completion,
            "prompt_cache_hit_tokens": cached,
            "prompt_cache_miss_tokens": prompt_tokens - cached,
        }
    if dialect == "anthropic":
        return {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "cache_read_input_tokens": cached,
            "cache_creation_input_tokens": 0 if cached else prompt_tokens,
        }
    if dialect == "exotic":
        return {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "kv_cache_reused_tokens": cached,
        }
    if dialect == "none":
        return {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "total_tokens": prompt_tokens + completion,
        }
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion,
        "total_tokens": prompt_tokens + completion,
        "prompt_tokens_details": {"cached_tokens": cached, "cache_write_tokens": 0},
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args) -> None:  # silence per-request stderr noise
        pass

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        if not re.search(r"/chat/completions", self.path):
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        rendered = _render(payload.get("messages", []))
        prompt_tokens = _tokens(rendered)

        # Enforce a TPM quota the way Azure does: rolling 60s window, 429 with
        # a Retry-After when the next request would breach it.
        if _state["tpm"]:
            now = time.time()
            ledger = [e for e in _state["ledger"] if e[0] > now - _state["window"]]  # type: ignore[index]
            spent = sum(t for _, t in ledger)
            if spent + prompt_tokens > _state["tpm"]:  # type: ignore[operator]
                _state["ledger"] = ledger
                _state["rejections"] += 1  # type: ignore[operator]
                oldest = ledger[0][0] if ledger else now
                retry_after = max(1, int(oldest + _state["window"] - now) + 1)
                message = json.dumps({
                    "error": {
                        "code": "RateLimitReached",
                        "message": (
                            f"Requests to the model deployment have exceeded the "
                            f"rate limit of {_state['tpm']} TPM."
                        ),
                    }
                }).encode()
                self.send_response(429)
                self.send_header("Content-Type", "application/json")
                self.send_header("Retry-After", str(retry_after))
                self.send_header("Content-Length", str(len(message)))
                self.end_headers()
                self.wfile.write(message)
                return
            ledger.append((now, prompt_tokens))
            _state["ledger"] = ledger

        # Simulate an Azure content filter. The real one rejected our original
        # hash-hex filler with label 'Jailbreak', so the trigger here is the same
        # thing: a long run of high-entropy characters.
        if _state["content_filter"] and re.search(r"[a-f0-9]{20,}", rendered):
            blocked = json.dumps({
                "id": "chatcmpl-blocked",
                "model": "",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": ""},
                    "finish_reason": "content_filter",
                    "content_filter_results": {"error": {
                        "code": "content_filter",
                        "message": "Response content blocked by label 'Jailbreak'.",
                    }},
                }],
                # Note: a filtered prompt is still billed.
                "usage": {"prompt_tokens": prompt_tokens, "total_tokens": prompt_tokens},
                "object": "chat.completion",
            }).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(blocked)))
            self.end_headers()
            self.wfile.write(blocked)
            return

        cached = 0
        if _state["cache"] and prompt_tokens >= MIN_CACHEABLE_TOKENS:
            shared_chars = _longest_shared_prefix(rendered)
            shared_tokens = _tokens(rendered[:shared_chars]) if shared_chars else 0
            if shared_tokens >= MIN_CACHEABLE_TOKENS:
                cached = (shared_tokens // BLOCK) * BLOCK

        _state["prefixes"].append(rendered)  # type: ignore[union-attr]

        completion = 4
        body = {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "model": payload.get("model", "mock-model"),
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "ok"},
                    "finish_reason": "stop",
                }
            ],
            "usage": _usage(prompt_tokens, cached, completion),
        }
        encoded = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8099)
    parser.add_argument(
        "--dialect",
        default="openai",
        choices=["openai", "deepseek", "anthropic", "exotic", "none"],
        help="which cache field naming convention to emit",
    )
    parser.add_argument(
        "--tpm",
        type=int,
        default=0,
        help="enforce a tokens-per-minute quota, answering 429 above it (0 = unlimited)",
    )
    parser.add_argument(
        "--window",
        type=float,
        default=60.0,
        help="length of the TPM window in seconds (shorten to compress tests)",
    )
    parser.add_argument(
        "--content-filter",
        action="store_true",
        help="reject high-entropy prompts with the Azure 'Jailbreak' 400, as the real filter does",
    )
    parser.add_argument(
        "--chars-per-token",
        type=float,
        default=CHARS_PER_TOKEN,
        help="tokeniser density to simulate (the real DeepSeek deployment bills ~5.5)",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="simulate an endpoint that never reuses a prefix",
    )
    args = parser.parse_args()

    _state["dialect"] = args.dialect
    _state["cache"] = not args.no_cache
    _state["tpm"] = args.tpm
    _state["window"] = args.window
    _state["content_filter"] = args.content_filter
    globals()["CHARS_PER_TOKEN"] = args.chars_per_token

    server = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"mock endpoint on http://127.0.0.1:{args.port}/v1 dialect={args.dialect} "
          f"cache={'off' if args.no_cache else 'on'} "
          f"tpm={args.tpm or 'unlimited'}")
    server.serve_forever()


if __name__ == "__main__":
    main()
