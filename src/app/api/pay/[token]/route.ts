import { rateLimit, rateLimitResponseInit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token input: non-empty, no control chars or null bytes, reasonable length
    if (!token || typeof token !== "string" || token.length > 128 || /[\x00-\x1F\x7F]/.test(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // Rate limit per token to mitigate brute-force enumeration attacks
    const limited = rateLimit(`pay_token:${token.slice(0, 32)}`, 60, 60_000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponseInit(limited)
      );
    }

    const supabaseAdmin = createServiceClient();
    // Only the fields the public pay page renders — a full "*" select here leaked
    // internal columns (user_id, payment_token, client contact details) to anyone
    // holding a share link.
    const PUBLIC_INVOICE_FIELDS =
      "id, invoice_number, issue_date, due_date, status, currency, subtotal, tax_amount, tax_rate, total, notes, " +
      "client:clients(name, company), items:invoice_items(description, quantity, unit_price, amount)";

    // The `payment_token` column is `uuid_generate_v4()` with no expiry of its
    // own. Without an explicit bound, a URL that leaks (email forward, support
    // ticket, browser history) is a permanent read credential. Honour a
    // coarser 90-day ceiling on the token so a leak has a bounded lifetime.
    const PAYMENT_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
    const tokenIssuedAfter = new Date(Date.now() - PAYMENT_TOKEN_MAX_AGE_MS).toISOString();

    // First, check by payment_token
    let { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select(PUBLIC_INVOICE_FIELDS)
      .eq("payment_token", token)
      .gte("created_at", tokenIssuedAfter)
      .maybeSingle();

    if (!invoice) {
      // Check by share_token
      const { data: shareToken } = await supabaseAdmin
        .from("share_tokens")
        .select("invoice_id, expires_at")
        .eq("token", token)
        .single();

      // Expired share tokens must not authorize access.
      const shareTokenValid =
        shareToken &&
        (!shareToken.expires_at ||
          new Date(shareToken.expires_at).getTime() > Date.now());

      if (shareTokenValid) {
        const { data: sharedInvoice } = await supabaseAdmin
          .from("invoices")
          .select(PUBLIC_INVOICE_FIELDS)
          .eq("id", shareToken.invoice_id)
          .single();
        invoice = sharedInvoice;
      }
    }

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Fetch pay invoice error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}
