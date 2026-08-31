# SETU — ImplementationPlan.md

**Document Class:** Engineering · Living (re-planned at the start of each major version)
**Owner:** CTO / Lead Engineer
**Audience:** Engineering team (primary work directive), founders (timeline visibility)
**Status:** v1.0 — MVP Build Plan (8 Weeks)
**Depends On:** FeaturesRoadmap.md, APIContract.md, Designs.md, TechSpec.md, TestingRequirements.md

---

## 0. How to Use This Document

This document breaks the MVP feature set from `FeaturesRoadmap.md §1` into concrete, sequenced, buildable tasks with explicit ordering. `Tracker.md` is initialized from this document's task list.

**Task naming convention:** `[AREA]-[NUMBER]` where AREA is:
- `INFRA` — Supabase schema, migrations, RLS
- `BE` — Backend Edge Functions
- `CA` — Customer App (Flutter)
- `VA` — Vendor App (Flutter)
- `RA` — Rider App (Flutter)
- `AD` — Admin Dashboard (Next.js)
- `INT` — Integration / cross-cutting concerns
- `QA` — Testing and QA tasks
- `OPS` — Operational setup (accounts, configurations)

**Effort scale:** `S` = <1 day, `M` = 1–2 days, `L` = 3–4 days, `XL` = 5+ days

**Definition of Done (per task):** Code written + unit tests passing + linting passing + PR reviewed + tested on at least one physical device (for Flutter tasks) or verified via curl/Postman (for Edge Function tasks).

---

## 1. Pre-Development Setup (Week 0 — Before Code Starts)

These must be complete before a single line of SETU code is written.

| Task | Description | Effort | Owner | Gate |
|---|---|---|---|---|
| `OPS-01` | Create Supabase project (dev, staging, prod) | S | CTO | — |
| `OPS-02` | Create GitHub repository with monorepo structure per TechSpec.md §2.1 | S | CTO | — |
| `OPS-03` | Configure GitHub Secrets (all variables from EnvironmentVariables.md §2) | M | CTO | OPS-01 |
| `OPS-04` | Set up Razorpay account (test + live), obtain test keys | S | Founder | — |
| `OPS-05` | Set up Twilio account, configure SMS + WhatsApp sandbox | S | Founder | — |
| `OPS-06` | Set up Firebase project, download google-services.json | S | Lead Dev | — |
| `OPS-07` | Set up Sentry projects (4: customer, vendor, rider, backend) | S | Lead Dev | — |
| `OPS-08` | Set up PostHog project | S | Lead Dev | — |
| `OPS-09` | Set up Mapbox account, obtain public + secret tokens | S | Lead Dev | — |
| `OPS-10` | Configure .env.example and .env.local for all team members | S | Lead Dev | OPS-01–09 |
| `OPS-11` | Set up CI/CD pipeline (GitHub Actions per TechSpec.md §8) | M | Lead Dev | OPS-02 |
| `OPS-12` | Melos bootstrap — verify all packages resolve | S | Lead Dev | OPS-02 |
| `OPS-13` | Seed data script: Madhepur block, Parsad+adjacent villages, initial categories | M | Lead Dev | OPS-01 |

---

## 2. Week 1 — Database Foundation

**Goal:** Complete schema deployed to local + staging Supabase, with all RLS policies active and seed data loaded. No app code this week — foundation first.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `INFRA-01` | Migration 0001: all tables per Schema.md (districts, blocks, villages, users, vendors, products, orders, order_items, transactions, deliveries, reviews, notifications, credit_accounts, audit_log, categories) | XL | OPS-01 | SQL validation: all tables exist with correct column types |
| `INFRA-02` | Migration 0002: all RLS policies per SecurityRequirements.md §3 | L | INFRA-01 | RLS boundary tests (TestingRequirements.md §3.2) |
| `INFRA-03` | Migration 0003: indexes per Schema.md (all `CREATE INDEX` statements) | S | INFRA-01 | Query EXPLAIN ANALYZE on key queries (vendor list by village, orders by status) |
| `INFRA-04` | Migration 0004: triggers (vendor rating denormalization on reviews insert; order_number generation function) | M | INFRA-01 | Unit test: insert review → vendor.rating updates; insert order → order_number set |
| `INFRA-05` | Seed script: Madhepur block + 10 villages (Parsad, Laxmipur, and 8 others from ground mapping) + 6 initial categories | M | INFRA-01 | Verify data in Supabase Studio |
| `INFRA-06` | Supabase Storage buckets: `product-images`, `delivery-proofs` with correct public/private policies | S | OPS-01 | Upload a test image, verify public URL accessible |
| `QA-01` | RLS integration test suite (all TestingRequirements.md §3.2 RLS boundary scenarios) | L | INFRA-02 | CI gate: all RLS tests pass |

