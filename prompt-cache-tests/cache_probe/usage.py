"""Normalise cache telemetry across the several conventions providers use.

There is no single standard. The ones seen in the wild:

  OpenAI / Azure OpenAI   usage.prompt_tokens_details.cached_tokens
                          usage.prompt_tokens_details.cache_write_tokens
  DeepSeek (native)       usage.prompt_cache_hit_tokens
                          usage.prompt_cache_miss_tokens
  Anthropic-style proxies usage.cache_read_input_tokens
                          usage.cache_creation_input_tokens
  Various gateways        usage.cached_tokens

Rather than guess which one an endpoint speaks, we look for all of them AND
deep-scan the raw usage object for anything cache-shaped. That way a provider
using a name nobody has seen yet still shows up in the report.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# Ordered by specificity: the first match wins when resolving a single number.
READ_PATHS: tuple[tuple[str, ...], ...] = (
    ("prompt_tokens_details", "cached_tokens"),
    ("prompt_tokens_details", "cache_read_input_tokens"),
    ("input_tokens_details", "cached_tokens"),
    ("prompt_cache_hit_tokens",),
    ("cache_read_input_tokens",),
    ("cached_tokens",),
)

WRITE_PATHS: tuple[tuple[str, ...], ...] = (
    ("prompt_tokens_details", "cache_write_tokens"),
    ("prompt_tokens_details", "cache_creation_input_tokens"),
    ("cache_creation_input_tokens",),
    ("cache_write_tokens",),
)

MISS_PATHS: tuple[tuple[str, ...], ...] = (
    ("prompt_cache_miss_tokens",),
    ("prompt_tokens_details", "cache_miss_tokens"),
)

# Deep-scan classifiers. Checked against the flattened dotted key, lowercased.
_READ_HINT = re.compile(r"cach.*(read|hit|reus)|(read|hit|reus).*cach|\bcached_tokens\b")
_WRITE_HINT = re.compile(r"cach.*(write|creation|creat)|(write|creation).*cach")
_MISS_HINT = re.compile(r"cach.*miss|miss.*cach")
_ANY_CACHE = re.compile(r"cach")


def flatten(obj: Any, prefix: str = "") -> dict[str, Any]:
    """Flatten nested dicts to dotted paths, keeping only scalar leaves."""
    out: dict[str, Any] = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            out.update(flatten(value, path))
    elif isinstance(obj, (int, float, str, bool)) or obj is None:
        out[prefix] = obj
    return out


def _dig(usage: dict[str, Any], path: tuple[str, ...]) -> int | None:
    node: Any = usage
    for part in path:
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, int) else None


def _first(usage: dict[str, Any], paths: tuple[tuple[str, ...], ...]) -> tuple[int | None, str | None]:
    for path in paths:
        value = _dig(usage, path)
        if value is not None:
            return value, ".".join(path)
    return None, None


@dataclass
class CacheUsage:
    """A single request's token accounting, normalised."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None

    cache_read: int | None = None
    cache_read_field: str | None = None
    cache_write: int | None = None
    cache_write_field: str | None = None
    cache_miss: int | None = None
    cache_miss_field: str | None = None

    # Every cache-shaped key found by deep scan, including ones we could not
    # classify. This is the escape hatch for unknown providers.
    discovered: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def reports_any_cache_field(self) -> bool:
        return bool(self.discovered)

    @property
    def hit(self) -> bool:
        """Did this request demonstrably reuse cached prefix tokens?"""
        if self.cache_read is not None:
            return self.cache_read > 0
        # Some providers only report misses. A miss count below the prompt size
        # implies the remainder was served from cache.
        if self.cache_miss is not None and self.prompt_tokens:
            return self.cache_miss < self.prompt_tokens
        return False

    @property
    def hit_ratio(self) -> float | None:
        if self.cache_read is None or not self.prompt_tokens:
            return None
        return self.cache_read / self.prompt_tokens

    def summary(self) -> str:
        parts = [f"prompt={self.prompt_tokens}"]
        if self.cache_read is not None:
            parts.append(f"cached={self.cache_read}")
        if self.cache_write is not None:
            parts.append(f"written={self.cache_write}")
        if self.cache_miss is not None:
            parts.append(f"missed={self.cache_miss}")
        if not self.reports_any_cache_field:
            parts.append("no-cache-fields")
        return " ".join(parts)


def parse_usage(raw_response: dict[str, Any]) -> CacheUsage:
    """Build a CacheUsage from a raw chat-completions JSON body."""
    usage = raw_response.get("usage") or {}
    flat = flatten(usage)

    discovered = {k: v for k, v in flat.items() if _ANY_CACHE.search(k.lower())}

    read, read_field = _first(usage, READ_PATHS)
    write, write_field = _first(usage, WRITE_PATHS)
    miss, miss_field = _first(usage, MISS_PATHS)

    # Fall back to the deep scan for providers using an unrecognised name.
    if read is None:
        for key, value in discovered.items():
            low = key.lower()
            if isinstance(value, int) and _READ_HINT.search(low) and not _WRITE_HINT.search(low):
                read, read_field = value, key
                break
    if read is None:
        # Last resort: a cache-shaped integer that is demonstrably neither a
        # write nor a miss is far more likely to be a read than nothing at all.
        for key, value in discovered.items():
            low = key.lower()
            if (
                isinstance(value, int)
                and not _WRITE_HINT.search(low)
                and not _MISS_HINT.search(low)
            ):
                read, read_field = value, key
                break
    if write is None:
        for key, value in discovered.items():
            if isinstance(value, int) and _WRITE_HINT.search(key.lower()):
                write, write_field = value, key
                break
    if miss is None:
        for key, value in discovered.items():
            if isinstance(value, int) and _MISS_HINT.search(key.lower()):
                miss, miss_field = value, key
                break

    return CacheUsage(
        prompt_tokens=usage.get("prompt_tokens") or usage.get("input_tokens"),
        completion_tokens=usage.get("completion_tokens") or usage.get("output_tokens"),
        total_tokens=usage.get("total_tokens"),
        cache_read=read,
        cache_read_field=read_field,
        cache_write=write,
        cache_write_field=write_field,
        cache_miss=miss,
        cache_miss_field=miss_field,
        discovered=discovered,
        raw=usage,
    )
