# SETU — Tracker.md

**Document Class:** Engineering · Living (updated daily during active development)
**Owner:** CTO / Project Lead (updated by whole team)
**Audience:** Entire team, founders, investors (progress reporting)
**Status:** v1.0 — Initialized from ImplementationPlan.md
**Depends On:** ImplementationPlan.md

---

## 0. How to Use This Document

This is the live status board for SETU MVP development. Every task from `ImplementationPlan.md` is listed here with its current status. Update your task's status at the end of each working day — not "when done," but daily, so blockers are visible within 24 hours.

**Status values:**
- `⬜ NOT STARTED` — Task not yet begun
- `🟡 IN PROGRESS` — Actively being worked on (name in "Assigned To")
- `🔴 BLOCKED` — Cannot proceed; blocker documented in Blocker Log (Section 3)
- `🟢 DONE` — Code written, tests passing, PR merged
- `✅ VERIFIED` — QA or second engineer has verified this works on a real device

**Update rule:** A task moves from `DONE` to `VERIFIED` only when someone other than the task author has confirmed it works end-to-end.

---

## 1. Task Status Board

### Week 0 — Pre-Development Setup

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `OPS-01` | Create Supabase projects (dev, staging, prod) | ⬜ NOT STARTED | — | — |
| `OPS-02` | GitHub repository + monorepo structure | ⬜ NOT STARTED | — | — |
| `OPS-03` | GitHub Secrets configuration | ⬜ NOT STARTED | — | — |
| `OPS-04` | Razorpay account + test keys | ⬜ NOT STARTED | — | — |
| `OPS-05` | Twilio account + WhatsApp sandbox | ⬜ NOT STARTED | — | — |
| `OPS-06` | Firebase project + google-services.json | ⬜ NOT STARTED | — | — |
| `OPS-07` | Sentry projects (4 apps) | ⬜ NOT STARTED | — | — |
| `OPS-08` | PostHog project | ⬜ NOT STARTED | — | — |
| `OPS-09` | Mapbox account + tokens | ⬜ NOT STARTED | — | — |
| `OPS-10` | .env.example + .env.local for team | ⬜ NOT STARTED | — | — |
| `OPS-11` | CI/CD pipeline (GitHub Actions) | ⬜ NOT STARTED | — | — |
| `OPS-12` | Melos bootstrap verification | ⬜ NOT STARTED | — | — |
| `OPS-13` | Seed data script (block, villages, categories) | ⬜ NOT STARTED | — | — |

### Week 1 — Database Foundation

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `INFRA-01` | Migration 0001: all tables per Schema.md | ⬜ NOT STARTED | — | — |
| `INFRA-02` | Migration 0002: all RLS policies | ⬜ NOT STARTED | — | — |
| `INFRA-03` | Migration 0003: indexes | ⬜ NOT STARTED | — | — |
| `INFRA-04` | Migration 0004: triggers (rating denorm, order_number) | ⬜ NOT STARTED | — | — |
| `INFRA-05` | Seed data loaded to local + staging | ⬜ NOT STARTED | — | — |
| `INFRA-06` | Supabase Storage buckets configured | ⬜ NOT STARTED | — | — |
| `QA-01` | RLS integration test suite | ⬜ NOT STARTED | — | — |

### Week 2 — Backend Services

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `BE-01` | Supabase Auth: phone OTP via Twilio | ⬜ NOT STARTED | — | — |
| `BE-02` | OrderService Edge Function | ⬜ NOT STARTED | — | — |
| `BE-03` | PaymentService Edge Function + webhook | ⬜ NOT STARTED | — | — |
| `BE-04` | VendorService Edge Function | ⬜ NOT STARTED | — | — |
| `BE-05` | RiderService Edge Function | ⬜ NOT STARTED | — | — |
| `BE-06` | NotificationService Edge Function | ⬜ NOT STARTED | — | — |
| `BE-07` | PostgREST configuration for discovery | ⬜ NOT STARTED | — | — |
| `BE-08` | Admin endpoints | ⬜ NOT STARTED | — | — |
| `INT-01` | Error handling + logging infrastructure | ⬜ NOT STARTED | — | — |

