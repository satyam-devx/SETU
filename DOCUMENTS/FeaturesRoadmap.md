# SETU — FeaturesRoadmap.md

**Document Class:** Product · Living (reprioritized regularly based on operational learnings)
**Owner:** Chief Product Officer
**Audience:** Engineering team, founders, investors (progress visibility)
**Status:** v1.0 — MVP Baseline + V1–V4 Horizon
**Depends On:** PRD.md, AppFlow.md, SystemArchitecture.md

---

## 0. How to Use This Document

This document is the prioritized, sequenced feature backlog from MVP through V4. It feeds `ImplementationPlan.md` (which breaks MVP features into week-by-week tasks) and `Tracker.md` (which tracks build status).

**Reading the feature tables:**
- **Must / Should / Could** = MoSCoW priority within the version
- **Gate** = the operational or architectural trigger that must be true before this feature begins development
- **Blocks** = features that cannot be built until this one is complete
- Items in the "Not Now" section are explicitly deferred — they have reconsideration triggers, not permanent "no" status

---

## 1. MVP Feature Set (v0.1)

**Definition of MVP done:** All 15 non-negotiables below function end-to-end on a real Android device with a real order in Madhepur block, and PRD §3 success metrics are sustained for 14 consecutive days.

### 1.1 Customer App — MVP

| # | Feature | Priority | AppFlow Ref | Gate | Blocks |
|---|---|---|---|---|---|
| C1 | Phone OTP login | Must | §1.1–1.2 | None | Everything |
| C2 | Village selection on first open | Must | §1.3 | C1 | C3 |
| C3 | Category grid on home screen (data-driven) | Must | §2.1 | C2, V1 | C4 |
| C4 | Vendor list per category | Must | §2.2 | C3 | C5 |
| C5 | Vendor detail + product catalog | Must | §2.3 | C4 | C6 |
| C6 | Add to cart (single-vendor enforcement) | Must | §2.4 | C5 | C7 |
| C7 | Checkout with COD (default) + UPI | Must | §3.1–3.2 | C6, P1 | C8 |
| C8 | Order confirmation screen | Must | §3.3 | C7 | C9 |
| C9 | Order tracking (5-state stepper + Realtime) | Must | §4.1 | C8, D3 | C10 |
| C10 | 5-star rating after delivery | Must | §4.2 | C9 | — |
| C11 | Hindi voice search (Whisper) | Must | §2.5 | C4 | — |
| C12 | Order history list | Should | §5.3 (APIContract) | C8 | — |
| C13 | Address management (add/edit) | Should | §2.3 (APIContract) | C2 | — |

### 1.2 Vendor App — MVP

| # | Feature | Priority | AppFlow Ref | Gate | Blocks |
|---|---|---|---|---|---|
| V1 | Vendor onboarding (via admin approval) | Must | §8.2 | A1 | C3 |
| V2 | New order notification (push + WhatsApp) | Must | §5.1, §9 | V1, N1 | V3 |
| V3 | Order accept / reject with reason | Must | §5.2 | V2 | R1 |
| V4 | Product catalog management (add/edit/toggle) | Must | §6.1–6.2 | V1 | — |
| V5 | Separate photo upload (non-blocking) | Must | §6.2 | V4 | — |
| V6 | Today's orders list | Must | §5.1 | V3 | — |
| V7 | Daily earnings summary | Must | §7.9 (APIContract) | V6 | — |

### 1.3 Rider App — MVP

| # | Feature | Priority | AppFlow Ref | Gate | Blocks |
|---|---|---|---|---|---|
| R1 | Active deliveries list | Must | §7.1 | A2 | R2 |
| R2 | Delivery detail with offline Mapbox map | Must | §7.2 | R1 | R3 |
| R3 | Mark picked up (offline-capable) | Must | §7.2 | R2 | R4 |
| R4 | Mark delivered with mandatory photo + COD | Must | §7.3 | R3 | — |
| R5 | Offline action queue (Hive-backed) | Must | §7.3 | R3 | — |
| R6 | Offline sync on reconnect | Must | §7.3 | R5 | — |
| R7 | Rider earnings view | Should | §8.5 (APIContract) | R4 | — |

