# billflow — DeepSeek Audit

**Date:** 2026-07-13
**Path:** `C:\Users\TATI\Desktop\DEV\billflow\`
**Stack:** TypeScript / Next.js 16 + Supabase + Stripe
**Tier:** 2 — High
**Dependencies:** None installed

---

## 🔴 Security Vulnerabilities

| Severity | File | Line(s) | Vulnerability | Exact Fix |
|----------|------|---------|---------------|-----------|
| 🔴 CRITICAL | `.env.local` | 2-3 | **Supabase service role key and anon key exposed** — valid Supabase demo project JWT tokens. While these are Supabase's public demo project keys (low real-world risk), the pattern of storing `.env.local` with real keys is dangerous. | DELETE this file. Values should come from `.env.local.example` template. Never commit `.env.local`. |
| 🟠 HIGH | `src/app/api/invoices/[id]/pdf/route.ts` | 88 | `JSON.parse(cleaned)` — LLM output may not be valid JSON. No try-catch around parse. Returns uncaught 500 error. | Wrap in try-catch: `try { parsed = JSON.parse(cleaned) } catch { return NextResponse.json({ error: "AI response invalid" }, { status: 502 }) }`. |
| 🟡 MEDIUM | `src/app/api/invoices/[id]/pdf/route.ts` | 85-141 | Up to 4 sequential DB queries for auth (user → share token → payment token → share token by query). | Parallelize independent queries with `Promise.all()`. |
| 🟡 MEDIUM | `src/app/dashboard/invoices/page.tsx` | 64 | `.select(...)` without `.limit()` — fetches all invoices. | Add `.range(0, 49)` or cursor-based pagination. |
| ✅ | `src/app/auth/callback/route.ts` | — | Supabase-managed auth via SSR. Good. | — |
| ✅ | `src/lib/supabase/server.ts` | — | Service-role key used for admin operations. Good. | — |

---

## 🟠 Performance Issues

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟠 HIGH | `src/app/api/invoices/[id]/pdf/route.ts` | 85-141 | 4 sequential DB round-trips before rendering PDF. Each adds ~50-100ms latency = 200-400ms total. | Parallelize: `const [userResult, shareTokenResult] = await Promise.all([query1, query2])`. |
| 🟡 MEDIUM | `src/app/api/invoices/[id]/pdf/route.ts` | 85, 101, 109, 127 | All queries use `select("*, client:clients(*), items:invoice_items(*)")` — joins 3 tables, fetches all columns. | Specify only needed columns: `.select("id, total, due_date, client:clients(name, email), items:invoice_items(description, quantity, unit_price)")`. |
| 🟡 MEDIUM | `src/app/dashboard/invoices/page.tsx` | 64 | No pagination on invoices list. | Add `.range(0, 49)` with infinite scroll or page controls. |

---

## 🟡 UI/UX Improvements

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟡 MEDIUM | `src/app/dashboard/page.tsx` | 241-260 | Hardcoded chart colors (`#10b981`, `#1c2e28`, `#4a5e58`) in Recharts config. | Use CSS vars or Tailwind theme: `var(--color-success)`, `var(--color-surface)`. |
| 🟡 MEDIUM | `src/app/dashboard/reports/page.tsx` | 29-295 | Same — hardcoded colors in reports charts. | Tokenize. |
| 🟡 MEDIUM | `src/app/dashboard/expenses/page.tsx` | 48-310 | Same — hardcoded colors in expense charts. | Tokenize. |
| 🟡 MEDIUM | Missing | — | No `loading.tsx` for `invoices/[id]`, `clients`, `expenses` sub-routes. | Add loading skeletons. |
| ✅ | `src/app/layout.tsx` | 5, 46-47 | sonner Toaster, TooltipProvider, forced dark theme. Good. | — |

---

## 🟢 Dependency Audit

| Category | Package | Issue | Fix |
|----------|---------|-------|-----|
| 🔴 CRITICAL | `shadcn ^4.8.2` | shadcn is a CLI scaffolding tool — should NOT be a runtime production dependency. Only individual UI component packages should be deps. | Remove `shadcn` from dependencies. Keep only the component packages it installed (e.g., `@radix-ui/react-dialog`, etc.). |
| 🟡 MEDIUM | `cmdk ^1.1.1` | ~200KB for a command palette. If not used extensively, remove. | Replace with lightweight custom `CommandMenu` or remove if unused. |
| 🟡 MEDIUM | `recharts ^3.8.1` | ~1.2MB. interviewace uses `recharts ^2.15.0` — inconsistent versions across projects. | Standardize on same recharts version. |
| 🟡 MEDIUM | Dev deps | `^4` on tailwindcss, `^9` on eslint — loose. | Pin to exact. |

