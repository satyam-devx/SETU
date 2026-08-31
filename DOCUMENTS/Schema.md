# SETU — Schema.md

**Document Class:** Foundation · Frozen, Versioned (migrations are append-only with formal review)
**Owner:** Principal Data Architect / CTO
**Audience:** All engineers, AI coding assistants, QA (test data design)
**Status:** v1.0 — MVP Schema
**Depends On:** Constitution.md, PRD.md

---

## 0. How to Use This Document

This is the "shape of truth" for SETU. Every API endpoint (`APIContract.md`), every UI flow (`AppFlow.md`), and every AI-generated database query must conform to the entities, types, relationships, and constraints defined here.

**Frozen, versioned policy:** Schema changes are made via numbered migration files (`0001_init.sql`, `0002_add_x.sql`, ...), never by editing existing migrations. This document is updated alongside each migration. A schema change that is not reflected here did not happen, as far as any other document or AI assistant is concerned.

**PRD traceability:** Every table below is traceable to either an MVP in-scope feature (PRD §4.1) or an explicitly-flagged open question (PRD §7) that requires schema flexibility now even if the UI doesn't expose it in MVP.

---

## 1. Entity-Relationship Overview

```
districts ──< blocks ──< villages ──< users
                            │            │
                            │            ├──< user_addresses
                            │            │
                            │            └──< vendors ──< products
                            │                    │            │
                            │                    │            │
                            └──< orders >────────┘            │
                                   │  │                        │
                                   │  └──< order_items >───────┘
                                   │
                                   ├──< deliveries (1:1)
                                   ├──< reviews (1:1)
                                   └──< transactions

users ──< credit_accounts (1:1, schema present, inactive in MVP)
users/vendors/admins ──< notifications
all tables ──< audit_log (referential by entity_type + entity_id)
```

**Design principle (Constitution VI):** Tables and fields that MVP UI doesn't surface but that future versions will need (Maithili text fields, voice review URLs, credit accounts) are present from v1.0 — adding them later would require costly migrations on live data with real orders. This is a deliberate **frozen-but-forward-looking** schema, not a minimal one.

---

## 2. Geography Layer

### 2.1 `districts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | e.g., "Madhubani" |
| `state` | `text` | NOT NULL, DEFAULT `'Bihar'` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

### 2.2 `blocks`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `district_id` | `uuid` | REFERENCES `districts(id)`, NOT NULL | |
| `name` | `text` | NOT NULL | e.g., "Madhepur" |
| `is_active` | `boolean` | DEFAULT `false` | Whether SETU operates here yet |
| `launched_at` | `timestamptz` | NULLABLE | Set when `is_active` flips true |

**Constitution link:** Commandment VIII (monopoly before distribution) — `is_active` is the gate. MVP has exactly one active block (Madhepur).

### 2.3 `villages`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `block_id` | `uuid` | REFERENCES `blocks(id)`, NOT NULL | |
| `name` | `text` | NOT NULL | e.g., "Parsad" |
| `lat` | `numeric(10,7)` | NULLABLE | |
| `lng` | `numeric(10,7)` | NULLABLE | |
| `population` | `integer` | NULLABLE | For ops planning, not user-facing |
| `anchor_user_id` | `uuid` | REFERENCES `users(id)`, NULLABLE | The Village Anchor (Constitution I) |
| `is_active` | `boolean` | DEFAULT `false` | Whether SETU delivers here yet |

**PRD link:** A2 (village selection on first login) queries `villages WHERE block_id = <madhepur> AND is_active = true`.

**Indexes:**
```sql
CREATE INDEX idx_villages_block ON villages(block_id) WHERE is_active = true;
```

---

## 3. User Layer

