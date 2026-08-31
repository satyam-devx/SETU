# SETU — APIContract.md

**Document Class:** Engineering · Evolving (every new endpoint requires an addition before implementation)
**Owner:** Principal Software Architect / Backend Lead
**Audience:** All engineers (frontend and backend), AI coding assistants, QA
**Status:** v1.0 — MVP Endpoints
**Depends On:** Schema.md, AppFlow.md, SystemArchitecture.md

---

## 0. How to Use This Document

This is the binding contract between client apps (Customer, Vendor, Rider, Admin) and the backend. Every endpoint listed here corresponds to an interaction in `AppFlow.md` and operates on entities defined in `Schema.md`. Frontend and backend engineers can build in parallel against this contract without integration surprises — **if this contract changes, AppFlow.md or Schema.md should be checked for consistency, and vice versa.**

**Conventions used throughout:**
- All monetary values in JSON are **integers in paise** (ADR-002) unless explicitly noted as a display-formatted field
- All timestamps are ISO 8601 UTC strings (`2026-06-12T08:30:00Z`)
- All endpoints are prefixed `/api/v1/`
- `{uuid}` denotes a UUID path parameter

---

## 1. Authentication

### 1.1 Authentication Flow

```
1. Client → POST /api/v1/auth/otp/send        { phone }
2. Server → SMS sent via Twilio (out of band)
3. Client → POST /api/v1/auth/otp/verify      { phone, otp }
4. Server → { access_token, refresh_token, user, is_new_user }
5. Client stores tokens securely (Flutter: flutter_secure_storage)
6. All subsequent requests: Authorization: Bearer {access_token}
7. On 401: Client → POST /api/v1/auth/token/refresh  { refresh_token }
8. Server → { access_token, refresh_token } (rotated)
```

**Token lifetimes** (per Technical Constitution Part 7): access token 1 hour, refresh token 30 days with rotation on use.

### 1.2 `POST /api/v1/auth/otp/send`

**Auth required:** No
**Rate limit:** 5/min per phone number, 20/min per IP (anti-abuse)

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "otp_expires_in_seconds": 600
}
```

**Error responses:**

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_PHONE_FORMAT` | Phone is not a valid 10-digit Indian number |
| 429 | `RATE_LIMITED` | Too many OTP requests for this phone/IP |
| 503 | `SMS_PROVIDER_UNAVAILABLE` | Twilio/Gupshup outage — see ErrorHandlingGuide.md |

---

### 1.3 `POST /api/v1/auth/otp/verify`

**Auth required:** No
**Rate limit:** 10/min per phone number

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "482913"
}
```

**Response `200 OK`** (existing user):
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "v1.M2...",
  "expires_in": 3600,
  "is_new_user": false,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+919876543210",
    "name": "Sunita Devi",
    "role": "customer",
    "village_id": "a1b2c3d4-...",
    "language_pref": "hi"
  }
}
```

**Response `200 OK`** (new user — no `users` row yet):
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "v1.M2...",
  "expires_in": 3600,
  "is_new_user": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+919876543210",
    "name": null,
    "role": "customer",
    "village_id": null,
    "language_pref": "hi"
  }
}
```

> AppFlow §1.2 branches on `is_new_user`: `true` → Village Selection (1.3); `false` → Home Screen.

**Error responses:**

| Status | Code | Meaning | AppFlow Reference |
|---|---|---|---|
| 400 | `INVALID_OTP` | OTP does not match | §1.2 "Incorrect OTP" branch |
| 410 | `OTP_EXPIRED` | OTP older than 10 minutes | §1.2 "OTP expired" branch |
| 429 | `RATE_LIMITED` | Too many verify attempts | — |

---

### 1.4 `POST /api/v1/auth/token/refresh`

**Auth required:** No (uses refresh token as credential)

**Request:**
```json
{
  "refresh_token": "v1.M2..."
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "v1.N3...",
  "expires_in": 3600
}
```

**Error `401 INVALID_REFRESH_TOKEN`:** Refresh token expired, revoked, or already used (rotation violation — possible token theft, per SecurityRequirements.md). Client must return to §1.1 step 1.

---

### 1.5 `DELETE /api/v1/auth/session`

**Auth required:** Yes (any role)

Invalidates the current refresh token. Response `204 No Content`.

---

## 2. User Profile

### 2.1 `GET /api/v1/users/me`

**Auth required:** Yes (any role)

**Response `200 OK`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "+919876543210",
  "name": "Sunita Devi",
  "role": "customer",
  "village_id": "a1b2c3d4-...",
  "village_name": "Parsad",
  "setu_score": 0,
  "language_pref": "hi",
  "created_at": "2026-06-01T10:00:00Z"
}
```

