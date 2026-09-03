import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  getStatusColor,
  TIER_LIMITS,
  EXPENSE_CATEGORIES,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  type Currency,
  type InvoiceStatus,
  type SubscriptionTier,
} from "./types";

describe("formatCurrency — Multi-Currency Formatting & Resilience", () => {
  it("formats USD amounts with standard dollar symbol and 2 decimals", () => {
    const res = formatCurrency(100.5, "USD");
    expect(res).toContain("$");
    expect(res).toContain("100.50");
  });

  it("formats GBP amounts with pound symbol", () => {
    const res = formatCurrency(2500, "GBP");
    expect(res).toContain("£");
    expect(res).toContain("2,500.00");
  });

  it("formats EUR amounts with euro symbol", () => {
    const res = formatCurrency(42.19, "EUR");
    expect(res).toContain("€");
    expect(res).toContain("42.19");
  });

  it("formats KES amounts with KES code", () => {
    const res = formatCurrency(1000, "KES");
    expect(res).toContain("KES");
    expect(res).toContain("1,000.00");
  });

  it("formats ZAR amounts with South African Rand code/symbol", () => {
    const res = formatCurrency(750.5, "ZAR");
    expect(res).toMatch(/ZAR|R/);
    expect(res).toContain("750.50");
  });

  it("formats NGN amounts with Nigerian Naira code/symbol", () => {
    const res = formatCurrency(50000, "NGN");
    expect(res).toMatch(/NGN|₦/);
    expect(res).toContain("50,000.00");
  });

  it("formats zero amount accurately", () => {
    const res = formatCurrency(0, "USD");
    expect(res).toBe("$0.00");
  });

  it("formats negative amounts accurately with negative indicator", () => {
    const res = formatCurrency(-50.25, "USD");
    expect(res).toContain("50.25");
    expect(res).toContain("-");
  });

  it("handles negative zero (-0) gracefully as 0.00", () => {
    const res = formatCurrency(-0, "USD");
    expect(res).toBe("$0.00");
  });

  it("handles NaN by falling back safely to $0.00", () => {
    const res = formatCurrency(NaN, "USD");
    expect(res).toBe("$0.00");
  });

  it("handles Infinity by falling back safely to $0.00", () => {
    const res = formatCurrency(Infinity, "USD");
    expect(res).toBe("$0.00");
  });

  it("handles unsupported currency string by falling back safely", () => {
    const res = formatCurrency(100, "XYZ" as unknown as Currency);
    expect(res).toContain("100.00");
  });

  it("rounds sub-cent fractional amounts to 2 decimal places", () => {
    const res = formatCurrency(12.3456, "USD");
    expect(res).toBe("$12.35");
  });
});

describe("getStatusColor — Invoice Status Badge Styles", () => {
  it("returns gray style for draft status", () => {
    expect(getStatusColor("draft")).toContain("text-gray-400");
  });

  it("returns blue style for sent status", () => {
    expect(getStatusColor("sent")).toContain("text-blue-400");
  });

  it("returns emerald style for paid status", () => {
    expect(getStatusColor("paid")).toContain("text-emerald-400");
  });

  it("returns red style for overdue status", () => {
    expect(getStatusColor("overdue")).toContain("text-red-400");
  });

  it("covers all 4 valid invoice statuses exhaustively", () => {
    const statuses: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];
    statuses.forEach((s) => {
      const color = getStatusColor(s);
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    });
  });
});

describe("TIER_LIMITS — Feature Matrix Invariants", () => {
  it("enforces Free tier limits", () => {
    expect(TIER_LIMITS.free.maxClients).toBe(10);
    expect(TIER_LIMITS.free.maxInvoicesPerMonth).toBe(5);
    expect(TIER_LIMITS.free.aiGenerator).toBe(false);
    expect(TIER_LIMITS.free.multiCurrency).toBe(false);
    expect(TIER_LIMITS.free.expenseManagement).toBe(false);
    expect(TIER_LIMITS.free.financialReports).toBe(false);
  });

  it("enforces Pro tier features", () => {
    expect(TIER_LIMITS.pro.maxClients).toBe(Infinity);
    expect(TIER_LIMITS.pro.maxInvoicesPerMonth).toBe(Infinity);
    expect(TIER_LIMITS.pro.aiGenerator).toBe(true);
    expect(TIER_LIMITS.pro.multiCurrency).toBe(true);
    expect(TIER_LIMITS.pro.whatsappShare).toBe(true);
    expect(TIER_LIMITS.pro.expenseManagement).toBe(false);
    expect(TIER_LIMITS.pro.financialReports).toBe(false);
  });

  it("enforces Business tier full feature access", () => {
    expect(TIER_LIMITS.business.maxClients).toBe(Infinity);
    expect(TIER_LIMITS.business.maxInvoicesPerMonth).toBe(Infinity);
    expect(TIER_LIMITS.business.aiGenerator).toBe(true);
    expect(TIER_LIMITS.business.multiCurrency).toBe(true);
    expect(TIER_LIMITS.business.expenseManagement).toBe(true);
    expect(TIER_LIMITS.business.financialReports).toBe(true);
    expect(TIER_LIMITS.business.customBranding).toBe(true);
    expect(TIER_LIMITS.business.clientPortal).toBe(true);
  });

  it("guarantees all tiers are defined in TIER_LIMITS", () => {
    const tiers: SubscriptionTier[] = ["free", "pro", "business"];
    tiers.forEach((t) => {
      expect(TIER_LIMITS[t]).toBeDefined();
    });
  });
});

describe("EXPENSE_CATEGORIES & CURRENCIES Constants", () => {
  it("includes all 6 required expense categories with valid labels", () => {
    expect(EXPENSE_CATEGORIES.length).toBe(6);
    const categoryValues = EXPENSE_CATEGORIES.map((c) => c.value);
    expect(categoryValues).toContain("food");
    expect(categoryValues).toContain("transport");
    expect(categoryValues).toContain("software");
    expect(categoryValues).toContain("equipment");
    expect(categoryValues).toContain("office");
    expect(categoryValues).toContain("other");

    EXPENSE_CATEGORIES.forEach((c) => {
      expect(c.label).toBeDefined();
      expect(c.label.length).toBeGreaterThan(0);
    });
  });

  it("provides symbols for all supported currencies", () => {
    CURRENCIES.forEach((c) => {
      expect(CURRENCY_SYMBOLS[c]).toBeDefined();
      expect(typeof CURRENCY_SYMBOLS[c]).toBe("string");
    });
  });
});
