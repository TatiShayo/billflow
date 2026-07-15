# BillFlow — Architecture

Simple invoicing SaaS for freelancers. Create clients, build invoices (manual or AI-assisted),
send them by email, share a public pay/view link, track expenses, view reports, and manage a
Stripe subscription across three tiers (free / pro / business).

**Stack:** Next.js 16 (App Router, React 19) · TypeScript · Supabase (Postgres + Auth + RLS) ·
Stripe (subscriptions) · OpenAI (invoice drafting) · Resend (email) · `@react-pdf/renderer` (PDF) ·
Tailwind v4 + shadcn/ui · Recharts · Zod · Vitest.

---

## Module map

```
src/
├── middleware.ts            Re-exports proxy() as Next middleware (route protection)
├── proxy.ts                 Supabase SSR auth guard for /dashboard + /api/* protected paths
├── app/
│   ├── layout.tsx           Root layout, dark theme, metadata/OG, Toaster
│   ├── page.tsx             Marketing landing
│   ├── login / signup / reset-password   Auth screens (client, supabase-js)
│   ├── auth/callback/route.ts             OAuth/email code exchange
│   ├── robots.ts / sitemap.ts             SEO
│   ├── pay/[token]/page.tsx               Public invoice view (no auth)
│   ├── dashboard/
│   │   ├── layout.tsx       Sidebar shell
│   │   ├── page.tsx         Stats + revenue chart
│   │   ├── invoices/        List, new, [id] view, [id]/edit
│   │   ├── clients/         Client CRUD
│   │   ├── expenses/        Expense CRUD + charts (business tier)
│   │   ├── reports/         Financial reports (business tier)
│   │   └── settings/        Profile, branding, billing (Stripe)
│   └── api/
│       ├── ai/invoice/route.ts            OpenAI → invoice line items (pro+)
│       ├── invoices/[id]/pdf/route.ts     Server-rendered PDF (auth OR share/pay token)
│       ├── invoices/[id]/send/route.ts    Resend email w/ pay link
│       ├── pay/[token]/route.ts           Public JSON for pay page
│       └── stripe/
│           ├── checkout/route.ts          Create Checkout Session
│           ├── cancel/route.ts            Cancel active subscription
│           └── webhook/route.ts           Stripe event sink → tier/subscription sync
├── components/
│   ├── invoice-editor.tsx   Core invoice form (client-side money math + direct DB write)
│   ├── tier-gate.tsx        Client-side feature gate by subscription tier
│   └── ui/                  shadcn primitives
└── lib/
    ├── invoice-utils.ts     calculateInvoiceTotals(), incrementInvoiceNumber()  ← MONEY MATH
    ├── invoice-utils.test.ts
    ├── types.ts             Domain types, CURRENCIES, formatCurrency(), TIER_LIMITS
    ├── auth.ts              useAuth() client hook (user + profile)
    ├── stripe.ts / openai.ts / resend.ts   Lazy singleton clients (throw if env missing)
    ├── pay-token.ts
    └── supabase/
        ├── client.ts        Browser client (anon key)
        └── server.ts        Server client (SSR cookies) + service-role admin client
```

## Data flow

**Auth.** Supabase Auth. `middleware.ts` → `proxy.ts` runs `supabase.auth.getUser()` on every
request and redirects unauthenticated users away from `/dashboard` and protected `/api/*` paths.
A Postgres trigger (`handle_new_user`) auto-creates a `profiles` row (`subscription_tier='free'`)
on `auth.users` insert, so tier can't be client-set at signup. `useAuth()` hydrates `user`+`profile`
on the client via `onAuthStateChange`.

**Invoicing (client-heavy).** `invoice-editor.tsx` computes totals with `calculateInvoiceTotals()`
and writes `invoices` + `invoice_items` **directly to Supabase from the browser**. RLS enforces
row ownership (`auth.uid() = user_id`); DB CHECK constraints enforce non-negative money. There is
no server API that recomputes amounts — the DB is the last line of defence (see Security notes).

**Public sharing.** Each invoice has a `payment_token` (uuid) plus optional `share_tokens` rows.
`/pay/[token]` and `/api/pay/[token]` resolve a token → invoice using the **service-role** client,
returning only whitelisted public columns. The PDF route accepts either an authenticated owner or
a valid share/pay token.

**Stripe subscriptions.** `checkout` creates/reuses a Stripe customer and a Checkout Session
(server-side price IDs; client only sends a plan name). On completion Stripe calls
`stripe/webhook` → signature verified → event deduped by id → `profiles.subscription_tier` and
`subscriptions` updated. `cancel` cancels the active Stripe subscription and downgrades to free.
**Money/tier changes are only ever authorised by a signed Stripe event or a server route — never by
a client-supplied amount.**

**AI drafting.** `ai/invoice` (pro/business only, rate-limited) calls OpenAI, parses JSON defensively,
and returns line-item suggestions the client can accept. AI output is advisory; totals are always
recomputed by `calculateInvoiceTotals`.

## Database schema (Supabase Postgres)

`profiles` (1:1 auth.users) · `subscriptions` · `clients` · `invoices` · `invoice_items` ·
`share_tokens` · `expenses`. All tables have RLS enabled with owner-scoped policies
(`auth.uid() = user_id`, indirected through `invoices` for `invoice_items`/`share_tokens`).
`profiles` splits SELECT/INSERT/UPDATE so users can't change `subscription_tier` or
`stripe_customer_id`; INSERT is service-role only. `invoices` has `UNIQUE(user_id, invoice_number)`
and non-negative money CHECK constraints; `invoice_items` has non-negative CHECK constraints.
`processed_stripe_events` records handled webhook event ids for idempotency.

## Trust boundaries

| Boundary | Who computes money / authorises | Guard |
|---|---|---|
| Browser → Supabase (invoice write) | client computes totals | RLS ownership + DB CHECK (≥0) |
| Browser → `/api/stripe/checkout` | server picks price ID | auth + plan allowlist |
| Stripe → `/api/stripe/webhook` | signed event | signature verify + event-id idempotency |
| Public → `/api/pay/[token]` | none | token lookup, whitelisted columns |
