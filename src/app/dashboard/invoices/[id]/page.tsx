"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Download,
  Mail,
  Share2,
  CheckCircle,
  Pencil,
  Loader2,
  Building2,
  User,
  Phone,
  MailIcon,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatCurrency,
  getStatusColor,
  type InvoiceWithRelations,
  type InvoiceItem,
  type Currency,
} from "@/lib/types";
import { toast } from "sonner";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadInvoice();
  }, [user, id]);

  async function loadInvoice() {
    const { data: inv } = await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("id", id)
      .single();

    if (inv) {
      setInvoice(inv as InvoiceWithRelations);
      const { data: itemData } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order");
      setItems((itemData || []) as InvoiceItem[]);
    }
    setLoading(false);
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoice?.invoice_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
    setDownloading(false);
  }

  async function sendEmail() {
    if (!invoice?.client?.email) {
      toast.error("Client has no email address");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Send failed");
      toast.success("Invoice emailed to client");
    } catch {
      toast.error("Failed to send email");
    }
    setSending(false);
  }

  async function shareWhatsApp() {
    const { data: shareToken } = await supabase
      .from("share_tokens")
      .select("token")
      .eq("invoice_id", id)
      .single();
    const token = shareToken?.token || id;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const text = encodeURIComponent(
      `Hi! Here's my invoice for ${formatCurrency(Number(invoice?.total || 0), (invoice?.currency as Currency) || "USD")}: ${appUrl}/pay/${token}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function markAsPaid() {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Marked as paid");
    loadInvoice();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Invoice not found
      </div>
    );
  }

  const currency = invoice.currency as Currency;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/invoices")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Invoice {invoice.invoice_number}
            </h1>
            <Badge
              className={`mt-1 ${getStatusColor(invoice.status)}`}
              variant="secondary"
            >
              {invoice.status}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            onClick={sendEmail}
            disabled={sending}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Email
          </Button>
          <Button variant="outline" onClick={shareWhatsApp} className="gap-2">
            <Share2 className="h-4 w-4" /> WhatsApp
          </Button>
          {invoice.status !== "paid" && (
            <Button
              onClick={markAsPaid}
              className="bg-emerald-600 hover:bg-emerald-500 gap-2"
            >
              <CheckCircle className="h-4 w-4" /> Mark Paid
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/invoices/${invoice.id}/edit`)
            }
            className="gap-2"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      {/* Invoice preview card */}
      <Card className="bg-white text-gray-900 shadow-lg print:shadow-none overflow-hidden">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-10 mb-3"
                />
              ) : (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                    <span className="text-white font-bold text-sm">B</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    BillFlow
                  </span>
                </div>
              )}
              {profile?.company_name && (
                <p className="text-sm font-medium">{profile.company_name}</p>
              )}
              {profile?.address && (
                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">
                  {profile.address}
                </p>
              )}
              {profile?.phone && (
                <p className="text-xs text-gray-500">{profile.phone}</p>
              )}
              {profile?.tax_number && (
                <p className="text-xs text-gray-500 mt-1">
                  Tax #: {profile.tax_number}
                </p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                INVOICE
              </h2>
              <p className="text-lg font-mono text-gray-700 mt-1">
                #{invoice.invoice_number}
              </p>
              <div className="mt-3 space-y-0.5 text-sm text-gray-500">
                <p>
                  Issue:{" "}
                  {format(new Date(invoice.issue_date), "MMM d, yyyy")}
                </p>
                <p>
                  Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Bill To */}
          {invoice.client && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Bill To
              </p>
              <p className="font-semibold text-gray-900">
                {invoice.client.name}
              </p>
              {invoice.client.company && (
                <p className="text-sm text-gray-600">
                  {invoice.client.company}
                </p>
              )}
              {invoice.client.address && (
                <p className="text-sm text-gray-500 whitespace-pre-line">
                  {invoice.client.address}
                </p>
              )}
              {invoice.client.email && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MailIcon className="h-3 w-3" /> {invoice.client.email}
                </p>
              )}
              {invoice.client.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {invoice.client.phone}
                </p>
              )}
            </div>
          )}

          {/* Line items */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left">
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 w-full">
                  Description
                </th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right px-4">
                  Qty
                </th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right px-4">
                  Price
                </th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-gray-100">
                  <td className="py-3 text-sm text-gray-800">
                    {item.description}
                  </td>
                  <td className="py-3 text-sm text-gray-600 text-right px-4 font-mono">
                    {Number(item.quantity)}
                  </td>
                  <td className="py-3 text-sm text-gray-600 text-right px-4 font-mono">
                    {formatCurrency(Number(item.unit_price), currency)}
                  </td>
                  <td className="py-3 text-sm text-gray-800 text-right font-mono">
                    {formatCurrency(Number(item.amount), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-700">
                  {formatCurrency(Number(invoice.subtotal), currency)}
                </span>
              </div>
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Tax ({Number(invoice.tax_rate)}%)
                  </span>
                  <span className="font-mono text-gray-700">
                    {formatCurrency(Number(invoice.tax_amount), currency)}
                  </span>
                </div>
              )}
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-mono text-red-500">
                    -{formatCurrency(Number(invoice.discount_amount), currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
                <span>Total</span>
                <span className="font-mono text-gray-900">
                  {formatCurrency(Number(invoice.total), currency)}
                </span>
              </div>
              {invoice.status === "paid" && (
                <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
                  <p className="text-sm font-medium text-emerald-700">
                    Paid on{" "}
                    {invoice.paid_at
                      ? format(new Date(invoice.paid_at), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Notes
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {invoice.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
