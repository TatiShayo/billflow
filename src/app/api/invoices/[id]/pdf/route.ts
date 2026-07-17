import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { parseInvoiceDate } from "@/lib/invoice-utils";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 48 },
  headerLeft: { maxWidth: "50%" },
  headerRight: { alignItems: "flex-end" },
  companyName: { fontSize: 20, fontWeight: "bold", color: "#111" },
  invoiceTitle: { fontSize: 32, fontWeight: "bold" },
  invoiceNumber: { fontSize: 18, color: "#555", marginTop: 4 },
  billToLabel: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#888", marginBottom: 4 },
  billToName: { fontSize: 15, fontWeight: "bold" },
  textSm: { fontSize: 13, color: "#555", marginTop: 2 },
  table: { marginTop: 40, marginBottom: 20 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#e5e5e5", paddingBottom: 12 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", paddingVertical: 12 },
  thDesc: { flex: 3, fontSize: 10, fontWeight: "bold", color: "#888" },
  thQty: { flex: 1, fontSize: 10, fontWeight: "bold", color: "#888", textAlign: "right", paddingRight: 12 },
  thPrice: { flex: 1, fontSize: 10, fontWeight: "bold", color: "#888", textAlign: "right", paddingRight: 12 },
  thAmount: { flex: 1, fontSize: 10, fontWeight: "bold", color: "#888", textAlign: "right" },
  tdDesc: { flex: 3, fontSize: 14 },
  tdQty: { flex: 1, fontSize: 14, textAlign: "right", paddingRight: 12 },
  tdPrice: { flex: 1, fontSize: 14, textAlign: "right", paddingRight: 12 },
  tdAmount: { flex: 1, fontSize: 14, textAlign: "right" },
  totalsWrapper: { alignItems: "flex-end", marginTop: 20 },
  totalsContainer: { width: 280 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, fontSize: 14 },
  totalsRowTotal: {
    flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6,
    fontSize: 20, fontWeight: "bold", borderTopWidth: 2, borderTopColor: "#e5e5e5",
  },
  paidStamp: {
    borderWidth: 3, borderColor: "#10b981", color: "#10b981",
    paddingVertical: 8, paddingHorizontal: 20, fontSize: 18, fontWeight: "bold",
    textTransform: "uppercase", borderRadius: 8, alignSelf: "flex-start", marginTop: 24,
  },
  notes: { marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#e5e5e5" },
  notesLabel: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase", color: "#888", marginBottom: 6 },
  notesText: { fontSize: 13, color: "#555", lineHeight: 1.5 },
  mutedText: { color: "#888" },
  redText: { color: "#ef4444" },
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A share token that has an expiry and is past it must not authorize access.
  const isShareTokenValid = (st: { expires_at: string | null } | null) =>
    !!st && (!st.expires_at || new Date(st.expires_at).getTime() > Date.now());

  let invoice;
  if (user) {
    // Authenticated path: ownership enforced explicitly (and by RLS).
    const { data } = await supabase
      .from("invoices")
      .select("*, client:clients(*), items:invoice_items(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    invoice = data;
  } else {
    // Unauthenticated path: authorization = possession of an unguessable token.
    // Must use the service-role client — the anon client is blocked by RLS, so
    // this branch previously always 404'd (share-link PDFs were dead).
    const admin = createServiceClient();

    // Check if the parameter 'id' itself is a share token
    const { data: shareToken } = await admin
      .from("share_tokens")
      .select("invoice_id, expires_at")
      .eq("token", id)
      .single();

    if (isShareTokenValid(shareToken)) {
      const { data } = await admin
        .from("invoices")
        .select("*, client:clients(*), items:invoice_items(*)")
        .eq("id", shareToken!.invoice_id)
        .single();
      invoice = data;
    } else if (token) {
      // Check if query param token is the payment_token
      const { data } = await admin
        .from("invoices")
        .select("*, client:clients(*), items:invoice_items(*)")
        .eq("id", id)
        .eq("payment_token", token)
        .single();
      invoice = data;

      if (!invoice) {
        // Check if query param token is a share token for THIS invoice
        const { data: shareTokenByQuery } = await admin
          .from("share_tokens")
          .select("invoice_id, expires_at")
          .eq("token", token)
          .eq("invoice_id", id)
          .single();

        if (isShareTokenValid(shareTokenByQuery)) {
          const { data: sharedInvoice } = await admin
            .from("invoices")
            .select("*, client:clients(*), items:invoice_items(*)")
            .eq("id", id)
            .single();
          invoice = sharedInvoice;
        }
      }
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Company header comes from the invoice OWNER's profile. For token access,
  // fetch it via service role (the anon client cannot read profiles).
  const profileClient = user ? supabase : createServiceClient();
  const { data: profile } = await profileClient
    .from("profiles")
    .select("company_name, address, phone, tax_number")
    .eq("id", user ? user.id : invoice.user_id)
    .single();

  interface PdfItem {
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }
  const items = (invoice.items || []) as PdfItem[];
  const currency: string = invoice.currency || "USD";

  const headerLeftChildren: React.ReactElement[] = [
    React.createElement(Text, { key: "cn", style: styles.companyName }, profile?.company_name || "BillFlow"),
  ];
  if (profile?.address) headerLeftChildren.push(React.createElement(Text, { key: "addr", style: styles.textSm }, profile.address));
  if (profile?.phone) headerLeftChildren.push(React.createElement(Text, { key: "ph", style: styles.textSm }, profile.phone));
  if (profile?.tax_number) headerLeftChildren.push(React.createElement(Text, { key: "tax", style: { ...styles.textSm, marginTop: 4 } }, `Tax #: ${profile.tax_number}`));

  const headerRight = React.createElement(View, { style: styles.headerRight },
    React.createElement(Text, { style: styles.invoiceTitle }, "INVOICE"),
    React.createElement(Text, { style: styles.invoiceNumber }, `#${invoice.invoice_number}`),
    React.createElement(Text, { style: { ...styles.textSm, marginTop: 12 } }, `Issue: ${format(parseInvoiceDate(invoice.issue_date), "MMM d, yyyy")}`),
    React.createElement(Text, { style: styles.textSm }, `Due: ${format(parseInvoiceDate(invoice.due_date), "MMM d, yyyy")}`),
  );

  const header = React.createElement(View, { key: "header", style: styles.header },
    React.createElement(View, { key: "left", style: styles.headerLeft }, ...headerLeftChildren),
    headerRight,
  );

  const pageChildren: React.ReactElement[] = [header];

  if (invoice.client) {
    const bc: React.ReactElement[] = [
      React.createElement(Text, { key: "label", style: styles.billToLabel }, "Bill To"),
      React.createElement(Text, { key: "name", style: styles.billToName }, invoice.client.name),
    ];
    if (invoice.client.company) bc.push(React.createElement(Text, { key: "comp", style: styles.textSm }, invoice.client.company));
    if (invoice.client.address) bc.push(React.createElement(Text, { key: "addr", style: styles.textSm }, invoice.client.address));
    if (invoice.client.email) bc.push(React.createElement(Text, { key: "email", style: { ...styles.textSm, marginTop: 4 } }, invoice.client.email));
    pageChildren.push(React.createElement(View, { key: "billTo" }, ...bc));
  }

  const tableRows: React.ReactElement[] = [
    React.createElement(View, { key: "thead", style: styles.tableHeader },
      React.createElement(Text, { style: styles.thDesc }, "Description"),
      React.createElement(Text, { style: styles.thQty }, "Qty"),
      React.createElement(Text, { style: styles.thPrice }, "Price"),
      React.createElement(Text, { style: styles.thAmount }, "Amount"),
    ),
  ];

  for (const item of items) {
    tableRows.push(
      React.createElement(View, { key: item.id || Math.random(), style: styles.tableRow },
        React.createElement(Text, { style: styles.tdDesc }, item.description),
        React.createElement(Text, { style: styles.tdQty }, String(Number(item.quantity))),
        React.createElement(Text, { style: styles.tdPrice }, formatAmount(Number(item.unit_price), currency)),
        React.createElement(Text, { style: styles.tdAmount }, formatAmount(Number(item.amount), currency)),
      )
    );
  }

  pageChildren.push(React.createElement(View, { key: "table", style: styles.table }, ...tableRows));

  const totalsRows: React.ReactElement[] = [
    React.createElement(View, { key: "subtotal", style: styles.totalsRow },
      React.createElement(Text, { style: styles.mutedText }, "Subtotal"),
      React.createElement(Text, {}, formatAmount(Number(invoice.subtotal), currency)),
    ),
  ];

  if (Number(invoice.tax_amount) > 0) {
    totalsRows.push(React.createElement(View, { key: "tax", style: styles.totalsRow },
      React.createElement(Text, { style: styles.mutedText }, `Tax (${Number(invoice.tax_rate)}%)`),
      React.createElement(Text, {}, formatAmount(Number(invoice.tax_amount), currency)),
    ));
  }

  if (Number(invoice.discount_amount) > 0) {
    totalsRows.push(React.createElement(View, { key: "discount", style: styles.totalsRow },
      React.createElement(Text, { style: styles.mutedText }, "Discount"),
      React.createElement(Text, { style: styles.redText }, `-${formatAmount(Number(invoice.discount_amount), currency)}`),
    ));
  }

  totalsRows.push(React.createElement(View, { key: "total", style: styles.totalsRowTotal },
    React.createElement(Text, {}, "Total"),
    React.createElement(Text, {}, formatAmount(Number(invoice.total), currency)),
  ));

  pageChildren.push(React.createElement(View, { key: "totalsWrapper", style: styles.totalsWrapper },
    React.createElement(View, { key: "totals", style: styles.totalsContainer }, ...totalsRows),
  ));

  if (invoice.status === "paid") {
    pageChildren.push(React.createElement(Text, { key: "paid", style: styles.paidStamp }, "PAID"));
  }

  if (invoice.notes) {
    pageChildren.push(React.createElement(View, { key: "notes", style: styles.notes },
      React.createElement(Text, { style: styles.notesLabel }, "Notes"),
      React.createElement(Text, { style: styles.notesText }, invoice.notes),
    ));
  }

  const doc = React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page }, ...pageChildren),
  );

  const pdfBuffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
