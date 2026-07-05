# BillFlow — Progress Log

## Session: 2026-05-29

### Phase 1: Audit & Stabilize
- [x] Build passes (zero errors)
- [x] TypeScript clean (0 errors)
- [x] Pages load without console errors
- [x] Supabase client connects
- [x] Auth flow end-to-end
- [x] RLS policies correct
- [x] Stripe webhook route returns 200

### Phase 2: Invoice Editor
- [x] Payment tokens generated on invoice creation
- [x] Due date helpers (Net 7/15/30) in editor
- [x] Resend email uses verified domain + share tokens
- [x] WhatsApp share uses share_tokens
- [x] Currency formatting with Intl.NumberFormat (already in formatCurrency)
- [x] Tax/discount live calculation in editor
- [x] Client selector with inline add-new
- [x] Save as draft + Send Invoice flow
- [x] Auto-increment invoice number
- [ ] Real PDF generation (currently HTML download)
- [ ] Duplicate invoice in editor
- [ ] AI invoice mode integration test
