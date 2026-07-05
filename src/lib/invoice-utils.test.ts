import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals, incrementInvoiceNumber } from "./invoice-utils";
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

describe("incrementInvoiceNumber", () => {
  it("correctly increments numbers", () => {
    expect(incrementInvoiceNumber("INV", 42)).toBe("INV-0043");
    expect(incrementInvoiceNumber("INV", 999)).toBe("INV-1000");
    expect(incrementInvoiceNumber("TEST", 0)).toBe("TEST-0001");
  });
});
