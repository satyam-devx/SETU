# SETU — TestingRequirements.md

**Document Class:** Engineering · Living (new test scenarios added per feature)
**Owner:** Head of QA
**Audience:** All engineers, QA team, AI coding assistants (test generation)
**Status:** v1.0 — MVP Testing Baseline
**Depends On:** AppFlow.md, APIContract.md, ErrorHandlingGuide.md

---

## 0. How to Use This Document

This document defines what "tested" means at SETU. Every feature in `FeaturesRoadmap.md` has a "Definition of Done" that includes the tests specified here. A feature is not done until its tests pass — not until the code is written.

**AI coding assistants:** When generating a new function, handler, or screen, also generate the corresponding unit/integration tests per Section 2's pyramid. Untested code is incomplete code.

---

## 1. Test Pyramid Policy

```
        ┌─────────────────┐
        │   E2E Tests      │  ← Few, high-value critical journeys only
        │  (manual + CI)   │     AppFlow happy paths + key failure paths
        ├─────────────────┤
        │ Integration Tests│  ← API + DB layer: RLS, business logic,
        │  (automated CI)  │     payment flows, notification triggers
        ├─────────────────┤
        │   Unit Tests     │  ← Business logic, utilities, transformations
        │  (automated CI)  │     CurrencyUtils, error parsing, cart logic
        └─────────────────┘
```

**Coverage targets:**

| Layer | Target Coverage | Measured By |
|---|---|---|
| Unit tests | 80% line coverage on `core/` and `data/` layers | `flutter test --coverage` |
| Integration tests | 100% of `APIContract.md` endpoints have at least one happy-path test | CI test run |
| E2E tests | 100% of AppFlow "critical journeys" (Section 3) have a manual QA script | QA sign-off checklist |

---

## 2. Unit Test Requirements

### 2.1 Always Unit Test

These must have unit tests regardless of apparent simplicity:

**Flutter:**
- `CurrencyUtils.formatRupees()` — every edge case (zero, sub-rupee amounts, large values)
- `getErrorMessage()` in `error_strings.dart` — every code in the catalog returns a non-null Hindi string
- Cart provider logic: add item, remove item, clear cart, single-vendor enforcement
- Offline action queue: enqueue, dequeue, FIFO ordering, sync-on-reconnect idempotency
- All `Repository` classes — unit tested with a mocked Supabase client

**Edge Functions:**
- Monetary calculation logic (total = subtotal + delivery_fee + platform_fee - discount_amount)
- Order number generation (`SETU-YYYYMMDD-NNNN` format)
- Razorpay signature verification function (known good and known bad signatures)
- JWT claim extraction function

### 2.2 Unit Test Patterns

```dart
// Flutter unit test example — currency utils
// test/unit/currency_test.dart
void main() {
  group('CurrencyUtils.formatRupees', () {
    test('formats whole rupee amounts without decimal', () {
      expect(CurrencyUtils.formatRupees(2500), equals('₹25'));
      expect(CurrencyUtils.formatRupees(100), equals('₹1'));
      expect(CurrencyUtils.formatRupees(100000), equals('₹1000'));
    });

    test('formats sub-rupee amounts with 2 decimal places', () {
      expect(CurrencyUtils.formatRupees(150), equals('₹1.50'));
      expect(CurrencyUtils.formatRupees(2550), equals('₹25.50'));
    });

    test('formats zero correctly', () {
      expect(CurrencyUtils.formatRupees(0), equals('₹0'));
    });

    test('never returns a float — input is always int', () {
      // This test documents the type contract
      expect(CurrencyUtils.formatRupees(1800), isA<String>());
    });
  });
}
```

