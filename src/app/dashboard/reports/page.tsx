"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierGate } from "@/components/tier-gate";
import { Loader2, TrendingUp, Users, PieChart, DollarSign } from "lucide-react";
import { format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import {
  formatCurrency,
  type Currency,
  type InvoiceWithRelations,
} from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

const STATUS_COLORS = {
  paid: "#10b981",
  sent: "#3b82f6",
  overdue: "#ef4444",
  draft: "#6b7280",
};

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthCount, setMonthCount] = useState(6);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, monthCount]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    setInvoices((data || []) as InvoiceWithRelations[]);
    setLoading(false);
  }

  const currency = (profile?.default_currency || "USD") as Currency;
  const now = new Date();

  // Revenue by month
  const revenueByMonth = Array.from({ length: monthCount }, (_, i) => {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    const revenue = invoices
      .filter((inv) => {
        if (inv.status !== "paid" || !inv.paid_at) return false;
        const d = new Date(inv.paid_at);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      month: format(monthStart, "MMM yy"),
      revenue: Math.round(revenue * 100) / 100,
    };
  }).reverse();

  // Top clients
  const clientRevenue: Record<string, { name: string; revenue: number }> = {};
  invoices.forEach((inv) => {
    const key = inv.client?.name || "No client";
    if (!clientRevenue[key]) {
      clientRevenue[key] = { name: key, revenue: 0 };
    }
    if (inv.status === "paid") {
      clientRevenue[key].revenue += Number(inv.total);
    }
  });
  const topClients = Object.values(clientRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Status breakdown
  const statusCounts = {
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
  };
  const statusPie = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: key, value }));

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total), 0);

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.total), 0);

  if (!user) return null;

  return (
    <TierGate requiredTier="business" feature="Financial Reports">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Financial overview and insights
            </p>
          </div>
          <select
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
            value={monthCount}
            onChange={(e) => setMonthCount(Number(e.target.value))}
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Revenue (Paid)
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {formatCurrency(totalRevenue, currency)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Outstanding
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    {formatCurrency(outstanding, currency)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue by Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1c2e28"
                      />
                      <XAxis
                        dataKey="month"
                        stroke="#4a5e58"
                        fontSize={12}
                      />
                      <YAxis stroke="#4a5e58" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111a17",
                          border: "1px solid #1c2e28",
                          borderRadius: "8px",
                        }}
                        formatter={(value: any) => [
                          formatCurrency(value, currency),
                          "Revenue",
                        ]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Top clients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    Top Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No paid invoices yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topClients.map((client, idx) => (
                        <div
                          key={client.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">
                              {idx + 1}
                            </span>
                            <span className="text-sm truncate max-w-[160px]">
                              {client.name}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-emerald-400">
                            {formatCurrency(client.revenue, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-emerald-400" />
                    Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusPie.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No invoices yet
                    </p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="h-[180px] w-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={statusPie}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={80}
                              dataKey="value"
                            >
                              {statusPie.map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={
                                    STATUS_COLORS[
                                      entry.name as keyof typeof STATUS_COLORS
                                    ]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#111a17",
                                border: "1px solid #1c2e28",
                                borderRadius: "8px",
                              }}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1.5">
                        {statusPie.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  STATUS_COLORS[
                                    s.name as keyof typeof STATUS_COLORS
                                  ],
                              }}
                            />
                            <span className="capitalize">{s.name}</span>
                            <span className="text-muted-foreground">
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </TierGate>
  );
}
