# BillFlow

Invoicing SaaS for freelancers — clients, invoices (manual or AI-drafted), email
delivery with public pay links, PDF export, expenses, reports, and a three-tier
Stripe subscription (free / pro / business).

**Stack:** Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Supabase
(Postgres + Auth + RLS) · Stripe · OpenAI · Resend · `@react-pdf/renderer` ·
Tailwind v4 + shadcn/ui · Recharts · Zod · Vitest

## Highlights

- **Money math done once, in integer cents.** A single canonical formula
  (`src/lib/invoice-utils.ts`) computes subtotal/tax/discount/total; the editor,
  server checks, and tests all share it. Characterization tests lock float-drift,
  rounding, clamping, and discount-cap invariants.
- **Defense-in-depth on billing.** Stripe webhook: signature verification +
  persisted event-id idempotency (replay-proof, retry-safe). Clients send intent
  (a plan name), never amounts — prices resolve server-side. RLS freezes
  `subscription_tier`/`stripe_customer_id` against self-upgrade; a DB trigger
  creates profiles as `free`.
- **Tamper gates.** Persisted invoice totals are re-verified against the
  canonical formula before any amount is emailed to a client; DB CHECK
  constraints keep money non-negative even against crafted writes.
- **Hardened surface.** Zod on API boundaries, per-user rate limits, security
  headers + CSP, open-redirect guard, ownership checks on every route, expiring
  share tokens, whitelisted public columns on the pay endpoint.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase / Stripe / OpenAI / Resend keys
npm run dev                        # http://localhost:3000
```

Apply `supabase/schema.sql` to your Supabase project (tables, RLS policies,
trigger, indexes). Point a Stripe webhook at `/api/stripe/webhook` with the
`checkout.session.completed` and `customer.subscription.*` events.

## Scripts

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | eslint (zero errors enforced) |
| `npm test` | vitest — money-math + webhook characterization tests |

## Documentation

- `ARCHITECTURE.md` — module map, data flow, trust boundaries
- `REVIEW_FINDINGS.md` — full security/money audit findings and their status
- `AUDIT_LOG.md` — chronological hardening log
