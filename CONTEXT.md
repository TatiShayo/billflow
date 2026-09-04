# CONTEXT.md — Ubiquitous Domain Language (BillFlow)

## Core Entities
- **Tenant**: An isolated organization boundary owning billing configurations, customers, and invoices.
- **Invoice**: A payable financial document containing immutable line items once marked in `ISSUED` status.
- **LedgerEntry**: Double-entry record tracking credits and debits tied directly to a Stripe `PaymentIntent`.
- **IdempotencyKey**: Cryptographically secure single-use token preventing double-billing during network retries.

## Domain Invariants
- `invoice.total_amount` must equal the exact sum of all `invoice_item.amount` rows.
- No database query may bypass `tenant_id` isolation unless explicitly authenticated as a super-admin audit process.
- All monetary amounts are stored in lowest common denomination (e.g. cents, integer format).

## Forbidden Terminology
- Do not use `user_id` when referencing data ownership; use `tenant_id`.
- Do not refer to unpaid invoices as "pending"; use canonical status `DRAFT` or `ISSUED`.