### 3.1 `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, REFERENCES `auth.users(id)` | Supabase auth-linked |
| `phone` | `text` | UNIQUE, NOT NULL | E.164 format, e.g., `+91XXXXXXXXXX` |
| `name` | `text` | NULLABLE | Collected post-OTP, optional |
| `village_id` | `uuid` | REFERENCES `villages(id)`, NULLABLE | Set during onboarding (PRD A2) |
| `role` | `text` | CHECK IN (`'customer'`,`'vendor'`,`'rider'`,`'seva_provider'`,`'anchor'`,`'admin'`,`'super_admin'`) | |
| `setu_score` | `integer` | DEFAULT `0` | Future gamification (V1+); present now per Constitution VI |
| `kyc_status` | `text` | DEFAULT `'pending'` | `pending` \| `verified` \| `rejected` |
| `language_pref` | `text` | DEFAULT `'hi'` | `hi` \| `mai` (Maithili) — present for future UI switch |
| `is_active` | `boolean` | DEFAULT `true` | Soft-disable for fraud/ban (links to SecurityRequirements.md) |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `last_seen_at` | `timestamptz` | NULLABLE | Updated on session activity |

**PRD link:** A1 (phone OTP login). `role = 'customer'` is the default assigned on first signup via the customer app; `vendor`/`rider` roles are assigned during their respective onboarding flows (out of schema scope — handled by admin approval in MVP per PRD D3).