### 2.2 `PATCH /api/v1/users/me`

**Auth required:** Yes
**Used by:** AppFlow §1.3 (name entry), §2.1 (village change)

**Request** (all fields optional, only provided fields updated):
```json
{
  "name": "Sunita Devi",
  "village_id": "a1b2c3d4-..."
}
```

**Response `200 OK`:** Returns updated user object (same shape as 2.1).

**Special behavior — village change with non-empty cart:** This endpoint itself does not manage cart state (cart is client-side in MVP — see Section 8). The client is responsible for triggering the confirmation dialog (AppFlow §2.4 edge case) and clearing local cart state *before* calling this endpoint if the user confirms.

---

### 2.3 `GET /api/v1/users/me/addresses`

**Auth required:** Yes

**Response `200 OK`:**
```json
{
  "addresses": [
    {
      "id": "addr-uuid-1",
      "label": "Home",
      "line1": null,
      "landmark": "Neem ke ped ke paas",
      "village_id": "a1b2c3d4-...",
      "village_name": "Parsad",
      "lat": 26.3500000,
      "lng": 86.1200000,
      "is_default": true
    }
  ]
}
```

### 2.4 `POST /api/v1/users/me/addresses`

**Auth required:** Yes

**Request:**
```json
{
  "label": "Home",
  "landmark": "Neem ke ped ke paas",
  "village_id": "a1b2c3d4-...",
  "lat": 26.3500000,
  "lng": 86.1200000,
  "is_default": true
}
```

**Response `201 Created`:** Returns the created address object (shape as 2.3).

**Note:** If `is_default: true` is set, server unsets `is_default` on the user's other addresses in the same transaction.

### 2.5 `PATCH /api/v1/users/me/addresses/{uuid}`

**Auth required:** Yes (must own the address — enforced via RLS)

Same request/response shape as 2.4, all fields optional.