### Missing Dev Tooling
- No `typecheck` script
- No test framework
- No `.nvmrc`

---

## 📋 Priority Fix Queue

1. **[CRITICAL — Secrets]** `.env.local` — DELETE this file. Values should come from template `.env.local.example`.
2. **[HIGH — JSON.parse Crash]** `src/app/api/invoices/[id]/pdf/route.ts:88` — Wrap `JSON.parse(cleaned)` in try-catch.
3. **[HIGH — Sequential Queries]** `src/app/api/invoices/[id]/pdf/route.ts:85-141` — Parallelize independent DB queries with `Promise.all()`.
4. **[MEDIUM — Column Selection]** `src/app/api/invoices/[id]/pdf/route.ts:85` — Use column projection instead of `select("*")`.
5. **[MEDIUM — Shadcn Dep]** Remove `shadcn` from runtime dependencies. Remove `cmdk` if unused.
6. **[MEDIUM — Pagination]** `src/app/dashboard/invoices/page.tsx:64` — Add pagination.
7. **[MEDIUM — Chart Colors]** Tokenize all hardcoded hex values in chart configs.

---

## 🔧 Session: 2026-07-14 — Multi-Agent Deep Audit Sweep (Round 1)

### Security fixes applied

| Severity | Issue | Fix | Files |
|----------|-------|-----|-------|
| 🔴 CRITICAL | RLS bypass: users could set own `subscription_tier` via direct Supabase API call | Split `FOR ALL` policy into SELECT + UPDATE with `WITH CHECK` guard comparing `subscription_tier` and `stripe_customer_id` against current DB values | `supabase/schema.sql` |
| 🟠 HIGH | Placeholder API keys (`sk_placeholder`, `re_placeholder`) silently degraded Stripe/OpenAI/Resend clients | Now throw explicit `Error` if env var is unset: `throw new Error("STRIPE_SECRET_KEY environment variable is required")` | `src/lib/stripe.ts`, `src/lib/openai.ts`, `src/lib/resend.ts` |
| 🟠 HIGH | No security headers configured (bare `next.config.ts`) | Added CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection | `next.config.ts` |

### Artifacts created
- `AUDIT_LOG.md` — full audit trail with all findings, fixes, and deferred items

---

## 🔧 Session: 2026-07-14 — Round 2: Adversarial, Reduction & Cross-Angle Sweep

### CRITICAL fixes
- **RLS upsert bypass closed:** INSERT policy now restricted to `service_role`. `handle_new_user()` trigger auto-creates profiles with `subscription_tier: 'free'` on auth.users insert. Prevents signup-time tier manipulation.
- **Dead auth middleware wired:** Created `src/middleware.ts` re-exporting orphaned `proxy.ts` + `config`.

### Reduction
- Removed 3 dead dependencies: `@base-ui/react`, `next-themes`, `framer-motion` from package.json.

---

## 🔧 Session: 2026-07-14 — Round 3: Race Conditions & Business Logic (Static)

### Race condition fixes
- Added `UNIQUE(user_id, invoice_number)` constraint to prevent duplicate invoice numbers from concurrent saves.
- Documented webhook write non-atomicity (profiles ↔ subscriptions) — needs PostgreSQL function.

### Business logic gaps found
- Invoice "mark as paid" is cosmetic (no Stripe integration) — entire payment flow is UI-only
- No server-side validation on amounts: negative totals, excessive discounts possible via API
- Free tier limits (maxClients, maxInvoicesPerMonth) are client-side only — never enforced

---

## 🔧 Session: 2026-07-14 — Round 4: Multi-Discipline Review

### Fixes applied
- Added `openGraph` metadata to layout, created `robots.ts` + `sitemap.ts`
- Math finding: invoice totals computed client-side, trusted by server — needs server-side recalculation
- Legal gap: no privacy policy, no terms, no signup consent checkbox

