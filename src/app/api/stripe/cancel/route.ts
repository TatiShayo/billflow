import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { rateLimit, rateLimitResponseInit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`cancel:${user.id}`, 5, 60_000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponseInit(limited)
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profile?.stripe_customer_id) {
      const stripe = getStripe();
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        limit: 1,
        status: "active",
      });

      if (subscriptions.data.length > 0) {
        await stripe.subscriptions.cancel(subscriptions.data[0].id);
      }
    }

    // Immediate downgrade for UX; the customer.subscription.deleted webhook is
    // the source of truth and re-applies "free" idempotently. Service-role
    // client required — RLS freezes subscription_tier for user-scoped writes.
    const admin = createServiceClient();
    const { error: tierError } = await admin
      .from("profiles")
      .update({ subscription_tier: "free" })
      .eq("id", user.id);
    if (tierError) {
      console.error("Cancel downgrade failed (webhook will settle):", tierError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "Failed to cancel" },
      { status: 500 }
    );
  }
}
