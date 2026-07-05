"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Download,
  Copy,
  Eye,
  Pencil,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatCurrency,
  getStatusColor,
  type InvoiceWithRelations,
  type InvoiceStatus,
  type Currency,
} from "@/lib/types";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export default function InvoicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [loading, setLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load invoices");
    } else {
      setInvoices((data || []) as InvoiceWithRelations[]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  async function duplicateInvoice(inv: InvoiceWithRelations) {
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        user_id: user!.id,
        client_id: inv.client_id,
        invoice_number: `${inv.invoice_number}-COPY`,
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .split("T")[0],
        subtotal: inv.subtotal,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount,
        total: inv.total,
        currency: inv.currency,
        notes: inv.notes,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to duplicate");
      return;
    }

    // Copy line items
    const { data: items } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("sort_order");

    if (items && data) {
      await supabase.from("invoice_items").insert(
        items.map((item) => ({
          invoice_id: data.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: item.sort_order,
        }))
      );
    }

    toast.success("Invoice duplicated");
    loadInvoices();
  }

  async function markAsPaid(id: string) {
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Marked as paid");
    loadInvoices();
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Invoice deleted");
    loadInvoices();
  }

  function exportCSV() {
    const rows = [
      ["Invoice #", "Client", "Amount", "Status", "Issue Date", "Due Date"],
      ...filtered.map((inv) => [
        inv.invoice_number,
        inv.client?.name || "",
        inv.total.toString(),
        inv.status,
        inv.issue_date,
        inv.due_date,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = invoices.filter((inv) => {
    const s = search.toLowerCase();
    const matchesSearch =
      !s ||
      inv.invoice_number.toLowerCase().includes(s) ||
      inv.client?.name?.toLowerCase().includes(s) ||
      inv.client?.company?.toLowerCase().includes(s);

    const matchesStatus =
      statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link href="/dashboard/invoices/new">
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2" size="sm">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices or clients..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-card">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt.value
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border">
          <div className="col-span-3">Invoice</div>
          <div className="col-span-2">Client</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-2 text-right">Due</div>
          <div className="col-span-1" />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">
              {search || statusFilter !== "all"
                ? "No invoices match your filters"
                : "No invoices yet"}
            </p>
          </div>
        ) : (
          filtered.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border/50 last:border-0 items-center hover:bg-muted/30 transition-colors"
            >
              <Link
                href={`/dashboard/invoices/${inv.id}`}
                className="col-span-3"
              >
                <p className="font-mono text-sm font-medium">
                  {inv.invoice_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  {inv.issue_date
                    ? format(new Date(inv.issue_date), "MMM d, yyyy")
                    : "—"}
                </p>
              </Link>
              <div className="col-span-2 text-sm truncate">
                {inv.client?.name || "—"}
              </div>
              <div className="col-span-2 text-right font-mono text-sm">
                {formatCurrency(Number(inv.total), inv.currency as Currency)}
              </div>
              <div className="col-span-2 flex justify-center">
                <Badge className={`text-xs ${getStatusColor(inv.status)}`} variant="secondary">
                  {inv.status}
                </Badge>
              </div>
              <div className="col-span-2 text-right text-sm text-muted-foreground">
                {format(new Date(inv.due_date), "MMM d, yyyy")}
              </div>
              <div className="col-span-1 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/dashboard/invoices/${inv.id}`)
                      }
                    >
                      <Eye className="h-4 w-4 mr-2" /> View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/dashboard/invoices/${inv.id}/edit`)
                      }
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateInvoice(inv)}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    {inv.status !== "paid" && (
                      <DropdownMenuItem onClick={() => markAsPaid(inv.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Mark paid
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={() => deleteInvoice(inv.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
