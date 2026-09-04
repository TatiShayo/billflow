# SPEC 001: Multi-Tenant Invoicing & Resilient Payment Ledger

## Problem Statement
B2B clients need guaranteed invoice isolation, automated payment reconciliation, and absolute protection against duplicate billing during network timeouts.

## Solution
A robust Next.js + Supabase billing service that utilizes JWT-derived tenant RLS, deterministic Stripe idempotency keys, and immutable invoice status progression.

## User Stories
1. As a tenant admin, I want to create an invoice with multiple line items, so that my customer can be billed accurately.
2. As a tenant admin, I want all invoice amounts calculated in integer cents, so that floating-point rounding errors are eliminated.
3. As a customer, I want to pay via Stripe Checkout with retry resilience, so that I am never double-charged if my connection drops.
4. As a system auditor, I want all cross-tenant access attempts blocked at the database engine level, so that data privacy is guaranteed.

## Implementation Decisions
- Implement `createStripeIdempotencyKey` utility in `src/lib/stripe.ts`.
- Enforce status transitions: `DRAFT` -> `ISSUED` -> `PAID` / `VOID`.
- Validate all incoming payloads with Zod schemas before database insertion.

## Testing Decisions
- Seam: `src/__tests__/tenant_service_role_isolation.test.ts`.
- Verify RLS boundaries and idempotency key uniqueness under concurrent mock invocations.
