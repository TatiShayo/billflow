import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Only the fields the public pay page renders — a full "*" select here leaked
    // internal columns (user_id, payment_token, client contact details) to anyone
    // holding a share link.
    const PUBLIC_INVOICE_FIELDS =
      "id, invoice_number, issue_date, due_date, status, currency, subtotal, tax_amount, tax_rate, total, notes, " +
      "client:clients(name, company), items:invoice_items(description, quantity, unit_price, amount)";

    // First, check by payment_token
    let { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select(PUBLIC_INVOICE_FIELDS)
      .eq("payment_token", token)
      .single();

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
