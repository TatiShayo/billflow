"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  formatCurrency,
  type InvoiceWithRelations,
  type Currency,
} from "@/lib/types";
import Link from "next/link";

export default function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const supabase = createClient();

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvoice();
  }, [token]);

  async function loadInvoice() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${token}`);
      if (!res.ok) {
        setError("Invoice not found or link has expired");
      } else {
        const inv = await res.json();
        setInvoice(inv as InvoiceWithRelations);
      }
    } catch {
      setError("Failed to load invoice");
    }
    setLoading(false);
  }

  async function downloadPdf() {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf?token=${token}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoice.invoice_number || "download"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail for public page
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-sm w-full">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {error || "Invoice not found"}
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-4">
                Go to BillFlow
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = (invoice.currency as Currency) || "USD";
  const items = ((invoice as any).items || []) as any[];

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-bold tracking-tight text-sm">BillFlow</span>
          </Link>
        </div>

        <Card className="bg-white text-gray-900 shadow-lg overflow-hidden">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">INVOICE</h2>
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
              <Badge
                variant={
                  invoice.status === "paid" ? "secondary" : "outline"
                }
              >
                {invoice.status}
              </Badge>
            </div>

            {/* Bill To */}
            {invoice.client && (
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Bill To
                </p>
                <p className="font-semibold">{invoice.client.name}</p>
                {invoice.client.company && (
                  <p className="text-sm text-gray-600">
                    {invoice.client.company}
                  </p>
                )}
              </div>
            )}

            {/* Line items */}
            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-gray-200 text-left">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-3 text-sm">{item.description}</td>
                    <td className="py-3 text-sm text-right px-4 font-mono">
                      {Number(item.quantity)}
                    </td>
                    <td className="py-3 text-sm text-right px-4 font-mono">
                      {formatCurrency(
                        Number(item.unit_price),
                        currency
                      )}
                    </td>
                    <td className="py-3 text-sm text-right font-mono">
                      {formatCurrency(Number(item.amount), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-60 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(
                      Number(invoice.subtotal),
                      currency
                    )}
                  </span>
                </div>
                {Number(invoice.tax_amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Tax ({Number(invoice.tax_rate)}%)
                    </span>
                    <span className="font-mono">
                      {formatCurrency(
                        Number(invoice.tax_amount),
                        currency
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-200">
                  <span>Total</span>
                  <span className="font-mono">
                    {formatCurrency(
                      Number(invoice.total),
                      currency
                    )}
                  </span>
                </div>
              </div>
            </div>

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

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={downloadPdf}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2" disabled>
            Contact to Pay
          </Button>
        </div>
      </div>
    </div>
  );
}