### 1.4 Admin Dashboard — MVP

| # | Feature | Priority | AppFlow Ref | Gate | Blocks |
|---|---|---|---|---|---|
| A1 | Vendor approval / rejection | Must | §8.2 | — | V1 |
| A2 | Manual rider assignment to confirmed orders | Must | §8.1 | — | R1 |
| A3 | All orders view (filterable by status) | Must | §8.1 | — | — |
| A4 | Daily COD reconciliation view + entry | Must | §8.3 | R4 | — |
| A5 | Block-level metrics dashboard | Should | §9.5 (APIContract) | A3 | — |

### 1.5 Backend / Infrastructure — MVP

| # | Feature | Priority | Notes | Gate | Blocks |
|---|---|---|---|---|---|
| B1 | Supabase schema + RLS policies (migration 0001, 0002) | Must | All tables per Schema.md | None | Everything |
| B2 | OrderService Edge Function | Must | Create order, validate stock, calculate total | B1 | C7 |
| B3 | PaymentService Edge Function (Razorpay + webhook) | Must | Order creation, verify, webhook handler | B2 | C7 |
| B4 | VendorService Edge Function | Must | Accept/reject, catalog CRUD | B1 | V3 |
| B5 | RiderService Edge Function | Must | Pickup, deliver, location update | B1 | R3 |
| B6 | NotificationService Edge Function | Must | FCM push + WhatsApp dispatch | B1 | V2, C9 |
| N1 | Firebase FCM setup + flutter_messaging integration | Must | Push notifications | None | V2, C9 |
| P1 | Razorpay integration (Flutter SDK + server) | Must | UPI payment | None | C7 |

### 1.6 Explicitly Not in MVP (with Reconsideration Triggers)

| Feature | Why Deferred | Reconsider When |
|---|---|---|
| Multi-vendor cart | Delivery routing complexity; proven single-vendor ops needed first | Single-vendor fulfillment rate >95% for 30 days |
| SETU Seva (services) | Different trust model, unvalidated demand | Commerce V1 metrics gate passed |
| Vendor subscription tiers | Must prove free value before charging | 50+ active vendors |
| Automated rider assignment / matching | Not enough riders for a matching algorithm to add value | 10+ active riders in the block |
| AI recommendations | No data to train on | 1,000+ completed orders |
| Loyalty points | Manual tracking sufficient (Execution Bible) | 100+ registered users |
| Automated refunds | Manual admin process sufficient | 50+ orders/day |
| Coupon/promo engine | No pricing strategy yet | V1+ monetization layer defined |
| Real-time customer-vendor chat | WhatsApp already serves this; adds trust complexity | Never — likely permanent deferral |
| iOS app | Android is >95% of target base | V2+ geographic expansion justifies |
| Maithili UI strings | Schema-ready now; UI translation deferred | V1 launch in Maithili-primary villages |
| Returns/refund automation | Case-by-case sufficient | 50+ orders/day |
| SETU Credit | No transaction history to underwrite | 10,000+ orders with repayment data |

---

## 2. V1 Feature Set — Block Domination Edition

**Gate to start V1 development:** All MVP success metrics (PRD §3) sustained for 30 consecutive days in Madhepur block.

**V1 definition of done:** 150+ active vendors, 5,000+ registered users, 300+ orders/day, all of Madhepur block covered.

