# SETU — SystemArchitecture.md

**Document Class:** Foundation · Evolving (updated at phase transitions, ADRs appended continuously)
**Owner:** Principal Software Architect / CTO
**Audience:** All engineers, DevOps, AI coding assistants, technical investors
**Status:** v1.0 — Phase 1 Active
**Depends On:** Constitution.md, PRD.md, Schema.md

---

## 0. How to Use This Document

This is the technical topology map of SETU. It defines what services exist, how they communicate, how data flows through core journeys, and — critically — **when** the architecture is permitted to evolve from one phase to the next.

Per Constitution's architectural cardinal rule: **never architect for scale you haven't achieved**. This document currently describes **Phase 1** as the active architecture. Phases 2–4 are documented here so that engineers understand the evolution path and don't accidentally build Phase 1 code that *blocks* Phase 2 — but no Phase 2+ infrastructure should be provisioned or built until its scaling trigger (Section 6) is met and an ADR (Section 7) records the transition.

---

## 1. Phase 1 Architecture — MVP Modular Monolith

**Active for:** 0–500 orders/day (current phase)

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT LAYER                                                  │
│  Customer App (Flutter) │ Vendor App (Flutter)               │
│  Rider App (Flutter)    │ Admin Dashboard (Next.js)          │
└───────────────────────┬───────────────────────────────────────┘
                         │ HTTPS / WebSocket
┌───────────────────────▼───────────────────────────────────────┐
│ API GATEWAY                                                    │
│  Supabase PostgREST (auto-generated REST)                     │
│  Supabase Edge Functions (custom business logic, Deno)       │
└───────────────────────┬───────────────────────────────────────┘
                         │ Internal function calls
┌───────────────────────▼───────────────────────────────────────┐
│ BUSINESS LOGIC LAYER (Edge Functions)                          │
│  OrderService │ VendorService │ RiderService                  │
│  PaymentService │ NotificationService                          │
└───────────────────────┬───────────────────────────────────────┘
                         │ SQL queries + RLS
┌───────────────────────▼───────────────────────────────────────┐
│ DATA LAYER                                                     │
│  PostgreSQL (Supabase) │ Row-Level Security                   │
│  Full-Text Search (pg_trgm) │ Realtime (Supabase Broadcast)   │
└───────────────────────┬───────────────────────────────────────┘
                         │ Object storage
┌───────────────────────▼───────────────────────────────────────┐
│ ASSET LAYER                                                    │
│  Supabase Storage (product images, delivery proofs)          │
│  Cloudflare CDN (fast delivery to Bihar)                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Why This Architecture for Phase 1

| Decision | Rationale |
|---|---|
| Supabase as unified backend | DB, auth, realtime, storage, and auto-generated API in one service — zero server management for a team that needs to ship in weeks, not months |
| Edge Functions as service "boundaries" | `OrderService`, `VendorService`, etc. are separate Deno files with clean responsibility boundaries, but deploy and run together — gives code organization benefits of services without distributed-systems operational overhead |
| RLS instead of app-layer auth middleware | Vendor/customer/rider data isolation (Schema.md §12) enforced at the database level — fewer lines of application code, and a bug in application code cannot leak cross-tenant data |
| PostgREST for CRUD | Auto-generated REST API for standard table operations reduces boilerplate significantly; Edge Functions only handle logic that PostgREST cannot (order creation with validation, payment webhooks, notification dispatch) |
| Supabase Realtime for order tracking | WebSocket infrastructure for live order status (PRD A7) without operating Socket.io or Redis pub/sub |
| Cost at 500 orders/day | Approximately $25–50/month total infrastructure |

### 1.2 Phase 1 Edge Functions (Service Inventory)

| Service | Responsibility | Key Operations |
|---|---|---|
| `OrderService` | Order lifecycle management | Create order (validate stock, calculate totals), update status, cancel |
| `VendorService` | Vendor-side operations | Accept/reject order, catalog CRUD, availability toggles |
| `RiderService` | Rider-side operations | Mark picked up/delivered, location updates, offline sync reconciliation |
| `PaymentService` | Payment processing | Razorpay order creation, webhook verification, transaction recording |
| `NotificationService` | Notification dispatch | FCM push, WhatsApp message sending, notification record creation |

Each service corresponds to one or more endpoints in `APIContract.md`. A service is a *logical* grouping of Edge Functions, not necessarily a 1:1 file — `APIContract.md` defines the exact endpoint-to-function mapping.

