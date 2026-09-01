import "server-only";

/**
 * In-memory sliding-window rate limiter for the Smart Search assistant.
 *
 * Each client gets N answered questions per rolling window (24h by default).
 * The state lives in the process, cached on globalThis so Next.js dev-server
 * hot reloads don't reset it — which means the budget is per app instance and
 * resets on deploy. That's the right trade-off here: the limit exists to cap
 * model spend and casual abuse, not to be an auditable quota, and it keeps the
 * chat route free of any database dependency.
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
 * Identify the caller. Behind a proxy the first x-forwarded-for entry is the
 * client; direct connections fall back to a shared bucket, which is
 * deliberately conservative — an unidentifiable caller shares one budget.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim();
  return ip || "unknown";
}

/** Headers that let the client show how much budget is left. */
export function rateLimitHeaders(state: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(state.limit),
    "X-RateLimit-Remaining": String(state.remaining),
    "X-RateLimit-Reset": String(Math.ceil(state.resetAt / 1000)),
  };
}
