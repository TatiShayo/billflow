import { getStripe, getProPriceId, getBusinessPriceId } from "@/lib/stripe";
import {
  decideEventDedupe,
  parsePlanMetadata,
  resolvePlanFromPriceId,
  extractSubscriptionId,
} from "@/lib/webhook-utils";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard — Stripe retries deliveries and an attacker can replay a
  // captured webhook body+signature. Claim the event id first; a duplicate hits
  // the primary-key conflict and we return 200 without re-applying tier changes.
  const { error: dedupeError } = await supabaseAdmin
    .from("stripe_events")
    .insert({ event_id: event.id, type: event.type });

  const decision = decideEventDedupe(dedupeError);
  if (decision === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (decision === "retry_later") {
    console.error("Webhook idempotency check failed:", dedupeError);
    return NextResponse.json({ error: "Ledger unavailable" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = parsePlanMetadata(session.metadata?.plan);

        if (userId && plan) {
          const { error: tierError } = await supabaseAdmin
            .from("profiles")
            .update({ subscription_tier: plan })
            .eq("id", userId);
          if (tierError) throw tierError;

          // Record subscription — retrieve safely: `session.subscription` may be
          // an id string or an expanded object, and the retrieve itself can fail
          // (network / deleted sub). A failure here throws → ledger row released
          // below → Stripe redelivers, instead of half-applied state.
          const subscriptionId = extractSubscriptionId(session.subscription);
          if (subscriptionId) {
            const stripe = getStripe();
            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId);

            const periodEnd = (
              subscription as unknown as { current_period_end?: number }
            ).current_period_end;

            const { error: subError } = await supabaseAdmin
              .from("subscriptions")
              .upsert(
                {
                  user_id: userId,
                  stripe_subscription_id: subscriptionId,
                  plan,
                  status: subscription.status,
                  current_period_end: periodEnd
                    ? new Date(periodEnd * 1000).toISOString()
                    : null,
                },
                { onConflict: "stripe_subscription_id" }
              );
            if (subError) throw subError;
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: subs } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (subs) {
          const planId = subscription.items?.data?.[0]?.price?.id;
          const planName = resolvePlanFromPriceId(
            planId,
            getProPriceId(),
            getBusinessPriceId()
          );

          const status = subscription.status;
          if (status === "active" || status === "trialing") {
            const periodEnd = (
              subscription as unknown as { current_period_end?: number }
            ).current_period_end;

            const { error: subError } = await supabaseAdmin
              .from("subscriptions")
              .update({
                status,
                plan: planName,
                current_period_end: periodEnd
                  ? new Date(periodEnd * 1000).toISOString()
                  : null,
              })
              .eq("stripe_subscription_id", subscription.id);
            if (subError) throw subError;

            const { error: tierError } = await supabaseAdmin
              .from("profiles")
              .update({ subscription_tier: planName })
              .eq("id", subs.user_id);
            if (tierError) throw tierError;
          } else if (
            status === "canceled" ||
            status === "unpaid" ||
            status === "past_due"
          ) {
            const { error: tierError } = await supabaseAdmin
              .from("profiles")
              .update({ subscription_tier: "free" })
              .eq("id", subs.user_id);
            if (tierError) throw tierError;

            const { error: subError } = await supabaseAdmin
              .from("subscriptions")
              .update({ status })
              .eq("stripe_subscription_id", subscription.id);
            if (subError) throw subError;
          }
        }
        break;
      }
    }
  } catch (err) {
    // Release the idempotency claim so Stripe's retry actually reprocesses the
    // event — otherwise a transient failure would leave the event marked as
    // handled while none of its writes were applied.
    console.error(`Webhook processing failed for ${event.id}:`, err);
    await supabaseAdmin.from("stripe_events").delete().eq("event_id", event.id);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
