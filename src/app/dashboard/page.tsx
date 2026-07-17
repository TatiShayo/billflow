"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Users,
  Plus,
  FileText,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import {
  formatCurrency,
  getStatusColor,
  type InvoiceWithRelations,
  type DashboardStats,
  type RevenueDataPoint,
  type Currency,
} from "@/lib/types";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceWithRelations[]>(
    []
  );
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    const currency = (profile?.default_currency || "USD") as Currency;

    // Stats
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    const { count: totalClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id);

    const allInvoices = invoices || [];
    const outstanding = allInvoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.total), 0);

    const now = new Date();
    const paidThisMonth = allInvoices
      .filter((i) => {
        if (i.status !== "paid" || !i.paid_at) return false;
        const paidDate = new Date(i.paid_at);
        return (
          paidDate >= startOfMonth(now) && paidDate <= endOfMonth(now)
        );
      })
      .reduce((sum, i) => sum + Number(i.total), 0);

    const overdueCount = allInvoices.filter(
      (i) =>
        i.status !== "paid" &&
        i.status !== "draft" &&
        new Date(i.due_date) < now
    ).length;

    setStats({
      outstanding,
      paidThisMonth,
      overdueCount,
      totalClients: totalClients || 0,
      defaultCurrency: currency,
    });

    // Recent invoices
    setRecentInvoices(allInvoices.slice(0, 10) as InvoiceWithRelations[]);

    // Revenue data (last 6 months)
    const months: RevenueDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const revenue = allInvoices
        .filter((inv) => {
          if (inv.status !== "paid" || !inv.paid_at) return false;
          const paidDate = new Date(inv.paid_at);
          return paidDate >= monthStart && paidDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + Number(inv.total), 0);

      months.push({
        month: format(monthStart, "MMM"),
        revenue: Math.round(revenue * 100) / 100,
      });
    }
    setRevenueData(months);

    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || !profile) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your business
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/invoices/new">
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Overdue alert */}
      {stats && stats.overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">
            You have {stats.overdueCount} overdue invoice
            {stats.overdueCount !== 1 ? "s" : ""}. Follow up with clients to
            avoid delays.
          </p>
          <Link href="/dashboard/invoices?status=overdue">
            <Button variant="outline" size="sm" className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10">
              View <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats ? formatCurrency(stats.outstanding, stats.defaultCurrency) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid this month
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {stats ? formatCurrency(stats.paidThisMonth, stats.defaultCurrency) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats ? stats.overdueCount : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total clients
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats ? stats.totalClients : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Revenue (last 6 months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2e28" />
                <XAxis dataKey="month" stroke="#4a5e58" fontSize={12} />
                <YAxis stroke="#4a5e58" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111a17",
                    border: "1px solid #1c2e28",
                    borderRadius: "8px",
                  }}
                  formatter={(value: unknown) => [
                    formatCurrency(Number(value), stats?.defaultCurrency || "USD"),
                    "Revenue",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent invoices</CardTitle>
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No invoices yet</p>
              <Link href="/dashboard/invoices/new">
                <Button size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-500">
                  Create your first invoice
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-3">Invoice</div>
                <div className="col-span-3">Client</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-right">Due</div>
              </div>
              {recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/dashboard/invoices/${inv.id}`}
                  className="grid grid-cols-12 gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 items-center"
                >
                  <div className="col-span-3 font-mono text-sm">
                    {inv.invoice_number}
                  </div>
                  <div className="col-span-3 text-sm truncate">
                    {inv.client?.name || "—"}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm">
                    {formatCurrency(
                      Number(inv.total),
                      inv.currency as Currency
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <Badge
                      className={`text-xs ${getStatusColor(inv.status)}`}
                      variant="secondary"
                    >
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right text-sm text-muted-foreground">
                    {format(new Date(inv.due_date), "MMM d, yyyy")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