**Week 1 exit criterion:** `supabase db push` on a fresh local environment produces a fully functional schema with RLS, indexes, and seed data. All RLS tests pass.

---

## 3. Week 2 — Authentication & Core Backend Services

**Goal:** OTP login working end-to-end. OrderService and core backend services deployed to staging.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `BE-01` | Supabase Auth: configure phone OTP via Twilio (OTP send, verify, JWT issue) | M | OPS-05, INFRA-01 | Manual: send OTP to real phone number, verify, receive JWT |
| `BE-02` | OrderService Edge Function: `POST /api/v1/orders` (both COD and UPI paths) per APIContract §5.1 | XL | INFRA-01, BE-01 | Integration test: all order creation scenarios (TestingRequirements §3.2) |
| `BE-03` | PaymentService Edge Function: `POST /api/v1/payments/verify` + `POST /api/v1/payments/webhook` | L | BE-02 | Integration test: valid webhook, invalid signature, duplicate webhook (TestingRequirements §5.1) |
| `BE-04` | VendorService Edge Function: accept/reject order + catalog CRUD endpoints | L | INFRA-01 | Integration test: accept → status confirmed; reject → status cancelled |
| `BE-05` | RiderService Edge Function: pickup + deliver endpoints (with idempotency) | L | INFRA-01 | Integration test: deliver with photo, deliver without photo (expect 400), idempotent replay |
| `BE-06` | NotificationService Edge Function: FCM push dispatch + Twilio WhatsApp | M | OPS-05, OPS-06 | Manual: place test order → vendor receives WhatsApp + push |
| `BE-07` | PostgREST auto-generated endpoints: configure for discovery (vendors, categories) and user profiles | S | INFRA-01 | Verify GET /rest/v1/vendors with RLS scoping |
| `BE-08` | Admin endpoints: orders overview, rider assignment, vendor approval, COD reconciliation | M | BE-02 | Integration test: assign rider → deliveries row created |
| `INT-01` | Error handling + logging infrastructure (shared logger, withErrorBoundary per ErrorHandlingGuide.md §8) | M | — | Unit test: withErrorBoundary catches and returns INTERNAL_ERROR; logger redacts PII |

**Week 2 exit criterion:** `POST /api/v1/orders` creates a complete order in staging DB, triggers vendor notification, and can be marked delivered via `POST /api/v1/rider/orders/:id/deliver` — all via curl/Postman. Webhook verification passing.

---

## 4. Week 3 — Customer App Foundation

**Goal:** Customer app: login → village selection → home screen → vendor browse working on a real device.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `CA-01` | Project setup: Flutter app structure per TechSpec.md §2.2, theme from Designs.md §1, app_strings.dart, error_strings.dart | M | OPS-12 | `flutter analyze` zero issues |
| `CA-02` | Supabase + Firebase initialization in main.dart | S | CA-01, OPS-06 | App launches without crash |
| `CA-03` | GoRouter configuration: all routes from AppFlow.md screens | M | CA-01 | Navigation between all defined routes works |
| `CA-04` | Auth screens: Phone Number Entry + OTP Verification (AppFlow §1.1–1.2) | L | BE-01, CA-03 | Real OTP login on physical device; new user → village selection, returning user → home |
| `CA-05` | Village Selection screen (AppFlow §1.3) | M | CA-04, BE-07 | Village list loads; selection creates user row + default address; GPS suggestion visible |
| `CA-06` | Home Screen: category grid + nearby vendor horizontal scroll (AppFlow §2.1) | L | CA-05, BE-07 | Categories load from DB; vendor cards render with Designs.md §2.1 VendorCard; empty state renders correctly |
| `CA-07` | Vendor List Screen by category (AppFlow §2.2) | M | CA-06 | Category filter works; closed-badge shows correctly (informational only) |
| `CA-08` | Vendor Detail + Product Catalog (AppFlow §2.3) | M | CA-07 | Products load; unavailable products grayed-out per Designs.md §2.2; is_available toggle visible |
| `QA-02` | Device testing: CA-01–CA-08 on all 3 device tiers (TestingRequirements §4) | M | CA-08 | Checklist per TestingRequirements §4 |