**Error `404 NOT_FOUND`:** Address doesn't exist or doesn't belong to caller (RLS makes these indistinguishable by design — no information leakage about other users' address IDs).

---

## 3. Discovery (Customer-Facing)

### 3.1 `GET /api/v1/discovery/categories`

**Auth required:** Yes (any role)

**Query params:** none (returns all active categories for the customer's block — derived from JWT's implicit village/block context, or optionally `?block_id=`)

**Response `200 OK`:**
```json
{
  "categories": [
    {
      "id": "cat-uuid-1",
      "name": "Grocery",
      "name_hindi": "किराना",
      "name_maithili": null,
      "icon_url": "https://cdn.setu.app/icons/grocery.png",
      "sort_order": 1
    }
  ]
}
```

> AppFlow §2.1: powers the category grid on Home Screen. Resolves PRD §7 Q1 — this list is entirely data-driven from `categories` table (Schema §4.1).

---

### 3.2 `GET /api/v1/discovery/vendors`

**Auth required:** Yes

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `village_id` | uuid | Yes | |
| `category_id` | uuid | No | Filters by category (AppFlow §2.2) |
| `sort` | string | No | `distance` (default) — requires `lat`/`lng` |
| `lat`, `lng` | numeric | No | User's current location for distance sort |
| `limit`, `offset` | integer | No | Pagination; defaults `limit=20, offset=0` |

**Response `200 OK`:**
```json
{
  "vendors": [
    {
      "id": "vendor-uuid-1",
      "business_name": "Ramesh General Store",
      "category_id": "cat-uuid-1",
      "category_name": "Grocery",
      "cover_image_url": "https://cdn.setu.app/vendors/v1/cover.jpg",
      "rating": 4.5,
      "review_count": 12,
      "is_open": true,
      "village_id": "a1b2c3d4-...",
      "distance_km": 0.8
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 14 }
}
```

> Only `is_verified = true` vendors are returned (enforced via RLS per Schema §12). `is_open` is informational only (PRD §7 Q4) — `is_open: false` vendors are still included in this list.

**Empty result:** `{ "vendors": [], "pagination": { "limit": 20, "offset": 0, "total": 0 } }` — AppFlow §2.1 renders this as the "no shops yet" empty state, **not** an error.

---

### 3.3 `GET /api/v1/discovery/vendors/{uuid}`

**Auth required:** Yes

**Response `200 OK`:**
```json
{
  "id": "vendor-uuid-1",
  "business_name": "Ramesh General Store",
  "category_id": "cat-uuid-1",
  "category_name": "Grocery",
  "description": "Fresh groceries and daily essentials",
  "cover_image_url": "https://cdn.setu.app/vendors/v1/cover.jpg",
  "rating": 4.5,
  "review_count": 12,
  "is_open": true,
  "opens_at": "07:00:00",
  "closes_at": "21:00:00",
  "min_order_value": 0,
  "products": [
    {
      "id": "prod-uuid-1",
      "name": "Tata Salt",
      "price": 2500,
      "mrp": 2800,
      "unit": "piece",
      "quantity_in_unit": 1.0,
      "image_urls": ["https://cdn.setu.app/products/p1/1.jpg"],
      "is_available": true,
      "category_id": "cat-uuid-1"
    },
    {
      "id": "prod-uuid-2",
      "name": "Basmati Rice",
      "price": 12000,
      "mrp": null,
      "unit": "kg",
      "quantity_in_unit": 1.0,
      "image_urls": [],
      "is_available": false,
      "category_id": "cat-uuid-1"
    }
  ]
}
```

> AppFlow §2.3: `is_available: false` products (like `prod-uuid-2`) are included in the response — the client renders them grayed-out, per AppFlow §2.3's "remains visible" requirement. The API does **not** filter these out.

**Error `404 VENDOR_NOT_FOUND`:** Vendor doesn't exist, or `is_verified = false` (RLS hides unverified vendors from non-admin roles — same 404 regardless of reason, no information leakage).

---

### 3.4 `GET /api/v1/discovery/search`

**Auth required:** Yes

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | Yes | Search query (from text input or voice transcription) |
| `village_id` | uuid | Yes | Scope search to customer's village |

**Response `200 OK`:**
```json
{
  "vendors": [ /* same shape as 3.2 vendors array */ ],
  "products": [
    {
      "id": "prod-uuid-1",
      "name": "Tata Salt",
      "vendor_id": "vendor-uuid-1",
      "vendor_name": "Ramesh General Store",
      "price": 2500,
      "image_urls": ["..."]
    }
  ]
}
```

**Empty result:** Both arrays empty — AppFlow §2.5 renders "Nothing found, browse by category" empty state.

---

## 4. AI — Voice Transcription

### 4.1 `POST /api/v1/ai/voice/transcribe`

**Auth required:** Yes
**Content-Type:** `multipart/form-data`
**Rate limit:** 10/min per user (voice transcription has real cost — Whisper API)

**Request:** Multipart form with field `audio` (audio file, max 15 seconds, max 2MB — enforced client-side before upload per Constitution IV bandwidth concerns)

**Response `200 OK`:**
```json
{
  "transcription": "tata namak aur chawal",
  "language_detected": "hi",
  "confidence": 0.87
}
```

**Error responses:**

| Status | Code | Meaning | AppFlow Reference |
|---|---|---|---|
| 400 | `AUDIO_TOO_LARGE` | File exceeds 2MB | — |
| 422 | `TRANSCRIPTION_FAILED` | Whisper returned low confidence or empty result | §2.5 "Transcription failed" branch |
| 503 | `AI_SERVICE_UNAVAILABLE` | Whisper API outage | §2.5 same branch (treated identically client-side) |

> Client treats `422` and `503` identically per AppFlow §2.5 — both fall back to text search. The distinction exists in the API for logging/monitoring (ErrorHandlingGuide.md), not for client branching logic.

---

## 5. Orders

### 5.1 `POST /api/v1/orders`

**Auth required:** Yes (role: `customer`)
**Idempotency:** Client must send `Idempotency-Key` header (UUID generated client-side once per checkout attempt) — prevents duplicate order creation on retry after network timeout.

**Request:**
```json
{
  "vendor_id": "vendor-uuid-1",
  "delivery_address_id": "addr-uuid-1",
  "items": [
    { "product_id": "prod-uuid-1", "quantity": 2 },
    { "product_id": "prod-uuid-3", "quantity": 1 }
  ],
  "payment_method": "cod",
  "special_instructions": "Ghar ke baahar rakh dena"
}
```

**Response `201 Created`** (COD):
```json
{
  "order": {
    "id": "order-uuid-1",
    "order_number": "SETU-20260612-0042",
    "status": "pending",
    "payment_status": "pending",
    "payment_method": "cod",
    "subtotal": 17000,
    "delivery_fee": 1000,
    "platform_fee": 0,
    "discount_amount": 0,
    "total": 18000,
    "created_at": "2026-06-12T08:30:00Z"
  }
}
```

**Response `201 Created`** (UPI — includes Razorpay order details):
```json
{
  "order": {
    "id": "order-uuid-1",
    "order_number": "SETU-20260612-0043",
    "status": "pending",
    "payment_status": "pending",
    "payment_method": "upi",
    "subtotal": 17000,
    "delivery_fee": 1000,
    "platform_fee": 0,
    "discount_amount": 0,
    "total": 18000,
    "created_at": "2026-06-12T08:30:05Z"
  },
  "razorpay": {
    "order_id": "order_Razorpay123",
    "amount": 18000,
    "currency": "INR",
    "key_id": "rzp_live_xxxxxxxx"
  }
}
```

> Client uses the `razorpay` object to open the native Razorpay payment sheet (AppFlow §3.2 UPI branch).

**Error responses:**

| Status | Code | Meaning | AppFlow Reference |
|---|---|---|---|
| 400 | `EMPTY_CART` | `items` array is empty | — |
| 400 | `MULTIPLE_VENDORS` | Items reference products from more than one vendor (server-side enforcement mirroring AppFlow §2.4 client-side check — defense in depth) | §2.4 |
| 404 | `VENDOR_NOT_FOUND` | `vendor_id` invalid or unverified | — |
| 404 | `ADDRESS_NOT_FOUND` | `delivery_address_id` doesn't belong to caller | — |
| 409 | `ITEMS_UNAVAILABLE` | One or more `product_id`s have `is_available=false` | §3.2 "Product became unavailable" branch |
| 422 | `BELOW_MINIMUM_ORDER` | `subtotal` < `vendor.min_order_value` (only relevant if a vendor sets a non-zero minimum — PRD §7 Q2) | — |

**`409 ITEMS_UNAVAILABLE` response body:**
```json
{
  "error": "ITEMS_UNAVAILABLE",
  "message": "One or more items are no longer available",
  "unavailable_items": [
    { "product_id": "prod-uuid-3", "name": "Basmati Rice" }
  ]
}
```
> AppFlow §3.2 uses `unavailable_items[].name` to construct the dialog message.

---

### 5.2 `GET /api/v1/orders/{uuid}`

**Auth required:** Yes (must be `customer_id` of the order, or admin in same block — RLS)

**Response `200 OK`:**
```json
{
  "id": "order-uuid-1",
  "order_number": "SETU-20260612-0042",
  "status": "confirmed",
  "payment_status": "pending",
  "payment_method": "cod",
  "subtotal": 17000,
  "delivery_fee": 1000,
  "total": 18000,
  "special_instructions": "Ghar ke baahar rakh dena",
  "vendor": {
    "id": "vendor-uuid-1",
    "business_name": "Ramesh General Store"
  },
  "items": [
    { "product_name": "Tata Salt", "unit_price": 2500, "quantity": 2, "total_price": 5000 },
    { "product_name": "Basmati Rice", "unit_price": 12000, "quantity": 1, "total_price": 12000 }
  ],
  "delivery": null,
  "cancel_reason": null,
  "created_at": "2026-06-12T08:30:00Z",
  "delivered_at": null
}
```

**Response `200 OK`** (with rider assigned, in-progress):
```json
{
  /* ... same fields ... */
  "status": "picked_up",
  "delivery": {
    "rider_id": "rider-uuid-1",
    "rider_name": "Vikash Kumar",
    "status": "picked_up",
    "picked_at": "2026-06-12T08:50:00Z"
  }
}
```

---

### 5.3 `GET /api/v1/orders`

**Auth required:** Yes (role: `customer`)

**Query params:** `limit`, `offset` (pagination; default `limit=20, offset=0`), `status` (optional filter)

**Response `200 OK`:**
```json
{
  "orders": [ /* array of order summary objects, same shape as 5.1 response "order" key */ ],
  "pagination": { "limit": 20, "offset": 0, "total": 7 }
}
```

---

### 5.4 `POST /api/v1/orders/{uuid}/reorder`

**Auth required:** Yes (must own the original order)

Creates a new order with the same `vendor_id`, `items` (re-checking current availability and prices — **not** a verbatim copy of old `order_items`, since prices may have changed), and `delivery_address_id` (defaults to the same address used previously, or caller's current default if that address was deleted).

**Request:** Empty body, or optionally `{ "delivery_address_id": "addr-uuid-2" }` to override.

**Response:** Same as 5.1 (`201 Created`), with the same `409 ITEMS_UNAVAILABLE` error possible if items from the original order are no longer available — client handles identically to a fresh checkout.

---

### 5.5 `GET /api/v1/orders/{uuid}/track`

**Auth required:** Yes (must be `customer_id` of the order)

**Response `200 OK`:**
```json
{
  "status": "on_the_way",
  "rider_location": { "lat": 26.3520000, "lng": 86.1180000, "updated_at": "2026-06-12T09:05:00Z" },
  "drop_location": { "lat": 26.3500000, "lng": 86.1200000 },
  "estimated_delivery_at": null
}
```

> `rider_location` is `null` if `status` is `pending` or `confirmed` (no rider assigned yet). After this initial fetch, the client subscribes to Supabase Realtime for live updates (AppFlow §4.1) rather than polling this endpoint repeatedly.

---

## 6. Payments

### 6.1 `POST /api/v1/payments/verify`

**Auth required:** Yes (role: `customer`)

**Request:**
```json
{
  "order_id": "order-uuid-1",
  "razorpay_order_id": "order_Razorpay123",
  "razorpay_payment_id": "pay_Razorpay456",
  "razorpay_signature": "abc123signature..."
}
```

**Response `200 OK`** (signature valid):
```json
{
  "success": true,
  "order": { "id": "order-uuid-1", "payment_status": "paid", "status": "pending" }
}
```

**Response `200 OK`** (signature invalid — possible tampering):
```json
{
  "success": false,
  "error": "SIGNATURE_VERIFICATION_FAILED"
}
```
> Returns `200` (not an error status) because the *request itself* was well-formed — the *payment* failed verification. AppFlow §3.2's "payment confirmation pending" polling branch treats `success: false` the same as a timeout: poll `GET /orders/:id` for webhook-driven resolution.

---

### 6.2 `POST /api/v1/payments/webhook`

**Auth required:** No (server-to-server; authenticated via Razorpay signature header `X-Razorpay-Signature` — see SecurityRequirements.md)

This endpoint is called by Razorpay directly, never by client apps. Documented here for completeness since it affects `orders.payment_status` and is part of the payment flow's eventual-consistency story (AppFlow §3.2's 30-second polling fallback relies on this webhook independently updating order state).

**Request:** Razorpay's standard webhook payload (varies by event type — `payment.captured`, `payment.failed`, etc.)

**Response `200 OK`** (always, to acknowledge receipt — Razorpay retries on non-200): `{ "received": true }`

**Side effects:**
- `payment.captured` → creates/updates `transactions` row (status='success'), sets `orders.payment_status='paid'`
- `payment.failed` → creates/updates `transactions` row (status='failed', `failure_reason` populated), sets `orders.payment_status='failed'`

---

### 6.3 `GET /api/v1/payments/history`

**Auth required:** Yes

**Response `200 OK`:**
```json
{
  "transactions": [
    {
      "id": "txn-uuid-1",
      "order_id": "order-uuid-1",
      "type": "payment",
      "amount": 18000,
      "status": "success",
      "gateway": "razorpay",
      "created_at": "2026-06-12T08:31:00Z"
    }
  ]
}
```

---

## 7. Vendor Endpoints

All endpoints in this section require **Auth: role=`vendor`**, and operate only on the caller's own `vendors` row (enforced via RLS — `vendors.user_id = auth.uid()`).

### 7.1 `GET /api/v1/vendor/me`

**Response `200 OK`:**
```json
{
  "id": "vendor-uuid-1",
  "business_name": "Ramesh General Store",
  "category_id": "cat-uuid-1",
  "is_verified": true,
  "is_open": true,
  "rating": 4.5,
  "review_count": 12
}
```

### 7.2 `GET /api/v1/vendor/orders`

**Query params:** `status` (optional — AppFlow §5.1 default fetch uses `status=pending`)

**Response `200 OK`:**
```json
{
  "orders": [
    {
      "id": "order-uuid-1",
      "order_number": "SETU-20260612-0042",
      "status": "pending",
      "items": [
        { "product_name": "Tata Salt", "quantity": 2 },
        { "product_name": "Basmati Rice", "quantity": 1 }
      ],
      "delivery_village": "Parsad",
      "delivery_landmark": "Neem ke ped ke paas",
      "special_instructions": "Ghar ke baahar rakh dena",
      "total": 18000,
      "created_at": "2026-06-12T08:30:00Z"
    }
  ]
}
```

> Note per AppFlow §5.2: customer phone number is deliberately **not** included in this response (Constitution-aligned — vendor doesn't need direct customer contact in MVP).

### 7.3 `PATCH /api/v1/vendor/orders/{uuid}`

**Request** (accept):
```json
{ "action": "accept" }
```

**Request** (reject):
```json
{ "action": "reject", "cancel_reason": "out_of_stock" }
```
> `cancel_reason` enum: `out_of_stock` | `closing_soon` | `other`. If `other`, an additional `cancel_reason_detail` free-text field is accepted (AppFlow §5.2 "Other" text field).

**Response `200 OK`:**
```json
{ "order": { "id": "order-uuid-1", "status": "confirmed" } }
```
(or `"status": "cancelled"` for reject)

**Error `409 INVALID_STATE_TRANSITION`:** Order is not in `pending` status (e.g., already accepted by a race condition, or already cancelled). Response includes current `status` so client can refresh its view.

---

### 7.4 `GET /api/v1/vendor/products`

**Response `200 OK`:**
```json
{
  "products": [
    {
      "id": "prod-uuid-1",
      "name": "Tata Salt",
      "price": 2500,
      "mrp": 2800,
      "unit": "piece",
      "category_id": "cat-uuid-1",
      "image_urls": ["..."],
      "is_available": true,
      "stock_count": 0
    }
  ]
}
```

### 7.5 `POST /api/v1/vendor/products`

**Request:**
```json
{
  "name": "Tata Salt",
  "price": 2500,
  "mrp": 2800,
  "unit": "piece",
  "quantity_in_unit": 1.0,
  "category_id": "cat-uuid-1"
}
```

> Photo upload is a **separate step** (Section 7.7) — per AppFlow §6.2, product creation is not blocked on photo upload completion.

**Response `201 Created`:** Returns created product object (shape as 7.4, `image_urls: []`).

### 7.6 `PATCH /api/v1/vendor/products/{uuid}`

All fields optional. Common usage per AppFlow §6.1 is the availability toggle:
```json
{ "is_available": false }
```

**Response `200 OK`:** Returns updated product object.

**Error `404`:** Product doesn't exist or doesn't belong to caller's vendor (RLS).

### 7.7 `POST /api/v1/vendor/products/{uuid}/image`

**Content-Type:** `multipart/form-data`, field `image`

**Response `200 OK`:**
```json
{ "image_url": "https://cdn.setu.app/products/p1/2.jpg", "image_urls": ["https://cdn.setu.app/products/p1/1.jpg", "https://cdn.setu.app/products/p1/2.jpg"] }
```

**Error `503 UPLOAD_FAILED`:** Per AppFlow §6.2, this error does **not** roll back the product creation/edit that may have triggered this upload — client shows the "uploading..." indicator and retries this call independently.

### 7.8 `DELETE /api/v1/vendor/products/{uuid}`

Soft-delete per Schema §13 convention — sets `is_available=false` permanently and excludes from `GET /vendor/products` default listing (an `?include_inactive=true` param can retrieve it). Response `204 No Content`.

### 7.9 `GET /api/v1/vendor/analytics`

**Response `200 OK`:**
```json
{
  "today": { "order_count": 8, "gross_earnings": 144000 },
  "this_week": { "order_count": 41, "gross_earnings": 738000 }
}
```
> "gross_earnings" = sum of `orders.total` for `status='delivered'` orders in the period. `platform_fee=0` in MVP (ADR per SystemArchitecture) means gross = net for now; this response shape anticipates a future `net_earnings` field without a breaking change.

---

## 8. Rider Endpoints

All endpoints require **Auth: role=`rider`**.

### 8.1 `GET /api/v1/rider/available-orders`

> Naming preserved for V1 forward-compatibility (AppFlow §7.1 note) — in MVP, returns deliveries assigned to this rider with status `assigned` or `picked_up`.

**Response `200 OK`:**
```json
{
  "deliveries": [
    {
      "order_id": "order-uuid-1",
      "order_number": "SETU-20260612-0042",
      "delivery_status": "assigned",
      "pickup": {
        "vendor_name": "Ramesh General Store",
        "village": "Madhepur",
        "lat": 26.3480000,
        "lng": 86.1150000
      },
      "drop": {
        "village": "Parsad",
        "landmark": "Neem ke ped ke paas",
        "lat": 26.3500000,
        "lng": 86.1200000
      },
      "items_summary": "3 items",
      "payment_method": "cod",
      "total": 18000
    }
  ]
}
```

### 8.2 `POST /api/v1/rider/orders/{uuid}/pickup`

**Idempotent:** Calling this twice for an already-`picked_up` order returns `200 OK` with current state, not an error — critical for offline-sync replay (AppFlow §7.2).

**Response `200 OK`:**
```json
{ "order": { "id": "order-uuid-1", "status": "picked_up" }, "delivery": { "status": "picked_up", "picked_at": "2026-06-12T08:50:00Z" } }
```

### 8.3 `POST /api/v1/rider/orders/{uuid}/deliver`

**Content-Type:** `multipart/form-data`

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `photo` | file | Yes | Delivery proof photo |
| `cod_amount` | integer (paise) | Conditional | Required if `order.is_cod = true` |

**Idempotent:** Per AppFlow §7.3 offline-sync — replaying this for an already-`delivered` order returns `200 OK` with current state.

**Response `200 OK`:**
```json
{
  "order": { "id": "order-uuid-1", "status": "delivered", "cod_collected": true, "cod_amount": 18000 },
  "delivery": { "status": "delivered", "delivered_at": "2026-06-12T09:15:00Z", "rider_earnings": 3000 }
}
```

**Error `409 ORDER_REASSIGNED`:** Per AppFlow §7.3 sync-conflict edge case — order's `rider_id` no longer matches caller. Response:
```json
{
  "error": "ORDER_REASSIGNED",
  "message": "This order has been reassigned",
  "current_rider_id": "rider-uuid-2"
}
```
> Client shows the AppFlow §7.3 conflict dialog; locally-captured photo/COD data is retained on-device per that section's resolution path.

### 8.4 `POST /api/v1/rider/location`

**Rate limit:** Client sends every 30s while a delivery is active (per Technical Constitution Part 9 route architecture); server-side rate limit set higher (e.g., 4/min) as abuse protection only.

**Request:**
```json
{ "lat": 26.3520000, "lng": 86.1180000 }
```

**Response `204 No Content`**

> This updates an in-memory/Realtime-broadcast location, not a persistent `deliveries` column (Schema.md does not define a location-history table for MVP — only the snapshot `pickup_lat/lng`/`drop_lat/lng` exist). Implementation detail: Edge Function broadcasts via Supabase Realtime channel `delivery:{order_id}` so the customer's tracking screen (AppFlow §4.1) receives live updates without a DB write per ping. If this endpoint is unreachable (offline), no queuing is needed — location updates are best-effort/ephemeral, unlike pickup/deliver actions which are queued.

### 8.5 `GET /api/v1/rider/earnings`

**Query params:** `period` = `today` | `week` (default `today`)

**Response `200 OK`:**
```json
{
  "period": "today",
  "delivery_count": 9,
  "total_earnings": 27000
}
```

---

## 9. Admin Endpoints

All endpoints require **Auth: role=`admin`** or `super_admin`. RLS scopes `admin` to their assigned `block_id`; `super_admin` sees all blocks (Schema §12).

### 9.1 `GET /api/v1/admin/orders`

**Query params:** `status`, `block_id` (super_admin only — admin's block is implicit), `limit`, `offset`

**Response `200 OK`:**
```json
{
  "orders": [
    {
      "id": "order-uuid-1",
      "order_number": "SETU-20260612-0042",
      "status": "confirmed",
      "customer_village": "Parsad",
      "vendor_name": "Ramesh General Store",
      "rider_id": null,
      "payment_status": "pending",
      "total": 18000,
      "created_at": "2026-06-12T08:30:00Z"
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 23 }
}
```

### 9.2 `PATCH /api/v1/admin/orders/{uuid}/assign`

**Request:**
```json
{ "rider_id": "rider-uuid-1" }
```

**Response `200 OK`:**
```json
{ "order": { "id": "order-uuid-1", "rider_id": "rider-uuid-1" }, "delivery": { "id": "delivery-uuid-1", "status": "assigned" } }
```

**Error `409 ALREADY_ASSIGNED`:** Per AppFlow §10.3 concurrent-assignment edge case.
```json
{ "error": "ALREADY_ASSIGNED", "current_rider_id": "rider-uuid-2" }
```

**Error `400 INVALID_RIDER`:** `rider_id` does not refer to an active rider (`role='rider'`, `is_active=true`).

### 9.3 `GET /api/v1/admin/vendors`

**Query params:** `is_verified` (boolean filter)

**Response `200 OK`:**
```json
{
  "vendors": [
    {
      "id": "vendor-uuid-2",
      "business_name": "Sita Tea Stall",
      "category_name": "Cooked Food",
      "village_name": "Madhepur",
      "is_verified": false,
      "fssai_number": null,
      "created_at": "2026-06-10T12:00:00Z"
    }
  ]
}
```

### 9.4 `PATCH /api/v1/admin/vendors/{uuid}/verify`

**Request** (approve):
```json
{ "is_verified": true }
```

**Request** (reject):
```json
{ "is_verified": false, "rejection_reason": "Address could not be confirmed" }
```

**Response `200 OK`:** Returns updated vendor object. Triggers `vendor_approved`/`vendor_rejected` notification (AppFlow §9 table) and an `audit_log` entry.

### 9.5 `GET /api/v1/admin/metrics`

Powers a future operational dashboard summary — included in MVP contract since `Tracker.md`/ops review will want this early even if the admin UI surface is minimal initially.

**Response `200 OK`:**
```json
{
  "today": {
    "order_count": 47,
    "fulfillment_rate": 0.96,
    "on_time_delivery_rate": 0.91,
    "avg_delivery_minutes": 38,
    "active_vendors": 12,
    "active_riders": 3
  }
}
```
> Field definitions correspond directly to PRD §3 success metrics — this endpoint is the eventual source for automated `Tracker.md` updates, though MVP tracking remains manual per Execution Bible.

### 9.6 `GET /api/v1/admin/cash`

**Query params:** `date` (YYYY-MM-DD, default today)

**Response `200 OK`:**
```json
{
  "date": "2026-06-12",
  "riders": [
    {
      "rider_id": "rider-uuid-1",
      "rider_name": "Vikash Kumar",
      "cod_delivery_count": 6,
      "expected_cash": 96000,
      "actual_cash": null
    }
  ]
}
```

### 9.7 `POST /api/v1/admin/cash/reconcile`

**Request:**
```json
{ "date": "2026-06-12", "rider_id": "rider-uuid-1", "actual_cash": 96000 }
```

**Response `200 OK`:**
```json
{ "discrepancy": 0, "logged": true }
```

> Per AppFlow §8.3: this writes a structured `audit_log` entry (`action='cash.reconciled'`) in MVP, not a dedicated table — `discrepancy = expected_cash - actual_cash` is computed server-side and included in the audit log's `new_values`.

---

## 10. Standard Error Format

Every error response (4xx/5xx) follows this shape, elaborated further in `ErrorHandlingGuide.md`:

```json
{
  "error": "ERROR_CODE_CONSTANT",
  "message": "Human-readable English message (for logs/debugging)",
  "details": { }
}
```

`details` is endpoint-specific (e.g., `unavailable_items` in §5.1, `current_rider_id` in §9.2). Client-facing **Hindi** messages are NOT returned by the API — they are looked up client-side from `error` code via the catalog defined in `ErrorHandlingGuide.md`. This separation ensures: (a) API responses stay language-neutral for logging/debugging, (b) adding Maithili support later (Constitution III) requires no API changes, only a client-side string catalog addition.

---

## 11. Rate Limiting Headers

Every authenticated response includes:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1718185800
```

Limits per role (per Technical Constitution Part 6, restated here as binding contract):

| Role | Requests/min |
|---|---|
| Unauthenticated | 20 |
| Customer | 60 |
| Vendor | 120 |
| Rider | 240 |
| Admin | 600 |

---

## 12. Required Request Headers

| Header | Required | Purpose |
|---|---|---|
| `Authorization: Bearer {token}` | Yes (except §1.2, §1.3, §6.2) | Auth |
| `X-App-Version` | Yes | Enables `426 Upgrade Required` (AppFlow §10.1) |
| `X-Device-ID` | Yes | Fraud detection (SecurityRequirements.md forward ref) |
| `Idempotency-Key` | Required on `POST /orders` only (§5.1) | Prevents duplicate order creation |
| `X-Request-ID` | Optional (server generates if absent) | Distributed tracing; echoed in response |

---

*End of APIContract.md — v1.0 (MVP Endpoints)*
