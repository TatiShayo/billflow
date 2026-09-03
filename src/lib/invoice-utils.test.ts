import { describe, it, expect } from "vitest";
import {
  calculateInvoiceTotals,
  incrementInvoiceNumber,
  validateInvoiceTotals,
  parseInvoiceDate,
} from "./invoice-utils";

describe("calculateInvoiceTotals — Canonical Money Math", () => {
  it("calculates basic subtotal and total without tax or discount", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 2, unitPrice: 10 },
        { quantity: 1, unitPrice: 5 },
      ],
      0,
      "fixed",
      0
    );
    expect(totals.subtotal).toBe(25);
    expect(totals.taxAmount).toBe(0);
    expect(totals.discountAmount).toBe(0);
    expect(totals.total).toBe(25);
  });

  it("calculates totals with fixed discount and no tax", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 3, unitPrice: 20 },
        { quantity: 2, unitPrice: 15 },
      ],
      0,
      "fixed",
      10
    );
    expect(totals.subtotal).toBe(90);
    expect(totals.taxAmount).toBe(0);
    expect(totals.discountAmount).toBe(10);
    expect(totals.total).toBe(80);
  });

  it("calculates totals with percentage discount and standard tax rate", () => {
    // subtotal = 100.33
    // tax = 8.25% of 100.33 = 8.277225 -> rounds to 8.28
    // discount = 10% of 100.33 = 10.033 -> rounds to 10.03
    // total = 100.33 + 8.28 - 10.03 = 98.58
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 100.33 }],
      8.25,
      "percent",
      10
    );
    expect(totals.subtotal).toBe(100.33);
    expect(totals.taxAmount).toBe(8.28);
    expect(totals.discountAmount).toBe(10.03);
    expect(totals.total).toBe(98.58);
  });

  it("calculates totals with fixed discount and percentage tax", () => {
    // subtotal = 75.25
    // tax = 5% of 75.25 = 3.7625 -> rounds to 3.76
    // discount = fixed 10
    // total = 75.25 + 3.76 - 10 = 69.01
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 75.25 }],
      5,
      "fixed",
      10
    );
    expect(totals.subtotal).toBe(75.25);
    expect(totals.taxAmount).toBe(3.76);
    expect(totals.discountAmount).toBe(10);
    expect(totals.total).toBe(69.01);
  });

  it("handles fractional quantities accurately (e.g. hours billing)", () => {
    // 2.5 hours at $80/hr = $200.00
    // 1.75 hours at $120/hr = $210.00
    const totals = calculateInvoiceTotals(
      [
        { quantity: 2.5, unitPrice: 80 },
        { quantity: 1.75, unitPrice: 120 },
      ],
      10, // 10% tax on 410 = 41.00
      "percent",
      5 // 5% discount on 410 = 20.50
    );
    expect(totals.subtotal).toBe(410);
    expect(totals.taxAmount).toBe(41);
    expect(totals.discountAmount).toBe(20.5);
    expect(totals.total).toBe(430.5);
  });

  it("handles multiple complex fractional line items", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 3.33, unitPrice: 15.5 }, // 3.33 * 15.5 = 51.615 -> 51.62
        { quantity: 0.5, unitPrice: 200 }, // 0.5 * 200 = 100.00
      ],
      16, // 16% VAT on 151.62 = 24.2592 -> 24.26
      "fixed",
      15.99
    );
    expect(totals.subtotal).toBe(151.62);
    expect(totals.taxAmount).toBe(24.26);
    expect(totals.discountAmount).toBe(15.99);
    expect(totals.total).toBe(159.89);
  });
});

