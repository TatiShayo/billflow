"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Users,
  Mail,
  Phone,
  Building2,
  FileText,
  DollarSign,
  Pencil,
  Search,
  Loader2,
} from "lucide-react";
import {
  formatCurrency,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  TIER_LIMITS,
  type Client,
  type Currency,
} from "@/lib/types";
import { toast } from "sonner";

export default function ClientsPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [invoiceCounts, setInvoiceCounts] = useState<
    Record<string, { count: number; total: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [clientCurrency, setClientCurrency] = useState<Currency>("USD");
  const [clientNotes, setClientNotes] = useState("");

  const tier = (profile?.subscription_tier || "free") as keyof typeof TIER_LIMITS;
  const maxClients = TIER_LIMITS[tier].maxClients;

  useEffect(() => {
    if (!user) return;
    loadClients();
  }, [user]);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user!.id)
      .order("name");

    const clientList = (data || []) as Client[];
    setClients(clientList);

    // Get invoice counts
    const { data: invoices } = await supabase
      .from("invoices")
      .select("client_id, total")
      .eq("user_id", user!.id);

    const counts: Record<string, { count: number; total: number }> = {};
    (invoices || []).forEach((inv) => {
      if (!inv.client_id) return;
      if (!counts[inv.client_id]) {
        counts[inv.client_id] = { count: 0, total: 0 };
      }
      counts[inv.client_id].count++;
      counts[inv.client_id].total += Number(inv.total);
    });
    setInvoiceCounts(counts);

    setLoading(false);
  }

  function openNewDialog() {
    if (maxClients !== Infinity && clients.length >= maxClients) {
      toast.error(
        `Free tier limited to ${maxClients} clients. Upgrade to Pro for unlimited.`
      );
      return;
    }
    setEditingClient(null);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAddress("");
    setClientCurrency(
      (profile?.default_currency as Currency) || "USD"
    );
    setClientNotes("");
    setShowDialog(true);
  }

  function openEditDialog(client: Client) {
    setEditingClient(client);
    setName(client.name);
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setCompany(client.company || "");
    setAddress(client.address || "");
    setClientCurrency(client.currency);
    setClientNotes(client.notes || "");
    setShowDialog(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user!.id,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      address: address || null,
      currency: clientCurrency,
      notes: clientNotes || null,
    };

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id);
      if (error) {
        toast.error("Failed to update");
        setSaving(false);
        return;
      }
      toast.success("Client updated");
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) {
        toast.error("Failed to add client");
        setSaving(false);
        return;
      }
      toast.success("Client added");
    }

    setSaving(false);
    setShowDialog(false);
    loadClients();
  }

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    return (
      !s ||
      c.name.toLowerCase().includes(s) ||
      c.company?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
    );
  });

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length}{" "}
            {maxClients !== Infinity
              ? `/ ${maxClients}`
              : ""}{" "}
            clients
          </p>
        </div>
        <Button
          onClick={openNewDialog}
          className="bg-emerald-600 hover:bg-emerald-500 gap-2"
        >
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            {search ? "No clients match your search" : "No clients yet"}
          </p>
          {!search && (
            <Button
              onClick={openNewDialog}
              className="mt-3 bg-emerald-600 hover:bg-emerald-500"
            >
              Add your first client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const invData = invoiceCounts[client.id] || {
              count: 0,
              total: 0,
            };
            return (
              <Card
                key={client.id}
                className="hover:border-emerald-500/30 transition-colors cursor-pointer group"
                onClick={() => openEditDialog(client)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{client.name}</p>
                        {client.company && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {client.company}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(client);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {client.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Mail className="h-3 w-3" /> {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Phone className="h-3 w-3" /> {client.phone}
                    </p>
                  )}

                  <div className="mt-4 pt-4 border-t border-border flex justify-between">
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">
                        {invData.count}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3 w-3 inline mr-0.5" />
                        Invoices
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono text-emerald-400">
                        {formatCurrency(invData.total, client.currency)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <DollarSign className="h-3 w-3 inline mr-0.5" />
                        Billed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Add Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 0000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={clientCurrency}
                  onValueChange={(v) => setClientCurrency(v as Currency)}
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
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={2}
              />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingClient ? (
                "Update Client"
              ) : (
                "Add Client"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