```typescript
// Edge Function unit test example — signature verification
// supabase/functions/payment-service/handlers/webhook_test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts"
import { verifyRazorpaySignature } from "./webhook.ts"

Deno.test("verifyRazorpaySignature returns true for valid signature", () => {
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test123"}}}}'
  const secret = "test_webhook_secret"
  // Pre-computed HMAC for this body+secret combination
  const validSig = "d4a3c2b1..."
  assertEquals(verifyRazorpaySignature(body, validSig, secret), true)
})

Deno.test("verifyRazorpaySignature returns false for tampered body", () => {
  const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_real"}}}}'
  const tamperedBody = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_different"}}}}'
  const secret = "test_webhook_secret"
  const sigForOriginal = "d4a3c2b1..."
  assertEquals(verifyRazorpaySignature(tamperedBody, sigForOriginal, secret), false)
})
```

---

## 3. Integration Test Requirements

### 3.1 API Integration Tests

Every endpoint in `APIContract.md` must have at minimum:
1. A **happy path** test (correct request, expected 2xx response)
2. At least one **auth failure** test (missing/invalid JWT → 401)
3. At least one **validation failure** test (malformed request → 400)
4. A **RLS boundary** test (user trying to access another user's data → 404)

**Test environment:** Against local Supabase (`supabase start`) with seeded test data. Never against staging or production.

### 3.2 Critical Integration Test Scenarios

These are the highest-priority integration tests — they must pass before any deploy:

#### ORDER CREATION (APIContract §5.1)

```
TEST: Happy path COD order
  Given: authenticated customer, vendor with 2 available products, customer address
  When: POST /api/v1/orders { vendor_id, items: [{product_id, quantity:2}], payment_method:'cod' }
  Then:
    - Response 201 with order.status='pending', order.payment_method='cod'
    - orders row created in DB with correct subtotal, delivery_fee, total (all paise)
    - order_items rows created with product_name and unit_price snapshots
    - notifications row created for vendor (type='new_order')
    - audit_log entry created (action='order.created')

TEST: Items unavailable at checkout
  Given: customer has product_id in request that has is_available=false
  When: POST /api/v1/orders
  Then: Response 409 ITEMS_UNAVAILABLE with unavailable_items array containing the product name

TEST: Cross-vendor item rejection
  Given: items array contains products from two different vendors
  When: POST /api/v1/orders
  Then: Response 400 MULTIPLE_VENDORS

TEST: RLS — vendor cannot create order for another vendor's products
  (This is tested at RLS level — a vendor JWT cannot insert into orders
   with a different vendor_id; the Edge Function enforces this additionally)
```

#### RAZORPAY WEBHOOK (APIContract §6.2 + SecurityRequirements.md §4.1)

```
TEST: Valid webhook — payment.captured
  Given: Valid Razorpay HMAC signature, order in 'pending' payment_status
  When: POST /api/v1/payments/webhook (with valid X-Razorpay-Signature)
  Then:
    - transactions row created/updated with status='success'
    - orders.payment_status = 'paid'
    - Response 200 { "received": true }

TEST: Invalid webhook signature
  Given: Request with tampered body or wrong signature
  When: POST /api/v1/payments/webhook
  Then:
    - Response 200 { "received": true } (not 401 — prevents retry storms)
    - NO order status change
    - audit_log entry: action='payment.webhook_signature_failed'
    - transactions row NOT created

TEST: Duplicate webhook (idempotency)
  Given: Same gateway_txn_id already exists in transactions table
  When: POST /api/v1/payments/webhook (replay)
  Then:
    - Response 200 { "received": true }
    - No new transactions row created (UNIQUE constraint)
    - order.payment_status unchanged (already 'paid')
```

#### RLS BOUNDARY TESTS

```
TEST: Customer cannot read another customer's orders
  Given: Customer A's JWT, Customer B's order_id
  When: GET /api/v1/orders/{customer_b_order_id}
  Then: Response 404 ORDER_NOT_FOUND (not 403 — no info leakage)

TEST: Vendor cannot read another vendor's orders
  Given: Vendor A's JWT, order belonging to Vendor B
  When: PATCH /api/v1/vendor/orders/{vendor_b_order_id}
  Then: Response 404

TEST: Admin (block-scoped) cannot read orders from another block
  Given: Admin JWT for Block A, order_id from Block B
  When: GET /api/v1/admin/orders/{block_b_order_id}
  Then: Response 404

TEST: Rider can only see their assigned deliveries
  Given: Rider A's JWT, delivery assigned to Rider B
  When: GET /api/v1/rider/available-orders
  Then: Response contains only Rider A's deliveries
```

#### DELIVERY CONFIRMATION (APIContract §8.3)

```
TEST: Successful delivery with photo and COD
  Given: Rider with assigned delivery, order.is_cod=true
  When: POST /api/v1/rider/orders/:id/deliver (multipart with photo + cod_amount=18000)
  Then:
    - orders.status='delivered', orders.cod_collected=true, orders.cod_amount=18000
    - deliveries.delivery_photo_url set (non-null)
    - deliveries.delivered_at set
    - Customer notification created (type='order_delivered')
    - Response 200 with rider_earnings set

TEST: Delivery without photo is rejected
  Given: Rider with assigned delivery
  When: POST /api/v1/rider/orders/:id/deliver (no photo field)
  Then: Response 400 MISSING_REQUIRED_FIELD

TEST: Idempotency — delivering already-delivered order
  Given: Order already in 'delivered' status
  When: POST /api/v1/rider/orders/:id/deliver (replay after offline sync)
  Then: Response 200 (not 409) with current order state — no duplicate DB writes
```

---

## 4. Device Testing Matrix

Per Execution Bible §T9 — every release must be tested on physical devices in each tier:

| Tier | Target Device Example | RAM | OS | Why |
|---|---|---|---|---|
| Budget | Redmi A3, Realme C35 | 2–3GB | Android 11–12 | Most common in rural Bihar, ₹5,000–7,000 range |
| Mid | Redmi Note 12, Realme 9 | 4–6GB | Android 13 | Aspiring segment, ₹10,000–12,000 |
| Upper-mid | Redmi Note 13, Samsung A34 | 6–8GB | Android 14 | Urban-adjacent users, ₹15,000 |

**Testing checklist per device tier:**

- [ ] App installs cleanly from APK (not just emulator)
- [ ] Startup time: `< 3 seconds` from launch to Home Screen on Budget tier
- [ ] Images load acceptably on 4G connection (< 2s per product image)
- [ ] Offline map tiles render on Rider App without internet (airplane mode test)
- [ ] COD + UPI payment flows complete successfully (Razorpay test mode)
- [ ] Push notification received and tapped successfully opens correct screen
- [ ] Voice search microphone permission granted and audio captured correctly
- [ ] App functions acceptably on 3G connection (not just WiFi/4G)
- [ ] App does not crash on low-memory condition (minimize + reopen repeatedly)
- [ ] System font-size increase (Accessibility → Font size → Largest): layout not broken

---

## 5. Payment Testing Protocol

### 5.1 Razorpay Test Mode Scenarios

All payment tests use Razorpay test mode credentials (`rzp_test_*`). Never use real payment credentials in testing.

| Scenario | Test Card/UPI | Expected Outcome |
|---|---|---|
| Successful UPI payment | `success@razorpay` (test UPI) | `payment_status='paid'`, order proceeds |
| Failed UPI payment | `failure@razorpay` (test UPI) | `payment_status` stays `'pending'`, retry offered |
| User cancels payment sheet | Close Razorpay SDK | Order stays `'pending'`, COD option offered |
| Network timeout during verify | Throttle network after payment, before verify | App polls GET /orders/:id for 30s, finds 'paid' via webhook |
| Webhook signature mismatch | Send webhook with wrong secret | No DB change, 200 response, audit_log entry |
| Duplicate webhook | Send same webhook twice | Second webhook is no-op (idempotency) |

### 5.2 COD Testing Protocol

```
Manual test flow:
1. Place COD order as customer
2. Admin assigns rider in Admin Dashboard
3. Rider app shows delivery
4. Rider app: mark picked up (confirm offline queue works if airplane mode on)
5. Rider app: mark delivered, capture photo, enter cod_amount
6. Verify: customer app shows "Delivered", rating prompt appears
7. Admin: check COD reconciliation view shows this rider's expected amount
8. Admin: enter actual amount = expected → confirm discrepancy = 0
```

---

## 6. Offline Testing Protocol (Rider App)

Critical per Constitution IV — offline behavior must be tested before every release:

```
TEST 1: Pickup while offline
  1. Assign an order to rider
  2. Open Rider App → confirm delivery appears
  3. Enable airplane mode (no internet)
  4. Tap "पिकअप हो गया" (Picked Up)
  5. Confirm: button shows "✓ (सेव हो रहा है)" state
  6. Confirm: offline action appears in queue (debug view or by checking Hive)
  7. Disable airplane mode
  8. Confirm: within 5 seconds, order.status = 'picked_up' in DB
  9. Confirm: customer app status stepper advances

TEST 2: Deliver while offline (including photo)
  1. Order in picked_up state
  2. Enable airplane mode
  3. Tap "डिलीवर हो गया", capture photo, enter COD amount
  4. Confirm: "Delivery Complete" screen shows despite no internet
  5. Confirm: offline sync banner shows "1 डिलीवरी सेव होने का इंतज़ार में"
  6. Disable airplane mode
  7. Confirm: delivery syncs, photo uploaded, customer notified

TEST 3: Offline map rendering
  1. Pre-download Madhepur block tiles (trigger on first app launch)
  2. Enable airplane mode
  3. Open Delivery Detail screen
  4. Confirm: map renders with correct pickup/drop pins
  5. Confirm: current GPS location updates on map (GPS works without internet)

TEST 4: App restart while offline queue has items
  1. Queue an action while offline (TEST 1 steps 1–6)
  2. Force-close the app (do not just minimize)
  3. Reopen the app (still in airplane mode)
  4. Confirm: queued action is still present (Hive persistence)
  5. Disable airplane mode
  6. Confirm: action syncs successfully
```

---

## 7. CI Gate Definition

Every PR that is not a documentation-only change must pass the following gates before it can be merged:

| Gate | Command | Failure Action |
|---|---|---|
| Flutter lint | `flutter analyze` | Block merge — zero warnings required |
| Dart format | `dart format --check` | Block merge |
| Flutter unit tests | `flutter test` | Block merge |
| Edge Function lint | `deno lint supabase/functions/` | Block merge |
| Security scan | `trufflehog git --since-commit HEAD~1` | Block merge — rotate any found secrets immediately |
| npm audit (admin) | `npm audit --audit-level=high` | Block merge |

**Integration tests** (run on the CI staging environment, not on every PR — run nightly and before any production deploy):
- Full API test suite against staging Supabase
- RLS boundary test suite
- Payment webhook simulation suite

---

## 8. QA Sign-Off Checklist (Pre-Production Deploy)

A production deploy requires manual QA sign-off on all items below. This feeds directly into `ProductionReadinessChecklist.md`.

**Happy Path (Customer):**
- [ ] OTP login on a real phone (not test number)
- [ ] Village selection, home screen loads with real vendors
- [ ] Place COD order → vendor receives WhatsApp + push notification
- [ ] Vendor accepts order → customer tracking screen updates
- [ ] Admin assigns rider → rider app shows delivery
- [ ] Rider picks up → customer tracking advances
- [ ] Rider delivers with photo → customer sees "Delivered" and rating prompt
- [ ] Customer submits 5-star rating → vendor's rating reflects in catalog

**Payment Path (UPI):**
- [ ] Place UPI order → Razorpay sheet opens with correct amount
- [ ] Complete UPI payment → order advances past vendor notification
- [ ] Payment failure → retry option works, COD fallback works

**Edge Cases:**
- [ ] Out-of-stock product at checkout shows correct error dialog
- [ ] Rider offline → delivers → syncs correctly on reconnect
- [ ] Admin COD reconciliation entries save and show correct discrepancy highlighting

---

*End of TestingRequirements.md — v1.0*
