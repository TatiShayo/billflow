# OPEN_QUESTIONS.md — Batched Decisions for Human Gate

**Project:** billflow  
**Run ID:** hermes-2026-07-25-b401  
**Timestamp:** 2026-07-25T12:00:00+03:00  

---

## Batched Decisions Queue

### Item 1: Dependency Additions for Landing Page & Theme System
- **Question:** Should `framer-motion` and `next-themes` be retained as permanent dependencies in `package.json`?
- **Context:** `src/app/page.tsx` and `src/components/theme-provider.tsx` imported these packages, causing `tsc --noEmit` build failure until added.
- **Options:**
  1. *(Recommended)* Approve keeping `framer-motion` (^12.4.7) and `next-themes` (^0.4.4).
  2. Remove animated components from landing page and strip `ThemeProvider`.
- **Default Action Taken:** Installed packages and applied React 19 motion component casting. Build verified clean.

---

### Item 2: Multi-Currency Email Template Formatting
- **Question:** Should `formatCurrency` be used across all email templates?
- **Context:** The invoice email sender was rendering `$100.00` for all invoices regardless of `invoice.currency` (e.g. EUR, KES, GBP).
- **Default Action Taken:** Updated template to use `formatCurrency(invoice.total, invoice.currency)`.