**Week 3 exit criterion:** Engineer can log in on a real ₹5,000 Android device, select Parsad village, see the category grid, tap Grocery, see Ramesh General Store, and view his product catalog.

---

## 5. Week 4 — Customer App: Ordering & Checkout

**Goal:** Customer can place a complete COD order and see it confirmed. UPI also working.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `CA-09` | Cart provider (Riverpod) with single-vendor enforcement (AppFlow §2.4) | M | CA-08 | Unit tests: add items from same vendor, add from different vendor (dialog), clear cart |
| `CA-10` | Cart Screen + item quantity management (AppFlow §3.1) | M | CA-09 | Cart updates correctly; removing last item shows empty state |
| `CA-11` | Checkout Screen: address display, COD/UPI selector, order summary with paise→₹ formatting (AppFlow §3.2) | L | CA-10, BE-02 | COD pre-selected; totals match DB values; CurrencyUtils used throughout (no inline division) |
| `CA-12` | COD order placement: POST /api/v1/orders, error handling (ITEMS_UNAVAILABLE dialog) (AppFlow §3.2) | M | CA-11 | Place real COD order in staging; 409 error dialog tested |
| `CA-13` | UPI order placement: Razorpay Flutter SDK integration (AppFlow §3.2 UPI branch) | L | CA-12, OPS-04 | Complete UPI test payment; payment failure handled; COD fallback works |
| `CA-14` | Order Confirmation Screen (AppFlow §3.3) | S | CA-12 | Shows order number; "Track Order" navigates to tracking |
| `CA-15` | Order Tracking Screen: status stepper + Realtime subscription (AppFlow §4.1) | L | CA-14, BE-06 | Status stepper updates live when backend changes status; cancelled state renders correctly |
| `CA-16` | Rating Prompt Overlay (AppFlow §4.2) | M | CA-15 | Rating submits to DB; "Later" shows reminder on next home screen open (once only) |
| `CA-17` | Payment verify flow + 30-second polling fallback (AppFlow §3.2 network-failure branch) | M | CA-13 | Network throttling test: payment succeeds via webhook, client detects via polling |
| `QA-03` | Full customer ordering E2E on physical devices (TestingRequirements §8 happy path) | L | CA-16 | QA sign-off on complete customer journey |

**Week 4 exit criterion:** Engineer can place a real COD order in staging, see vendor notification, and track the order through all 5 states on a physical device. UPI test payment also works.

---

## 6. Week 5 — Vendor App + Rider App

**Goal:** Vendor can manage orders and catalog. Rider can execute deliveries including offline scenarios.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `VA-01` | Vendor App: project setup, theme, auth (same pattern as CA-01–CA-04) | M | OPS-12 | Vendor OTP login works |
| `VA-02` | Vendor Dashboard: new orders list + daily earnings (AppFlow §5.1) | L | VA-01, BE-04 | Realtime order arrival highlights correctly (Designs.md §2.5 pulse animation) |
| `VA-03` | Order Detail: accept/reject with reason dialog (AppFlow §5.2) | M | VA-02 | Accept → order confirmed, customer notified; reject → cancelled, reason logged |
| `VA-04` | Catalog Screen: product list with availability toggle (AppFlow §6.1) | M | VA-01, BE-04 | Toggle updates DB immediately; no confirmation dialog per Designs.md §2.3 rationale |
| `VA-05` | Add/Edit Product Screen with non-blocking photo upload (AppFlow §6.2) | L | VA-04 | Product saves without photo; photo uploads asynchronously; "uploading" indicator shows |
| `RA-01` | Rider App: project setup, theme, auth | M | OPS-12 | Rider OTP login works |
| `RA-02` | Active Deliveries List (AppFlow §7.1) | M | RA-01, BE-05 | Assigned deliveries appear; delivery card shows all required fields |
| `RA-03` | Delivery Detail: offline Mapbox map with pickup + drop pins (AppFlow §7.2) | L | RA-02, OPS-09 | Map renders in airplane mode using pre-downloaded tiles; GPS updates live |
| `RA-04` | Hive offline action queue implementation (TechSpec.md §6.2) | L | RA-03 | Unit tests: enqueue, FIFO ordering, persist across app restart, idempotent sync |
| `RA-05` | Mark Picked Up (offline-capable) (AppFlow §7.2) | M | RA-04 | Works online; works offline (queued); "saving" button state shows when offline |
| `RA-06` | Delivery Confirmation: photo capture + COD amount entry (AppFlow §7.3) | L | RA-05 | Photo mandatory (rejects without); COD amount logged; sync-conflict dialog implemented |
| `RA-07` | Offline sync on reconnect + persistent sync banner (AppFlow §7.3) | M | RA-04 | Full offline tests per TestingRequirements §6 |
| `QA-04` | Vendor app E2E: receive order → accept → confirm pick-up signal (QA collaboration with rider test) | M | VA-03 | QA sign-off |
| `QA-05` | Rider app offline tests: all 4 scenarios from TestingRequirements §6 | L | RA-07 | All 4 offline test cases documented as passing |

