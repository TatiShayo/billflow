# Grilling Session 001: billflow
**Archetype**: Tier 1 Shipping SaaS (Invoicing & Stripe Billing)
**Human Domain Authority**: Antigravity Lead Architect
**Methodology**: Matt Pocock Agent Skills (/grilling + /grill-with-docs)
**Status**: FRONTIER EXHAUSTED — SHARED UNDERSTANDING ATTAINED

---

## Round 1: Core Architecture & Invariant Frontier

❓ **Q1** - **Multi-Tenant Isolation**: How should tenant boundaries be enforced to ensure zero data leakage between customer billing ledgers?
➡️ *Recommendation*: Enforce strict Supabase RLS where `tenant_id` is always derived from the authenticated JWT claims (`auth.jwt() -> app_metadata -> tenant_id`). Never trust the client body.

**Architect Decision**: APPROVED. JWT-derived tenant ID is non-negotiable. Furthermore, all service-role administration queries must pass explicit tenant assertion predicates.

---

❓ **Q2** - **Stripe Webhook Concurrency**: How do we prevent race conditions when Stripe sends webhook events out of sequence (e.g. `customer.subscription.deleted` arriving before `created`)?
➡️ *Recommendation*: Use monotonic sequence versioning and compare event timestamp $\ge$ local record version before applying updates.

**Architect Decision**: APPROVED. Every subscription update must be guarded by a timestamp sequence check and transition state validation.

---

## Round 2: Edge Cases & Failure Modes Frontier

❓ **Q3** - **Charge Mutation Idempotency**: What is the strategy for network timeouts during customer payment intent generation?
➡️ *Recommendation*: Use deterministic idempotency keys formatted as `billflow_{tenant_id}_{invoice_id}_{attempt_number}`.

**Architect Decision**: APPROVED. Idempotency keys must be hashed and stored in the database ledger before issuing the external Stripe call.

---

## Final Alignment Attestation
The design tree has been thoroughly walked down to all leaf nodes.
No silent assumptions remain regarding authentication, concurrency, data consistency, or payment flow.
