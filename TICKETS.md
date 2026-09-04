# TICKETS — BillFlow Invoicing & Ledger

## [TICKET-001] Multi-Tenant JWT Claim Isolation & RLS Verification
- **Blocked by**: None
- **Delivers**: Database RLS policy and test harness verifying zero cross-tenant leakage.
- **Verification**: `src/__tests__/tenant_service_role_isolation.test.ts`

## [TICKET-002] Deterministic Stripe Idempotency Key Generator
- **Blocked by**: TICKET-001
- **Delivers**: SHA-256 idempotency key pipeline for Stripe payment intent calls.
- **Verification**: Unit tests covering collision resistance and retry counter increments.

## [TICKET-003] Immutable Invoice Status State Machine
- **Blocked by**: TICKET-002
- **Delivers**: Transition enforcement preventing edits to `ISSUED` or `PAID` invoices.
- **Verification**: API integration tests asserting 409 Conflict on invalid transitions.