**Week 5 exit criterion:** End-to-end delivery workflow works: customer orders → vendor accepts → admin assigns rider → rider picks up (offline) → rider delivers with photo (offline) → sync on reconnect → customer sees delivered.

---

## 7. Week 6 — Admin Dashboard + Integration

**Goal:** Admin dashboard functional. All cross-system integrations verified end-to-end.

| Task | Description | Effort | Depends On | Tests |
|---|---|---|---|---|
| `AD-01` | Next.js project setup: Supabase SSR auth, Tailwind, base layout | M | OPS-12 | Admin login via OTP works in browser |
| `AD-02` | Orders overview table with status filter (AppFlow §8.1) | M | AD-01, BE-08 | Orders display correctly; filter by status works; block-scoping RLS verified |
| `AD-03` | Manual rider assignment panel (AppFlow §8.1) | M | AD-02 | Assign rider → rider app shows delivery; ALREADY_ASSIGNED conflict handled |
| `AD-04` | Vendor approval panel (AppFlow §8.2) | M | AD-01 | Approve → vendor visible in customer app; reject → vendor gets WhatsApp notification |
| `AD-05` | COD reconciliation screen (AppFlow §8.3) | M | AD-01 | Expected amounts calculate correctly; discrepancy highlighting per Designs.md §3.5 |
| `AD-06` | Block-level metrics dashboard (PRD §3 success metrics) | M | AD-02 | All 8 PRD success metrics display correctly |
| `INT-02` | Voice search: Whisper transcription endpoint + Flutter integration (APIContract §4.1, AppFlow §2.5) | L | CA-07, BE-01 | Voice input in Hindi → correct product search results; failure states handled |
| `INT-03` | Full notification pipeline verification: all 11 events from AppFlow §9 | M | BE-06, CA-15 | Each event triggers correct push + WhatsApp to correct recipient |
| `INT-04` | Version check middleware: X-App-Version header → 426 response for old versions (AppFlow §10.1) | S | BE-01 | Old version string → 426 response; current version → passes through |
| `INT-05` | JWT refresh flow (AppFlow §10.2): silent refresh, cart preservation | M | CA-04 | Token expiry mid-session handled without user re-login; in-progress cart preserved |
| `QA-06` | Full end-to-end QA run: all scenarios in TestingRequirements §8 sign-off checklist | XL | All above | QA lead sign-off |

**Week 6 exit criterion:** Admin can approve a vendor, assign riders to orders, and complete a full COD reconciliation session. All 11 notification events verified. QA sign-off checklist in TestingRequirements §8 complete.

---

## 8. Week 7 — Hardening, Performance, and Staging Stabilization

**Goal:** No new features. Fix bugs found in Week 6 QA. Performance optimization on target devices. Security verification.

