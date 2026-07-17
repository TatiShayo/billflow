import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripe, getProPriceId, getBusinessPriceId } from "@/lib/stripe";
import { rateLimit, rateLimitResponseInit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  // Client sends INTENT (a plan name); price comes from server-side env config.
  plan: z.enum(["pro", "business"]),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = rateLimit(`checkout:${user.id}`, 10, 60_000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponseInit(limited)
      );
    }

    const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const { plan } = parsed.data;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    const stripe = getStripe();

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      // Must use the service-role client: the hardened RLS UPDATE policy
      // freezes stripe_customer_id for end users, so the user-scoped client's
      // write was silently rejected — every checkout minted a duplicate
      // Stripe customer. Check the error so a failure surfaces.
      const admin = createServiceClient();
      const { error: linkError } = await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (linkError) {
        console.error("Failed to link Stripe customer:", linkError);
        return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
      }
    }

    const priceId =
      plan === "pro" ? getProPriceId() : getBusinessPriceId();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing`,
      metadata: { userId: user.id, plan },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}
