/**
 * Pure helpers for the Stripe webhook — extracted so the replay/idempotency
 * and plan-resolution decisions are unit-testable without a live DB or Stripe.
 */

/** Postgres unique_violation — the event id already exists in stripe_events. */
export const PG_UNIQUE_VIOLATION = "23505";

export type DedupeDecision = "process" | "duplicate" | "retry_later";

/**
 * Decide what to do after attempting to claim a Stripe event id in the
 * stripe_events ledger.
 *
 *  - insert succeeded (no error)      → "process"      (first delivery)
 *  - unique violation                 → "duplicate"    (replay/retry → no-op, 200)
 *  - any other DB error               → "retry_later"  (500 so Stripe redelivers;
 *                                        never silently drop a billing event)
 */
export function decideEventDedupe(
  insertError: { code?: string } | null | undefined
): DedupeDecision {
  if (!insertError) return "process";
  if (insertError.code === PG_UNIQUE_VIOLATION) return "duplicate";
  return "retry_later";
}

/** Plans a checkout-session metadata blob may legitimately carry. */
export const VALID_PLANS = ["pro", "business"] as const;
export type PaidPlan = (typeof VALID_PLANS)[number];

/**
 * Validate the plan taken from checkout-session metadata. Metadata is written
 * by our own checkout route, but treat it as untrusted at the webhook boundary:
 * anything outside the whitelist is rejected rather than written to profiles.
 */
export function parsePlanMetadata(plan: unknown): PaidPlan | null {
  return VALID_PLANS.includes(plan as PaidPlan) ? (plan as PaidPlan) : null;
}

/**
 * Map a Stripe price id from a subscription event back to a tier name.
 * Unknown price ids resolve to "free" — an attacker-attached foreign price can
 * never grant a paid tier.
 */
export function resolvePlanFromPriceId(
  priceId: string | undefined | null,
  proPriceId: string,
  businessPriceId: string
): "free" | PaidPlan {
  if (priceId && priceId === proPriceId) return "pro";
  if (priceId && priceId === businessPriceId) return "business";
  return "free";
}

/**
 * Stripe may deliver `session.subscription` as an id string or an expanded
 * object depending on API version/expansion. Normalize to the id, or null if
 * absent/malformed — callers must handle null instead of crashing mid-webhook.
 */
export function extractSubscriptionId(sub: unknown): string | null {
  if (typeof sub === "string" && sub.length > 0) return sub;
  if (sub && typeof sub === "object" && typeof (sub as { id?: unknown }).id === "string") {
    return (sub as { id: string }).id;
  }
  return null;
}
