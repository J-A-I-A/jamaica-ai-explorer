import "server-only";

/**
 * In-memory sliding-window rate limiter shared by the public API routes.
 *
 * Each client gets N requests per rolling window, per scope — the Smart Search
 * assistant and feedback submissions hold separate budgets, so using one never
 * eats into the other. The state lives in the process, cached on globalThis so
 * Next.js dev-server hot reloads don't reset it — which means the budget is per
 * app instance and resets on deploy. That's the right trade-off here: the limit
 * exists to cap model spend and casual abuse, not to be an auditable quota, and
 * it keeps the routes free of any extra database dependency.
 */

/** Hits are recorded as timestamps, so the window slides instead of resetting
 *  everyone at a fixed hour. */
type Bucket = { hits: number[] };

const globalForLimiter = globalThis as unknown as {
  jaiaRateLimiter?: Map<string, Bucket>;
};

function getStore(): Map<string, Bucket> {
  if (!globalForLimiter.jaiaRateLimiter) {
    globalForLimiter.jaiaRateLimiter = new Map();
  }
  return globalForLimiter.jaiaRateLimiter;
}

/** Drop buckets whose hits have all aged out, so an instance that has served
 *  many clients doesn't hold their keys forever. */
function sweep(store: Map<string, Bucket>, cutoff: number) {
  for (const [key, bucket] of store) {
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] <= cutoff) {
      store.delete(key);
    }
  }
}

let sinceSweep = 0;
const SWEEP_EVERY = 500;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  /** Requests still available in the current window. */
  remaining: number;
  /** Epoch ms at which the oldest hit ages out and a slot frees up. */
  resetAt: number;
  /** Seconds until `resetAt`, for a Retry-After header. */
  retryAfterSeconds: number;
};

/**
 * Look at a client's budget without spending any of it. Call this before doing
 * the expensive work, then `recordHit` once the work actually succeeded, so a
 * failed upstream call doesn't cost the user one of their questions.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const cutoff = now - windowMs;

  if (++sinceSweep >= SWEEP_EVERY) {
    sinceSweep = 0;
    sweep(store, cutoff);
  }

  const bucket = store.get(key);
  const hits = bucket ? bucket.hits.filter((t) => t > cutoff) : [];
  if (bucket) {
    if (hits.length === 0) store.delete(key);
    else bucket.hits = hits;
  }

  const allowed = hits.length < limit;
  const resetAt = hits.length > 0 ? hits[0] + windowMs : now;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - hits.length),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

/** Spend one slot. Returns the state after the hit. */
export function recordHit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  bucket.hits.push(now);
  store.set(key, bucket);

  const resetAt = bucket.hits[0] + windowMs;
  return {
    allowed: bucket.hits.length <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.hits.length),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

/**
 * Identify the caller, within one scope. Behind a proxy the first
 * x-forwarded-for entry is the client; direct connections fall back to a shared
 * bucket, which is deliberately conservative — an unidentifiable caller shares
 * one budget. The scope keeps each route's budget separate, so a visitor who
 * has used up their questions can still send feedback.
 */
export function clientKey(req: Request, scope: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim();
  return `${scope}:${ip || "unknown"}`;
}

/** Headers that let the client show how much budget is left. */
export function rateLimitHeaders(state: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(state.limit),
    "X-RateLimit-Remaining": String(state.remaining),
    "X-RateLimit-Reset": String(Math.ceil(state.resetAt / 1000)),
  };
}

/**
 * Read a non-negative limit or window from the environment. An unset or
 * unparseable value keeps the caller's default; an explicit 0 is honoured, so a
 * deployment can turn a limit off without a code change.
 */
export function numberFromEnv(raw: string | undefined, fallback: number): number {
  const value = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** "in about 3 hours" / "in about 25 minutes", for a limit message. */
export function describeWait(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  if (hours >= 1) return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
