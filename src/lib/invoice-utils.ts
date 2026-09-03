export interface LineItemInput {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

/**
 * Canonical invoice money math. This is the SINGLE source of truth for
 * subtotal / tax / discount / total — the editor, any server recomputation,
 * and tests must all go through here.
 *
 * All arithmetic is done in integer cents to avoid binary-float drift
 * (e.g. 0.1 + 0.2 !== 0.3). Values are converted back to decimal dollars
 * only at the boundary.
 *
 * Hardening / invariants:
 *  - Negative quantities, unit prices, tax rates and discounts are clamped to 0.
 *  - Infinite / non-finite inputs are safely converted to 0.
 *  - Fixed discounts are rounded to whole cents (no sub-cent precision).
 *  - Discount can never exceed subtotal + tax, so total is never negative.
 */
export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxRate: string | number,
  discountType: "fixed" | "percent",
  discountValue: string | number
): InvoiceTotals {
  const toCents = (n: string | number): number => {
    const num = Number(n);
    return Number.isFinite(num) ? Math.round(num * 100) : 0;
  };

  const safeItems = Array.isArray(lineItems) ? lineItems : [];

  // Subtotal: round each line to whole cents (matches per-line display) then sum.
  const subtotalCents = safeItems.reduce((sum, item) => {
    if (!item) return sum;
    const rawQty = Number(item.quantity);
    const rawPrice = Number(item.unitPrice);
    const qty = Number.isFinite(rawQty) ? Math.max(0, rawQty) : 0;
    const price = Number.isFinite(rawPrice) ? Math.max(0, rawPrice) : 0;
    return sum + Math.round(qty * price * 100);
  }, 0);

  const rawTaxRate = Number(taxRate);
  const parsedTaxRate = Number.isFinite(rawTaxRate) ? Math.max(0, rawTaxRate) : 0;
  const taxCents = Math.round((subtotalCents * parsedTaxRate) / 100);

  const rawDiscountVal = Number(discountValue);
  const parsedDiscountValue = Number.isFinite(rawDiscountVal) ? Math.max(0, rawDiscountVal) : 0;
  const rawDiscountCents =
    discountType === "percent"
      ? Math.round((subtotalCents * parsedDiscountValue) / 100)
      : toCents(parsedDiscountValue);

  // A discount can never make the invoice negative.
  const discountCents = Math.min(rawDiscountCents, subtotalCents + taxCents);

  const totalCents = subtotalCents + taxCents - discountCents;

  return {
    subtotal: subtotalCents / 100,
    taxAmount: taxCents / 100,
    discountAmount: discountCents / 100,
    total: totalCents / 100,
  };
}

export function incrementInvoiceNumber(prefix: string, lastNumber: number): string {
  const cleanPrefix = (prefix || "INV").trim();
  const rawNum = Number(lastNumber);
  const next = (Number.isFinite(rawNum) ? Math.max(0, Math.floor(rawNum)) : 0) + 1;
  return `${cleanPrefix}-${String(next).padStart(4, "0")}`;
}

/**
 * Server-side integrity check for persisted invoice money.
 *
 * The invoice editor is a client component that writes subtotal / tax / total
 * straight to the DB, so a crafted request could persist amounts that don't
 * match the canonical formula. Any server code that trusts those numbers
 * (PDF, email, pay page) can call this to detect tampering. Recompute is done
 * through the SAME `calculateInvoiceTotals`, so there is exactly one formula.
 *
 * Returns `{ ok, expected }`. Compared in integer cents — exact, no float
 * tolerance — because the canonical formula is itself cents-based.
 */
export function validateInvoiceTotals(
  persisted: { subtotal: number; taxAmount: number; discountAmount: number; total: number },
  lineItems: LineItemInput[],
  taxRate: string | number,
  discountType: "fixed" | "percent",
  discountValue: string | number
): { ok: boolean; expected: InvoiceTotals } {
  const expected = calculateInvoiceTotals(lineItems, taxRate, discountType, discountValue);
  const cents = (n: number) => {
    const num = Number(n);
    return Number.isFinite(num) ? Math.round(num * 100) : 0;
  };
  const ok =
    cents(persisted.subtotal) === cents(expected.subtotal) &&
    cents(persisted.taxAmount) === cents(expected.taxAmount) &&
    cents(persisted.discountAmount) === cents(expected.discountAmount) &&
    cents(persisted.total) === cents(expected.total);
  return { ok, expected };
}

/**
 * Parse a `YYYY-MM-DD` invoice/due date into a Date at LOCAL midnight.
 *
 * `new Date("2024-02-29")` parses as UTC midnight, which in any negative-offset
 * timezone renders as Feb 28 — an off-by-one on due dates that decides whether
 * an invoice is overdue. Building the Date from explicit parts pins it to the
 * local day the user actually typed. Leap-year safe.
 */
export function parseInvoiceDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!match) return new Date(dateStr);
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}
