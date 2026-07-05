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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierGate } from "@/components/tier-gate";
import {
  Plus,
  Receipt,
  Loader2,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatCurrency,
  EXPENSE_CATEGORIES,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  type Expense,
  type ExpenseCategory,
  type Currency,
} from "@/lib/types";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: "#f59e0b",
  transport: "#3b82f6",
  software: "#8b5cf6",
  equipment: "#ef4444",
  office: "#06b6d4",
  other: "#6b7280",
};

export default function ExpensesPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>(
    (profile?.default_currency as Currency) || "USD"
  );
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expenseNotes, setExpenseNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    loadExpenses();
  }, [user]);

  async function loadExpenses() {
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user!.id)
      .order("expense_date", { ascending: false });

    setExpenses((data || []) as Expense[]);
    setLoading(false);
  }

  function openNewDialog() {
    setEditingExpense(null);
    setDescription("");
    setAmount("");
    setExpenseCurrency(
      (profile?.default_currency as Currency) || "USD"
    );
    setCategory("other");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setExpenseNotes("");
    setShowDialog(true);
  }

  async function handleSave() {
    if (!description.trim() || !amount) {
      toast.error("Description and amount required");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user!.id,
      description,
      amount: Number(amount),
      currency: expenseCurrency,
      category,
      expense_date: expenseDate,
      notes: expenseNotes || null,
    };

    if (editingExpense) {
      const { error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingExpense.id);
      if (error) {
        toast.error("Failed to update");
        setSaving(false);
        return;
      }
      toast.success("Expense updated");
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) {
        toast.error("Failed to add expense");
        setSaving(false);
        return;
      }
      toast.success("Expense added");
    }

    setSaving(false);
    setShowDialog(false);
    loadExpenses();
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Expense deleted");
    loadExpenses();
  }

  const filtered = expenses.filter((e) => {
    const s = search.toLowerCase();
    return (
      !s ||
      e.description.toLowerCase().includes(s) ||
      e.category?.toLowerCase().includes(s)
    );
  });

  // Pie chart data
  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => {
    const total = filtered
      .filter((e) => e.category === cat.value)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { name: cat.label, value: total, category: cat.value };
  }).filter((d) => d.value > 0);

  if (!user) return null;

  return (
    <TierGate requiredTier="business" feature="Expense Management">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-sm text-muted-foreground">
              {expenses.length} expenses
            </p>
          </div>
          <Button
            onClick={openNewDialog}
            className="bg-emerald-600 hover:bg-emerald-500 gap-2"
          >
            <Plus className="h-4 w-4" /> Record Expense
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
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
                <Receipt className="mx-auto h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No expenses recorded yet</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-2" />
                </div>
                {filtered.map((exp) => (
                  <div
                    key={exp.id}
                    className="grid grid-cols-12 gap-4 px-4 py-2.5 border-t border-border/50 items-center hover:bg-muted/30 cursor-pointer"
                    onClick={() => {
                      setEditingExpense(exp);
                      setDescription(exp.description);
                      setAmount(exp.amount.toString());
                      setExpenseCurrency(exp.currency);
                      setCategory(exp.category);
                      setExpenseDate(exp.expense_date);
                      setExpenseNotes(exp.notes || "");
                      setShowDialog(true);
                    }}
                  >
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {format(new Date(exp.expense_date), "MMM d")}
                    </div>
                    <div className="col-span-4 text-sm">{exp.description}</div>
                    <div className="col-span-2">
                      <Badge variant="secondary" className="text-xs">
                        {EXPENSE_CATEGORIES.find(
                          (c) => c.value === exp.category
                        )?.label || exp.category}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm">
                      {formatCurrency(
                        Number(exp.amount),
                        exp.currency as Currency
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteExpense(exp.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryTotals.length > 0 ? (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryTotals}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categoryTotals.map((entry) => (
                            <Cell
                              key={entry.category}
                              fill={CATEGORY_COLORS[entry.category]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111a17",
                            border: "1px solid #1c2e28",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any) => [
                            formatCurrency(
                              Number(value || 0),
                              (profile?.default_currency as Currency) || "USD"
                            ),
                            "",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1">
                    {categoryTotals.map((cat) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                CATEGORY_COLORS[cat.category],
                            }}
                          />
                          {cat.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(
                            cat.value,
                            (profile?.default_currency as Currency) ||
                              "USD"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No expense data to chart
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit Expense" : "Record Expense"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lunch meeting, Software subscription..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={expenseCurrency}
                    onValueChange={(v) =>
                      setExpenseCurrency(v as Currency)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) =>
                      setCategory(v as ExpenseCategory)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
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
                ) : editingExpense ? (
                  "Update Expense"
                ) : (
                  "Record Expense"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TierGate>
  );
}