describe("calculateInvoiceTotals — Hardening Invariants & Floating Point Safety", () => {
  it("does not drift on binary-float unfriendly inputs (0.1 * 3)", () => {
    const t = calculateInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }], 0, "fixed", 0);
    expect(t.subtotal).toBe(0.3);
    expect(t.total).toBe(0.3);
  });

  it("does not drift on standard 0.07 tax multiplier or currency cents", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 19.99 }], 7, "fixed", 0);
    expect(t.subtotal).toBe(19.99);
    // 19.99 * 0.07 = 1.3993 -> 1.40
    expect(t.taxAmount).toBe(1.4);
    expect(t.total).toBe(21.39);
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
    expect(t.subtotal).toBe(12);
    expect(t.total).toBe(12);
  });

  it("clamps a negative tax rate to 0", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], -10, "fixed", 0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(100);
  });

  it("clamps a negative discount value to 0", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 0, "fixed", -25);
    expect(t.discountAmount).toBe(0);
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

  it("treats non-numeric, NaN, and Infinity inputs as 0", () => {
    const t1 = calculateInvoiceTotals(
      [{ quantity: "" as unknown as number, unitPrice: "abc" as unknown as number }],
      "" as unknown as number,
      "fixed",
      "" as unknown as number
    );
    expect(t1).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 });

    const t2 = calculateInvoiceTotals(
      [{ quantity: NaN, unitPrice: Infinity }],
      Infinity,
      "fixed",
      NaN
    );
    expect(t2).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 });
  });

  it("handles empty items array gracefully", () => {
    const t = calculateInvoiceTotals([], 10, "percent", 5);
    expect(t).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 });
  });

  it("handles null/undefined lineItems argument gracefully", () => {
    const t = calculateInvoiceTotals(null as unknown as [], 0, "fixed", 0);
    expect(t).toEqual({ subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0 });
  });

  it("handles 100% discount properly giving 0 total", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 250 }], 0, "percent", 100);
    expect(t.subtotal).toBe(250);
    expect(t.discountAmount).toBe(250);
    expect(t.total).toBe(0);
  });

  it("calculates 0% discount without affecting total", () => {
    const t = calculateInvoiceTotals([{ quantity: 1, unitPrice: 150 }], 10, "percent", 0);
    expect(t.subtotal).toBe(150);
    expect(t.taxAmount).toBe(15);
    expect(t.discountAmount).toBe(0);
    expect(t.total).toBe(165);
  });
});

describe("validateInvoiceTotals — Integrity & Anti-Tampering Check", () => {
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
    expect(res.expected.total).toBe(108);
  });

  it("rejects a tampered total (client-forged lower total)", () => {
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

  it("rejects a tampered subtotal", () => {
    const items = [{ quantity: 5, unitPrice: 20 }];
    const res = validateInvoiceTotals(
      { subtotal: 80, taxAmount: 0, discountAmount: 0, total: 80 },
      items,
      0,
      "fixed",
      0
    );
    expect(res.ok).toBe(false);
    expect(res.expected.subtotal).toBe(100);
  });

  it("rejects a tampered tax amount", () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    const res = validateInvoiceTotals(
      { subtotal: 100, taxAmount: 0, discountAmount: 0, total: 100 },
      items,
      10,
      "fixed",
      0
    );
    expect(res.ok).toBe(false);
    expect(res.expected.taxAmount).toBe(10);
  });

  it("rejects a tampered discount amount", () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    const res = validateInvoiceTotals(
      { subtotal: 100, taxAmount: 0, discountAmount: 50, total: 50 },
      items,
      0,
      "fixed",
      10
    );
    expect(res.ok).toBe(false);
    expect(res.expected.discountAmount).toBe(10);
  });
});

describe("incrementInvoiceNumber", () => {
  it("correctly increments standard prefix and number", () => {
    expect(incrementInvoiceNumber("INV", 42)).toBe("INV-0043");
    expect(incrementInvoiceNumber("INV", 999)).toBe("INV-1000");
    expect(incrementInvoiceNumber("TEST", 0)).toBe("TEST-0001");
  });

  it("handles multi-digit high number rollover (1000+)", () => {
    expect(incrementInvoiceNumber("INV", 1234)).toBe("INV-1235");
    expect(incrementInvoiceNumber("INV", 9999)).toBe("INV-10000");
  });

  it("handles custom prefix and whitespace", () => {
    expect(incrementInvoiceNumber("ACME", 1)).toBe("ACME-0002");
    expect(incrementInvoiceNumber("  BILL  ", 5)).toBe("BILL-0006");
  });

  it("handles empty or missing prefix by defaulting to INV", () => {
    expect(incrementInvoiceNumber("", 10)).toBe("INV-0011");
  });

  it("handles negative or non-numeric lastNumber safely", () => {
    expect(incrementInvoiceNumber("INV", -5)).toBe("INV-0001");
    expect(incrementInvoiceNumber("INV", NaN)).toBe("INV-0001");
    expect(incrementInvoiceNumber("INV", undefined as unknown as number)).toBe("INV-0001");
  });
});

describe("parseInvoiceDate — Timezone & Leap-Year Safety", () => {
  it("keeps a leap day on its local calendar date (2024-02-29)", () => {
    const d = parseInvoiceDate("2024-02-29");
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1); // February (0-indexed)
    expect(d.getDate()).toBe(29);
  });

  it("parses normal dates to local midnight", () => {
    const d = parseInvoiceDate("2025-01-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("parses year-end dates correctly (2025-12-31)", () => {
    const d = parseInvoiceDate("2025-12-31");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(31);
  });

  it("falls back safely on non-ISO date strings", () => {
    const d = parseInvoiceDate("invalid-date");
    expect(d instanceof Date).toBe(true);
  });

  it("handles empty string gracefully", () => {
    const d = parseInvoiceDate("");
    expect(d instanceof Date).toBe(true);
  });
});
