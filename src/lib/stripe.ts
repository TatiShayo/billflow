import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
      apiVersion: "2025-06-02.acacia" as any,
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
