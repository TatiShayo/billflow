# REVIEW FINDINGS — BillFlow

Full audit + hardening pass, July 14–17 2026. Status of every finding across all
rounds. Severity: CRITICAL / HIGH / MEDIUM / LOW. "Fixed" items are committed and
gate-verified (tsc + eslint + build + vitest).

---

## CRITICAL

| # | Finding | Status |
|---|---|---|
| C1 | **RLS `subscription_tier` self-upgrade** — `FOR ALL` policy let any authenticated user set their own tier via Supabase REST, bypassing Stripe. | **Fixed** — split SELECT/INSERT/UPDATE policies; UPDATE `WITH CHECK` freezes `subscription_tier` + `stripe_customer_id`. |
| C2 | **RLS upsert bypass on new profiles** — `WITH CHECK` subquery returned NULL for a not-yet-existing row, so a crafted signup upsert could set `tier: business`. | **Fixed** — INSERT restricted to `service_role`; `handle_new_user()` trigger creates profiles as `free`. |
| C3 | **Webhook replay (billing-abuse chain, proven)** — a captured signed webhook body replays with a valid signature; pre-fix every delivery re-applied tier changes, so a replayed `checkout.session.completed` could resurrect a canceled paid tier. | **Fixed** — `stripe_events` ledger claims each event id under a PK before any state change; duplicate delivery → 200 no-op. Ledger row is **released on processing failure** so Stripe's retry re-applies. Decision table locked by `webhook-utils.test.ts`. |
| C4 | **Build gate broken** — unclosed `try` in webhook route (TS1472) left by an interrupted pass; separately `middleware.ts` + `proxy.ts` coexisting is a hard build error in Next 16 (proxy is the auto-wired convention). | **Fixed** — webhook completed with catch/release; `middleware.ts` removed. |

## HIGH

| # | Finding | Status |
|---|---|---|
| H1 | **Client-computed invoice totals trusted** — editor writes subtotal/tax/total straight to DB; a crafted request could persist arbitrary amounts. | **Mitigated (layered)** — single canonical cents-based formula (`calculateInvoiceTotals`), DB CHECK constraints (non-negative money), and `validateInvoiceTotals` tamper gate on the send-email route (422 on mismatch). Full fix = move invoice writes behind a server route (deferred, flagged). |
| H2 | **Duplicate Stripe customers on every checkout** — the hardened RLS policy silently rejected the user-scoped `stripe_customer_id` write, so the "existing customer" lookup never hit. | **Fixed** — service-role client for the link write; error surfaced instead of swallowed. |
| H3 | **Cancel downgrade silently blocked by RLS** — same silent-reject on `subscription_tier: free`; UI showed paid tier until webhook arrived. | **Fixed** — service-role write; webhook remains source of truth. |
| H4 | **Share-link PDFs dead + no token expiry** — unauthenticated PDF branch used the anon client (RLS blocked all reads → always 404); `share_tokens.expires_at` was never validated anywhere. | **Fixed** — service-role reads with token possession as authorization; expiry enforced in PDF and pay APIs. |
| H5 | **Placeholder API keys masked misconfig** — stripe/openai/resend fell back to `"sk_placeholder"`. | **Fixed** — throw on missing env. |
| H6 | **No security headers** — empty `next.config.ts`. | **Fixed** — CSP (Stripe/Supabase-aware), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy. |
| H7 | **Duplicate invoice numbers (race)** — number read at mount, written at save; no unique constraint. | **Fixed** — `UNIQUE(user_id, invoice_number)`. App-level retry on conflict still recommended. |
| H8 | **No rate limiting** on OpenAI, email, and Stripe endpoints. | **Fixed** — per-user sliding-window limits (ai 10/min, send 20/min, checkout 10/min, cancel 5/min). In-memory per instance; swap for Redis for hard global limits. |
| H9 | **Open redirect** — `/auth/callback?next=` interpolated unvalidated. | **Fixed** — same-origin path check (`/x`, not `//host`). |
| H10 | **Webhook writes not atomic** — profile update + subscription upsert are sequential; crash between them leaves inconsistent state. | **Mitigated** — every write error now throws → ledger released → Stripe retries the whole event (idempotent). True transaction needs a Postgres RPC (deferred, flagged). |