### 1.3 Phase 1 Known Limitations (Accepted)

These are documented and accepted constraints — not bugs, and not to be "fixed" by jumping to Phase 2 infrastructure prematurely:

- Edge Functions have ~150ms cold start — acceptable for non-realtime operations (order creation, catalog updates)
- No dedicated job queue — scheduled tasks (e.g., daily COD reconciliation summary generation) use `pg_cron`
- Supabase Realtime has connection limits on free/starter tiers — monitored via `EnvironmentVariables.md`-referenced dashboards; becomes a Phase 2 trigger if approaching limits
- `pg_trgm` full-text search is adequate until ~100K products — far beyond MVP catalog size
- No dedicated caching layer — PostgreSQL connection pooling and proper indexing (Schema.md) carry Phase 1
- All services share one database — acceptable for Phase 1; Schema.md's table ownership (which service "owns" writes to which table) is documented in Section 5 below to ease future extraction

---

## 2. Data Flow — Core Journey: Order Placement to Delivery

This is the canonical end-to-end flow referenced by `AppFlow.md`, `APIContract.md`, and `AIDevelopmentRules.md`. Every PR touching the order lifecycle should be checked against this flow.

```
1. CUSTOMER: Browses vendor catalog (Customer App)
      │
      ▼  GET /api/v1/discovery/vendors/:id  (PostgREST, read-only)
2. CUSTOMER: Adds items to cart, proceeds to checkout
      │
      ▼  POST /api/v1/orders  (OrderService Edge Function)
3. ORDERSERVICE:
      - Validates product availability (products.is_available)
      - Snapshots prices into order_items (Schema §5.2)
      - Calculates subtotal, delivery_fee, total (all in paise)
      - Creates orders row with status='pending', payment_status='pending'
      - If payment_method='upi': calls PaymentService to create Razorpay order
      - If payment_method='cod': order proceeds directly
      │
      ▼ (async, fire-and-forget)
4. NOTIFICATIONSERVICE:
      - Sends push notification to vendor (new order)
      - Sends WhatsApp message to vendor with order details
      - Creates notifications row
      │
      ▼  Realtime subscription (Supabase Broadcast)
5. VENDOR APP: New order appears in "Pending" list (live, via Realtime)
      │
      ▼  PATCH /api/v1/vendor/orders/:id  (VendorService)
6. VENDOR: Accepts → orders.status = 'confirmed'
      │
      ▼ (Realtime + NotificationService)
7. CUSTOMER APP: Order tracking screen updates to "Confirmed"
   ADMIN DASHBOARD: Order now eligible for rider assignment
      │
      ▼  PATCH /api/v1/admin/orders/:id/assign  (Admin action, OrderService)
8. ADMIN: Assigns rider → orders.rider_id set, deliveries row created (status='assigned')
      │
      ▼ (Realtime + NotificationService)
9. RIDER APP: New delivery appears (or syncs on reconnect if rider was offline)
      │
      ▼  POST /api/v1/rider/orders/:id/pickup  (RiderService)
10. RIDER: Marks picked up → orders.status='picked_up', deliveries.picked_at set
      │
      ▼  POST /api/v1/rider/orders/:id/deliver  (RiderService, with photo + COD amount)
11. RIDER: Marks delivered →
      - orders.status='delivered', delivered_at set
      - deliveries.delivery_photo_url, delivered_at set
      - If COD: orders.cod_collected=true, cod_amount set
      │
      ▼ (Realtime + NotificationService)
12. CUSTOMER APP: Status → "Delivered", review prompt shown (PRD A8)
      │
      ▼  POST /api/v1/reviews  (via PostgREST or dedicated function)
13. CUSTOMER: Submits rating → reviews row created, trigger updates vendors.rating
```

**Offline handling (Constitution IV):** Steps 9–11 (rider-side) must function if the Rider App has no connectivity. The Rider App queues actions locally (Hive/Isar local DB per TechSpec.md) and replays them via the same endpoints once connectivity returns. `RiderService` endpoints must be idempotent — replaying a "mark picked up" call for an already-picked-up order should not error, just no-op.

---

## 3. Phase 2 Architecture — Hybrid Architecture

**Trigger:** 500–5,000 orders/day (see Section 6 for exact gate conditions)

