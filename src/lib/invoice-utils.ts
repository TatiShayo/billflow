export interface LineItemInput {
  quantity: number;
  unitPrice: number;
}

export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxRate: string | number,
  discountType: "fixed" | "percent",
  discountValue: string | number
) {
  const subtotal = Math.round(
    lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) * 100
  ) / 100;

  const parsedTaxRate = Number(taxRate) || 0;
  const taxAmount = Math.round(((subtotal * parsedTaxRate) / 100) * 100) / 100;

  const parsedDiscountValue = Number(discountValue) || 0;
  const discountAmount =
    discountType === "percent"
      ? Math.round(((subtotal * parsedDiscountValue) / 100) * 100) / 100
      : parsedDiscountValue;

  const total = Math.round((subtotal + taxAmount - discountAmount) * 100) / 100;

  return {
    subtotal,
    taxAmount,
    discountAmount,
    total,
  };
}

export function incrementInvoiceNumber(prefix: string, lastNumber: number): string {
  const next = (lastNumber || 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
