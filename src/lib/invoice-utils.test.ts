import { describe, it, expect } from "vitest";
import {
  calculateInvoiceTotals,
  incrementInvoiceNumber,
  validateInvoiceTotals,
  parseInvoiceDate,
} from "./invoice-utils";
import { formatCurrency } from "./types";

describe("formatCurrency", () => {
  it("correctly formats amounts with respective currency symbols", () => {
    // USD
    const usdFormatted = formatCurrency(100.5, "USD");
    expect(usdFormatted).toContain("$");
    expect(usdFormatted).toContain("100.50");

    // GBP
    const gbpFormatted = formatCurrency(2500, "GBP");
    expect(gbpFormatted).toContain("£");
    expect(gbpFormatted).toContain("2,500.00");

    // EUR
    const eurFormatted = formatCurrency(42.19, "EUR");
    expect(eurFormatted).toContain("€");
    expect(eurFormatted).toContain("42.19");

    // KES
    const kesFormatted = formatCurrency(1000, "KES");
    expect(kesFormatted).toContain("KES");
    expect(kesFormatted).toContain("1,000.00");
  });
});

describe("calculateInvoiceTotals", () => {
  it("correctly calculates subtotal, tax amount, discount amount, and total under different combinations", () => {
    // Fixed discount, no tax, no rounding issues
    const totals1 = calculateInvoiceTotals(
      [
        { quantity: 2, unitPrice: 10 },
        { quantity: 1, unitPrice: 5 },
      ],
      0,
      "fixed",
      5
    );
    expect(totals1.subtotal).toBe(25);
    expect(totals1.taxAmount).toBe(0);
    expect(totals1.discountAmount).toBe(5);
    expect(totals1.total).toBe(20);

    // Percent discount, tax rate, and rounding
    // subtotal = 100.33
    // tax = 8.25% of 100.33 = 8.277225 -> rounds to 8.28
    // discount = 10% of 100.33 = 10.033 -> rounds to 10.03
    // total = 100.33 + 8.28 - 10.03 = 98.58
    const totals2 = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 100.33 }],
      8.25,
      "percent",
      10
    );
    expect(totals2.subtotal).toBe(100.33);
    expect(totals2.taxAmount).toBe(8.28);
    expect(totals2.discountAmount).toBe(10.03);
    expect(totals2.total).toBe(98.58);

    // Fixed discount, tax rate, and rounding
    // subtotal = 75.25
    // tax = 5% of 75.25 = 3.7625 -> rounds to 3.76
    // discount = fixed 10
    // total = 75.25 + 3.76 - 10 = 69.01
    const totals3 = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 75.25 }],
      5,
      "fixed",
      10
    );
    expect(totals3.subtotal).toBe(75.25);
    expect(totals3.taxAmount).toBe(3.76);
    expect(totals3.discountAmount).toBe(10);
    expect(totals3.total).toBe(69.01);
  });
});

describe("calculateInvoiceTotals — hardening invariants (characterization)", () => {
  it("does not drift on binary-float unfriendly inputs (0.1 * 3)", () => {
    const t = calculateInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }], 0, "fixed", 0);
    expect(t.subtotal).toBe(0.3);
    expect(t.total).toBe(0.3);
  });

  it("clamps negative quantities and unit prices to 0", () => {
    const t = calculateInvoiceTotals(
      [
        { quantity: -5, unitPrice: 10 },
        { quantity: 2, unitPrice: -10 },
        { quantity: 3, unitPrice: 4 },
      ],
      0,
      "fixed",
      0
    );
    expect(t.subtotal).toBe(12); // only the 3*4 line survives
    expect(t.total).toBe(12);
  });

  it("clamps a negative tax rate to 0", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], -10, "fixed", 0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(100);
  });

  it("caps a fixed discount so the total can never go negative", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 0, "fixed", 500);
    expect(t.discountAmount).toBe(100);
    expect(t.total).toBe(0);
  });

  it("caps a percent discount over 100% at subtotal + tax", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 10, "percent", 150);
    // subtotal 100, tax 10 -> cap 110, total 0
    expect(t.discountAmount).toBe(110);
    expect(t.total).toBe(0);
  });

  it("rounds a fixed discount to whole cents (no sub-cent precision)", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 0, "fixed", 9.999);
    expect(t.discountAmount).toBe(10);
    expect(t.total).toBe(90);
  });

  it("treats non-numeric / empty inputs as 0", () => {
    const t = calculateInvoiceTotals(
      [{ quantity: "" as unknown as number, unitPrice: "abc" as unknown as number }],
      "" as unknown as number,
      "fixed",
      "" as unknown as number
    );
    expect(t).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 });
  });
});

describe("validateInvoiceTotals", () => {
  it("accepts correctly-computed persisted totals", () => {
    const items = [{ quantity: 2, unitPrice: 50 }];
    const res = validateInvoiceTotals(
      { subtotal: 100, taxAmount: 8, discountAmount: 0, total: 108 },
      items,
      8,
      "fixed",
      0
    );
    expect(res.ok).toBe(true);
  });

  it("rejects a tampered total (client-forged amount)", () => {
    const items = [{ quantity: 2, unitPrice: 50 }];
    const res = validateInvoiceTotals(
      { subtotal: 100, taxAmount: 8, discountAmount: 0, total: 1 },
      items,
      8,
      "fixed",
      0
    );
    expect(res.ok).toBe(false);
    expect(res.expected.total).toBe(108);
  });
});

describe("parseInvoiceDate — timezone & leap-year safety", () => {
  it("keeps a leap day on its local calendar date", () => {
    const d = parseInvoiceDate("2024-02-29");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1); // February
    expect(d.getDate()).toBe(29); // not shifted to Feb 28 / Mar 1
  });

  it("parses a normal date to local midnight of the same day", () => {
    const d = parseInvoiceDate("2025-01-15");
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });
});

describe("incrementInvoiceNumber", () => {
  it("correctly increments numbers", () => {
    expect(incrementInvoiceNumber("INV", 42)).toBe("INV-0043");
    expect(incrementInvoiceNumber("INV", 999)).toBe("INV-1000");
    expect(incrementInvoiceNumber("TEST", 0)).toBe("TEST-0001");
  });
});
