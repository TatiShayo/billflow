# AUDIT LOG — billflow

**Sweep:** July 14, 2026 (Round 1, Rounds 2-3 applied)

## FIXES APPLIED

### CRITICAL — RLS subscription_tier bypass
**Finding:** `FOR ALL` policy on profiles allowed authenticated users to set their own `subscription_tier` via direct Supabase REST API call, bypassing Stripe entirely.
**Fix:** Split into separate SELECT and UPDATE policies. UPDATE now has `WITH CHECK` guard comparing `subscription_tier` and `stripe_customer_id` against current DB values.
**File:** `supabase/schema.sql`

### HIGH — Placeholder API keys masking misconfigurations
**Finding:** `stripe.ts`, `openai.ts`, `resend.ts` silently fell back to `"sk_placeholder"`, `"sk-placeholder"`, `"re_placeholder"` when env vars were missing.
**Fix:** All three now throw explicit `Error` if their respective env var is unset.
**Files:** `src/lib/stripe.ts`, `src/lib/openai.ts`, `src/lib/resend.ts`

### HIGH — Missing security headers
**Finding:** `next.config.ts` was empty — no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
**Fix:** Added `headers()` config with all standard security headers and a Stripe/Supabase-aware CSP.
**File:** `next.config.ts`

## DEFERRED

- Share tokens `expires_at` column exists but never set or validated
- No rate limiting on AI invoice endpoint
- `createServiceClient()` in server.ts is dead code
- `npm audit` shows hono (4 CVEs), js-yaml, postcss vulns — update dependencies

---

## ROUND 2 — Adversarial, Reduction & Cross-Angle Sweep (July 14, 2026)

### CRITICAL — RLS upsert bypass on new profiles
**Finding:** Round 1's `WITH CHECK` guard compared `subscription_tier` against current DB value. On UPSERT of a NEW profile, the subquery returned NULL → `NULL is not distinct from NULL` = TRUE. User could intercept signup and set `subscription_tier: "business"`.
**Fix:** Added INSERT policy restricted to `service_role`, plus `handle_new_user()` trigger that auto-creates profiles with `subscription_tier: 'free'` on `auth.users` insert. Users can no longer control `subscription_tier` at creation time.
**File:** `supabase/schema.sql`

### HIGH — Dead auth middleware (orphaned proxy.ts)
**Finding:** `src/proxy.ts` contained full Supabase SSR auth logic but no `middleware.ts` existed to wire it. Route protection was dead code.
**Fix:** Created `src/middleware.ts` that re-exports `proxy` + `config`.
**File:** `src/middleware.ts` (NEW)

### MEDIUM — Dead dependencies removed
**Removed:** `@base-ui/react` (never imported), `next-themes` (app hardcoded to dark mode), `framer-motion` (8 fade animations replaceable with CSS)
**File:** `package.json`

---

## ROUND 4 — Multi-Discipline Review (July 14, 2026)

### Pass A — Legal: no privacy policy, no terms, no consent checkbox on signup
Status: **Still missing.** Privacy policy, terms page, and signup consent checkbox needed.

### Pass D — SEO: missing OG tags, robots.txt, sitemap
**Fixed:** Added `openGraph` metadata to layout.tsx, created `robots.ts` + `sitemap.ts`.

### Pass G — Math: client-side invoice totals, no server-side verification
**Finding:** Invoice subtotal/tax/discount/total computed entirely client-side, sent verbatim to server. Malicious client can set arbitrary `total`. No server-side recalculation exists.
**Status:** Deferred — needs server-side recomputation before DB write.

### Pass G — Math: fixed discount amount not rounded
**Finding:** `discountType === "fixed"` path uses raw `Number()` without `Math.round()`, allowing >2 decimal places.
**Status:** Deferred — needs rounding added to discount handler.

---

## ROUND 3 — Live Exploitation, Race Conditions & Chaos Engineering (July 14, 2026)

**Note:** Live testing skipped — no staging environment available. Static analysis with race condition lenses applied.

### HIGH — Duplicate invoice numbers (race condition)
**Finding:** `next_invoice_number` read during component mount, written minutes later on save. No DB unique constraint on `invoice_number`. Two concurrent invoice saves → same number.
**Fix:** Added `UNIQUE(user_id, invoice_number)` constraint on invoices table. App should retry on constraint violation.
**File:** `supabase/schema.sql`

### HIGH — Webhook writes not atomic
**Finding:** `profiles.update()` and `subscriptions.upsert()` are separate sequential calls. Crash between them → inconsistent subscription state.
**Status:** Deferred — requires PostgreSQL function via `supabase.rpc()` for proper transaction boundary.

### MEDIUM — Invoice "mark as paid" is cosmetic (no Stripe)
**Finding:** `markAsPaid()` directly updates invoice status. No payment integration. Entire payment flow is a UI illusion.
**Status:** Noted — architectural gap, not a vulnerability per se. Requires Stripe Payment Intents integration.

### MEDIUM — No server-side validation on amounts
**Finding:** Negative line items, negative totals, and discounts exceeding subtotals are all possible via API despite `min="0"` in UI.
**Status:** Deferred — needs zod/validation middleware on save.

### MEDIUM — Free tier limits unenforced
**Finding:** TIER_LIMITS defined but never enforced server-side. Free users have no cap on clients, invoices, or expenses.
**Status:** Deferred — needs row-count checks in API routes or RLS policies.
