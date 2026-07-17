"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Save,
  Send,
  Eye,
  Calculator,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatCurrency,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  type Invoice,
  type InvoiceItem,
  type Currency,
  type Client,
  type AiInvoiceResult,
  TIER_LIMITS,
} from "@/lib/types";

import { toast } from "sonner";
import { calculateInvoiceTotals } from "@/lib/invoice-utils";

interface LineItem {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceEditorProps {
  invoiceId?: string;
}

export function InvoiceEditor({ invoiceId }: InvoiceEditorProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!invoiceId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("manual");

  // Form state
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [currency, setCurrency] = useState<Currency>(
    (profile?.default_currency as Currency) || "USD"
  );
  const [taxRate, setTaxRate] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    "fixed"
  );
  const [discountValue, setDiscountValue] = useState("0");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [lineItems, setLineItems] = useState<LineItem[]>(() => [
    { key: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
  ]);

  // AI state
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  async function loadData() {
    setLoading(true);

    // Load clients
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user!.id)
      .order("name");

    setClients(clientData || []);

    if (invoiceId) {
      // Load invoice
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoice) {
        setClientId(invoice.client_id || "");
        setInvoiceNumber(invoice.invoice_number);
        setIssueDate(invoice.issue_date);
        setDueDate(invoice.due_date);
        setCurrency(invoice.currency as Currency);
        setTaxRate(invoice.tax_rate.toString());
        setNotes(invoice.notes || "");
        setStatus(invoice.status);

        // Load items
        const { data: items } = await supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("sort_order");

        if (items && items.length > 0) {
          setLineItems(
            items.map((item) => ({
              key: crypto.randomUUID(),
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
            }))
          );
        }

        // Determine discount
        if (Number(invoice.discount_amount) > 0) {
          setDiscountType("fixed");
          setDiscountValue(invoice.discount_amount.toString());
        }
      }
    } else {
      // Generate invoice number
      const prefix = profile?.invoice_prefix || "INV";
      const next = profile?.next_invoice_number || 1;
      const num = `${prefix}-${String(next).padStart(4, "0")}`;
      setInvoiceNumber(num);
    }

