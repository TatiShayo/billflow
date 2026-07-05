import { getStripe, getProPriceId, getBusinessPriceId } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

let _supabaseAdmin: any = null;

function getSupabaseAdmin() {
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
  const signature = request.headers.get("stripe-signature")!;

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const session = event.data.object as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_tier: plan })
          .eq("id", userId);

        // Record subscription
        if (session.subscription) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );

          await supabaseAdmin.from("subscriptions").upsert({
            user_id: userId,
            stripe_subscription_id: session.subscription,
            plan,
            status: subscription.status,
            current_period_end: new Date(
              (subscription as any).current_period_end * 1000
            ).toISOString(),
          });
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", session.id)
        .single();

      if (subs) {
        const planId = session.items?.data?.[0]?.price?.id;
        let planName = "free";
        if (planId === getProPriceId()) {
          planName = "pro";
        } else if (planId === getBusinessPriceId()) {
          planName = "business";
        }

        if (session.status === "active" || session.status === "trialing") {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: session.status,
              plan: planName,
              current_period_end: new Date(
                (session as any).current_period_end * 1000
              ).toISOString(),
            })
            .eq("stripe_subscription_id", session.id);

          await supabaseAdmin
            .from("profiles")
            .update({ subscription_tier: planName })
            .eq("id", subs.user_id);
        } else if (
          session.status === "canceled" ||
          session.status === "unpaid" ||
          session.status === "past_due"
        ) {
          await supabaseAdmin
            .from("profiles")
            .update({ subscription_tier: "free" })
            .eq("id", subs.user_id);

          await supabaseAdmin
            .from("subscriptions")
            .update({ status: session.status })
            .eq("stripe_subscription_id", session.id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