### Week 3 — Customer App Foundation

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `CA-01` | Customer App project setup + theme | ⬜ NOT STARTED | — | — |
| `CA-02` | Supabase + Firebase initialization | ⬜ NOT STARTED | — | — |
| `CA-03` | GoRouter configuration | ⬜ NOT STARTED | — | — |
| `CA-04` | Auth screens (phone entry + OTP) | ⬜ NOT STARTED | — | — |
| `CA-05` | Village Selection screen | ⬜ NOT STARTED | — | — |
| `CA-06` | Home Screen (categories + vendor scroll) | ⬜ NOT STARTED | — | — |
| `CA-07` | Vendor List Screen by category | ⬜ NOT STARTED | — | — |
| `CA-08` | Vendor Detail + Product Catalog | ⬜ NOT STARTED | — | — |
| `QA-02` | Device testing: CA-01–CA-08 on all 3 tiers | ⬜ NOT STARTED | — | — |

### Week 4 — Customer App: Ordering & Checkout

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `CA-09` | Cart provider with single-vendor enforcement | ⬜ NOT STARTED | — | — |
| `CA-10` | Cart Screen + quantity management | ⬜ NOT STARTED | — | — |
| `CA-11` | Checkout Screen (address, COD/UPI, summary) | ⬜ NOT STARTED | — | — |
| `CA-12` | COD order placement + error handling | ⬜ NOT STARTED | — | — |
| `CA-13` | UPI order + Razorpay Flutter SDK | ⬜ NOT STARTED | — | — |
| `CA-14` | Order Confirmation Screen | ⬜ NOT STARTED | — | — |
| `CA-15` | Order Tracking: stepper + Realtime | ⬜ NOT STARTED | — | — |
| `CA-16` | Rating Prompt Overlay | ⬜ NOT STARTED | — | — |
| `CA-17` | Payment verify + 30s polling fallback | ⬜ NOT STARTED | — | — |
| `QA-03` | Full customer E2E on physical devices | ⬜ NOT STARTED | — | — |

### Week 5 — Vendor App + Rider App

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `VA-01` | Vendor App: project setup + auth | ⬜ NOT STARTED | — | — |
| `VA-02` | Vendor Dashboard: orders list + earnings | ⬜ NOT STARTED | — | — |
| `VA-03` | Order Detail: accept/reject | ⬜ NOT STARTED | — | — |
| `VA-04` | Catalog Screen: list + availability toggle | ⬜ NOT STARTED | — | — |
| `VA-05` | Add/Edit Product + async photo upload | ⬜ NOT STARTED | — | — |
| `RA-01` | Rider App: project setup + auth | ⬜ NOT STARTED | — | — |
| `RA-02` | Active Deliveries List | ⬜ NOT STARTED | — | — |
| `RA-03` | Delivery Detail + offline Mapbox map | ⬜ NOT STARTED | — | — |
| `RA-04` | Hive offline action queue | ⬜ NOT STARTED | — | — |
| `RA-05` | Mark Picked Up (offline-capable) | ⬜ NOT STARTED | — | — |
| `RA-06` | Delivery Confirmation: photo + COD | ⬜ NOT STARTED | — | — |
| `RA-07` | Offline sync on reconnect + sync banner | ⬜ NOT STARTED | — | — |
| `QA-04` | Vendor app E2E sign-off | ⬜ NOT STARTED | — | — |
| `QA-05` | Rider offline tests (all 4 scenarios) | ⬜ NOT STARTED | — | — |

### Week 6 — Admin Dashboard + Integration

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `AD-01` | Next.js setup + auth | ⬜ NOT STARTED | — | — |
| `AD-02` | Orders overview table | ⬜ NOT STARTED | — | — |
| `AD-03` | Rider assignment panel | ⬜ NOT STARTED | — | — |
| `AD-04` | Vendor approval panel | ⬜ NOT STARTED | — | — |
| `AD-05` | COD reconciliation screen | ⬜ NOT STARTED | — | — |
| `AD-06` | Metrics dashboard | ⬜ NOT STARTED | — | — |
| `INT-02` | Voice search: Whisper + Flutter integration | ⬜ NOT STARTED | — | — |
| `INT-03` | Full notification pipeline verification | ⬜ NOT STARTED | — | — |
| `INT-04` | Version check middleware | ⬜ NOT STARTED | — | — |
| `INT-05` | JWT refresh flow | ⬜ NOT STARTED | — | — |
| `QA-06` | Full end-to-end QA run + sign-off | ⬜ NOT STARTED | — | — |

