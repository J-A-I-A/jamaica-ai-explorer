#!/usr/bin/env python3
"""Tokens-per-second benchmark for document QA against the local Qwen3.5-0.8B server.

Sends the Jamaica National A.I. Task Force report as the system prompt, asks a fixed
set of questions over the OpenAI-compatible streaming API, and reports per question:

  ttft_s     seconds until the first answer token (dominated by prompt processing)
  prompt/s   prompt tokens processed per second (server-side, uncached tokens only)
  gen/s      answer tokens generated per second (server-side)
  e2e/s      answer tokens / total wall time, i.e. what a user actually experiences
  ok         whether the answer contains the expected fact (sanity check, not a full eval)

Standard library only. Usage:

  python3 bench_qa.py                    # cold run, then cached runs
  python3 bench_qa.py --no-cache         # reprocess the full document every question
  python3 bench_qa.py --concurrency 4    # parallel users (server has 4 slots)
  python3 bench_qa.py --min-gen-tps 15   # exit 1 if median gen/s falls below 15
"""
import argparse
import json
import os
import re
import statistics
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_DOC = HERE.parent / "prompt-cache-tests" / "fixtures" / "system_prompt.txt"

# (question, regex the answer should match)
QUESTIONS = [
    ("Who chaired the National A.I. Task Force?", r"reckord"),
    ("How many policy pillars does the report have?", r"\b(9|nine)\b"),
    ("What time span does the report call 'short term'?", r"1\s*[-–to]+\s*3"),
    ("By what year does the report aim to make Jamaica a regional A.I. innovation hub?", r"2035"),
    ("Which Jamaican law must A.I. systems comply with for data privacy?", r"data protection act"),
    ("Which UNESCO instrument does the report recommend implementing for A.I. ethics?",
     r"recommendation on the ethics"),
    ("What does the report recommend for broadband in the short term?", r"underserved|coverage"),
    ("What long-term body does the report propose for regulating A.I.?", r"regulatory authority"),
    ("Name two threats listed in the SWOT analysis.",
     r"cyber|displace|competition|resistance|ethical"),
    ("What is the capital of France?", r"report|cannot|not (covered|mentioned|in)|unable|only"),
]


def ask(base_url, model, api_key, system, question, max_tokens, cache):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ],
        "max_tokens": max_tokens,
        "temperature": 0,
        "stream": True,
        "stream_options": {"include_usage": True},
        "cache_prompt": cache,  # llama.cpp extension; ignored by other servers
    }
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    )
    text, usage, timings, t_first = [], {}, {}, None
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=900) as resp:
        for raw in resp:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            chunk = json.loads(line[6:])
            usage = chunk.get("usage") or usage
            timings = chunk.get("timings") or timings
            for choice in chunk.get("choices", []):
                piece = choice.get("delta", {}).get("content")
                if piece:
                    if t_first is None:
                        t_first = time.perf_counter()
                    text.append(piece)
    total = time.perf_counter() - t0
    out_tokens = usage.get("completion_tokens") or timings.get("predicted_n") or 0
    return {
        "question": question,
        "answer": "".join(text).strip(),
        "prompt_tokens": usage.get("prompt_tokens"),
        "cached_tokens": timings.get("cache_n"),
        "completion_tokens": out_tokens,
        "ttft_s": (t_first - t0) if t_first else None,
        "total_s": total,
        "prompt_tps": timings.get("prompt_per_second") if timings.get("prompt_n", 0) > 1 else None,
        "gen_tps": timings.get("predicted_per_second"),
        "e2e_tps": out_tokens / total if total else None,
    }


