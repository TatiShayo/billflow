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
 * Hardening / invariants (each locked by a test in invoice-utils.test.ts):
 *  - Negative quantities, unit prices, tax rates and discounts are clamped to 0.
 *  - Fixed discounts are rounded to whole cents (no sub-cent precision).
 *  - Discount can never exceed subtotal + tax, so total is never negative.
 */
export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxRate: string | number,
  discountType: "fixed" | "percent",
  discountValue: string | number
): InvoiceTotals {
  const toCents = (n: string | number): number => Math.round((Number(n) || 0) * 100);

  // Subtotal: round each line to whole cents (matches per-line display) then sum.
  const subtotalCents = lineItems.reduce((sum, item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return sum + Math.round(qty * price * 100);
  }, 0);

  const parsedTaxRate = Math.max(0, Number(taxRate) || 0);
  const taxCents = Math.round((subtotalCents * parsedTaxRate) / 100);

  const parsedDiscountValue = Math.max(0, Number(discountValue) || 0);
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
  const next = (lastNumber || 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