```
[Phase 1 base remains intact, with additions:]

┌─────────────────────────────────────────────────────────────┐
│ NEW: CACHING & QUEUE LAYER                                     │
│  Upstash Redis (serverless) — session cache, rate limiting   │
│  BullMQ — job queues (WhatsApp batch sends, notification     │
│           retry, scheduled reports)                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NEW: SEARCH LAYER                                              │
│  Typesense (self-hosted, Railway) — product/vendor search    │
│  Replaces pg_trgm for sub-10ms, typo-tolerant, Hindi-aware    │
│  search                                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NEW: AI SERVICE (separate Node.js service, Railway)            │
│  - Claude API orchestration (WhatsApp bot, Section 9 of      │
│    Technical Constitution)                                     │
│  - Whisper voice transcription                                │
│  - SQL-based recommendation queries                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NEW: ANALYTICS LAYER                                           │
│  ClickHouse (via Tinybird) — time-series analytics            │
│  PostHog — product analytics                                  │
│  Separated from operational Postgres to avoid analytical      │
│  query load impacting transactional performance               │
└─────────────────────────────────────────────────────────────┘
```

**What does NOT change in Phase 2:** Core order/payment/delivery flow (Section 2) remains on Supabase. Phase 2 additions are *alongside*, not *replacing*, the Phase 1 base. This is intentional — Phase 2 should feel like "adding capabilities," not "rebuilding."

---

## 4. Phase 3 & 4 Architecture — Reference Only

