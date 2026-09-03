import { describe, it, expect } from "vitest";
import type { InvoiceWithRelations, Expense, Currency } from "./types";

// Mock data fixtures for business logic tests
const mockInvoices: InvoiceWithRelations[] = [
  {
    id: "inv-1",
    user_id: "user-1",
    client_id: "client-1",
    invoice_number: "INV-0001",
    payment_token: "token-1",
    status: "paid",
    issue_date: "2026-01-10",
    due_date: "2026-02-10",
    subtotal: 1000,
    tax_rate: 10,
    tax_amount: 100,
    discount_amount: 0,
    total: 1100,
    currency: "USD",
    notes: "Payment complete",
    paid_at: "2026-01-20T10:00:00Z",
    created_at: "2026-01-10T10:00:00Z",
    client: {
      id: "client-1",
      user_id: "user-1",
      name: "Acme Corp",
      email: "billing@acme.com",
      phone: null,
      company: "Acme Industries",
      address: "123 Main St",
      currency: "USD",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    items: [],
  },
  {
    id: "inv-2",
    user_id: "user-1",
    client_id: "client-2",
    invoice_number: "INV-0002",
    payment_token: "token-2",
    status: "sent",
    issue_date: "2026-02-01",
    due_date: "2026-03-01",
    subtotal: 500,
    tax_rate: 0,
    tax_amount: 0,
    discount_amount: 50,
    total: 450,
    currency: "USD",
    notes: null,
    paid_at: null,
    created_at: "2026-02-01T10:00:00Z",
    client: {
      id: "client-2",
      user_id: "user-1",
      name: "Beta LLC",
      email: "finance@beta.io",
      phone: null,
      company: "Beta Group",
      address: null,
      currency: "USD",
      notes: null,
      created_at: "2026-01-05T00:00:00Z",
    },
    items: [],
  },
  {
    id: "inv-3",
    user_id: "user-1",
    client_id: "client-1",
    invoice_number: "INV-0003",
    payment_token: "token-3",
    status: "overdue",
    issue_date: "2026-01-01",
    due_date: "2026-01-31",
    subtotal: 800,
    tax_rate: 0,
    tax_amount: 0,
    discount_amount: 0,
    total: 800,
    currency: "USD",
    notes: null,
    paid_at: null,
    created_at: "2026-01-01T10:00:00Z",
    client: {
      id: "client-1",
      user_id: "user-1",
      name: "Acme Corp",
      email: "billing@acme.com",
      phone: null,
      company: "Acme Industries",
      address: "123 Main St",
      currency: "USD",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    items: [],
  },
  {
    id: "inv-4",
    user_id: "user-1",
    client_id: null,
    invoice_number: "INV-0004",
    payment_token: "token-4",
    status: "draft",
    issue_date: "2026-02-15",
    due_date: "2026-03-15",
    subtotal: 300,
    tax_rate: 0,
    tax_amount: 0,
    discount_amount: 0,
    total: 300,
    currency: "USD",
    notes: null,
    paid_at: null,
    created_at: "2026-02-15T10:00:00Z",
    client: null,
    items: [],
  },
];

describe("Invoice Filtering & Search Logic", () => {
  function filterInvoices(
    invoices: InvoiceWithRelations[],
    search: string,
    statusFilter: string
  ): InvoiceWithRelations[] {
    return invoices.filter((inv) => {
      const s = search.trim().toLowerCase();
      const matchesSearch =
        !s ||
        inv.invoice_number.toLowerCase().includes(s) ||
        inv.client?.name?.toLowerCase().includes(s) ||
        inv.client?.company?.toLowerCase().includes(s);

      const matchesStatus =
        statusFilter === "all" || inv.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  it("returns all invoices when filter is 'all' and search is empty", () => {
    const res = filterInvoices(mockInvoices, "", "all");
    expect(res.length).toBe(4);
  });

  it("filters by status: paid", () => {
    const res = filterInvoices(mockInvoices, "", "paid");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-1");
  });

  it("filters by status: sent", () => {
    const res = filterInvoices(mockInvoices, "", "sent");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-2");
  });

  it("filters by status: overdue", () => {
    const res = filterInvoices(mockInvoices, "", "overdue");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-3");
  });

  it("filters by status: draft", () => {
    const res = filterInvoices(mockInvoices, "", "draft");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-4");
  });

  it("searches by invoice number substring", () => {
    const res = filterInvoices(mockInvoices, "0002", "all");
    expect(res.length).toBe(1);
    expect(res[0].invoice_number).toBe("INV-0002");
  });

  it("searches case-insensitively by client name", () => {
    const res = filterInvoices(mockInvoices, "acme", "all");
    expect(res.length).toBe(2);
    expect(res.map((i) => i.id)).toEqual(["inv-1", "inv-3"]);
  });

  it("searches by client company name", () => {
    const res = filterInvoices(mockInvoices, "Beta Group", "all");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-2");
  });

  it("combines search query with status filter", () => {
    const res = filterInvoices(mockInvoices, "acme", "overdue");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("inv-3");
  });

  it("returns empty array when search matches nothing", () => {
    const res = filterInvoices(mockInvoices, "nonexistent client", "all");
    expect(res.length).toBe(0);
  });
});

describe("Dashboard & Report Aggregations", () => {
  it("calculates outstanding total (sent + overdue)", () => {
    const outstanding = mockInvoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + Number(i.total), 0);

    // inv-2 ($450) + inv-3 ($800) = $1250
    expect(outstanding).toBe(1250);
  });

  it("calculates total paid revenue accurately", () => {
    const totalPaid = mockInvoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.total), 0);

    expect(totalPaid).toBe(1100);
  });

  it("calculates top clients by paid revenue correctly", () => {
    const clientRevenue: Record<string, { name: string; revenue: number }> = {};
    mockInvoices.forEach((inv) => {
      const key = inv.client?.name || "No client";
      if (!clientRevenue[key]) {
        clientRevenue[key] = { name: key, revenue: 0 };
      }
      if (inv.status === "paid") {
        clientRevenue[key].revenue += Number(inv.total);
      }
    });

    const top = Object.values(clientRevenue).sort((a, b) => b.revenue - a.revenue);
    expect(top[0].name).toBe("Acme Corp");
    expect(top[0].revenue).toBe(1100);
  });

  it("calculates status breakdown counts correctly", () => {
    const statusCounts = {
      draft: mockInvoices.filter((i) => i.status === "draft").length,
      sent: mockInvoices.filter((i) => i.status === "sent").length,
      paid: mockInvoices.filter((i) => i.status === "paid").length,
      overdue: mockInvoices.filter((i) => i.status === "overdue").length,
    };
    expect(statusCounts).toEqual({
      draft: 1,
      sent: 1,
      paid: 1,
      overdue: 1,
    });
  });
});

describe("Expense Aggregations by Category", () => {
  const mockExpenses: Expense[] = [
    {
      id: "e1",
      user_id: "u1",
      description: "GitHub Copilot",
      amount: 20,
      currency: "USD",
      category: "software",
      expense_date: "2026-05-01",
      receipt_url: null,
      notes: null,
      created_at: "2026-05-01T00:00:00Z",
    },
    {
      id: "e2",
      user_id: "u1",
      description: "AWS Hosting",
      amount: 150,
      currency: "USD",
      category: "software",
      expense_date: "2026-05-02",
      receipt_url: null,
      notes: null,
      created_at: "2026-05-02T00:00:00Z",
    },
    {
      id: "e3",
      user_id: "u1",
      description: "Uber to Client",
      amount: 35.5,
      currency: "USD",
      category: "transport",
      expense_date: "2026-05-03",
      receipt_url: null,
      notes: null,
      created_at: "2026-05-03T00:00:00Z",
    },
  ];

  it("groups expense amounts by category accurately", () => {
    const softwareTotal = mockExpenses
      .filter((e) => e.category === "software")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(softwareTotal).toBe(170);

    const transportTotal = mockExpenses
      .filter((e) => e.category === "transport")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(transportTotal).toBe(35.5);
  });
});

describe("Auth Callback Open-Redirect Security Sanitizer", () => {
  function sanitizeRedirectUrl(rawNext: string | null | undefined): string {
    const fallback = "/dashboard";
    if (!rawNext) return fallback;
    // Must start with single slash and NOT double slash or protocol
    if (rawNext.startsWith("/") && !rawNext.startsWith("//")) {
      return rawNext;
    }
    return fallback;
  }

  it("permits standard internal relative paths", () => {
    expect(sanitizeRedirectUrl("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectUrl("/dashboard/invoices/new")).toBe("/dashboard/invoices/new");
    expect(sanitizeRedirectUrl("/dashboard/settings?tab=billing")).toBe("/dashboard/settings?tab=billing");
  });

  it("blocks open redirect attacks using double slashes (//attacker.com)", () => {
    expect(sanitizeRedirectUrl("//attacker.com")).toBe("/dashboard");
    expect(sanitizeRedirectUrl("//evil.com/phish")).toBe("/dashboard");
  });

  it("blocks open redirect attacks using full external URLs", () => {
    expect(sanitizeRedirectUrl("https://evil.com")).toBe("/dashboard");
    expect(sanitizeRedirectUrl("http://phishing.site/login")).toBe("/dashboard");
    expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("handles null and undefined by falling back to /dashboard", () => {
    expect(sanitizeRedirectUrl(null)).toBe("/dashboard");
    expect(sanitizeRedirectUrl(undefined)).toBe("/dashboard");
    expect(sanitizeRedirectUrl("")).toBe("/dashboard");
  });
});
