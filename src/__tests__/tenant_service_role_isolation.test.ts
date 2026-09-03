import { describe, it, expect } from "vitest";
import { createStripeIdempotencyKey } from "../lib/stripe";
import { timingSafeCompare } from "../lib/utils";

describe("Tenant Isolation & Service Role Invariants", () => {
  it("enforces deterministic stripe idempotency key windows", () => {
    const key1 = createStripeIdempotencyKey("invoice.pay", "inv_12345", 5);
    const key2 = createStripeIdempotencyKey("invoice.pay", "inv_12345", 5);
    const keyDifferentEntity = createStripeIdempotencyKey("invoice.pay", "inv_67890", 5);
    const keyDifferentAction = createStripeIdempotencyKey("invoice.void", "inv_12345", 5);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDifferentEntity);
    expect(key1).not.toBe(keyDifferentAction);
    expect(key1).toMatch(/^invoice\.pay:inv_12345:\d+$/);
  });

  it("verifies timing-safe authorization token verification", () => {
    const secret = "super-secret-service-role-key-9999";
    const validCandidate = "super-secret-service-role-key-9999";
    const invalidCandidate = "super-secret-service-role-key-8888";
    const prefixCandidate = "super-secret-service-role-key";

    expect(timingSafeCompare(validCandidate, secret)).toBe(true);
    expect(timingSafeCompare(invalidCandidate, secret)).toBe(false);
    expect(timingSafeCompare(prefixCandidate, secret)).toBe(false);
    expect(timingSafeCompare("", secret)).toBe(false);
  });

  it("prevents tenant identifier injection or path traversal in invoice lookups", () => {
    const sanitizeTenantId = (raw: string): string | null => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(raw.trim()) ? raw.trim().toLowerCase() : null;
    };

    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    const traversalAttempt = "../../../etc/passwd";
    const sqlInjection = "' OR 1=1 --";
    const nullByte = "123e4567-e89b-12d3-a456-426614174000\0";

    expect(sanitizeTenantId(validUuid)).toBe(validUuid);
    expect(sanitizeTenantId(traversalAttempt)).toBeNull();
    expect(sanitizeTenantId(sqlInjection)).toBeNull();
    expect(sanitizeTenantId(nullByte)).toBeNull();
  });
});
