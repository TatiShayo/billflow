# ADR 0001: Multi-Tenant RLS and Deterministic Stripe Idempotency

## Context
BillFlow processes financial invoices across multiple tenants. Data leakage between tenants represents an existential risk, and network disruptions during checkout could cause double-billing.

## Decision
1. **Schema-Level RLS**: Supabase Row-Level Security policies derive tenant ownership solely from `auth.jwt()`.
2. **Deterministic Idempotency**: Stripe API mutations must utilize `createStripeIdempotencyKey(tenantId, invoiceId, attempt)`.
3. **Double-Entry Ledger**: Invoices lock into immutable state upon issuance.

## Consequences
- **Positive**: Cryptographic tenant isolation and complete immunity against duplicate charges.
- **Negative**: Requires strict tenant claim hydration in all auth tokens and unit test harnesses.
