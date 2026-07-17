import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Account is pinned to acacia; SDK types only describe the latest version.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2025-06-02.acacia" as any,
      // Retry transient network failures on Stripe calls (idempotent by
      // default for GET/retrieve; Stripe SDK adds idempotency keys for POST).
      maxNetworkRetries: 2,
    });
  }
  return _stripe;
}

export { getStripe }

export function getProPriceId() {
  return process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID!;
}

export function getBusinessPriceId() {
  return process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID!;
}