## MEDIUM

| # | Finding | Status |
|---|---|---|
| M1 | **No zod on API boundaries.** | **Fixed** — checkout (plan enum: client sends intent, price stays server-side) and AI route (description ≤4000 chars). Send/pdf/pay take no money-bearing input. |
| M2 | **Negative amounts / oversized discounts** possible via API. | **Fixed** — formula clamps (test-locked) + DB CHECK constraints. |
| M3 | **Fixed discount not rounded** (sub-cent precision). | **Fixed** — cents rounding in canonical formula, test-locked. |
| M4 | **Timezone off-by-one on invoice dates** — `new Date("YYYY-MM-DD")` is UTC midnight; negative-offset zones rendered the prior day (decides "overdue"). Leap-year sensitive. | **Fixed** — `parseInvoiceDate` builds local-midnight dates; leap-year locked by test. |
| M5 | **"Mark as paid" is cosmetic** — no payment rails on invoices; status is a manual flag. | **Flagged** — architectural gap, needs Stripe Payment Intents. Not removed (feature, not vuln). |
| M6 | **Free-tier limits unenforced server-side** — `TIER_LIMITS` is client-side only. | **Flagged/deferred** — needs row-count checks in RLS or a server route. |
| M7 | **Dead auth wiring confusion** — Round 2 added `middleware.ts` believing `proxy.ts` was dead; in this Next 16 fork `proxy.ts` is the live convention and the extra file broke the build. | **Fixed** — see C4. |
| M8 | **`createServiceClient` carried user cookies** and was unused. | **Fixed** — now a cookie-free service-role client used by checkout/cancel/pdf. |
| M9 | **npm audit CVEs** (hono, js-yaml, postcss — transitive). | **Flagged/deferred** — dependency updates; none reachable from runtime paths per sbom scan. |
| M10 | **React Compiler lint: setState-in-effect** across dashboard pages (legacy load-in-effect pattern). | **Downgraded to warn** with tracked refactor: move dashboard data fetching to server components. |

## LOW

| # | Finding | Status |
|---|---|---|
| L1 | Missing OG tags / robots / sitemap. | **Fixed** (Round 4). |
| L2 | No privacy policy / terms / signup consent. | **Flagged** — legal content required before launch. |
| L3 | No error boundaries. | **Fixed** — `app/error.tsx` + `app/global-error.tsx` (Next 16 `unstable_retry`). |
| L4 | Dead deps (`@base-ui/react`, `next-themes`, `framer-motion`). | **Fixed** (Round 2). |
| L5 | PDF pay-page leak of internal columns via `select("*")`. | **Fixed** — whitelisted public columns on `/api/pay/[token]`. |

---

## Money-correctness test lock (vitest, 24 tests green)

- `invoice-utils.test.ts` — float drift (0.1+0.2), per-line cents rounding,
  negative clamps (qty/price/tax/discount), discount cap ≤ subtotal+tax (total
  never negative), sub-cent fixed-discount rounding, tamper detection via
  `validateInvoiceTotals`, local-midnight + leap-year date parsing.
- `webhook-utils.test.ts` — replay dedupe decision table (process / duplicate /
  retry_later), plan-metadata whitelist, price-id → tier mapping (unknown price
  can never grant a paid tier), safe subscription-id extraction.

## Performance

- Indexes on all hot paths: `invoices(user_id,status)`, `(user_id,created_at)`,
  `client_id`, `payment_token`, `invoice_items(invoice_id)`, `clients(user_id)`,
  `expenses(user_id,expense_date)`, `share_tokens(token)`, `subscriptions(stripe_subscription_id)`.
- No N+1s: list pages join relations in single queries (`*, client:clients(*)`).
- Stripe SDK `maxNetworkRetries: 2`.
- Dashboard aggregates are computed in JS over one invoice fetch — acceptable at
  freelancer scale; move to SQL aggregates if row counts grow (flagged).