| Task | Description | Effort | Depends On |
|---|---|---|---|
| `QA-07` | Security checklist: all items in SecurityRequirements.md §9 verified by second engineer | M | Week 6 |
| `QA-08` | Dependency security audit: `flutter pub audit` + `npm audit` zero high vulnerabilities | S | Week 6 |
| `QA-09` | Sentry crash monitoring verified live: trigger a test crash, confirm Sentry alert received | S | Week 6 |
| `QA-10` | PostHog analytics verified: order placement funnel visible in dashboard | S | Week 6 |
| `QA-11` | UptimeRobot monitoring configured: vendor list endpoint + admin dashboard | S | OPS-01 |
| `QA-12` | Load baseline test: 50 simultaneous order placements against staging (verify no timeouts) | M | Week 6 |
| `INT-06` | Performance: image compression for product photos (target < 200KB per image after compression) | M | VA-05 |
| `INT-07` | Offline tile pre-download size verification (target < 80MB for Madhepur block, Zoom 12–18) | S | RA-03 |
| `INT-08` | App startup time measurement on Budget tier device (target < 3 seconds to Home Screen) | S | CA-06 |
| `INT-09` | All bug fixes from Week 6 QA session | L | QA-06 |
| `INT-10` | Production Supabase configuration: connection pooling, daily backup verification | M | OPS-01 |
| `INT-11` | Staging → Production environment variables verification (EnvironmentVariables.md §4) | S | OPS-03 |

**Week 7 exit criterion:** Zero high-severity bugs open. All security checklist items verified. Monitoring active. Performance targets met on Budget tier device.

---

## 9. Week 8 — Production Readiness & Soft Launch

**Goal:** Pass ProductionReadinessChecklist.md. Submit to Play Store. Soft launch to 100 pre-registered users.

| Task | Description | Effort | Depends On |
|---|---|---|---|
| `OPS-14` | Google Play Console account setup ($25 one-time fee) | S | — |
| `OPS-15` | Play Store listing: description (Hindi + English), screenshots (3 device sizes), feature graphic | L | CA-01 |
| `OPS-16` | Generate signed release APK/AAB: keystore creation, signing configuration | M | OPS-14 |
| `OPS-17` | Internal testing track: APK to 10 internal testers, 48-hour soak | M | OPS-16 |
| `OPS-18` | Production secrets rotation from dev defaults (EnvironmentVariables.md §5.2) | M | INT-11 |
| `QA-13` | ProductionReadinessChecklist.md: complete sign-off (3-party: CTO + QA + Founder) | L | QA-07–12 |
| `OPS-19` | Soft launch: APK distributed to 100 pre-registered users (per Execution Bible §6 customer acquisition) | S | QA-13 |
| `OPS-20` | Play Store open testing / production submission | S | OPS-17 |
| `INT-12` | Post-launch monitoring: watch Sentry, PostHog, UptimeRobot for 24 hours post-launch | M | OPS-19 |

**Week 8 exit criterion:** ProductionReadinessChecklist.md signed off by CTO + QA + Founder. App available to 100 users. Zero P0/P1 alerts in first 24 hours.

---

## 10. Parallel Work Streams

The 8-week plan assumes one Flutter developer and one backend developer working in parallel. Key parallelism opportunities:

| Weeks | Frontend Dev | Backend Dev |
|---|---|---|
| 1 | — (review Schema.md, set up local env) | INFRA-01–06 (full schema) |
| 2 | CA-01–02 (app scaffold) | BE-01–08 (all Edge Functions) |
| 3 | CA-03–08 (browse/discovery) | BE testing + integration fixes |
| 4 | CA-09–17 (ordering) | Payment integration support |
| 5 | VA + RA (parallel: vendor AM, rider PM) | Notification pipeline + bug fixes |
| 6 | AD-01–06 (admin) | INT-02–05 (integrations) |
| 7 | Bug fixes from QA-06 | Security hardening + performance |
| 8 | Play Store assets | Production configuration |

---

## 11. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Mapbox offline tile size exceeds 80MB | Medium | Medium | Test in Week 5; reduce zoom level ceiling if needed |
| Razorpay webhook delivery delay in local testing | Medium | Low | Use ngrok tunnel for local webhook testing |
| WhatsApp template approval delayed | High | Low | Use sandbox for dev/staging; timeline prod template approval alongside Week 7 |
| Vendor onboarding manual effort (photographer / catalog setup) | High | Medium | Founder does first 10 vendors personally per Execution Bible; this is expected |
| Play Store review takes >7 days for first submission | Medium | Medium | Submit in Week 7 (earlier than planned Week 8) to absorb delays |
| Flutter developer velocity lower than estimated | Medium | High | Start with CA features only; VA/RA can be simplified to bare-minimum in MVP if needed |

---

*End of ImplementationPlan.md — v1.0 (MVP Build Plan)*
