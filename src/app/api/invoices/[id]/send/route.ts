import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!invoice.client?.email) {
    return NextResponse.json(
      { error: "Client has no email address" },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, company_email")
    .eq("id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const resend = getResend();
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = profile?.company_name || "BillFlow";

    // Get share token for the pay link
    const { data: shareToken } = await supabase
      .from("share_tokens")
      .select("token")
      .eq("invoice_id", id)
      .single();

    const payToken = shareToken?.token || invoice.payment_token || id;

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: invoice.client.email,
      subject: `Invoice ${invoice.invoice_number} from ${profile?.company_name || "BillFlow"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
          <div style="background: #111a17; border-radius: 12px; padding: 32px; color: white;">
            <h1 style="margin: 0 0 4px; font-size: 24px;">BillFlow</h1>
            <p style="margin: 0; color: #10b981; font-size: 13px;">Simple Invoicing for Freelancers</p>
          </div>
          <div style="padding: 32px; background: white; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111; margin: 0 0 16px;">Invoice ${invoice.invoice_number}</h2>
            <p style="color: #555; line-height: 1.6;">Hi ${invoice.client.name},</p>
            <p style="color: #555; line-height: 1.6;">
              ${profile?.company_name || "A freelancer"} has sent you an invoice for <strong style="color: #111;">$${Number(invoice.total).toFixed(2)}</strong>, due ${new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            </p>
            <a href="${appUrl}/pay/${payToken}" style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; font-size: 15px;">View Invoice</a>
            <p style="color: #888; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">Sent via <strong>BillFlow</strong> — Simple invoicing for freelancers</p>
          </div>
        </div>
      `,
    });

    // Update status to sent
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