**Why `seva_provider` and `anchor` roles exist in MVP schema despite SETU Seva being out of scope (PRD 4.3):** Per Constitution VI, adding a role value later is a trivial CHECK constraint edit, but retrofitting a role *system* later (if it didn't exist) would be costly. The role exists in the enum; no application logic for `seva_provider` ships in MVP.

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_village ON users(village_id);
CREATE INDEX idx_users_role ON users(role);
```

### 3.2 `user_addresses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | REFERENCES `users(id)` ON DELETE CASCADE | |
| `label` | `text` | NULLABLE | e.g., "Home", "Shop" |
| `line1` | `text` | NULLABLE | |
| `landmark` | `text` | NULLABLE | **Critical field** — rural addresses rely on landmarks (Constitution I/IV) |
| `village_id` | `uuid` | REFERENCES `villages(id)` | |
| `lat` | `numeric(10,7)` | NULLABLE | |
| `lng` | `numeric(10,7)` | NULLABLE | |
| `is_default` | `boolean` | DEFAULT `false` | |

**PRD link:** A2 (village selection creates a default address record), C2/C3 (rider navigation depends on `landmark` + lat/lng).

---

## 4. Vendor & Catalog Layer

### 4.1 `categories`

> **Resolves PRD Open Question #1 (category taxonomy must be data-driven).**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | e.g., "Grocery" |
| `name_hindi` | `text` | NULLABLE | |
| `name_maithili` | `text` | NULLABLE | |
| `icon_url` | `text` | NULLABLE | For visual-first browsing (Constitution III) |
| `sort_order` | `integer` | DEFAULT `0` | Controls display order on home screen |
| `is_active` | `boolean` | DEFAULT `true` | Allows hiding categories without deleting |

**Design rationale:** PRD §7 Q1 flags that the category list must come from ground vendor-mapping data, not be hardcoded. This table allows admins to add/edit/reorder categories without an app release. `vendors.category` (below) is a foreign key into this table, not a free-text or enum field.

### 4.2 `vendors`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | REFERENCES `users(id)` | The vendor's login account |
| `business_name` | `text` | NOT NULL | |
| `category_id` | `uuid` | REFERENCES `categories(id)`, NOT NULL | See 4.1 |
| `sub_category` | `text` | NULLABLE | Free-text refinement, e.g., "Tea Stall" under "Cooked Food" |
| `description` | `text` | NULLABLE | |
| `address_id` | `uuid` | REFERENCES `user_addresses(id)` | |
| `village_id` | `uuid` | REFERENCES `villages(id)`, NOT NULL | Denormalized for fast vendor-list queries |
| `cover_image_url` | `text` | NULLABLE | |
| `rating` | `numeric(3,2)` | DEFAULT `0` | Denormalized average, updated via trigger on `reviews` insert |
| `review_count` | `integer` | DEFAULT `0` | Denormalized, same trigger |
| `is_verified` | `boolean` | DEFAULT `false` | Set true on admin approval (PRD D3) |
| `is_open` | `boolean` | DEFAULT `false` | Vendor-controlled toggle |
| `opens_at` | `time` | NULLABLE | Informational only in MVP (PRD §7 Q4) |
| `closes_at` | `time` | NULLABLE | Informational only in MVP |
| `min_order_value` | `integer` | DEFAULT `0` | In paise/rupees — see Note below; MVP default 0 (PRD §7 Q2) |
| `delivery_radius_km` | `numeric(4,1)` | DEFAULT `3.0` | |
| `subscription_tier` | `text` | DEFAULT `'free'` | Schema-present for V1 monetization; no logic gates MVP behavior on this |
| `anchor_user_id` | `uuid` | REFERENCES `users(id)`, NULLABLE | Village Anchor who vouched for this vendor (Constitution I) |
| `fssai_number` | `text` | NULLABLE | For food vendors; collected but not validated in MVP |
| `gst_number` | `text` | NULLABLE | Optional |
| `bank_account_id` | `uuid` | NULLABLE | Forward reference for payout system (not built in MVP) |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

> **Monetary value convention:** All monetary columns (`min_order_value`, `price`, `mrp`, `total`, etc.) are stored as **integers in paise** (₹1 = 100) to avoid floating-point rounding errors in financial calculations. This convention applies platform-wide and must be respected by `APIContract.md` (API responses convert to rupees for display) and all AI-generated code (`AIDevelopmentRules.md` will enforce this explicitly).

**PRD link:** A3 (vendor browse by category), D3 (admin approval sets `is_verified`).

**Indexes:**
```sql
CREATE INDEX idx_vendors_village ON vendors(village_id) WHERE is_verified = true;
CREATE INDEX idx_vendors_category ON vendors(category_id);
CREATE INDEX idx_vendors_rating ON vendors(rating DESC);
```

### 4.3 `products`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `vendor_id` | `uuid` | REFERENCES `vendors(id)` ON DELETE CASCADE | |
| `name` | `text` | NOT NULL | |
| `name_hindi` | `text` | NULLABLE | |
| `name_maithili` | `text` | NULLABLE | Present per Constitution VI; not surfaced in MVP UI |
| `description` | `text` | NULLABLE | |
| `category_id` | `uuid` | REFERENCES `categories(id)`, NULLABLE | Product-level category, may differ from vendor's primary category |
| `price` | `integer` | NOT NULL | **In paise** — see 4.2 monetary convention |
| `mrp` | `integer` | NULLABLE | **In paise** |
| `unit` | `text` | DEFAULT `'piece'` | e.g., "kg", "piece", "litre" |
| `quantity_in_unit` | `numeric` | NULLABLE | e.g., `1.0` for "1 kg" |
| `image_urls` | `text[]` | NULLABLE | |
| `voice_desc_url` | `text` | NULLABLE | Schema-present for future voice catalog (Constitution III); not in MVP UI |
| `stock_count` | `integer` | DEFAULT `0` | |
| `is_available` | `boolean` | DEFAULT `true` | Vendor toggle (PRD B3) |
| `is_seasonal` | `boolean` | DEFAULT `false` | Forward reference for SETU Krishi seasonal items (V2) |
| `season_months` | `integer[]` | NULLABLE | e.g., `[10,11]` for Oct–Nov (makhana season) |
| `sort_order` | `integer` | DEFAULT `0` | |
| `search_vector` | `tsvector` | NULLABLE | Full-text search (pg_trgm), populated via trigger |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**PRD link:** A5 (product catalog view), A4 (voice search queries `search_vector`), B3 (vendor catalog management).

**Indexes:**
```sql
CREATE INDEX idx_products_vendor ON products(vendor_id) WHERE is_available = true;
CREATE INDEX idx_products_search ON products USING gin(search_vector);
```

---

## 5. Order Layer

### 5.1 `orders`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `order_number` | `text` | UNIQUE, NOT NULL | Human-readable, e.g., `SETU-20260612-0042` |
| `customer_id` | `uuid` | REFERENCES `users(id)` | |
| `vendor_id` | `uuid` | REFERENCES `vendors(id)` | |
| `rider_id` | `uuid` | REFERENCES `users(id)`, NULLABLE | NULL until admin assigns (PRD D2) |
| `delivery_address_id` | `uuid` | REFERENCES `user_addresses(id)` | |
| `status` | `text` | NOT NULL, DEFAULT `'pending'` | See state machine below |
| `payment_status` | `text` | DEFAULT `'pending'` | `pending` \| `paid` \| `failed` \| `refund_pending` \| `refunded` |
| `payment_method` | `text` | NULLABLE | `cod` \| `upi` |
| `subtotal` | `integer` | NOT NULL | **In paise**, sum of `order_items.total_price` |
| `delivery_fee` | `integer` | DEFAULT `0` | **In paise** (PRD §7 Q3 — flat fee for MVP) |
| `platform_fee` | `integer` | DEFAULT `0` | **In paise** — schema-present, value `0` for MVP (no commission charged yet) |
| `coupon_id` | `uuid` | NULLABLE | Forward reference; no `coupons` table in MVP (PRD 4.3) |
| `discount_amount` | `integer` | DEFAULT `0` | **In paise** |
| `total` | `integer` | NOT NULL | **In paise** = subtotal + delivery_fee + platform_fee - discount_amount |
| `special_instructions` | `text` | NULLABLE | Free text from customer |
| `estimated_delivery_at` | `timestamptz` | NULLABLE | |
| `picked_up_at` | `timestamptz` | NULLABLE | |
| `delivered_at` | `timestamptz` | NULLABLE | |
| `cancelled_at` | `timestamptz` | NULLABLE | |
| `cancel_reason` | `text` | NULLABLE | |
| `is_cod` | `boolean` | DEFAULT `true` | |
| `cod_collected` | `boolean` | DEFAULT `false` | Set true by rider on delivery (PRD C3) |
| `cod_amount` | `integer` | NULLABLE | **In paise** — actual cash collected, for reconciliation (PRD D4) |
| `block_id` | `uuid` | REFERENCES `blocks(id)` | Denormalized for fast admin filtering |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

#### Order Status State Machine

```
pending ──> confirmed ──> picked_up ──> on_the_way ──> delivered
   │            │
   └──> cancelled         └──> failed
```

| Status | Meaning | Set By | PRD Reference |
|---|---|---|---|
| `pending` | Order created, awaiting vendor confirmation | System (on order creation) | A6 |
| `confirmed` | Vendor accepted | Vendor (B2) | B2 |
| `picked_up` | Rider collected from vendor | Rider (C1) | C1 |
| `on_the_way` | Rider en route to customer | Rider (implicit on pickup, or explicit toggle — see AppFlow.md) | A7 |
| `delivered` | Rider confirmed delivery | Rider (C3) | C3 |
| `cancelled` | Order cancelled (by vendor reject, or customer — customer cancellation not in MVP UI but status exists) | Vendor (B2) / Admin | B2 |
| `failed` | Delivery attempted but failed (terminal, distinct from cancelled) | Rider / Admin | Forward reference for V1 |

**Note on `on_the_way`:** AppFlow.md must define whether this is a distinct rider action or is automatically set upon `picked_up`. Schema supports both as separate states; the simplest MVP implementation (per Constitution's "do not architect for scale you haven't achieved") may set `on_the_way` immediately upon `picked_up` confirmation — this is an AppFlow decision, not a schema constraint.

**Indexes:**
```sql
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_vendor ON orders(vendor_id, status);
CREATE INDEX idx_orders_rider ON orders(rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_block ON orders(block_id, created_at DESC);
```

### 5.2 `order_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `order_id` | `uuid` | REFERENCES `orders(id)` ON DELETE CASCADE | |
| `product_id` | `uuid` | REFERENCES `products(id)` | Nullable-on-delete handled via app logic; product may be deleted later but order_items retain `product_name` snapshot |
| `product_name` | `text` | NOT NULL | **Snapshot at order time** — protects historical orders if product is renamed/deleted |
| `unit_price` | `integer` | NOT NULL | **In paise**, snapshot at order time |
| `quantity` | `integer` | NOT NULL | |
| `total_price` | `integer` | NOT NULL | **In paise** = unit_price × quantity |

**Why snapshot fields:** If a vendor changes a product's price tomorrow, today's completed orders must retain today's price for accounting accuracy. This is a standard e-commerce pattern and is non-negotiable for any system handling real payments (Constitution links to future SecurityRequirements.md financial integrity section).

---

## 6. Payment & Transaction Layer

### 6.1 `transactions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `order_id` | `uuid` | REFERENCES `orders(id)`, NULLABLE | NULL for non-order transactions (future: credit repayments) |
| `user_id` | `uuid` | REFERENCES `users(id)` | |
| `type` | `text` | NOT NULL, CHECK IN (`'payment'`,`'refund'`,`'payout'`,`'credit_disbursement'`,`'credit_repayment'`,`'commission'`) | Only `'payment'` and `'refund'` are used in MVP |
| `amount` | `integer` | NOT NULL | **In paise** |
| `currency` | `text` | DEFAULT `'INR'` | |
| `status` | `text` | DEFAULT `'pending'` | `pending` \| `success` \| `failed` |
| `gateway` | `text` | NULLABLE | `'razorpay'` for MVP |
| `gateway_txn_id` | `text` | UNIQUE, NULLABLE | Razorpay payment ID — UNIQUE prevents double-recording |
| `gateway_response` | `jsonb` | NULLABLE | Raw webhook payload, for debugging/audit |
| `failure_reason` | `text` | NULLABLE | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**PRD link:** A6 (UPI payment creates a `transactions` row of type `payment`).

**Security note (forward reference):** `gateway_txn_id` UNIQUE constraint is the database-level enforcement of idempotency referenced in SecurityRequirements.md — a webhook replay cannot create a duplicate successful transaction.

---

## 7. Delivery Layer

### 7.1 `deliveries`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `order_id` | `uuid` | REFERENCES `orders(id)`, UNIQUE | 1:1 with orders |
| `rider_id` | `uuid` | REFERENCES `users(id)` | |
| `pickup_lat` | `numeric(10,7)` | NULLABLE | Snapshot of vendor location at assignment time |
| `pickup_lng` | `numeric(10,7)` | NULLABLE | |
| `drop_lat` | `numeric(10,7)` | NULLABLE | Snapshot of delivery address |
| `drop_lng` | `numeric(10,7)` | NULLABLE | |
| `status` | `text` | DEFAULT `'assigned'` | Mirrors order status subset: `assigned`\|`picked_up`\|`delivered` |
| `assigned_at` | `timestamptz` | NULLABLE | |
| `accepted_at` | `timestamptz` | NULLABLE | Forward reference — MVP has no rider "accept/decline" step (admin-assigned, PRD D2); field present for V1 self-assignment |
| `picked_at` | `timestamptz` | NULLABLE | |
| `delivered_at` | `timestamptz` | NULLABLE | |
| `delivery_photo_url` | `text` | NULLABLE | **Mandatory in practice** (PRD C3) — enforced at application/API level, not DB constraint, to allow for retry/upload-failure edge cases |
| `cod_photo_url` | `text` | NULLABLE | Optional additional photo of cash/receipt |
| `distance_km` | `numeric(6,2)` | NULLABLE | Calculated at delivery time, for analytics |
| `rider_earnings` | `integer` | NULLABLE | **In paise** — per-delivery earning, for PRD C-series earnings display |

**Why a separate table from `orders`:** Keeps order-level commerce data separate from delivery-execution data. Enables future (V2+) scenarios where delivery logistics might be handled by a different service/table structure without touching the `orders` table.

---

## 8. Review Layer

### 8.1 `reviews`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `order_id` | `uuid` | REFERENCES `orders(id)`, UNIQUE | One review per order |
| `customer_id` | `uuid` | REFERENCES `users(id)` | |
| `vendor_id` | `uuid` | REFERENCES `vendors(id)` | |
| `rider_id` | `uuid` | REFERENCES `users(id)`, NULLABLE | |
| `vendor_rating` | `integer` | CHECK BETWEEN 1 AND 5, NULLABLE | |
| `rider_rating` | `integer` | CHECK BETWEEN 1 AND 5, NULLABLE | |
| `text_review` | `text` | NULLABLE | |
| `voice_review_url` | `text` | NULLABLE | Schema-present per Constitution III/VI; MVP UI may not record voice reviews (PRD A8 notes UI may defer) |
| `is_verified_purchase` | `boolean` | DEFAULT `true` | Always true in MVP (reviews only follow real orders) |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Trigger note:** On INSERT to `reviews`, a trigger recalculates `vendors.rating` and `vendors.review_count` (denormalized fields in 4.2). This trigger is part of the migration that creates this table.

---

## 9. Notification Layer

### 9.1 `notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | REFERENCES `users(id)` | |
| `type` | `text` | NOT NULL | e.g., `order_confirmed`, `order_delivered` — catalog defined in ErrorHandlingGuide.md / AppFlow.md notification trigger map |
| `title` | `text` | NULLABLE | |
| `body` | `text` | NULLABLE | |
| `data` | `jsonb` | NULLABLE | Deep-link payload (e.g., `{"order_id": "..."}`) |
| `channel` | `text[]` | DEFAULT `ARRAY['push']` | Subset of `push`, `whatsapp` |
| `is_read` | `boolean` | DEFAULT `false` | |
| `sent_at` | `timestamptz` | NULLABLE | NULL until dispatch confirmed |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**PRD link:** A7, B1 (push notification triggers), D-series (WhatsApp confirmations).

---

## 10. Credit Layer (Schema-Present, Inactive in MVP)

### 10.1 `credit_accounts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | REFERENCES `users(id)`, UNIQUE | |
| `credit_limit` | `integer` | DEFAULT `0` | **In paise** |
| `outstanding` | `integer` | DEFAULT `0` | **In paise** |
| `credit_score` | `integer` | DEFAULT `0` | |
| `repayment_history` | `jsonb` | DEFAULT `'[]'` | |
| `status` | `text` | DEFAULT `'inactive'` | All accounts `inactive` in MVP |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Why this table exists in MVP schema:** Per Constitution VII, SETU Credit is a major future structural revenue layer (Technical Constitution Part 9–10). The table costs nothing to have present and unused; retrofitting it onto a live user base in V2+ would be far more disruptive. No application code reads or writes this table in MVP except `status = 'inactive'` defaults.

---

## 11. Audit Layer

### 11.1 `audit_log`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `actor_id` | `uuid` | NULLABLE | NULL for system-initiated actions |
| `actor_role` | `text` | NULLABLE | |
| `action` | `text` | NOT NULL | e.g., `order.status_changed`, `vendor.approved` |
| `entity_type` | `text` | NULLABLE | e.g., `'orders'`, `'vendors'` |
| `entity_id` | `uuid` | NULLABLE | |
| `old_values` | `jsonb` | NULLABLE | |
| `new_values` | `jsonb` | NULLABLE | |
| `ip_address` | `inet` | NULLABLE | |
| `user_agent` | `text` | NULLABLE | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
```sql
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

**Constitution link:** Commandment X (system must survive the founder) and forward reference to SecurityRequirements.md — every admin action (order reassignment, vendor approval/rejection, status overrides) must be logged here. This is critical for both debugging and accountability once operations involve more than one admin user.

---

## 12. Row-Level Security (RLS) Policy Summary

> **Full RLS policy SQL will be specified in SecurityRequirements.md.** This section establishes the *intent* each table's RLS must satisfy, so that SecurityRequirements.md can be written against a known target rather than inventing policy alongside schema.

| Table | Customer Access | Vendor Access | Rider Access | Admin Access |
|---|---|---|---|---|
| `users` | Own row only | Own row only | Own row only | All rows in their block |
| `user_addresses` | Own addresses only | N/A | N/A | All (for delivery context) |
| `vendors` | Read: verified vendors in their village/block. Write: none | Own vendor row (read/write) | Read-only (pickup info) | All (approve/edit) |
| `products` | Read: products of visible vendors | Own products (read/write) | Read-only (order item context) | All |
| `orders` | Own orders only (read; create via API) | Orders where `vendor_id` = own vendor (read/update status) | Orders where `rider_id` = self (read/update status) | All orders in their block |
| `order_items` | Via parent order ownership | Via parent order ownership | Via parent order ownership | All |
| `transactions` | Own transactions (read-only) | None (payouts not in MVP) | None | All in their block |
| `deliveries` | Via parent order ownership (read-only) | Via parent order ownership (read-only) | Own deliveries (read/update) | All |
| `reviews` | Own reviews (create/read) | Reviews of own vendor (read-only) | Reviews of self as rider (read-only) | All |
| `notifications` | Own notifications | Own notifications | Own notifications | All (for debugging) |
| `credit_accounts` | Own (read-only, inactive in MVP) | N/A | N/A | All (read-only in MVP) |
| `audit_log` | None | None | None | All in their block |
| `categories`, `villages`, `blocks`, `districts` | Read-only (active records) | Read-only | Read-only | Full read/write |

**Critical pattern:** "Admin Access" above means **block-scoped** admin access (Constitution + Technical Constitution Part 7 — admins are block-scoped; `super_admin` is the only cross-block role). RLS policies must filter admin queries by `orders.block_id` / `vendors.village_id → blocks.id` matching the admin's assigned block, except for `super_admin`.

---

## 13. Naming Conventions & Migration Discipline

- **Table names:** plural, `snake_case` (`order_items`, not `orderItem` or `order_item`)
- **Column names:** `snake_case`
- **Foreign keys:** `<referenced_table_singular>_id` (e.g., `vendor_id` references `vendors.id`)
- **Booleans:** prefixed `is_` or `has_` (`is_active`, `is_verified`)
- **Timestamps:** suffixed `_at` (`created_at`, `delivered_at`); always `timestamptz`, never `timestamp`
- **Monetary values:** always `integer`, always paise, no exceptions — a `numeric` or `float` monetary column is a schema violation
- **Soft delete:** SETU does not hard-delete records that have financial or operational history (orders, transactions, reviews). `products` and `vendors` use `is_available`/`is_verified`-style flags rather than deletion. `user_addresses` may be hard-deleted as they carry no transactional history once unreferenced.
- **Migration files:** `NNNN_description.sql` in `/supabase/migrations/`, sequential, never edited after merge. This document's version bumps when a new migration changes any table above.

---

## 14. Open Items Carried Forward

These remain unresolved at the schema level and must be addressed in `APIContract.md` or `AppFlow.md`:

1. **`on_the_way` status trigger** (Section 5.1 note) — whether this is rider-initiated or automatic on pickup. Schema supports either; AppFlow.md must decide.
2. **Delivery fee calculation logic** (PRD §7 Q3) — schema stores the resulting `delivery_fee` value; the calculation (flat rate, configurable per block?) is API/business-logic, not schema.
3. **`platform_fee = 0` for MVP** — when commission is introduced (V1+, per Constitution VII), this column already exists; only the calculation logic and `vendors.subscription_tier`-based rate need to be added. No migration required for that future change.

---

*End of Schema.md — v1.0 (MVP Schema)*