| # | Feature | Priority | Architectural Dependency | Revenue Impact |
|---|---|---|---|---|
| V1.1 | Vendor subscription tiers (Free / Pro ₹199 / Plus ₹499) | Must | None — field present in schema | First SaaS revenue |
| V1.2 | Pro tier: vendor analytics dashboard (weekly trends, top products) | Must | V1.1 | Drives V1.1 conversion |
| V1.3 | Pro tier: AI demand forecasting nudges ("order 15kg more rice by Friday") | Should | Phase 2 AI service (SystemArchitecture §2) | — |
| V1.4 | Featured vendor placement (paid listings) | Must | V1.1 | Ad revenue stream |
| V1.5 | Maithili UI translation (full strings pass) | Must | app_strings.dart architecture already correct | Trust + adoption |
| V1.6 | SETU Seva — service provider bookings (plumber, electrician, tailor) | Must | New: seva_providers table, seva_bookings table | New vertical |
| V1.7 | Rider self-assignment (claim unassigned orders) | Should | `deliveries.accepted_at` already in schema | Ops efficiency |
| V1.8 | Automated refund flow for UPI-paid cancelled orders | Must | PaymentService refund endpoint (Razorpay refund API) | Trust |
| V1.9 | Referral code tracking (formal, with per-referral ₹30 credit) | Must | New: referrals table | CAC reduction |
| V1.10 | Village Anchor dashboard (anchor sees their village's activity) | Should | `villages.anchor_user_id` already in schema | Community moat |
| V1.11 | SETU Jobs board (local gig + permanent listings) | Could | New: job_listings table | Engagement + retention |
| V1.12 | Reorder button on order history | Must | `POST /api/v1/orders/:id/reorder` already in APIContract §5.4 | GMV increase |
| V1.13 | Scheme navigation service (₹99 fee for assisted PM Kisan, Ayushman application) | Could | New: scheme_requests table | Non-commerce revenue |
| V1.14 | Typesense search (replaces pg_trgm when catalog >10K products) | Should | Phase 2 scaling trigger (SystemArchitecture §6) | Latency improvement |

---

## 3. V2 Feature Set — District Scale Edition

**Gate to start V2 development:** V1 metrics stable in 3+ blocks; Series A funding or equivalent runway.

**V2 definition of done:** 5 blocks in Madhubani, 20,000+ users, 2,000+ orders/day.

| # | Feature | Priority | Notes |
|---|---|---|---|
| V2.1 | SETU Krishi — makhana/fish/agri-input marketplace | Must | New vertical; highest local product moat |
| V2.2 | Cold chain booking integration (when cold storage unit operational) | Must | Physical infrastructure must precede (Constitution IX) |
| V2.3 | SETU ID — shareable digital business profile (unique URL per vendor) | Must | `setu.app/shop/ramesh-general-store` |
| V2.4 | ML-based fraud detection (trained on V1 transaction data) | Must | Requires 10,000+ orders in dataset |
| V2.5 | ONDC seller onboarding (SETU vendors discoverable on ONDC network) | Must | Regulatory/strategic |
| V2.6 | Multi-vendor cart | Should | System Architecture §6 trigger: fulfillment rate proven stable |
| V2.7 | Hyperlocal advertising (local business announcements, scheme updates) | Should | SETU Inform feature |
| V2.8 | Vendor working capital loans (NBFC partnership, not own book) | Could | Requires 6+ months vendor transaction history |
| V2.9 | Telemedicine integration (partner API) | Could | New vertical; PHC Madhepur empanelment needed |
| V2.10 | EV delivery pilot (2-3 EVs in Madhepur) | Could | Ops/infrastructure investment |

---

## 4. V3–V4 Horizon (Reference Only)

### V3 — Bihar Infrastructure Edition
- SETU Credit (BNPL for consumers + working capital for vendors) — NBFC partnership
- SETU Sehat (telemedicine + Ayushman Bharat empanelment)
- Insurance distribution (crop, health, device)
- B2G scheme delivery integration
- Full Bihar state coverage (20 districts)
- Custom ML models: credit underwriting, demand forecasting, fraud network detection

### V4 — Rural OS Platform Edition
- SETU Platform API (third-party developer access)
- SETU-Rural LLM (proprietary fine-tuned model)
- Village Digital Identity layer
- Government infrastructure integration (PM POSHAN, MGNREGS)
- White-label SETU for other state governments
- 5M+ MAU, IPO-readiness

---

## 5. Feature-to-Architecture Dependency Map

| Feature | Requires Architecture Phase |
|---|---|
| All MVP features | Phase 1 (Supabase monolith) |
| V1.3 (AI demand forecasting) | Phase 2 (AI service) |
| V1.14 (Typesense search) | Phase 2 (search layer) |
| V2.4 (ML fraud detection) | Phase 2 (AI + analytics) |
| V3 (SETU Credit, heavy ML) | Phase 3 (service extraction + data platform) |
| V4 (Platform API, custom LLM) | Phase 4 (full platform) |

---

*End of FeaturesRoadmap.md — v1.0*