### Week 7 — Hardening

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `QA-07` | Security checklist verification | ⬜ NOT STARTED | — | — |
| `QA-08` | Dependency security audit | ⬜ NOT STARTED | — | — |
| `QA-09` | Sentry live verification | ⬜ NOT STARTED | — | — |
| `QA-10` | PostHog analytics verification | ⬜ NOT STARTED | — | — |
| `QA-11` | UptimeRobot monitoring setup | ⬜ NOT STARTED | — | — |
| `QA-12` | Load baseline test | ⬜ NOT STARTED | — | — |
| `INT-06` | Image compression optimization | ⬜ NOT STARTED | — | — |
| `INT-07` | Offline tile size verification | ⬜ NOT STARTED | — | — |
| `INT-08` | App startup time measurement | ⬜ NOT STARTED | — | — |
| `INT-09` | Bug fixes from Week 6 QA | ⬜ NOT STARTED | — | — |
| `INT-10` | Production Supabase configuration | ⬜ NOT STARTED | — | — |
| `INT-11` | Environment variables verification | ⬜ NOT STARTED | — | — |

### Week 8 — Production Readiness & Launch

| Task ID | Description | Status | Assigned To | Done Date |
|---|---|---|---|---|
| `OPS-14` | Google Play Console setup | ⬜ NOT STARTED | — | — |
| `OPS-15` | Play Store listing assets | ⬜ NOT STARTED | — | — |
| `OPS-16` | Signed release APK/AAB + keystore | ⬜ NOT STARTED | — | — |
| `OPS-17` | Internal testing track (48-hour soak) | ⬜ NOT STARTED | — | — |
| `OPS-18` | Production secrets rotation | ⬜ NOT STARTED | — | — |
| `QA-13` | ProductionReadinessChecklist.md sign-off | ⬜ NOT STARTED | — | — |
| `OPS-19` | Soft launch: APK to 100 pre-registered users | ⬜ NOT STARTED | — | — |
| `OPS-20` | Play Store production submission | ⬜ NOT STARTED | — | — |
| `INT-12` | Post-launch monitoring (24-hour watch) | ⬜ NOT STARTED | — | — |

---

## 2. Milestone Tracker

| Milestone | Target Date | Status | Notes |
|---|---|---|---|
| Pre-dev setup complete (all OPS tasks done) | Week 0 end | ⬜ NOT STARTED | — |
| Schema deployed to staging with RLS passing | Week 1 end | ⬜ NOT STARTED | — |
| First real order placed via API (curl) | Week 2 end | ⬜ NOT STARTED | — |
| Customer can browse vendors on real device | Week 3 end | ⬜ NOT STARTED | — |
| Customer can place real COD order | Week 4 end | ⬜ NOT STARTED | — |
| Full delivery workflow end-to-end (incl. offline) | Week 5 end | ⬜ NOT STARTED | — |
| Admin dashboard functional, QA-06 signed off | Week 6 end | ⬜ NOT STARTED | — |
| Security hardening + performance targets met | Week 7 end | ⬜ NOT STARTED | — |
| **MVP SOFT LAUNCH — 100 users** | Week 8 | ⬜ NOT STARTED | — |
| PRD §3 metrics sustained for 14 days | Week 10+ | ⬜ NOT STARTED | Gate to V1 development |
| PRD §3 metrics sustained for 30 days | Week 12+ | ⬜ NOT STARTED | Gate to V1 feature build |

---

## 3. Blocker Log

*No blockers currently. Append below when a blocker is identified.*

| Date | Task ID | Blocker Description | Owner | Resolution | Resolved Date |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

**Blocker escalation policy:** If a blocker is not resolved within 48 hours, it is escalated to the CTO. If still unresolved at 72 hours, the Founder is looped in. No blocker should remain unresolved for more than 72 hours without a documented decision (defer, workaround, or escalate further).

---

## 4. Weekly Velocity Snapshots

*Updated every Monday by the CTO. Tracks tasks completed the prior week.*

| Week | Tasks Completed | Tasks Planned | Velocity | Notable Issues |
|---|---|---|---|---|
| Week 0 | — | 13 | — | — |
| Week 1 | — | 7 | — | — |
| Week 2 | — | 9 | — | — |
| Week 3 | — | 9 | — | — |
| Week 4 | — | 10 | — | — |
| Week 5 | — | 14 | — | — |
| Week 6 | — | 11 | — | — |
| Week 7 | — | 12 | — | — |
| Week 8 | — | 9 | — | — |

---

## 5. Change Log

*Record any task additions, removals, or significant scope changes here.*

| Date | Change | Reason | Approved By |
|---|---|---|---|
| 2026-06 | Initial tracker created from ImplementationPlan.md v1.0 | Document creation | CTO |

---

*End of Tracker.md — v1.0 (Initialized, all tasks NOT STARTED)*
