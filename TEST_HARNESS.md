# TEST_HARNESS.md — Hermetic Isolation Verification

**Project:** billflow  
**Run ID:** hermes-2026-07-25-b401  
**Timestamp:** 2026-07-25T11:55:00+03:00  

---

## Mechanical Isolation Checks (10-ORCHESTRATION.md §4.1)

| Check # | Requirement | Status | Verification Detail |
|---|---|---|---|
| **1** | Hostname Resolution | **PASS** | Every app hostname maps to `127.0.0.1` / mock containers. |
| **2** | Credential Sanity | **PASS** | `NEXT_PUBLIC_SUPABASE_URL` and `STRIPE_WEBHOOK_SECRET` use local/test mock strings; no `sk_live_` present. |
| **3** | Proxy Egress Allowlist | **PASS** | Outbound traffic restricted to localhost test servers. |
| **4** | Canaries External Deny | **PASS** | Outbound request to external canary endpoint (`http://198.51.100.1`) failed cleanly as required. |
| **5** | Database Sentinel | **PASS** | Isolated local SQLite/Supabase test instance seeded with synthetic fixtures. |

**Result:** Hermetic Isolation Established. Phase 5 Dynamic Exploitation Permitted.
