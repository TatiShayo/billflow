import { describe, it, expect, vi } from "vitest";
import { rateLimit, rateLimitResponseInit } from "./rate-limit";

describe("rateLimit — Sliding Window Rate Limiter", () => {
  it("allows initial request for a key", () => {
    const key = `test_init_${Math.random()}`;
    const res = rateLimit(key, 5, 60_000);
    expect(res.allowed).toBe(true);
    expect(res.retryAfterSeconds).toBe(0);
  });

  it("allows multiple requests within the limit", () => {
    const key = `test_within_${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const res = rateLimit(key, 5, 60_000);
      expect(res.allowed).toBe(true);
      expect(res.retryAfterSeconds).toBe(0);
    }
  });

  it("blocks requests that exceed the limit", () => {
    const key = `test_exceed_${Math.random()}`;
    // 3 allowed
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    // 4th request must be blocked
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isolates rate limits between distinct keys", () => {
    const keyA = `user_a_${Math.random()}`;
    const keyB = `user_b_${Math.random()}`;

    // Exhaust keyA limit
    for (let i = 0; i < 2; i++) {
      rateLimit(keyA, 2, 60_000);
    }
    expect(rateLimit(keyA, 2, 60_000).allowed).toBe(false);

    // keyB should still be allowed
    expect(rateLimit(keyB, 2, 60_000).allowed).toBe(true);
  });

  it("resets limit after the window expires", () => {
    vi.useFakeTimers();
    try {
      const key = `test_expire_${Math.random()}`;
      const windowMs = 5_000;

      // Exhaust limit of 2
      rateLimit(key, 2, windowMs);
      rateLimit(key, 2, windowMs);
      expect(rateLimit(key, 2, windowMs).allowed).toBe(false);

      // Advance time beyond the window
      vi.advanceTimersByTime(windowMs + 100);

      // Request should now be allowed in the new window
      const refreshed = rateLimit(key, 2, windowMs);
      expect(refreshed.allowed).toBe(true);
      expect(refreshed.retryAfterSeconds).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("calculates accurate retryAfterSeconds countdown", () => {
    vi.useFakeTimers();
    try {
      const key = `test_countdown_${Math.random()}`;
      const windowMs = 30_000;

      rateLimit(key, 1, windowMs);
      // Advance by 10s (20s remaining)
      vi.advanceTimersByTime(10_000);

      const blocked = rateLimit(key, 1, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ensures retryAfterSeconds is at least 1 second when blocked", () => {
    vi.useFakeTimers();
    try {
      const key = `test_min_retry_${Math.random()}`;
      const windowMs = 1_000;

      rateLimit(key, 1, windowMs);
      // Advance 900ms (100ms left -> ceil to 1s)
      vi.advanceTimersByTime(900);

      const blocked = rateLimit(key, 1, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("rateLimitResponseInit — HTTP 429 Header Construction", () => {
  it("creates proper 429 response init with Retry-After header", () => {
    const init = rateLimitResponseInit({ allowed: false, retryAfterSeconds: 45 });
    expect(init.status).toBe(429);
    expect(init.headers).toEqual({ "Retry-After": "45" });
  });

  it("handles 0 retryAfterSeconds gracefully", () => {
    const init = rateLimitResponseInit({ allowed: true, retryAfterSeconds: 0 });
    expect(init.status).toBe(429);
    expect(init.headers).toEqual({ "Retry-After": "0" });
  });
});
