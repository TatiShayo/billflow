# ARCHITECTURE.md — BillFlow Architecture & Trust Boundaries

**Stack:** Next.js 16.2.6 (App Router), React 19.2.4, Supabase (SSR + JS client), Stripe 22.2.0, Vitest 4.1.9, Tailwind CSS v4.  
**Audited Date:** 2026-07-25  

---

## 1. System Overview

BillFlow is a SaaS application for invoice management, client tracking, PDF generation, AI invoice parsing, and payment collection via Stripe.

```
                           ┌───────────────────────────┐
                           │   Client Web Browser      │
                           └─────────────┬─────────────┘
                                         │ HTTPS
                                         ▼
                           ┌───────────────────────────┐
                           │   Next.js 16 Proxy / Middleware │ (src/proxy.ts)
                           └─────────────┬─────────────┘
                                         │ Auth Check (getUser)
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
           ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
           │ Dashboard Pages│   │ Public Pay Page│   │  API Endpoints │
           │ (/dashboard)   │   │ (/pay/[token]) │   │ (/api/*)       │
           └───────┬────────┘   └───────┬────────┘   └───────┬────────┘
                   │                    │                    │
                   ▼                    ▼                    ▼
           ┌──────────────────────────────────────────────────────────┐
           │                     Supabase Postgres                    │
           │        (Profiles, Invoices, Clients, Share Tokens)       │
           └──────────────────────────────────────────────────────────┘
```

---

## 2. Trust Boundaries & Entry Points

1. **Authenticated Users:** Access `/dashboard/*`, `/api/ai/*`, `/api/invoices/*`, `/api/stripe/checkout`. Guarded by `src/proxy.ts` session check (`getUser()`).
2. **Public Share Link Holders:** Access `/pay/[token]` and `/api/pay/[token]`. No auth required; guarded by `payment_token` or valid `share_tokens` row. Public query is restricted to `PUBLIC_INVOICE_FIELDS` to avoid leaking internal user or client data.
3. **Stripe Webhook Gateway:** Access `/api/stripe/webhook`. Authenticated via Stripe Signature verification (`stripe.webhooks.constructEvent`) and idempotency via `stripe_events` table.

---

## 3. Mutating Endpoint & Ownership Matrix

| Endpoint | Method | Mutates | Ownership Checked? | Status |
|---|---|---|---|---|
| `/api/ai/invoice` | POST | AI Generation | User session check + plan tier check + rate limit | PASS |
| `/api/invoices/[id]/send` | POST | Invoice status (`sent`) | Explicit `user_id = user.id` check + `validateInvoiceTotals` integrity check | PASS |
| `/api/stripe/checkout` | POST | Checkout Session | User session check + plan enum constraint | PASS |
| `/api/stripe/webhook` | POST | Subscription / Profile Tier | Webhook Signature + `stripe_events` idempotency table | PASS |
| `/api/pay/[token]` | GET | Read Invoice | Public fields filtered; token expiry enforced | PASS |

---

## 4. Key Security Invariants

- **Currency Math:** Integer cents arithmetic via `calculateInvoiceTotals` in `src/lib/invoice-utils.ts`.
- **Integrity Validation:** Server-side `validateInvoiceTotals` recomputes invoice subtotal/tax/discount/total before emailing clients to prevent tampered payloads.
- **RLS Isolation:** Multi-tenant data segregation enforced via Supabase Row-Level Security policies on `invoices`, `clients`, and `profiles`.
