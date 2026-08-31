# SETU — SecurityRequirements.md

**Document Class:** Security · Frozen, Versioned (changes require formal review)
**Owner:** Principal Security Engineer / CTO
**Audience:** All engineers, QA, AI coding assistants, auditors
**Status:** v1.0 — MVP Security Baseline
**Depends On:** Schema.md, APIContract.md, SystemArchitecture.md

---

## 0. How to Use This Document

This document translates the security architecture from Technical Constitution Part 7 into enforceable, checkable requirements. Every section produces either a PR checklist item, a CI gate, or an audit test that QA can run against `TestingRequirements.md`.

**Enforcement model:** Security requirements are not guidelines. A PR that introduces a violation is blocked regardless of feature urgency. The PR checklist in `TechSpec.md §8` cross-references this document — every engineer must run the self-verification checklist in Section 9 before marking a PR ready for review.

**Scope note:** This document covers startup-stage implementation (Phase 1 architecture per `SystemArchitecture.md`). Enterprise-stage additions (WAF, SIEM, SOC2) are noted where relevant but are not Phase 1 requirements.

---

## 1. Threat Model

SETU's specific threat surface, ordered by likelihood and impact:

| Threat | Likelihood | Impact | Category |
|---|---|---|---|
| COD fraud (fake orders, refusal rings) | High | Medium | Rural-specific |
| Rider-customer delivery collusion | Medium | Medium | Rural-specific |
| Payment webhook replay / signature bypass | Low | Critical | Financial |
| Cross-tenant data exposure (vendor seeing another vendor's orders) | Low | High | Authorization |
| Secret/credential committed to Git | Medium | Critical | Dev ops |
| JWT theft enabling account takeover | Low | High | Authentication |
| Admin account takeover | Low | Critical | Authentication |
| PII data breach (phone numbers, addresses) | Low | High | Data protection |
| OTP brute-force / enumeration | Medium | Medium | Authentication |
| Ghost vendor (listing without real stock) | High | Low | Operational fraud |
| Review manipulation | Medium | Low | Platform integrity |
| Dependency supply-chain attack | Low | High | Dev ops |

Threats marked **Critical** or **High** have explicit mitigations in this document. Medium threats are addressed at the application/operational layer.

---

## 2. Authentication Security

### 2.1 OTP Security

**Requirements:**

- [ ] OTP must be exactly 6 digits, cryptographically random (not `Math.random()`)
- [ ] OTP expiry: 10 minutes from generation (matches `APIContract.md §1.3`)
- [ ] OTP is hashed before storage — never stored in plaintext in any table or log
- [ ] Maximum 5 OTP verification attempts per phone number per 10-minute window; after 5 failures, the OTP is invalidated and must be re-requested
- [ ] OTP send rate limit: 3 sends per phone number per hour — prevents SMS flooding abuse
- [ ] OTP delivery exclusively via Supabase Auth (Twilio backend) — never via email or WhatsApp (reduces interception surface)
- [ ] Phone number stored in E.164 format (`+91XXXXXXXXXX`) — validated server-side before OTP dispatch; client-side validation is UX only, not a security control

**Verification:**
```sql
-- Audit: verify no plaintext OTPs in logs or tables
-- There should be no 'otp' column with a 6-digit pattern in any table
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name ILIKE '%otp%';
-- Expected: zero rows (OTPs are transient, handled by Supabase Auth internals)
```

### 2.2 JWT Security

**Requirements:**

- [ ] Access token lifetime: 1 hour maximum
- [ ] Refresh token lifetime: 30 days with **rotation on every use** — a refresh token used once is immediately invalidated and replaced with a new one; a second use of the same token is a signal of token theft and must invalidate the entire session family
- [ ] Tokens stored in Flutter `flutter_secure_storage` (Android Keystore-backed) — never in `SharedPreferences`, never in plain `localStorage`
- [ ] Token refresh is silent — users are never asked to log in again mid-session unless the refresh token itself has expired or been revoked
- [ ] JWT claims include `role` and implicitly the user's `block_id` (derivable from `users.village_id → villages.block_id`) — RLS policies use these claims directly; no client-supplied role override is accepted
- [ ] Supabase's `auth.uid()` function is the only trusted source of user identity in RLS policies and Edge Functions — `body.user_id` or any client-supplied identifier is treated as untrusted and discarded

**Violation pattern to detect in code review:**
```typescript
// PROHIBITED — trusting client-supplied identity
const { userId } = await req.json()
const orders = await supabase.from('orders').select().eq('customer_id', userId)

// REQUIRED — extracting identity from verified JWT
const { data: { user } } = await supabase.auth.getUser(jwtFromHeader)
const orders = await supabase.from('orders').select().eq('customer_id', user.id)
```

### 2.3 Admin Authentication

**Requirements:**

- [ ] All `admin` and `super_admin` role accounts require TOTP (Time-based One-Time Password) as a second factor — configured via Supabase Auth MFA
- [ ] Admin sessions have a maximum lifetime of 8 hours regardless of activity — re-authentication required after this window
- [ ] Admin login attempts are logged to `audit_log` with `action='admin.login_attempt'`, including IP address and success/failure status
- [ ] Failed admin login (wrong OTP or failed TOTP): 3 consecutive failures locks the account for 30 minutes; the Super Admin is notified via WhatsApp
- [ ] No shared admin accounts — each admin has their own phone-based login tied to their assigned `block_id`

---

## 3. Authorization — Row-Level Security Policies

This section specifies the exact RLS policies for every table. These policies are implemented as SQL in a migration file (`supabase/migrations/0002_rls_policies.sql`) and are **the primary authorization enforcement mechanism** — application-layer checks are defense-in-depth, not the primary control.

**General pattern:** All tables have RLS enabled (`ENABLE ROW LEVEL SECURITY`). Default is deny-all (`USING (false)`) unless an explicit ALLOW policy matches.

### 3.1 `users` Table

```sql
-- Own row read
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Own row update (limited fields — name, language_pref, village_id only)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin read (block-scoped via village)
CREATE POLICY "users_read_admin" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users admin_user
      JOIN villages v ON v.id = users.village_id
      JOIN villages admin_v ON admin_v.id = admin_user.village_id
      WHERE admin_user.id = auth.uid()
        AND admin_user.role IN ('admin', 'super_admin')
        AND (admin_user.role = 'super_admin' OR v.block_id = admin_v.block_id)
    )
  );

-- Insert: only Supabase Auth trigger creates user rows (no direct INSERT policy needed)
```

### 3.2 `vendors` Table

```sql
-- Customers: read verified vendors in their block only
CREATE POLICY "vendors_read_customer" ON vendors
  FOR SELECT USING (
    is_verified = true
    AND EXISTS (
      SELECT 1 FROM villages v1
      JOIN villages v2 ON v1.block_id = v2.block_id
      WHERE v1.id = vendors.village_id
        AND v2.id = (SELECT village_id FROM users WHERE id = auth.uid())
    )
  );

-- Vendor: read/update own vendor row
CREATE POLICY "vendors_read_own" ON vendors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vendors_update_own" ON vendors
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: read/update all vendors in their block
CREATE POLICY "vendors_admin" ON vendors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN villages vendor_v ON vendor_v.id = vendors.village_id
      JOIN villages user_v ON user_v.id = u.village_id
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND (u.role = 'super_admin' OR vendor_v.block_id = user_v.block_id)
    )
  );
```

### 3.3 `orders` Table

```sql
-- Customer: read/create own orders
CREATE POLICY "orders_read_own_customer" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Note: INSERT is via Edge Function (OrderService) using service role key,
-- not via direct client insert — no customer INSERT policy needed;
-- the Edge Function enforces all business rules before inserting.

-- Vendor: read orders for their vendor; update status only
CREATE POLICY "orders_read_vendor" ON orders
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "orders_update_vendor" ON orders
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  )
  WITH CHECK (
    -- Vendor may only update: status (confirmed/cancelled) and cancel_reason
    -- Schema-level: no constraint prevents other field updates, but
    -- Edge Function (VendorService) validates this before calling UPDATE
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

-- Rider: read/update own assigned orders
CREATE POLICY "orders_read_rider" ON orders
  FOR SELECT USING (rider_id = auth.uid());

CREATE POLICY "orders_update_rider" ON orders
  FOR UPDATE USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

-- Admin: all orders in their block
CREATE POLICY "orders_admin" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN villages user_v ON user_v.id = u.village_id
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND (u.role = 'super_admin' OR orders.block_id = user_v.block_id)
    )
  );
```

### 3.4 `transactions` Table

```sql
-- Customer: read own transactions
CREATE POLICY "transactions_read_own" ON transactions
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: PaymentService (service role) only — no direct client insert
-- Admin: read all in their block (via order join)
CREATE POLICY "transactions_read_admin" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN orders o ON o.id = transactions.order_id
      JOIN villages v ON v.id = (SELECT village_id FROM users cu WHERE cu.id = o.customer_id)
      JOIN villages uv ON uv.id = u.village_id
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND (u.role = 'super_admin' OR v.block_id = uv.block_id)
    )
  );
```

### 3.5 `deliveries` Table

```sql
-- Rider: read/update own deliveries
CREATE POLICY "deliveries_rider" ON deliveries
  FOR ALL USING (rider_id = auth.uid());

-- Customer: read delivery for their orders (for tracking)
CREATE POLICY "deliveries_read_customer" ON deliveries
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Vendor: read delivery for their orders
CREATE POLICY "deliveries_read_vendor" ON deliveries
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );

-- Admin: all in their block
CREATE POLICY "deliveries_admin" ON deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN orders o ON o.id = deliveries.order_id
      JOIN villages v ON v.id = (SELECT village_id FROM users cu WHERE cu.id = o.customer_id)
      JOIN villages uv ON uv.id = u.village_id
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND (u.role = 'super_admin' OR v.block_id = uv.block_id)
    )
  );
```

### 3.6 `audit_log` Table

```sql
-- INSERT: all authenticated users can write (append-only)
-- SELECT: admin and super_admin only
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_log_read_admin" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
-- No UPDATE or DELETE policies — audit_log is immutable
```

### 3.7 Reference Tables (`categories`, `villages`, `blocks`, `districts`)

```sql
-- All authenticated users: read-only on active records
CREATE POLICY "reference_read" ON categories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "reference_read" ON villages
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admin-only write
CREATE POLICY "reference_write_admin" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );
-- (Repeat pattern for blocks, districts)
```

---

## 4. Payment Security

### 4.1 Razorpay Webhook Verification

**This is the most critical single security control in SETU's payment system.**

- [ ] Every incoming request to `POST /api/v1/payments/webhook` must verify the `X-Razorpay-Signature` header before processing any payload
- [ ] Verification algorithm: HMAC-SHA256 of the raw request body using `RAZORPAY_WEBHOOK_SECRET` (from `EnvironmentVariables.md`) — if the computed HMAC does not match the header value, return `200 OK` with `{ "received": true }` but **do not process** (returning non-200 causes Razorpay to retry, which is acceptable behavior; processing an unverified webhook is not)
- [ ] The webhook handler must use the **raw request body** for HMAC computation — parsing the JSON first and re-serializing introduces byte-order and whitespace differences that break verification
- [ ] Webhook events are idempotent: `gateway_txn_id` UNIQUE constraint in the `transactions` table (Schema.md §6.1) prevents duplicate processing at the database level; webhook handler must tolerate a UNIQUE violation without erroring

```typescript
// REQUIRED implementation pattern
export async function handlePaymentWebhook(req: Request): Promise<Response> {
  const rawBody = await req.text()  // raw body BEFORE JSON parsing
  const signature = req.headers.get('X-Razorpay-Signature')
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

  const expectedSignature = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  if (expectedSignature !== signature) {
    // Log the failed verification attempt to audit_log
    await logAuditEvent({ action: 'payment.webhook_signature_failed', ... })
    // Return 200 to prevent Razorpay retry storm on a persistent bad-actor
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const payload = JSON.parse(rawBody)
  // ... process verified payload
}
```

### 4.2 Payment Integrity

- [ ] Order total displayed to customer in checkout (APIContract §5.1 response) must match the amount sent to Razorpay — server calculates `razorpay.amount` from the database, never from a client-supplied value
- [ ] On `POST /api/v1/payments/verify` (APIContract §6.1): the `razorpay_order_id` from the client must be matched against the `transactions` row created during order creation — a client cannot submit a different Razorpay order ID to get a different order marked as paid
- [ ] All payouts to vendors/riders are to KYC-verified bank accounts only (MVP: manual payout via admin; the security requirement exists now so the field is enforced before automated payouts are built)
- [ ] Vendor payout is held 48 hours post-delivery confirmation — provides a fraud reversal window for COD disputes

---

## 5. Fraud Detection Requirements

Six rural-specific fraud patterns (Technical Constitution Part 7) translated into detectable signals:

### 5.1 COD Refusal Ring

**Detection:** Customer's `cod_collected = false` (delivery marked as refused/undeliverable) on 3 or more orders within any 30-day window.

**Response:**
- [ ] Automated: After the 3rd refusal within 30 days, `users.is_active` is NOT automatically set to false (to avoid false positives from legitimate "not home" scenarios) — instead, a structured `audit_log` entry is created with `action='fraud.cod_refusal_pattern'` and a flag in the user's record for admin review
- [ ] Admin action: Admin reviews the pattern and can disable COD payment method for that user (a new `users.cod_disabled` boolean column — not in Schema v1.0, flagged here for `Schema.md` next revision) or deactivate the account
- [ ] Edge Function requirement: `RiderService` delivery endpoint must increment a counter (queryable from `orders` table — no separate counter needed) before confirming delivery failed

### 5.2 Ghost Vendor

**Detection:** Vendor's order rejection rate (`status='cancelled'`, `cancel_reason='out_of_stock'`) exceeds 30% of accepted orders over any 7-day window.

**Response:**
- [ ] Automated `audit_log` entry: `action='fraud.ghost_vendor_pattern'`
- [ ] Admin notification via WhatsApp: "Vendor X has rejected N orders this week for out-of-stock reasons"
- [ ] Admin may require the vendor to complete a stock verification step before new orders are displayed to customers

### 5.3 Rider-Customer Collusion (False Delivery Claims)

**Detection:** Order `status='delivered'` but `delivery_photo_url IS NULL` — or photo was uploaded after a suspicious delay (>30 minutes post-delivery timestamp).

**Requirement:**
- [ ] `POST /api/v1/rider/orders/{uuid}/deliver` endpoint must reject requests with no `photo` field — this is enforced at the API layer, not just policy (APIContract §8.3 specifies `photo` as required)
- [ ] Photo upload creates a Supabase Storage object in a `delivery-proofs/` bucket with `{order_id}/{timestamp}.jpg` naming — not in a user-writable path that could be pre-uploaded
- [ ] If a customer disputes delivery on an order with `delivery_photo_url` set, the dispute is flagged for admin manual review (not auto-resolved either way)

### 5.4 Referral Fraud (Multiple Accounts)

**Detection:** Same device (`X-Device-ID` header) creating multiple `users` accounts with different phone numbers.

**Requirement:**
- [ ] `X-Device-ID` is stored server-side on user creation (a `users.device_id` column — also not in Schema v1.0, flagged for Schema.md next revision)
- [ ] On new user creation: if `device_id` already exists on another `users` row, an `audit_log` entry is created with `action='fraud.duplicate_device'` for admin review — account creation is NOT blocked automatically (legitimate household device-sharing is common in rural Bihar; automatic blocking would generate too many false positives)

### 5.5 Review Manipulation

**Detection:** Multiple reviews submitted from the same IP address for the same vendor within a short window.

**Requirement:**
- [ ] `reviews` table has a `UNIQUE(order_id)` constraint (Schema.md §8.1) — one review per order, period; a customer cannot submit two reviews for the same order
- [ ] Review submission IP logged to `audit_log` — queryable for pattern analysis
- [ ] Bulk review detection is a Phase 2+ automated concern; MVP relies on the per-order uniqueness constraint as the primary control

### 5.6 Vendor Pricing Manipulation

**Requirement:**
- [ ] Product prices are snapshotted at order creation into `order_items.unit_price` (Schema.md §5.2) — a vendor changing a price after an order is placed has no effect on that order's economics
- [ ] Vendor cannot set a product price of 0 paise — minimum price validation: `price >= 100` (₹1 minimum) enforced in `VendorService`

---

## 6. Data Protection Requirements

### 6.1 PII Handling

PII fields in SETU's database: `users.phone`, `user_addresses.line1`, `user_addresses.landmark`, `users.name`.

**Requirements:**
- [ ] `users.phone` is stored in plaintext (required for Supabase Auth to function — Auth uses phone as the primary lookup key); all other PII is treated as sensitive
- [ ] Phone numbers are never included in log output — log lines reference `user_id` (UUID) only
- [ ] `user_addresses` records are never returned in API responses beyond the customer's own requests — no endpoint exposes another user's address (RLS enforces this; API design double-enforces it)
- [ ] Vendor receives only `delivery_village` and `delivery_landmark` (APIContract §7.2) — not the full `user_addresses` record, and never the customer's phone number

### 6.2 DPDP Act 2023 Compliance

India's Digital Personal Data Protection Act 2023 requirements for MVP:

- [ ] **Consent on signup:** First-launch onboarding includes a consent screen (before OTP is sent) with: "SETU आपका फोन नंबर और पता जानकारी ऑर्डर डिलीवरी के लिए उपयोग करेगा।" — User must tap "सहमत हूं" (I agree) before proceeding. `users.created_at` acts as the consent timestamp in MVP (a dedicated `consent_records` table is a V1+ addition).
- [ ] **Right to erasure:** Admin can deactivate a user account (`is_active = false`) and manually null-out PII fields on written request — an automated deletion flow is a V1+ feature, but the policy must exist now
- [ ] **Data minimisation:** SETU collects only what is needed for the stated purpose (delivery). Behavioral analytics (PostHog) is configured with IP anonymization enabled.
- [ ] **No sharing with third parties:** Phone numbers, addresses, and purchase history are never sold or shared with advertisers or data brokers — referenced in `Constitution.md §1` and enforced by configuration (Supabase's data export controls, PostHog's self-hosted option for Phase 3+)

### 6.3 Encryption

- [ ] **In transit:** TLS 1.2 minimum on all endpoints (enforced by Cloudflare and Supabase — no plain HTTP permitted; all `http://` URLs in app config are a build-time error)
- [ ] **At rest:** Supabase Cloud encrypts all data at rest (AES-256) by default — no additional application-layer encryption required for Phase 1
- [ ] **Backups:** Supabase automated backups are encrypted; backup download access is restricted to the Supabase project owner (founder/CTO email only)
- [ ] **Secrets:** Never in source code, never in `.env` files committed to Git — see `EnvironmentVariables.md`

---

## 7. Secrets Management Policy

This section defines how secrets are handled. Full secret values are in `EnvironmentVariables.md` — this section defines the **policy** for managing them.

- [ ] **No secrets in Git, ever.** The CI pipeline runs `trufflehog` on every PR to detect accidentally committed secrets (TechSpec.md §8 CI gate). A PR with any detected secret is blocked and the secret must be rotated before the PR can merge.
- [ ] **`.env.local` is gitignored** — enforced in `.gitignore`. The `.env.example` file in the repository contains only placeholder values, never real secrets.
- [ ] **Rotation schedule:** All secrets are rotated at least annually. Razorpay and Twilio credentials are rotated on any suspected compromise. The rotation procedure is: (1) generate new credential in provider dashboard, (2) update GitHub Secrets and Supabase environment variables, (3) deploy, (4) verify, (5) revoke old credential.
- [ ] **Supabase service role key:** Used only in Edge Functions server-side. Never exposed to Flutter apps. Flutter apps use the `anon` key only (which is safe to expose — RLS and JWT validation are the security controls, not key secrecy).
- [ ] **Access control:** GitHub Secrets are accessible only to GitHub Actions workflows and users with `admin` role on the repository. Individual developer machines should never have production secrets — only development equivalents.

---

## 8. Dependency Security

- [ ] `flutter pub audit` runs in CI on every PR — any package with a known CVE blocks the PR
- [ ] `npm audit` runs on the admin dashboard in CI — same policy
- [ ] Supabase Edge Function dependencies are pinned via `import_map.json` — floating imports (`esm.sh/package@latest`) are prohibited
- [ ] New package additions require the review in `TechSpec.md §7` — security review is part of this (any package that requires unusual permissions is flagged)
- [ ] GitHub Dependabot is enabled for security updates — automated PRs for security-only updates are fast-tracked (do not require full review cycle, just CI passing)

---

## 9. Security Self-Verification Checklist for PRs

Every engineer and AI coding assistant must run this checklist before marking a PR ready for review. This is the operational form of the security requirements above.

**Authentication & Authorization:**
- [ ] Does any new code accept `user_id` or `role` from the request body? → **Remove it. Use JWT claims only.**
- [ ] Does any new code query a table without RLS being the primary access control? → **Review RLS policy coverage.**
- [ ] Does any new Edge Function skip JWT verification? → **Add verification before any logic.**

**Data & Payments:**
- [ ] Does any new code log a phone number, OTP, or payment credential? → **Remove it. Log user_id (UUID) only.**
- [ ] Does any new monetary calculation use floating-point division? → **Replace with integer paise arithmetic.**
- [ ] Does the payment webhook handler verify the Razorpay signature before processing? → **Verify Section 4.1 pattern is followed.**

**Secrets & Configuration:**
- [ ] Are any secrets hardcoded in the PR? → **Move to EnvironmentVariables.md pattern immediately.**
- [ ] Does any new endpoint bypass rate limiting? → **All endpoints must have a rate limit tier per APIContract §11.**

**Schema & Migrations:**
- [ ] Does any new migration create a table without `ENABLE ROW LEVEL SECURITY`? → **Add it before the PR merges.**
- [ ] Does any new migration add a monetary column as `numeric` or `float`? → **Change to `integer` (paise). ADR-002.**

**Fraud:**
- [ ] Does any new order-creation flow skip idempotency key handling? → **Verify Idempotency-Key header is checked.**
- [ ] Does the delivery confirmation flow allow photo-less submission? → **Photo is mandatory (Section 5.3).**

---

## 10. Security Incident Response

**Severity levels and response times per Technical Constitution Part 8:**

| Severity | Example | Response Time | Owner |
|---|---|---|---|
| P0 | Payment data breach, secret exposed | 30 minutes | CTO + Founder |
| P1 | Cross-tenant data visible to wrong user | 2 hours | CTO |
| P2 | Fraud pattern detected but no financial impact | Next business day | Security lead |
| P3 | Audit log gap, non-critical finding | Scheduled sprint | Engineer |

**P0 Response Protocol:**
1. Immediately rotate any exposed secrets (Section 7 rotation procedure)
2. If user data was accessed: identify affected users from `audit_log`
3. Supabase project: enable maintenance mode (disable anon key if needed)
4. Notify affected users within 72 hours (DPDP Act requirement)
5. Post-mortem within 48 hours (Technical Constitution Part 8 requirement)

---

*End of SecurityRequirements.md — v1.0*
