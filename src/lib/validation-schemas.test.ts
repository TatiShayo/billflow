import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  aiInvoiceInputSchema,
  aiInvoiceItemSchema,
  aiInvoiceOutputSchema,
  sanitizeAiOutput,
} from "../app/api/ai/invoice/route";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
});

const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Invalid email").nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  currency: z.enum(["USD", "GBP", "EUR", "KES", "ZAR", "NGN"]).default("USD"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const expenseInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  amount: z.coerce.number().finite().positive("Amount must be greater than 0"),
  currency: z.enum(["USD", "GBP", "EUR", "KES", "ZAR", "NGN"]).default("USD"),
  category: z.enum(["food", "transport", "software", "equipment", "office", "other"]).default("other"),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

describe("AI Invoice Input Schema Validation", () => {
  it("accepts valid descriptions and currencies", () => {
    const res = aiInvoiceInputSchema.safeParse({
      description: "Built a modern website for 20 hours at $50/hr",
      currency: "USD",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.description).toBe("Built a modern website for 20 hours at $50/hr");
      expect(res.data.currency).toBe("USD");
    }
  });

  it("trims whitespace from input description", () => {
    const res = aiInvoiceInputSchema.safeParse({
      description: "   Custom logo branding   ",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.description).toBe("Custom logo branding");
    }
  });

  it("rejects empty description or whitespace-only", () => {
    const emptyRes = aiInvoiceInputSchema.safeParse({ description: "" });
    expect(emptyRes.success).toBe(false);

    const spaceRes = aiInvoiceInputSchema.safeParse({ description: "   " });
    expect(spaceRes.success).toBe(false);
  });

  it("rejects descriptions exceeding 4000 characters", () => {
    const longDesc = "a".repeat(4001);
    const res = aiInvoiceInputSchema.safeParse({ description: longDesc });
    expect(res.success).toBe(false);
  });
});

describe("AI Invoice Output Sanitizer & Schema", () => {
  it("parses clean JSON string into validated structure", () => {
    const raw = JSON.stringify({
      items: [
        { description: "Frontend Development", quantity: 40, unitPrice: 75 },
        { description: "API Integration", quantity: 10, unitPrice: 85 },
      ],
      suggestedPaymentTerms: "Net 15",
      notes: "Please wire payment to account X",
    });

    const result = sanitizeAiOutput(raw);
    expect(result.items.length).toBe(2);
    expect(result.items[0].description).toBe("Frontend Development");
    expect(result.items[0].quantity).toBe(40);
    expect(result.items[0].unitPrice).toBe(75);
    expect(result.suggestedPaymentTerms).toBe("Net 15");
    expect(result.notes).toBe("Please wire payment to account X");
  });

  it("strips markdown code blocks before parsing (```json ... ```)", () => {
    const raw = '```json\n{\n  "items": [{ "description": "SEO Audit", "quantity": 1, "unitPrice": 500 }],\n  "suggestedPaymentTerms": "Due on Receipt",\n  "notes": "Thank you"\n}\n```';
    const result = sanitizeAiOutput(raw);
    expect(result.items[0].description).toBe("SEO Audit");
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unitPrice).toBe(500);
    expect(result.suggestedPaymentTerms).toBe("Due on Receipt");
  });

  it("coerces string numbers to valid numbers", () => {
    const raw = JSON.stringify({
      items: [{ description: "Design", quantity: "5", unitPrice: "100.50" }],
      suggestedPaymentTerms: "Net 30",
      notes: "",
    });
    const result = sanitizeAiOutput(raw);
    expect(result.items[0].quantity).toBe(5);
    expect(result.items[0].unitPrice).toBe(100.5);
  });

  it("throws on malformed JSON", () => {
    expect(() => sanitizeAiOutput("not valid json at all")).toThrow();
  });

  it("throws when items array is empty", () => {
    const raw = JSON.stringify({
      items: [],
      suggestedPaymentTerms: "Net 30",
      notes: "",
    });
    expect(() => sanitizeAiOutput(raw)).toThrow();
  });
});

describe("Stripe Checkout Schema Validation", () => {
  it("accepts valid pro and business plans", () => {
    expect(checkoutSchema.safeParse({ plan: "pro" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ plan: "business" }).success).toBe(true);
  });

  it("rejects invalid plans (free, enterprise, admin)", () => {
    expect(checkoutSchema.safeParse({ plan: "free" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: "enterprise" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({}).success).toBe(false);
  });
});

describe("Client Input Schema Validation", () => {
  it("accepts valid client information", () => {
    const validClient = {
      name: "Acme Corp",
      email: "contact@acme.com",
      phone: "+1 555 123 4567",
      company: "Acme Industries",
      address: "123 Main St, New York, NY",
      currency: "USD" as const,
      notes: "VIP Client",
    };
    const res = clientInputSchema.safeParse(validClient);
    expect(res.success).toBe(true);
  });

  it("rejects client without name", () => {
    const res = clientInputSchema.safeParse({ name: "   ", email: "test@example.com" });
    expect(res.success).toBe(false);
  });

  it("accepts optional/empty email", () => {
    const res = clientInputSchema.safeParse({ name: "John Doe", email: "" });
    expect(res.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const res = clientInputSchema.safeParse({ name: "John Doe", email: "invalid-email" });
    expect(res.success).toBe(false);
  });
});

describe("Expense Input Schema Validation", () => {
  it("accepts valid expense entries", () => {
    const validExpense = {
      description: "Cloud Hosting — AWS",
      amount: 85.5,
      currency: "USD" as const,
      category: "software" as const,
      expense_date: "2026-05-15",
      notes: "Monthly recurring server cost",
    };
    const res = expenseInputSchema.safeParse(validExpense);
    expect(res.success).toBe(true);
  });

  it("rejects zero or negative expense amounts", () => {
    expect(
      expenseInputSchema.safeParse({
        description: "Coffee",
        amount: 0,
        expense_date: "2026-05-15",
      }).success
    ).toBe(false);

    expect(
      expenseInputSchema.safeParse({
        description: "Coffee",
        amount: -10,
        expense_date: "2026-05-15",
      }).success
    ).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(
      expenseInputSchema.safeParse({
        description: "Taxi",
        amount: 25,
        expense_date: "15/05/2026",
      }).success
    ).toBe(false);
  });
});
