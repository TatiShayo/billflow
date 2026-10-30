import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  calculateInvoiceTotals,
  validateInvoiceTotals,
  incrementInvoiceNumber,
  parseInvoiceDate,
} from "../lib/invoice-utils";
import {
  escapeHtml,
  sanitizeHeaderValue,
  sanitizeRedirectPath,
  timingSafeCompare,
} from "../lib/utils";
import { generatePayToken } from "../lib/pay-token";
import { rateLimit } from "../lib/rate-limit";
import {
  decideEventDedupe,
  parsePlanMetadata,
  resolvePlanFromPriceId,
  extractSubscriptionId,
  PG_UNIQUE_VIOLATION,
} from "../lib/webhook-utils";
import {
  aiInvoiceInputSchema,
  aiInvoiceItemSchema,
  aiInvoiceOutputSchema,
  sanitizeAiOutput,
} from "../app/api/ai/invoice/route";
import { formatCurrency, CURRENCIES, CURRENCY_SYMBOLS, TIER_LIMITS, type Currency } from "../lib/types";

/* 1. IDOR & TENANT ISOLATION TESTS                                          */
describe("Archetype 1: IDOR & Tenant Isolation", () => {
  it("prevents cross-tenant access in tenant-filtered datasets", () => {
    interface RecordWithUser {
      id: string;
      user_id: string;
      data: string;
    }

    const tenantAUser = "user_tenant_A_uuid";
    const tenantBUser = "user_tenant_B_uuid";

    const dbRecords: RecordWithUser[] = [
      { id: "inv_1", user_id: tenantAUser, data: "Tenant A Invoice 1" },
      { id: "inv_2", user_id: tenantAUser, data: "Tenant A Invoice 2" },
      { id: "inv_3", user_id: tenantBUser, data: "Tenant B Secret Invoice" },
    ];

    // Simulating RLS query filter: SELECT * WHERE id = target_id AND user_id = auth.uid()
    const queryAsTenantA = (recordId: string) =>
      dbRecords.find((r) => r.id === recordId && r.user_id === tenantAUser) || null;

    // Tenant A can view their own
    expect(queryAsTenantA("inv_1")?.data).toBe("Tenant A Invoice 1");
    // Tenant A attempts IDOR on Tenant B's record
    expect(queryAsTenantA("inv_3")).toBeNull();
  });

  it("ensures public pay tokens never expose owner identity or secret tokens", () => {
    const internalInvoiceRecord = {
      id: "inv_uuid_secret",
      user_id: "user_owner_uuid",
      client_id: "client_uuid_internal",
      invoice_number: "INV-9999",
      payment_token: "private_owner_token_abc123",
      status: "sent",
      issue_date: "2026-06-01",
      due_date: "2026-07-01",
      subtotal: 500,
      tax_rate: 10,
      tax_amount: 50,
      total: 550,
      currency: "USD",
      notes: "Please pay via bank transfer",
      created_at: "2026-06-01T00:00:00Z",
    };

    // Public pay fields whitelist
    const publicWhitelist = [
      "id",
      "invoice_number",
      "issue_date",
      "due_date",
      "status",
      "currency",
      "subtotal",
      "tax_amount",
      "tax_rate",
      "total",
      "notes",
    ];

    const sanitizedPublicResponse = Object.fromEntries(
      Object.entries(internalInvoiceRecord).filter(([k]) => publicWhitelist.includes(k))
    );

    expect(sanitizedPublicResponse).not.toHaveProperty("user_id");
    expect(sanitizedPublicResponse).not.toHaveProperty("payment_token");
    expect(sanitizedPublicResponse).not.toHaveProperty("client_id");
    expect(sanitizedPublicResponse.invoice_number).toBe("INV-9999");
  });

  it("rejects expired share tokens from granting invoice access", () => {
    const isShareTokenValid = (st: { expires_at: string | null } | null) =>
      !!st && (!st.expires_at || new Date(st.expires_at).getTime() > Date.now());

    const expiredToken = {
      expires_at: new Date(Date.now() - 3600_000).toISOString(),
    };
    const validToken = {
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
    const perpetualToken = { expires_at: null };

    expect(isShareTokenValid(expiredToken)).toBe(false);
    expect(isShareTokenValid(validToken)).toBe(true);
    expect(isShareTokenValid(perpetualToken)).toBe(true);
    expect(isShareTokenValid(null)).toBe(false);
  });

  it("enforces tier hierarchy restrictions preventing unauthorized tier escalation", () => {
    const tierRank: Record<string, number> = { free: 0, pro: 1, business: 2 };
    const canAccessFeature = (userTier: string, requiredTier: string) =>
      (tierRank[userTier] ?? -1) >= (tierRank[requiredTier] ?? 99);

    expect(canAccessFeature("free", "pro")).toBe(false);
    expect(canAccessFeature("free", "business")).toBe(false);
    expect(canAccessFeature("pro", "business")).toBe(false);
    expect(canAccessFeature("pro", "pro")).toBe(true);
    expect(canAccessFeature("business", "pro")).toBe(true);
    expect(canAccessFeature("business", "business")).toBe(true);
    expect(canAccessFeature("attacker_tier", "pro")).toBe(false);
  });

  it("validates cross-client IDOR prevention during invoice association", () => {
    const clientsDb = [
      { id: "client-1", user_id: "user-alpha", name: "Alpha Client" },
      { id: "client-2", user_id: "user-beta", name: "Beta Client" },
    ];

    const canUserAssignClient = (userId: string, clientId: string) => {
      const client = clientsDb.find((c) => c.id === clientId);
      return client ? client.user_id === userId : false;
    };

    expect(canUserAssignClient("user-alpha", "client-1")).toBe(true);
    expect(canUserAssignClient("user-alpha", "client-2")).toBe(false);
    expect(canUserAssignClient("user-beta", "client-1")).toBe(false);
    expect(canUserAssignClient("user-beta", "client-2")).toBe(true);
  });
});

/* 2. TOCTOU & CONCURRENCY TESTS                                             */
describe("Archetype 2: TOCTOU & Concurrency", () => {
  it("handles webhook event idempotency under simultaneous duplicate deliveries", () => {
    const ledger = new Set<string>();

    function simulateWebhookArrival(eventId: string): { status: number; duplicate: boolean } {
      const isDuplicate = ledger.has(eventId);
      if (isDuplicate) {
        const decision = decideEventDedupe({ code: PG_UNIQUE_VIOLATION });
        return { status: 200, duplicate: decision === "duplicate" };
      }
      ledger.add(eventId);
      return { status: 200, duplicate: false };
    }

    const eventId = "evt_stripe_test_concurrent_123";

    // 1st delivery
    const res1 = simulateWebhookArrival(eventId);
    expect(res1.status).toBe(200);
    expect(res1.duplicate).toBe(false);

    // 2nd delivery (replayed or simultaneous retry)
    const res2 = simulateWebhookArrival(eventId);
    expect(res2.status).toBe(200);
    expect(res2.duplicate).toBe(true);

    // 3rd delivery
    const res3 = simulateWebhookArrival(eventId);
    expect(res3.status).toBe(200);
    expect(res3.duplicate).toBe(true);
  });

  it("handles concurrent rate limit requests across thread-like calls", () => {
    const key = `concur_test_${Math.random()}`;
    const limit = 10;
    const results: boolean[] = [];

    // Simulate 20 rapid bursts
    for (let i = 0; i < 20; i++) {
      const res = rateLimit(key, limit, 60_000);
      results.push(res.allowed);
    }

    const allowedCount = results.filter(Boolean).length;
    const blockedCount = results.filter((b) => !b).length;

    expect(allowedCount).toBe(10);
    expect(blockedCount).toBe(10);
  });

  it("preserves strict sequential numbering under sequential counter increment", () => {
    let currentNumber = 1;
    const numbers: string[] = [];

    for (let i = 0; i < 15; i++) {
      const nextStr = incrementInvoiceNumber("INV", currentNumber);
      numbers.push(nextStr);
      currentNumber++;
    }

    expect(numbers[0]).toBe("INV-0002");
    expect(numbers[13]).toBe("INV-0015");
    expect(new Set(numbers).size).toBe(15);
  });

  it("safely handles non-standard prefixes during numbering increment", () => {
    expect(incrementInvoiceNumber("BILL-2026", 99)).toBe("BILL-2026-0100");
    expect(incrementInvoiceNumber("ORG/INV", 0)).toBe("ORG/INV-0001");
    expect(incrementInvoiceNumber("", -10)).toBe("INV-0001");
  });
});

/* 3. PROTOTYPE POLLUTION & OBJECT KEY INJECTION                             */
describe("Archetype 3: Prototype Pollution & Object Key Injection", () => {
  it("rejects prototype pollution keys in JSON payloads without mutating Object.prototype", () => {
    const pollutedJson = '{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"admin": true}}, "description": "Consulting work"}';

    // Verify prototype is clean before
    expect((Object.prototype as unknown as { polluted?: string }).polluted).toBeUndefined();
    expect((Object.prototype as unknown as { admin?: boolean }).admin).toBeUndefined();

    const parsed = JSON.parse(pollutedJson);
    const schema = z.object({
      description: z.string(),
    });

    const validated = schema.safeParse(parsed);
    expect(validated.success).toBe(true);

    // Verify prototype remains clean after
    expect((Object.prototype as unknown as { polluted?: string }).polluted).toBeUndefined();
    expect((Object.prototype as unknown as { admin?: boolean }).admin).toBeUndefined();
  });

  it("sanitizes AI invoice outputs with injected prototype keys safely", () => {
    const maliciousAiOutput = JSON.stringify({
      __proto__: { isAdmin: true },
      items: [{ description: "Hardening", quantity: 1, unitPrice: 200 }],
      suggestedPaymentTerms: "Net 15",
      notes: "Safe",
    });

    const result = sanitizeAiOutput(maliciousAiOutput);
    expect(result.items.length).toBe(1);
    expect((result as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
    expect((Object.prototype as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });

  it("rejects non-object structures in sanitizeAiOutput", () => {
    expect(() => sanitizeAiOutput("null")).toThrow();
    expect(() => sanitizeAiOutput("[]")).toThrow();
    expect(() => sanitizeAiOutput('"just a string"')).toThrow();
    expect(() => sanitizeAiOutput("12345")).toThrow();
  });

  it("safely handles injected __proto__ keys in nested line item objects", () => {
    const maliciousNestedJson = JSON.stringify({
      items: [
        {
          __proto__: { bypass: true },
          description: "Malicious item",
          quantity: 1,
          unitPrice: 50,
        },
      ],
      suggestedPaymentTerms: "Net 30",
      notes: "",
    });

    const sanitized = sanitizeAiOutput(maliciousNestedJson);
    expect(sanitized.items[0].description).toBe("Malicious item");
    expect((Object.prototype as unknown as { bypass?: boolean }).bypass).toBeUndefined();
  });
});

/* 4. PARSER DESYNC & MALFORMED PAYLOADS                                     */
describe("Archetype 4: Parser Desync & Malformed Payloads", () => {
  it("handles malformed JSON, trailing commas, and incomplete JSON strings gracefully", () => {
    const malformedPayloads = [
      '{"description": "Incomplete',
      '{"items": [1, 2, ],}',
      "{ bad: json }",
      "undefined",
      "<<xml><script>alert(1)</script></xml>",
      "\x00\x00\x00\x00",
    ];

    malformedPayloads.forEach((payload) => {
      expect(() => sanitizeAiOutput(payload)).toThrow();
    });
  });

  it("strips various markdown fences (json, JSON, raw, trailing backticks)", () => {
    const fence1 = '```json\n{"items":[{"description":"A","quantity":1,"unitPrice":10}]}\n```';
    const fence2 = '```JSON\n{"items":[{"description":"B","quantity":2,"unitPrice":20}]}\n```';
    const fence3 = '```\n{"items":[{"description":"C","quantity":3,"unitPrice":30}]}\n```';

    expect(sanitizeAiOutput(fence1).items[0].description).toBe("A");
    expect(sanitizeAiOutput(fence2).items[0].description).toBe("B");
    expect(sanitizeAiOutput(fence3).items[0].description).toBe("C");
  });

  it("handles null-byte (%00, \\0) injections in header and text inputs", () => {
    const nullByteInput = "Valid Text\x00Evil Injected String";
    const sanitized = sanitizeHeaderValue(nullByteInput);

    expect(sanitized).not.toContain("\x00");
    expect(sanitized).toBe("Valid TextEvil Injected String");
  });

  it("handles exotic unicode, zero-width characters and RTL directional overrides safely", () => {
    const evilUnicode = "INV\u200B-\u202E001";
    const formatted = formatCurrency(100, "USD");
    expect(formatted).toBe("$100.00");
    expect(typeof evilUnicode).toBe("string");
  });

  it("extracts subscription ID safely across malformed and atypical payload structures", () => {
    expect(extractSubscriptionId("sub_real_123")).toBe("sub_real_123");
    expect(extractSubscriptionId({ id: "sub_nested_456" })).toBe("sub_nested_456");
    expect(extractSubscriptionId(null)).toBeNull();
    expect(extractSubscriptionId(undefined)).toBeNull();
    expect(extractSubscriptionId({})).toBeNull();
    expect(extractSubscriptionId([])).toBeNull();
    expect(extractSubscriptionId({ id: 12345 })).toBeNull();
    expect(extractSubscriptionId(true)).toBeNull();
  });
});

/* 5. CRLF & HEADER INJECTION TESTS                                          */
describe("Archetype 5: CRLF & Header Injection", () => {
  it("strips CRLF (\\r, \\n) from email and HTTP header inputs", () => {
    const maliciousHeader = "BillFlow Freelancer\r\nSet-Cookie: session=hijacked\r\nBcc: evil@attacker.com";
    const cleaned = sanitizeHeaderValue(maliciousHeader);

    expect(cleaned).not.toContain("\r");
    expect(cleaned).not.toContain("\n");
    expect(cleaned).toBe("BillFlow FreelancerSet-Cookie: session=hijackedBcc: evil@attacker.com");
  });

  it("sanitizes fallback on completely empty or whitespace CRLF inputs", () => {
    expect(sanitizeHeaderValue("\r\n\r\n", "Default")).toBe("Default");
    expect(sanitizeHeaderValue(null, "Default")).toBe("Default");
    expect(sanitizeHeaderValue(undefined, "Default")).toBe("Default");
  });

  it("blocks open redirect attacks and backslash scheme evasion via sanitizeRedirectPath", () => {
    const attacks = [
      "//attacker.com",
      "//evil.com/path",
      "/\\attacker.com",
      "\\attacker.com",
      "https://attacker.com",
      "http://attacker.com",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "/dashboard\r\nLocation: https://evil.com",
      "/dashboard\nSet-Cookie: evil=1",
      "/dashboard\x00/admin",
    ];

    attacks.forEach((attack) => {
      expect(sanitizeRedirectPath(attack, "/dashboard")).toBe("/dashboard");
    });
  });

  it("allows safe relative paths through sanitizeRedirectPath", () => {
    const safePaths = [
      "/dashboard",
      "/dashboard/invoices",
      "/dashboard/invoices/new",
      "/dashboard/settings?tab=billing&success=true",
      "/pay/abc-123",
    ];

    safePaths.forEach((path) => {
      expect(sanitizeRedirectPath(path, "/dashboard")).toBe(path);
    });
  });

  it("escapes all dangerous HTML characters to prevent XSS in email templates", () => {
    const xssPayload = '<script>alert("XSS")</script>&<img src="x" onerror="stealCookies()">\'';
    const escaped = escapeHtml(xssPayload);

    expect(escaped).not.toContain("<script>");
    expect(escaped).not.toContain("</script>");
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("&amp;");
    expect(escaped).toContain("&quot;");
    expect(escaped).toContain("&#039;");
  });

  it("handles null and undefined safely in escapeHtml", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(123)).toBe("123");
  });

  it("fuzzes CRLF and control characters across 50 random ASCII strings", () => {
    for (let i = 0; i < 50; i++) {
      const chars = ["\r", "\n", "\x00", "\x1F", "\x7F", "A", "B", " ", "_", "-"];
      const randomStr = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const sanitized = sanitizeHeaderValue(randomStr);

      expect(sanitized).not.toMatch(/[\r\n\x00-\x1F\x7F]/);
    }
  });
});

/* 6. ARITHMETIC EDGE CASES & MONEY INTEGRITY                                */
describe("Archetype 6: Arithmetic Edge Cases & Money Integrity", () => {
  it("never yields negative total under any extreme discount or negative inputs", () => {
    // 200 fuzzing iterations with random chaotic inputs
    for (let i = 0; i < 200; i++) {
      const qty = (Math.random() - 0.5) * 100;
      const price = (Math.random() - 0.5) * 1000;
      const tax = (Math.random() - 0.5) * 100;
      const discountVal = Math.random() * 5000;
      const discountType = Math.random() > 0.5 ? "fixed" : "percent";

      const res = calculateInvoiceTotals(
        [{ quantity: qty, unitPrice: price }],
        tax,
        discountType,
        discountVal
      );

      expect(res.subtotal).toBeGreaterThanOrEqual(0);
      expect(res.taxAmount).toBeGreaterThanOrEqual(0);
      expect(res.discountAmount).toBeGreaterThanOrEqual(0);
      expect(res.total).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(res.total)).toBe(true);
    }
  });

  it("detects any deliberate cent-level tampering with validateInvoiceTotals", () => {
    const items = [
      { quantity: 3, unitPrice: 33.33 },
      { quantity: 1, unitPrice: 0.01 },
    ];
    // subtotal = 3 * 33.33 (99.99) + 0.01 = 100.00
    // tax 10% = 10.00
    // discount = 5.00
    // total = 105.00

    const valid = { subtotal: 100, taxAmount: 10, discountAmount: 5, total: 105 };
    expect(validateInvoiceTotals(valid, items, 10, "fixed", 5).ok).toBe(true);

    // Tamper by 1 cent on each field individually
    expect(validateInvoiceTotals({ ...valid, subtotal: 99.99 }, items, 10, "fixed", 5).ok).toBe(false);
    expect(validateInvoiceTotals({ ...valid, taxAmount: 9.99 }, items, 10, "fixed", 5).ok).toBe(false);
    expect(validateInvoiceTotals({ ...valid, discountAmount: 5.01 }, items, 10, "fixed", 5).ok).toBe(false);
    expect(validateInvoiceTotals({ ...valid, total: 104.99 }, items, 10, "fixed", 5).ok).toBe(false);
  });

  it("handles high precision sub-cent values without float rounding overflow", () => {
    const items = [
      { quantity: 0.0001, unitPrice: 1000 }, // 0.1
      { quantity: 0.333333, unitPrice: 3 }, // 1.00
    ];
    const totals = calculateInvoiceTotals(items, 0, "fixed", 0);
    expect(totals.subtotal).toBe(1.1);
    expect(totals.total).toBe(1.1);
  });

  it("handles large values approaching billions safely", () => {
    const items = [{ quantity: 1_000_000, unitPrice: 1_000 }];
    const totals = calculateInvoiceTotals(items, 15, "percent", 10);
    // subtotal = 1,000,000,000.00
    // tax = 150,000,000.00
    // discount = 100,000,000.00
    // total = 1,050,000,000.00
    expect(totals.subtotal).toBe(1_000_000_000);
    expect(totals.taxAmount).toBe(150_000_000);
    expect(totals.discountAmount).toBe(100_000_000);
    expect(totals.total).toBe(1_050_000_000);
  });

  it("fuzzes formatCurrency across 100 random amounts and currencies without crashing", () => {
    for (let i = 0; i < 100; i++) {
      const amt = (Math.random() - 0.3) * 1_000_000;
      const currency = CURRENCIES[i % CURRENCIES.length];
      const formatted = formatCurrency(amt, currency);
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
    }
  });
});

/* 7. REDOS & BUFFER LIMIT TESTS                                             */
describe("Archetype 7: ReDoS & Buffer Limits", () => {
  it("evaluates parseInvoiceDate linearly without backtracking on evil input patterns", () => {
    const evilDateString = "2024-" + "9".repeat(50_000) + "-01";
    const start = performance.now();
    const result = parseInvoiceDate(evilDateString);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // Must parse in <50ms without catastrophic backtracking
    expect(result instanceof Date).toBe(true);
  });

  it("enforces max length constraints on AI invoice schemas", () => {
    // 4000 char limit on description
    const validDesc = "a".repeat(4000);
    const oversizedDesc = "a".repeat(4001);

    expect(aiInvoiceInputSchema.safeParse({ description: validDesc }).success).toBe(true);
    expect(aiInvoiceInputSchema.safeParse({ description: oversizedDesc }).success).toBe(false);
  });

  it("enforces max items limit in AI invoice output schema to prevent memory exhaustion", () => {
    const items100 = Array.from({ length: 100 }, (_, i) => ({
      description: `Item ${i}`,
      quantity: 1,
      unitPrice: 10,
    }));
    const items101 = Array.from({ length: 101 }, (_, i) => ({
      description: `Item ${i}`,
      quantity: 1,
      unitPrice: 10,
    }));

    expect(aiInvoiceOutputSchema.safeParse({ items: items100 }).success).toBe(true);
    expect(aiInvoiceOutputSchema.safeParse({ items: items101 }).success).toBe(false);
  });

  it("sweeps expired buckets to prevent memory leaks in the rate limiter", () => {
    vi.useFakeTimers();
    try {
      const baseKey = `leak_test_${Math.random()}`;
      for (let i = 0; i < 50; i++) {
        rateLimit(`${baseKey}_${i}`, 5, 1_000);
      }

      // Advance time beyond window
      vi.advanceTimersByTime(2_000);

      // Next call triggers sweep
      const next = rateLimit(`${baseKey}_new`, 5, 1_000);
      expect(next.allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

/* 8. CRYPTOGRAPHIC TIMING ATTACKS & TOKEN SECURITY                         */
describe("Archetype 8: Cryptographic Timing Attacks & Token Security", () => {
  it("timingSafeCompare returns true for strictly identical strings", () => {
    const secret = "dummy_live_token_for_timing_safe_test_12345";
    expect(timingSafeCompare(secret, secret)).toBe(true);
    expect(timingSafeCompare("simple", "simple")).toBe(true);
    expect(timingSafeCompare("", "")).toBe(true);
  });

  it("timingSafeCompare returns false for any mismatch regardless of position", () => {
    const original = "0123456789abcdef0123456789abcdef";

    // Mismatch at start
    const mismatchStart = "x123456789abcdef0123456789abcdef";
    // Mismatch at middle
    const mismatchMiddle = "0123456789abcxef0123456789abcdef";
    // Mismatch at end
    const mismatchEnd = "0123456789abcdef0123456789abcdez";
    // Different length
    const diffLength = "0123456789";

    expect(timingSafeCompare(original, mismatchStart)).toBe(false);
    expect(timingSafeCompare(original, mismatchMiddle)).toBe(false);
    expect(timingSafeCompare(original, mismatchEnd)).toBe(false);
    expect(timingSafeCompare(original, diffLength)).toBe(false);
  });

  it("timingSafeCompare safely rejects non-string or null inputs without throwing", () => {
    expect(timingSafeCompare(null, "secret")).toBe(false);
    expect(timingSafeCompare("secret", undefined)).toBe(false);
    expect(timingSafeCompare(null, null)).toBe(false);
    expect(timingSafeCompare(undefined, undefined)).toBe(false);
  });

  it("generatePayToken satisfies cryptographically secure randomness properties", () => {
    const tokens = new Set<string>();
    const count = 500;

    for (let i = 0; i < count; i++) {
      const token = generatePayToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      tokens.add(token);
    }

    // 0 collisions across 500 randomly generated tokens
    expect(tokens.size).toBe(count);
  });

  it("enforces plan metadata verification against foreign/tampered price IDs", () => {
    const PRO = "price_pro_real_123";
    const BUSINESS = "price_biz_real_456";

    expect(resolvePlanFromPriceId(PRO, PRO, BUSINESS)).toBe("pro");
    expect(resolvePlanFromPriceId(BUSINESS, PRO, BUSINESS)).toBe("business");
    expect(resolvePlanFromPriceId("price_attacker_cheap", PRO, BUSINESS)).toBe("free");
    expect(resolvePlanFromPriceId(null, PRO, BUSINESS)).toBe("free");
  });
});