def fmt(value, spec=".1f"):
    return "-" if value is None else format(value, spec)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base-url", default="http://127.0.0.1:8080/v1")
    ap.add_argument("--model", default="qwen3.5-0.8b")
    ap.add_argument("--api-key", default=os.environ.get("API_KEY", "none"),
                    help="defaults to the API_KEY environment variable")
    ap.add_argument("--doc", type=Path, default=DEFAULT_DOC,
                    help="text file used as the system prompt (instructions + report)")
    ap.add_argument("--max-tokens", type=int, default=200)
    ap.add_argument("--rounds", type=int, default=1, help="times to repeat the question set")
    ap.add_argument("--concurrency", type=int, default=1)
    ap.add_argument("--no-cache", action="store_true",
                    help="disable prompt caching so every question pays full prompt cost")
    ap.add_argument("--min-gen-tps", type=float, help="fail if median gen/s is below this")
    ap.add_argument("--out-dir", type=Path, default=HERE / "results")
    args = ap.parse_args()

    system = args.doc.read_text(encoding="utf-8")
    jobs = QUESTIONS * args.rounds
    print(f"doc: {args.doc.name} ({len(system):,} chars)  model: {args.model}  "
          f"questions: {len(jobs)}  concurrency: {args.concurrency}  "
          f"cache: {'off' if args.no_cache else 'on'}\n")

    def run(job):
        t0 = time.perf_counter()
        try:
            result = ask(args.base_url, args.model, args.api_key, system, job[0], args.max_tokens,
                         not args.no_cache)
        except OSError as exc:  # HTTP errors, refused connections, timeouts
            result = {"question": job[0], "answer": "", "error": str(exc),
                      "prompt_tokens": None, "cached_tokens": None, "completion_tokens": 0,
                      "ttft_s": None, "total_s": time.perf_counter() - t0,
                      "prompt_tps": None, "gen_tps": None, "e2e_tps": None}
        result["ok"] = bool(re.search(job[1], result["answer"], re.I))
        return result

    wall0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(run, jobs))
    wall = time.perf_counter() - wall0

    print(f"{'#':>2} {'prompt':>6} {'cached':>6} {'out':>4} {'ttft_s':>7} {'total_s':>7} "
          f"{'prompt/s':>8} {'gen/s':>6} {'e2e/s':>6} {'ok':>3}  question")
    for i, r in enumerate(results, 1):
        print(f"{i:>2} {fmt(r['prompt_tokens'], 'd'):>6} {fmt(r['cached_tokens'], 'd'):>6} "
              f"{r['completion_tokens']:>4} {fmt(r['ttft_s'], '.2f'):>7} {r['total_s']:>7.2f} "
              f"{fmt(r['prompt_tps']):>8} {fmt(r['gen_tps']):>6} {fmt(r['e2e_tps']):>6} "
              f"{'yes' if r['ok'] else 'NO':>3}  {r['question'][:60]}")

    def med(key, rows=results):
        values = [r[key] for r in rows if r[key] is not None]
        return statistics.median(values) if values else None

    # The first request has nothing cached, so it is the only true cold-start sample.
    warm = results[1:] if not args.no_cache and len(results) > 1 else results
    out_total = sum(r["completion_tokens"] for r in results)
    summary = {
        "cold_ttft_s": results[0]["ttft_s"],
        "cold_prompt_tps": results[0]["prompt_tps"],
        "warm_median_ttft_s": med("ttft_s", warm),
        "median_gen_tps": med("gen_tps"),
        "median_e2e_tps": med("e2e_tps", warm),
        "aggregate_output_tps": out_total / wall,
        "wall_s": wall,
        "answers_ok": f"{sum(r['ok'] for r in results)}/{len(results)}",
        "errors": str(sum("error" in r for r in results)),
    }
    print("\nsummary")
    for key, value in summary.items():
        print(f"  {key:<22} {value if isinstance(value, str) else fmt(value, '.2f')}")

    args.out_dir.mkdir(exist_ok=True)
    report = args.out_dir / f"bench_qa_{datetime.now():%Y%m%d_%H%M%S}.json"
    report.write_text(json.dumps({"args": {k: str(v) for k, v in vars(args).items() if k != "api_key"},
                                  "summary": summary, "results": results}, indent=2),
                      encoding="utf-8")
    print(f"\nreport: {report}")

    if args.min_gen_tps and (summary["median_gen_tps"] or 0) < args.min_gen_tps:
        print(f"FAIL: median gen/s {summary['median_gen_tps']:.1f} < {args.min_gen_tps}")
        sys.exit(1)


if __name__ == "__main__":
    main()