These phases are documented for long-term context (and to ensure Phase 1/2 decisions don't preclude them) but are **not actionable** until their respective triggers (Section 6) are met, likely 18+ months out.

### Phase 3 — Service Extraction (5K–50K orders/day)

- API Gateway (Kong) becomes the unified entry point
- Apache Kafka (Confluent Cloud) introduced as event backbone for async service communication
- First services extracted to standalone Node.js: `OrderService`, `PaymentService`, `NotificationService` (the highest-traffic paths)
- Core Supabase retained for lower-traffic, stable-schema data: user profiles, vendor data, product catalog, reviews
- Polyglot persistence: PostgreSQL (core) + Redis Cluster + ClickHouse + Typesense + S3-compatible storage

### Phase 4 — Platform Architecture (50K+ orders/day)

- SETU Platform API (third-party developer access, OAuth2)
- Full microservices: `OrderService`, `PaymentService`, `LedgerService`, `RiderMatchingService`, `InventoryService`, `CreditService`, `FraudService`
- Data platform: S3 data lake, Airflow, dbt, ClickHouse warehouse, ML feature store
- AI platform: custom SETU-Rural LLM, real-time fraud ML, demand forecasting, credit scoring
- Kubernetes (EKS), service mesh (Istio), multi-region India deployment

---

## 5. Table Ownership Map (Phase 1 → Phase 3 Extraction Readiness)

Even though Phase 1 is a monolith with one shared database, documenting which *service* logically "owns" writes to which table now means Phase 3 extraction (Section 4) can happen with minimal schema disruption — the ownership boundaries are already conceptually drawn.

| Table | Primary Write Owner | Read Access |
|---|---|---|
| `users`, `user_addresses` | Auth/User management (Supabase Auth + minimal Edge Function) | All services (read) |
| `vendors`, `products`, `categories` | `VendorService` | `OrderService` (read, for order creation), Customer-facing PostgREST (read) |
| `orders`, `order_items` | `OrderService` | `VendorService`, `RiderService`, Admin (read/status-update within scope) |
| `transactions` | `PaymentService` | `OrderService` (read, for payment_status checks) |
| `deliveries` | `RiderService` | `OrderService`, Admin |
| `reviews` | Customer-facing function (simple insert) | `VendorService` (read, for rating display) |
| `notifications` | `NotificationService` | All (read, own notifications) |
| `audit_log` | All services (write-only, append) | Admin (read) |
| `villages`, `blocks`, `districts` | Admin/seed data | All (read) |
| `credit_accounts` | None (inactive) | None (inactive) |

**Rule for AI-assisted development:** When generating code that writes to a table, check this map. If the code is in `RiderService` and writes to `vendors`, that's a signal to reconsider — either the write belongs in a different service, or this ownership map needs an ADR-documented update (Section 7).

---

## 6. Scaling Triggers — Phase Transition Gates

Per Constitution's cardinal architectural rule, a phase transition requires **both** a quantitative trigger **and** a written ADR (Section 7). Hitting the number alone does not authorize the change — but also, the change should not happen *without* hitting the number.

| Transition | Quantitative Trigger | Additional Conditions |
|---|---|---|
| Phase 1 → Phase 2 | Sustained >400 orders/day for 2 weeks, OR Supabase Realtime concurrent connections approaching plan limit, OR product catalog search latency >200ms at p95 | PRD success metrics (§3) must be stable — don't add infrastructure complexity while still firefighting operational reliability |
| Phase 2 → Phase 3 | Sustained >4,000 orders/day for 2 weeks, OR specific service (e.g., NotificationService under BullMQ) shows queue depth consistently >1000 | Multi-block operation (Constitution VIII gate) should already be true — Phase 3 complexity is justified by multi-geography load, not single-block growth alone |
| Phase 3 → Phase 4 | Sustained >40,000 orders/day, OR external partners requesting API access (ONDC, third-party integrations) | Series A funding and dedicated platform engineering team in place (Team Constitution, Technical Constitution Part 11) |

**Anti-pattern explicitly forbidden:** Provisioning Phase 2/3/4 infrastructure "to be ready" before triggers are met. An empty Kafka cluster or unused Typesense instance is operational overhead and attack surface with zero benefit — a Constitution Commandment IX violation in reverse (infrastructure without the application need that justifies it).

---

## 7. Architecture Decision Records (ADR) Log

ADRs document significant architectural decisions and their rationale, in chronological order. Each ADR is numbered and never deleted (superseded ADRs are marked, not removed).

### ADR-001: Adopt Supabase as Phase 1 Backend
- **Date:** Document v1.0
- **Status:** Accepted
- **Context:** MVP requires shipping in weeks with a small team; need DB, auth, realtime, storage, and API without operating infrastructure.
- **Decision:** Use Supabase (PostgreSQL-based BaaS) as the unified Phase 1 backend.
- **Consequences:** Fast initial development; some Phase 2+ migration work anticipated but is bounded (PostgreSQL underlies Supabase, so the database itself is portable).

### ADR-002: Monetary Values Stored as Integer Paise
- **Date:** Document v1.0 (formalizing Schema.md §4.2 convention)
- **Status:** Accepted
- **Context:** Floating-point monetary values risk rounding errors in financial calculations across order totals, discounts, and future credit/payout systems.
- **Decision:** All monetary columns are `integer`, representing paise (₹1 = 100 paise). API layer converts to rupees for display.
- **Consequences:** Slightly less "readable" raw database values; eliminates an entire class of financial rounding bugs. AIDevelopmentRules.md will enforce this in generated code.

### ADR-003: Admin-Only Rider Assignment for MVP
- **Date:** Document v1.0 (formalizing PRD D2 / Schema §7.1 `accepted_at` note)
- **Status:** Accepted
- **Context:** Automated or rider-self-assignment matching requires either sufficient rider density or a matching algorithm — neither exists/is-justified at MVP scale.
- **Decision:** MVP rider assignment is manual, via Admin Dashboard. Schema includes `deliveries.accepted_at` as a forward-compatible field for V1+ self-assignment without a future migration.
- **Consequences:** Admin operational load is higher in MVP (acceptable per Constitution X — admin/ops presence is expected at MVP scale); removes need for matching algorithm complexity in Phase 1.

*New ADRs are appended below this line as decisions are made during development.*

---

## 8. Architecture Principles Checklist (For Every New Feature)

Before implementing any feature, verify against this checklist — a synthesis of this document's principles for quick reference:

- [ ] Does this feature fit within Phase 1 architecture (Section 1), or does it require a Phase 2+ component?
  - If Phase 2+: has the scaling trigger (Section 6) been met and an ADR written?
- [ ] Which service (Section 1.2) owns this feature's primary logic?
- [ ] Does this feature's data flow fit the canonical order journey (Section 2), or does it introduce a new flow that should be documented here?
- [ ] If this feature involves the Rider App, has offline behavior been explicitly designed (Constitution IV)?
- [ ] Does this feature write to a table outside its service's ownership (Section 5)? If so, is that intentional and documented?
- [ ] Are all monetary values handled as integer paise (ADR-002)?

---

*End of SystemArchitecture.md — v1.0 (Phase 1 Active)*
