export type SubscriptionTier = "free" | "pro" | "business";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "software"
  | "equipment"
  | "office"
  | "other";

export type Currency = "USD" | "GBP" | "EUR" | "KES" | "ZAR" | "NGN";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_email: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  tax_number: string | null;
  default_currency: Currency;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  payment_terms: string;
  default_notes: string | null;
  notify_on_payment: boolean;
  notify_overdue: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  currency: Currency;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  payment_token: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: Currency;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

export interface InvoiceWithRelations extends Invoice {
  client: Client | null;
  items: InvoiceItem[];
}

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayToken {
  id: string;
  invoice_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface DashboardStats {
  outstanding: number;
  paidThisMonth: number;
  overdueCount: number;
  totalClients: number;
  defaultCurrency: Currency;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export interface AiInvoiceResult {
  items: { description: string; quantity: number; unitPrice: number }[];
  suggestedPaymentTerms: string;
  notes: string;
}

export const CURRENCIES: Currency[] = ["USD", "GBP", "EUR", "KES", "ZAR", "NGN"];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  KES: "KES",
  ZAR: "R",
  NGN: "₦",
};

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transport" },
  { value: "software", label: "Software" },
  { value: "equipment", label: "Equipment" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "bg-gray-500/20 text-gray-400";
    case "sent":
      return "bg-blue-500/20 text-blue-400";
    case "paid":
      return "bg-emerald-500/20 text-emerald-400";
    case "overdue":
      return "bg-red-500/20 text-red-400";
  }
}

export const TIER_LIMITS = {
  free: {
    maxClients: 10,
    maxInvoicesPerMonth: 5,
    aiGenerator: false,
    multiCurrency: false,
    whatsappShare: false,
    expenseManagement: false,
    financialReports: false,
    customBranding: false,
    clientPortal: false,
  },
  pro: {
    maxClients: Infinity,
    maxInvoicesPerMonth: Infinity,
    aiGenerator: true,
    multiCurrency: true,
    whatsappShare: true,
    expenseManagement: false,
    financialReports: false,
    customBranding: false,
    clientPortal: false,
  },
  business: {
    maxClients: Infinity,
    maxInvoicesPerMonth: Infinity,
    aiGenerator: true,
    multiCurrency: true,
    whatsappShare: true,
    expenseManagement: true,
    financialReports: true,
    customBranding: true,
    clientPortal: true,
  },
};
