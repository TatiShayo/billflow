import { describe, it, expect } from "vitest";
import {
  decideEventDedupe,
  parsePlanMetadata,
  resolvePlanFromPriceId,
  extractSubscriptionId,
  PG_UNIQUE_VIOLATION,
} from "./webhook-utils";

/**
 * ABUSE CHAIN (proven + fixed): webhook replay for a free tier upgrade.
 *
 * 1. Attacker (or Stripe retry) captures a legitimate signed webhook body for
 *    `checkout.session.completed` upgrading user X to "business".
 * 2. Signature verification PASSES on replay — the body+signature pair is
 *    still valid within Stripe's tolerance window, and retries are byte-identical.
 * 3. Pre-fix: every delivery re-ran the tier update and subscription upsert;
 *    combined with a concurrent downgrade (subscription.deleted), replays could
 *    resurrect a canceled paid tier.
 * 4. Fix: stripe_events ledger claims each event id under a PRIMARY KEY before
 *    any state change. The second delivery hits unique_violation 23505 and the
 *    handler returns 200 {duplicate:true} WITHOUT touching profiles.
 *
 * These tests lock the decision table that implements that fix.
 */
describe("decideEventDedupe — webhook replay protection", () => {
  it("first delivery (no insert error) → process", () => {
    expect(decideEventDedupe(null)).toBe("process");
    expect(decideEventDedupe(undefined)).toBe("process");
  });

  it("replayed delivery (unique violation on event id) → duplicate no-op", () => {
    expect(decideEventDedupe({ code: PG_UNIQUE_VIOLATION })).toBe("duplicate");
  });

  it("ledger unavailable → retry_later (500), never silently drop a billing event", () => {
    expect(decideEventDedupe({ code: "57P01" })).toBe("retry_later");
    expect(decideEventDedupe({})).toBe("retry_later");
  });
});

describe("parsePlanMetadata — metadata is untrusted at the webhook boundary", () => {
  it("accepts only whitelisted paid plans", () => {
    expect(parsePlanMetadata("pro")).toBe("pro");
    expect(parsePlanMetadata("business")).toBe("business");
  });

  it("rejects anything else (crafted metadata cannot invent a tier)", () => {
    expect(parsePlanMetadata("enterprise")).toBeNull();
    expect(parsePlanMetadata("free")).toBeNull();
    expect(parsePlanMetadata("")).toBeNull();
    expect(parsePlanMetadata(undefined)).toBeNull();
    expect(parsePlanMetadata({ plan: "pro" })).toBeNull();
  });
});

describe("resolvePlanFromPriceId", () => {
  const PRO = "price_pro_123";
  const BIZ = "price_biz_456";

  it("maps known price ids to tiers", () => {
    expect(resolvePlanFromPriceId(PRO, PRO, BIZ)).toBe("pro");
    expect(resolvePlanFromPriceId(BIZ, PRO, BIZ)).toBe("business");
  });

  it("unknown/foreign price ids downgrade to free, never grant a paid tier", () => {
    expect(resolvePlanFromPriceId("price_attacker", PRO, BIZ)).toBe("free");
    expect(resolvePlanFromPriceId(undefined, PRO, BIZ)).toBe("free");
    expect(resolvePlanFromPriceId(null, PRO, BIZ)).toBe("free");
    expect(resolvePlanFromPriceId("", PRO, BIZ)).toBe("free");
  });
});

describe("extractSubscriptionId — safe subscription retrieval", () => {
  it("accepts a plain id string", () => {
    expect(extractSubscriptionId("sub_123")).toBe("sub_123");
  });

  it("accepts an expanded subscription object", () => {
    expect(extractSubscriptionId({ id: "sub_456", status: "active" })).toBe("sub_456");
  });

  it("returns null for absent/malformed values instead of crashing the webhook", () => {
    expect(extractSubscriptionId(null)).toBeNull();
    expect(extractSubscriptionId(undefined)).toBeNull();
    expect(extractSubscriptionId("")).toBeNull();
    expect(extractSubscriptionId(42)).toBeNull();
    expect(extractSubscriptionId({ id: 42 })).toBeNull();
  });
});
