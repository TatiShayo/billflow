# BillFlow — Master Build Plan

## PHASE 1: AUDIT & STABILIZE

- [ ] `npm run build` passes with zero errors
- [ ] All TypeScript errors fixed (`npx tsc --noEmit` clean)
- [ ] All pages load in dev without console errors
- [ ] Supabase client connects (check in browser console)
- [ ] Auth flow: signup → login → dashboard works end-to-end
- [ ] All Supabase RLS policies are correct (users can only see their own data)
- [ ] Stripe webhook route returns 200 on test event

## PHASE 2: COMPLETE THE INVOICE EDITOR — THIS IS THE CORE PRODUCT

- [ ] Manual invoice mode: line items table with add/remove rows, live total calculation
- [ ] Auto-increment invoice number: read profiles.next_invoice_number, use it, increment after saving
- [ ] Currency formatting: all amounts display with Intl.NumberFormat(locale, {style:'currency', currency}) — never raw numbers
- [ ] Tax calculation: subtotal × tax_rate updates live as user types
- [ ] Discount: toggle between fixed amount and percentage, live updates total
- [ ] Client selector: searchable dropdown from clients table, "Add new" inline without leaving page
- [ ] Due date helper: clicking "Net 7" / "Net 15" / "Net 30" auto-sets due_date from issue_date
- [ ] Save as draft: saves invoice with status='draft', shows success toast, stays on page
- [ ] "Send Invoice" flow: saves with status='sent', triggers email via /api/invoices/[id]/send, redirects to invoice detail
- [ ] Invoice number auto-formatting: prefix + zero-padded number (e.g. INV-0042)
- [ ] Duplicate invoice: copies all line items and client to new invoice with new number
- [ ] AI invoice mode: textarea input → POST /api/ai/invoice → populate line items → user reviews → save

## PHASE 3: COMPLETE THE INVOICE DETAIL & PDF

- [ ] Invoice preview: clean white-on-dark design, looks like a real paper invoice
- [ ] Company logo renders from profiles.logo_url (or placeholder if none)
- [ ] "Download PDF" button: calls /api/invoices/[id]/pdf → streams PDF → browser downloads
- [ ] PDF looks identical to the preview (same layout, not different)
- [ ] "Send Email" button: calls /api/invoices/[id]/send → Resend email to client.email → success toast
- [ ] Email template: professional HTML, company colors, "View Invoice" button linking to /pay/[token]
- [ ] "WhatsApp Share" button: generates wa.me/?text=... with invoice link, opens in new tab
- [ ] "Mark as Paid" button: sets status='paid', sets paid_at=now(), shows green paid banner
- [ ] Payment token: generate UUID token on invoice creation, store in invoices.payment_token, use in /pay/[token] URL
- [ ] Public pay page /pay/[token]: no auth, shows invoice read-only, "Download PDF" button

## PHASE 4: COMPLETE REMAINING PAGES

- [ ] Dashboard stats: real Supabase queries — outstanding balance, paid this month, overdue count, active clients count
- [ ] Dashboard: overdue alert banner when invoices past due_date with status!='paid'
- [ ] Invoices list: server-side filtered by status tabs, paginated (25 per page)
- [ ] Invoices list: search by client name or invoice number (Supabase ilike query)
- [ ] Invoices list: export to CSV
- [ ] Clients page: grid cards with real data, click → client detail with invoice history
- [ ] Client detail: total revenue from this client, list of their invoices
- [ ] Expenses page (Business tier): add expense form, category filter, monthly totals
- [ ] Expenses: receipt upload to Supabase storage, thumbnail display
- [ ] Reports page (Business tier): all 4 charts with real Supabase aggregated data
- [ ] Settings: business info form saves to profiles, logo upload to Supabase storage
- [ ] Settings: invoice defaults (prefix, payment terms, default notes) save to profiles
- [ ] Billing: current plan display, upgrade flow via Stripe, invoice history from Stripe API

## PHASE 5: TESTING INFRASTRUCTURE

- [ ] Install vitest, @testing-library/react, @vitejs/plugin-react, jsdom
- [ ] Install @playwright/test and chromium
- [ ] Unit test: invoice total calculation
- [ ] Unit test: AI invoice API route
- [ ] Unit test: invoice number auto-generation
- [ ] Unit test: currency formatting
- [ ] Unit test: PDF generation
- [ ] Unit test: email send route
- [ ] E2E: landing page loads, pricing visible
- [ ] E2E: create invoice flow
- [ ] E2E: mark invoice as paid
- [ ] Run: npx vitest run && npx playwright test — all must pass

## PHASE 6: PERFORMANCE & QUALITY

- [ ] Bundle analyzer setup
- [ ] Dynamic import: @react-pdf/renderer
- [ ] Dynamic import: recharts
- [ ] Lighthouse target ≥85 performance
- [ ] Add generateMetadata to all pages
- [ ] Add next-sitemap
- [ ] Input validation: Zod schemas on all API routes
- [ ] Error handling: every try/catch logs error and returns proper HTTP status code
- [ ] Rate limiting: add to AI route and email route
- [ ] Mobile audit: every page at 375px
- [ ] Loading states: skeleton on every page that fetches data
- [ ] Error boundaries on dashboard, invoices, clients, reports pages

## PHASE 7: ADVANCED FEATURES — AI & AUTOMATION

- [ ] Smart Payment Reminders
- [ ] Recurring Invoices
- [ ] Multi-currency Revenue Dashboard
- [ ] Client Portal (read-only)
- [ ] Invoice Status Webhook
- [ ] Expense OCR
- [ ] Late Payment Predictor
- [ ] CSV Import Clients
- [ ] Xero/QuickBooks export

## PHASE 8: M-PESA INTEGRATION (Kenya market)

- [ ] Research Safaricom Daraja API documentation
- [ ] Add payment_method field to invoices table
- [ ] M-Pesa option in invoice editor for KES currency
- [ ] Add M-Pesa phone number field to clients table
- [ ] M-Pesa STK Push endpoint: /api/payments/mpesa/stk-push
- [ ] M-Pesa callback endpoint: /api/payments/mpesa/callback
- [ ] WhatsApp invoice sharing in KES
- [ ] Mock flow if sandbox credentials not available