    setLoading(false);
  }

  // Load invoice if editing
  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invoiceId]);

  // Calculate totals with safe money rounding
  const { subtotal, taxAmount, discountAmount, total } = calculateInvoiceTotals(
    lineItems,
    taxRate,
    discountType,
    discountValue
  );

  function addLineItem() {
    setLineItems([
      ...lineItems,
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function removeLineItem(key: string) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.key !== key));
  }

  function updateLineItem(
    key: string,
    field: keyof LineItem,
    value: string | number
  ) {
    setLineItems(
      lineItems.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  }

  async function saveInvoice(newStatus?: string) {
    setSaving(true);
    const finalStatus = newStatus || status;

    const invoicePayload = {
      user_id: user!.id,
      client_id: clientId || null,
      invoice_number: invoiceNumber,
      status: finalStatus,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal,
      tax_rate: Number(taxRate),
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      currency,
      notes: notes || null,
      ...(finalStatus === "paid"
        ? { paid_at: new Date().toISOString() }
        : {}),
    };

    let invoiceData: Invoice | null = null;

    if (isEditing) {
      const { data, error } = await supabase
        .from("invoices")
        .update(invoicePayload)
        .eq("id", invoiceId!)
        .select()
        .single();

      if (error) {
        toast.error("Failed to save");
        setSaving(false);
        return;
      }
      invoiceData = data as Invoice;

      // Delete old items and re-insert
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    } else {
      const { data, error } = await supabase
        .from("invoices")
        .insert(invoicePayload)
        .select()
        .single();

      if (error) {
        toast.error("Failed to save");
        setSaving(false);
        return;
      }
      invoiceData = data as Invoice;

      // Increment invoice number
      await supabase
        .from("profiles")
        .update({ next_invoice_number: (profile?.next_invoice_number || 1) + 1 })
        .eq("id", user!.id);
    }

    // Save line items
    if (invoiceData) {
      await supabase.from("invoice_items").insert(
        lineItems.map((item, idx) => ({
          invoice_id: invoiceData!.id,
          description: item.description || "Untitled item",
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          sort_order: idx,
        }))
      );
    }

    toast.success(
      finalStatus === "sent" ? "Invoice sent!" : "Invoice saved"
    );
    setSaving(false);

    if (invoiceData) {
      if (finalStatus === "sent") {
        // Trigger email send
        try {
          await fetch(`/api/invoices/${invoiceData.id}/send`, { method: "POST" });
        } catch {}
        router.push(`/dashboard/invoices/${invoiceData.id}`);
      } else if (!isEditing) {
        router.push(`/dashboard/invoices/${invoiceData.id}`);
      }
    }
  }

  async function handleAiGenerate() {
    if (!aiDescription.trim()) {
      toast.error("Please describe the work done");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription, currency }),
      });

      if (!res.ok) throw new Error("AI generation failed");

      const result: AiInvoiceResult = await res.json();

      setLineItems(
        result.items.map((item) => ({
          key: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      );

      if (result.notes) {
        setNotes(result.notes);
      }

      setMode("manual");
      toast.success("AI generated invoice items");
    } catch {
      toast.error("AI generation failed. Try again.");
    }
    setAiLoading(false);
  }

  async function addNewClient() {
    if (!newClientName.trim()) return;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: user!.id,
        name: newClientName,
        email: newClientEmail || null,
        currency,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add client");
      return;
    }

    setClients([...clients, data as Client]);
    setClientId(data.id);
    setNewClientName("");
    setNewClientEmail("");
    setShowNewClient(false);
    toast.success("Client added");
  }

  const tier = (profile?.subscription_tier || "free") as keyof typeof TIER_LIMITS;
  const canUseAi = TIER_LIMITS[tier].aiGenerator;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/invoices")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Invoice" : "New Invoice"}
          </h1>
          <p className="text-sm text-muted-foreground">{invoiceNumber}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveInvoice("draft")}
            disabled={saving}
            className="gap-2"
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button
            onClick={() => saveInvoice("sent")}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Invoice
          </Button>
        </div>
      </div>

      {canUseAi && (
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "manual" | "ai")}
        >
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="manual" className="flex-1">
              Manual
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI Generator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-base">
                    Describe the work you did
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Be specific — mention hours, deliverables, rates, and any
                    special terms
                  </p>
                  <Textarea
                    placeholder='e.g. "I built a Shopify store over 3 weeks at $75/hr, did logo design ($500 flat), and a 1hr strategy call at $150"'
                    className="min-h-[120px]"
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiDescription.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 gap-2"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate Invoice
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="space-y-6">
        {/* Client & Invoice details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Client</Label>
            {!showNewClient ? (
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={(v) => setClientId(v || "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewClient(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Input
                  placeholder="Client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500"
                    onClick={addNewClient}
                  >
                    Add Client
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewClient(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Invoice number</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Issue date</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex gap-1 mt-1">
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    const d = new Date(issueDate);
                    d.setDate(d.getDate() + days);
                    setDueDate(d.toISOString().split("T")[0]);
                  }}
                  className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/50 transition-colors"
                >
                  Net {days}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as Currency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} ({CURRENCY_SYMBOLS[c]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-3">
          <Label>Line items</Label>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Unit price</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1" />
            </div>
            {lineItems.map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-12 gap-2 px-4 py-2 border-t border-border/50 items-center"
              >
                <div className="col-span-5">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(item.key, "description", e.target.value)
                    }
                    className="border-0 bg-transparent h-8 p-0 focus-visible:ring-0"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(
                        item.key,
                        "quantity",
                        Number(e.target.value) || 0
                      )
                    }
                    className="border-0 bg-transparent h-8 p-0 focus-visible:ring-0"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateLineItem(
                        item.key,
                        "unitPrice",
                        Number(e.target.value) || 0
                      )
                    }
                    className="border-0 bg-transparent h-8 p-0 focus-visible:ring-0"
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-sm">
                  {formatCurrency(
                    item.quantity * item.unitPrice,
                    currency
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeLineItem(item.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addLineItem}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add line item
          </Button>
        </div>

        {/* Tax & Discount */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tax rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Discount</Label>
            <div className="flex gap-1">
              <Select
                value={discountType}
                onValueChange={(v) =>
                  setDiscountType(v as "fixed" | "percent")
                }
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">
                    {CURRENCY_SYMBOLS[currency]}
                  </SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Totals */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({taxRate}%)
                </span>
                <span className="font-mono">
                  {formatCurrency(taxAmount, currency)}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Discount
                  {discountType === "percent" ? ` (${discountValue}%)` : ""}
                </span>
                <span className="font-mono text-red-400">
                  -{formatCurrency(discountAmount, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="font-mono text-emerald-400">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes / Payment instructions</Label>
          <Textarea
            placeholder="Thank you for your business!"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
