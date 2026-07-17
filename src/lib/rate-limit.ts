/**
 * Minimal in-memory sliding-window rate limiter for API routes.
 *
 * Scope: per server instance. On serverless/multi-instance deploys each
 * instance keeps its own window, so the effective global limit is
 * (limit x instances) — still enough to stop tight-loop abuse of the
 * expensive endpoints (OpenAI generation, outbound email, Stripe customer
 * creation). For a hard global limit, swap the Map for Upstash/Redis; the
 * call-site contract stays the same.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Periodically drop expired windows so the map cannot grow unbounded. */
function sweep(now: number) {
  if (windows.size < 10_000) return;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — suitable for a Retry-After header. */
  retryAfterSeconds: number;
}

/**
 * @param key      unique bucket, e.g. `ai:${userId}` or `send:${userId}`
 * @param limit    max requests per window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Standard 429 payload helper for route handlers. */
export function rateLimitResponseInit(result: RateLimitResult): ResponseInit {
  return {
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds) },
  };
}
