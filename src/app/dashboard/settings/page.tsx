"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Building2,
  FileText,
  Bell,
  CreditCard,
  Check,
  Sparkles,
} from "lucide-react";
import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  type Currency,
  type Profile,
  TIER_LIMITS,
  type SubscriptionTier,
} from "@/lib/types";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "business"
  );
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Business info
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [fullName, setFullName] = useState("");

  // Invoice defaults
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>("USD");
  const [paymentTerms, setPaymentTerms] = useState("30");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1);

  // Notifications
  const [notifyOnPayment, setNotifyOnPayment] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setCompanyName(profile.company_name || "");
    setCompanyEmail(profile.company_email || "");
    setAddress(profile.address || "");
    setPhone(profile.phone || "");
    setTaxNumber(profile.tax_number || "");
    setDefaultCurrency(profile.default_currency as Currency);
    setInvoicePrefix(profile.invoice_prefix);
    setNextInvoiceNumber(profile.next_invoice_number);
    setDefaultNotes(profile.default_notes || "");

    const terms = profile.payment_terms || "Net 30";
    setPaymentTerms(terms.replace("Net ", ""));
    setNotifyOnPayment(
      (profile as { notify_on_payment?: boolean }).notify_on_payment !== false
    );
    setNotifyOverdue(
      (profile as { notify_overdue?: boolean }).notify_overdue !== false
    );
  }, [profile]);

  async function handleSaveBusinessInfo() {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        company_name: companyName || null,
        company_email: companyEmail || null,
        address: address || null,
        phone: phone || null,
        tax_number: taxNumber || null,
      })
      .eq("id", user!.id);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Business info updated");
    }
    setLoading(false);
  }

  async function handleSaveInvoiceDefaults() {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        default_currency: defaultCurrency,
        payment_terms: `Net ${paymentTerms}`,
        default_notes: defaultNotes || null,
        invoice_prefix: invoicePrefix,
        next_invoice_number: nextInvoiceNumber,
      })
      .eq("id", user!.id);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Invoice defaults updated");
    }
    setLoading(false);
  }

  async function handleSaveNotifications() {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        notify_on_payment: notifyOnPayment,
        notify_overdue: notifyOverdue,
      })
      .eq("id", user!.id);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Notification preferences saved");
    }
    setLoading(false);
  }

  async function handleCheckout(plan: "pro" | "business") {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const { sessionId, error } = await res.json();
      if (error) {
        toast.error(error);
        setCheckoutLoading(null);
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        toast.error("Stripe failed to load");
        setCheckoutLoading(null);
        return;
      }

      const { error: stripeError } = await (stripe as unknown as { redirectToCheckout: (o: { sessionId: string }) => Promise<{ error?: { message: string } }> }).redirectToCheckout({
        sessionId,
      });

      if (stripeError) toast.error(stripeError.message);
    } catch {
      toast.error("Checkout failed");
    }
    setCheckoutLoading(null);
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
      });
      const { error } = await res.json();
      if (error) {
        toast.error(error);
      } else {
        toast.success("Subscription cancelled. You'll keep access until the period ends.");
      }
    } catch {
      toast.error("Failed to cancel subscription");
    }
    setLoading(false);
  }

  if (!user || !profile) return null;

  const tier = (profile.subscription_tier || "free") as SubscriptionTier;
  const tierLabel =
    tier === "free" ? "Free" : tier === "pro" ? "Pro" : "Business";

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start gap-0">
          <TabsTrigger value="business" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Business
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Invoice Defaults
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your business name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Company Email</Label>
                <Input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="billing@yourcompany.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, Country"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax/VAT Number</Label>
                  <Input
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="TAX-12345"
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveBusinessInfo}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Default Currency</Label>
                  <Select
                    value={defaultCurrency}
                    onValueChange={(v) =>
                      setDefaultCurrency(v as Currency)
                    }
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
                <div className="space-y-1.5">
                  <Label>Payment Terms</Label>
                  <Select
                    value={paymentTerms}
                    onValueChange={(v) => setPaymentTerms(v || "30")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Net 7</SelectItem>
                      <SelectItem value="15">Net 15</SelectItem>
                      <SelectItem value="30">Net 30</SelectItem>
                      <SelectItem value="60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Invoice Number Prefix</Label>
                  <Input
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Next Invoice Number</Label>
                  <Input
                    type="number"
                    value={nextInvoiceNumber}
                    onChange={(e) =>
                      setNextInvoiceNumber(Number(e.target.value))
                    }
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default Notes</Label>
                <Textarea
                  value={defaultNotes}
                  onChange={(e) => setDefaultNotes(e.target.value)}
                  placeholder="Thank you for your business! Payment is due within {days} days."
                  rows={2}
                />
              </div>
              <Button
                onClick={handleSaveInvoiceDefaults}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment received</p>
                  <p className="text-sm text-muted-foreground">
                    Email when an invoice is marked as paid
                  </p>
                </div>
                <Switch
                  checked={notifyOnPayment}
                  onCheckedChange={setNotifyOnPayment}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Overdue reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Email notification when invoices become overdue
                  </p>
                </div>
                <Switch
                  checked={notifyOverdue}
                  onCheckedChange={setNotifyOverdue}
                />
              </div>
              <Button
                onClick={handleSaveNotifications}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {tierLabel}{" "}
                        <Badge
                          variant="secondary"
                          className="text-xs"
                        >
                          {tier === "free"
                            ? "$0/mo"
                            : tier === "pro"
                            ? "$8/mo"
                            : "$16/mo"}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tier === "free"
                          ? "10 clients · 5 invoices/month · Single currency"
                          : tier === "pro"
                          ? "Unlimited clients · AI generator · Multi-currency · WhatsApp share"
                          : "Everything in Pro + Expenses · Reports · Custom branding · Client portal"}
                      </p>
                    </div>
                  </div>
                  {tier !== "free" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-500/30"
                      onClick={handleCancel}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {tier === "free" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                  <CardContent className="pt-6">
                    <div className="mb-3">
                      <Badge className="bg-emerald-500/20 text-emerald-400 mb-2">
                        Popular
                      </Badge>
                      <p className="text-lg font-bold">Pro</p>
                      <p className="text-2xl font-bold mt-1">
                        $8<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                    </div>
                    <ul className="space-y-1.5 mb-6 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Unlimited clients & invoices
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        AI invoice generator
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Multi-currency support
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        WhatsApp share
                      </li>
                    </ul>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => handleCheckout("pro")}
                      disabled={checkoutLoading === "pro"}
                    >
                      {checkoutLoading === "pro" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Upgrade to Pro"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="hover:border-indigo-500/30 transition-colors">
                  <CardContent className="pt-6">
                    <div className="mb-3">
                      <Badge variant="secondary" className="mb-2">
                        Best Value
                      </Badge>
                      <p className="text-lg font-bold">Business</p>
                      <p className="text-2xl font-bold mt-1">
                        $16
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                    </div>
                    <ul className="space-y-1.5 mb-6 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Everything in Pro
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Expense management
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Financial reports
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Custom branding
                      </li>
                    </ul>
                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-500"
                      onClick={() => handleCheckout("business")}
                      disabled={checkoutLoading === "business"}
                    >
                      {checkoutLoading === "business" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Upgrade to Business"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {tier === "pro" && (
              <Card className="hover:border-indigo-500/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        Upgrade Available
                      </Badge>
                      <p className="text-lg font-bold">Business</p>
                      <p className="text-2xl font-bold mt-1">
                        $16
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <ul className="space-y-1 mt-3 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Expense management
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Financial reports
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Custom branding
                        </li>
                      </ul>
                    </div>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-500"
                      onClick={() => handleCheckout("business")}
                      disabled={checkoutLoading === "business"}
                    >
                      {checkoutLoading === "business" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Upgrade"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
