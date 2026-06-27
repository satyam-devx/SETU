# SETU — Security Fixes Changelog (Round 2)

This documents every change made in response to the production-readiness
audit, plus several **new, more severe issues discovered while verifying
that the audit's fixes actually work against the real deployed schema**.

**Read this before deploying.** Some of the new findings (wallet theft,
free-money minting) are worse than anything in the original audit.

---

## How to deploy these fixes

1. **Database**: `supabase db push` (or your CI deploy pipeline) to apply
   migrations `014`, `015`, and `016`.
2. **Edge Functions**: redeploy all functions — `deploy.yml` now sets
   `--no-verify-jwt` **only** on `razorpay-webhook`.
3. **New secrets to set** (Supabase Dashboard → Edge Functions → Secrets):
   - `ALLOWED_ORIGINS` — your real frontend domain(s), comma-separated
   - `ALLOW_KYC_DEV_BYPASS` — leave unset in production
4. **New env var** (GitHub Secrets / Cloudflare Pages env):
   - `VITE_DEMO_MODE` — leave unset/`false` in production
5. Re-run the full QA suite — `qa.yml`/`qa/.github/workflows/qa.yml` and
   `qa/playwright.config.js` were updated to pass `VITE_DEMO_MODE=true`
   so existing e2e/a11y tests keep working under the new fail-closed
   behavior.

---

## Part 1 — Original audit fixes

### CRITICAL-1: Payment amount never reconciled with order total
- `create-razorpay-order`: for `order_payment`, the client-supplied
  `amount` is now **ignored**. The order's real `total` is loaded
  server-side and sent to Razorpay instead.
- `razorpay-webhook`: `payment.captured` now compares the captured
  amount against `orders.total` before confirming. A mismatch is logged
  to `audit_log` and the order is **not** confirmed — flagged for manual
  review instead of auto-releasing escrow.

### CRITICAL-2: Unauthenticated Edge Functions + blanket `--no-verify-jwt`
- New `supabase/functions/_shared/auth.ts` — `requireUser()`,
  `requireInternalOrAdmin()`, `isInternalServiceCall()`.
- Added to **every** function: `verify-aadhaar`, `kyc-verify`,
  `send-fcm-notification` (internal-or-admin), `ai-assistant`,
  `create-razorpay-order`, `vendor-payout` (already had it, now shares
  the helper).
- `deploy.yml`: `--no-verify-jwt` now applies **only** to
  `razorpay-webhook`. Also fixed a latent bug where the "deploy only
  changed functions" detection was computed but never actually used —
  the loop deployed everything every time regardless.

### CRITICAL-3: KYC dev-mode bypass triggered by client input
- `verify-aadhaar`: the bypass no longer triggers on a client-supplied
  `requestId.startsWith("dev_")`. It's now gated on a server-only
  secret, `ALLOW_KYC_DEV_BYPASS`, which must be explicitly set to
  `"true"` — and should never be set in a production project.

### CRITICAL-4: Sensitive profile columns were self-updatable
- Migration 014: `profiles_own_update` now also pins `is_verified`,
  `setu_score`, `aadhaar_verified` (migration 013 only pinned `role`).
  `village_id` can be set once (onboarding) then locks.

### CRITICAL-5: Silent demo-mode fallback in production
- `VITE_DEMO_MODE` is now a required explicit opt-in. If Supabase env
  is missing **and** this flag isn't `"true"`, `App.jsx` renders a
  configuration-error screen instead of auto-logging in as a fake
  demo customer. QA workflows were updated to set the flag so existing
  e2e/a11y tests are unaffected.

### H1 — Anchors could read KYC records platform-wide
- Migration 014: `kyc_records_anchor_read` now scopes to the anchor's
  own village via `get_my_village_id()`.

### H2 — Webhook signature compare + payout-reason operator-precedence bug
- `razorpay-webhook`: HMAC signature compared with a constant-time
  loop instead of `!==`. Fixed `payout.failure_reason ?? eventType ===
  "payout.reversed" ? ... : ...` — due to `??` binding looser than the
  ternary, any truthy `failure_reason` was silently replaced with the
  literal string `"reversed"`.

### H3 — Webhook marked events processed even when the handler failed
- `razorpay-webhook`: `processed_at` is now only set after the handler
  completes without throwing. On failure, the function returns 500 so
  Razorpay retries instead of the event being silently dropped.

### H4 — No rate limiting
- Migration 014: lightweight Postgres-backed `check_rate_limit()` +
  hourly pruning via `pg_cron`. Wired into `create-razorpay-order`,
  `verify-aadhaar`, `kyc-verify`, `ai-assistant`, `vendor-payout`.
  (OTP already had a 60s client-side cooldown — untouched.)
  **Not a substitute for WAF/edge-level rate limiting** — see "Not
  fixed" below.

### H5 — `Access-Control-Allow-Origin: *` on every function
- New `supabase/functions/_shared/cors.ts` — reflects only an
  allow-listed origin (`ALLOWED_ORIGINS` secret), applied to all 7
  functions.

### AI assistant — was a hardcoded stub
- `ai-assistant` now calls the real Anthropic Messages API
  (`claude-haiku-4-5`) with a SETU-specific system prompt, behind auth
  + rate limiting.

---

## Part 2 — New findings (not in the original audit)

Found while checking whether the CRITICAL-1 fix would actually work
against the real deployed database. **These are arguably more severe
than the original CRITICAL findings** because they require zero
amount-mismatch trickery — just a direct RPC call.

### CRITICAL-NEW (deploy-blocking): payment RPCs didn't exist in the deployed schema
`record_delivery_split`, `confirm_vendor_payout`, `initiate_vendor_payout`,
and `compute_fee_split` were called by the webhook/vendor-payout
functions but only ever existed in the legacy `database/` tree, which
the CI pipeline does **not** push (only `supabase/migrations/` is
deployed). On a fresh deploy, every `payment.captured` event would have
failed at the RPC call — vendor escrow would never be credited.
**Fixed**: migration 015 ports these four functions into the canonical
tree, with explicit `revoke ... from authenticated, anon` (service_role
only — the original legacy versions had no such restriction).

### CRITICAL-NEW-1: `pay_from_wallet` had no ownership check
Took `p_user_id` as a plain parameter with **no check that the caller
is that user**. Any logged-in customer could call
`supabase.rpc('pay_from_wallet', { p_user_id: '<victim-uuid>', p_amount: 99999 })`
directly and drain another user's wallet completely. **Fixed** in
migration 016: the function now requires `auth.uid() = p_user_id`
(service_role/backend calls, where `auth.uid()` is null, remain
unrestricted).

### CRITICAL-NEW-2: `topup_wallet` had zero caller restriction
Confirmed it has no legitimate frontend caller (only the webhook should
call it). Postgres grants `EXECUTE` to `PUBLIC` by default, and nothing
revoked it — any authenticated user could call
`supabase.rpc('topup_wallet', { p_user_id: auth.uid(), p_amount: 999999 })`
and mint themselves unlimited wallet balance for free. **Fixed**:
revoked from `authenticated`/`anon`.

### CRITICAL-NEW-3: `upsert_platform_config` / `_bulk` had no admin check
These are `security definer` functions, which **bypass RLS** on the
tables they touch — so the existing `config_admin_write` RLS policy on
`platform_config` never actually protected anything. Any authenticated
user could rewrite platform-wide settings. **Fixed**: added the same
`is_admin()` check `admin_update_order_status` already had.

### CRITICAL-NEW-4: `place_order` — unused but dangerous dead code
Confirmed (via grep) that nothing in `src/` calls this RPC — the real
checkout path does a direct table insert with `payment_status: 'pending'`
always, which is correct. But the RPC itself auto-marks any non-COD
order as `payment_status = 'paid'` immediately, with **no payment
captured at all**, and takes `p_customer_id` with no ownership check.
**Fixed**: revoked from `authenticated`/`anon` rather than risk a
partial fix on code nothing exercises — if you do want to use it,
it needs a full rewrite first.

### CRITICAL-NEW-5: `review_image` had no admin check
Any authenticated user could approve/reject any pending image
moderation entry. **Fixed**: added `is_admin()` check.

### CRITICAL-NEW-6: `set_default_address` had no ownership check
Any authenticated user could change another user's default address.
Low impact, but real. **Fixed**: added `auth.uid() = p_user_id` check.

---

## Part 3 — Flagged, NOT fixed (needs careful follow-up)

These were found during the same sweep but were **not** changed,
because a quick fix risks breaking real, currently-working multi-role
flows without proper testing against the actual UI:

- **`update_order_status`** — ✅ **RESOLVED in migration 017 (CRITICAL-B),
  refined in 019.** This flag was written when migrations only went up to
  `016`; `017` landed immediately after and rewrote the function to derive the
  caller from `auth.uid()`, enforce a per-role transition matrix
  (vendor: confirm/prepare/ready/cancel · rider: pick-up/on-the-way/deliver ·
  customer: cancel · admin: any), validate the state machine, and honour
  `p_meta.rider_id/rider_name` **only** for admin/backend callers — so a rider
  can no longer credit a different rider's earnings, and `delivered` credits
  the order's already-assigned rider. Proven end-to-end by
  `qa/sql/phase1_money_integrity_test.sql` TEST B (B1 outsider rejected,
  B2/B2b no cross-rider credit, B3/B3c assigned-rider delivery + correct
  crediting).
- **`get_vendor_orders(p_vendor_id)`** — ✅ **RESOLVED in migration 049.** It
  was `SECURITY DEFINER`, `language sql`, with no caller check and no
  `set search_path` — any authenticated user could read any vendor's full
  order book (customer names, payment info, line items) by passing an
  arbitrary `p_vendor_id`. Nothing in `src/` calls it (the vendor portal uses
  a direct, RLS-governed `from('orders')` query), so it was dead-but-dangerous
  code. Rewritten with an owner-or-admin guard (backend/`service_role`
  unrestricted) and `set search_path = public`. Proven by
  `qa/sql/phase1_money_integrity_test.sql` TEST F (F1 outsider denied, F2 owner
  reads own orders).
- **Legacy `database/` tree** — ✅ **RESOLVED.** The three functions this flag
  named (`cancel_order_with_refund`, `create_rider_payment_batch`,
  `confirm_rider_payment`) were ported with a same-scrutiny pass in migrations
  017 and 018, along with `credit_wallet`, `record_delivery_split`,
  `compute_fee_split`, `initiate_vendor_payout`, `confirm_vendor_payout` (015)
  — each with explicit `revoke execute … from authenticated, anon` (money
  movement is service_role-only). Migration 018's note records that the legacy
  tree then "carries nothing the deployed schema lacks." The directory itself
  no longer exists in the repo.
- **Dual migration trees** — ✅ **RESOLVED (Phase-2 unification).**
  `supabase/migrations/` is now the single canonical, CI-deployed tree; the
  legacy `database/` tree was removed (see `scripts/validate_migrations.py`,
  `qa/scripts/run-security-suite.js`, and the nightly workflow, which now
  *assembles* `database/rls.sql` at runtime from `supabase/migrations/*.sql`
  purely as an audit snapshot — it is an output artifact, not a source tree).
- **Full distributed rate limiting / WAF**: the Postgres-backed
  `check_rate_limit()` added here is real but per-database, not
  per-edge — a sufaciently distributed attacker can still exceed it.
  GitHub Pages has no WAF/rate-limit layer in front of it; this needs
  an infra change (e.g. Cloudflare in front, or move off Pages).
- **Test suite — partially addressed.** Two complementary layers now exercise
  the *real* implementation: (1) executable SQL proofs run the actual RPCs/RLS
  against a real Postgres in CI (`qa/sql/phase1_money_integrity_test.sql`
  TEST A–G, `seva_credit_test.sql` T1–T18); (2) `qa/tests/unit/api-rpc-contracts.test.js`
  imports the real `src/lib/api.js` and asserts the frontend↔RPC contract
  (claim_order / admin_assign_rider / rate_order / request_credit /
  accept_seva_job / get_revenue_analytics / get_admin_dashboard_live /
  get_today_hourly_orders) with the supabase client mocked. Remaining gap:
  broader component/e2e coverage of the de-mocked Seva and admin screens
  (Playwright) — still mostly mock-based.
- Remaining items from the original audit's P3–P5 roadmap (hosting/CDN/WAF
  migration off GitHub Pages, observability, bundle diet, partitioning, load
  testing) are tracked separately. Note: **migration-tree unification is done**
  (above), and **mock-data replacement** has since been carried out across the
  Seva portal and admin analytics (see Part 4 and the Round-3 frontend work).

---

## Part 4 — Round 3 (full-project audit follow-up: migrations 035–048)

A later full-project audit pass hardened the RPC surface generically and
de-mocked / de-downloaded several admin and Seva paths. Each change ships
as a new timestamped migration (the remote DB already has 001–034 applied,
so in-place edits would not reach it) and is covered by an executable proof
in `qa/sql/seva_credit_test.sql`, wired into the CI `db-integrity-tests` job.

- **035 — RPC `EXECUTE` lockdown.** Revoked `EXECUTE` from `PUBLIC` on the
  money/escrow/internal RPCs (generalising the case-by-case revokes in
  Part 2). Self-guarding admin RPCs (`ban_user`, `unban_user`, `assign_role`)
  keep their `authenticated` grant — they enforce `has_permission()`
  internally (migration 025 grants them deliberately).
- **036 — `audit_log.target_type`** column added (referenced by admin ops
  that record immutable audit entries; was missing on the deployed schema).
- **037 — escrow over-debit guard.** Replaced a dead post-check (unreachable
  behind a CHECK constraint) with a real pre-check so an over-debit is
  rejected with a clear error instead of a constraint violation.
- **038 — `list_blocked_ips`** now returns `host(ip)` (bare address) so the
  admin Security screen renders the IP without the CIDR suffix.
- **039 — explicit table read grants** to `anon`/`authenticated` (CI strict
  grant checks; RLS still governs row visibility).
- **041 — Seva job lifecycle RPCs** (`accept_seva_job`, `complete_seva_job`)
  + `seva_providers_own_read` policy. The Seva portal was UI-only; accept /
  complete now move state server-side with provider-ownership checks.
- **042 — `request_credit` RPC.** Replaced an insecure client-side
  `applyCredit` that moved credit balances from the browser. Requests now
  create a *pending* application server-side (no money moves), bounded by the
  user's available credit, one pending request at a time.
- **043 — `review_credit_request` RPC.** Finance-gated
  (`finance.manage`) approval/disbursement; disbursing increases
  `outstanding` and records an immutable `credit_transactions` row.
- **044 / 046 / 047 / 048 — admin read aggregates.** `get_admin_village_stats`,
  `get_admin_dashboard_live`, `get_revenue_analytics`, `get_today_hourly_orders`
  — `SECURITY DEFINER`, `is_admin()`-gated server-side aggregates that replaced
  full-table downloads (orders/vendors/riders/tickets/deposits) to the browser.
  Performance fix with a security benefit: no cross-user raw rows leave the DB.
- **045 — Storage bucket policies.** `kyc-documents` made private with
  owner/role read policies (was relying on bucket defaults).
- **049 — `get_vendor_orders` IDOR fix.** See "Updates to Part 3 flags" below.
- **050 — order write-path lockdown.** The `orders` table had three
  column-unrestricted client UPDATE policies (rider/vendor/customer). RLS gates
  rows, not columns, so a qualifying client could `.update()` any column and
  bypass the role-aware state machine in `update_order_status` — worst case, an
  assigned rider directly setting `status='delivered'` to skip the `cod_balance`
  debit (COD cash theft). The same rider policy also couldn't match
  `rider_id IS NULL`, so the rider "accept order" flow was silently broken by
  RLS. Fixed: added `claim_order` (rider self-claim, row-locked, derives the
  rider from `auth.uid()`) and `admin_assign_rider` (admin) RPCs, hardened the
  existing `rate_order` with `set search_path`, repointed `assignRider` /
  `adminAssignRider` / `rateOrder` in `api.js` to these RPCs, and **dropped**
  `orders_rider_update` / `orders_vendor_update` / `orders_customer_cancel`.
  All order writes now flow through SECURITY DEFINER RPCs. Proven by
  `qa/sql/phase1_money_integrity_test.sql` TEST G (G1 rider claim, G2 double-claim
  rejected, G3 direct rider UPDATE blocked).

### Updates to Part 3 flags
- The **`request_credit`** path closes the client-side credit-application
  concern: balances are no longer mutable from the browser.
- **`update_order_status`** is confirmed **already resolved** (migration 017,
  refined 019; proven by `phase1_money_integrity_test.sql` TEST B) — the Part 3
  flag predated migration 017 and has been corrected above.
- `get_vendor_orders` is closed in migration 049 (owner-or-admin guard +
  `set search_path`; proof TEST F). The legacy `database/` tree and WAF/edge
  rate-limiting **remain as flagged in Part 3** — not addressed in this round.

---

## Honest bottom line

This round closes every CRITICAL + High finding from the original audit,
**plus six more critical RPC-permission bugs that the original audit
didn't catch** (and that were arguably more exploitable — no fraud
trickery needed, just a direct `supabase.rpc()` call with someone else's
UUID). That's a meaningfully different platform than before.

It is **not** "100/100 production ready." A score like that implies a
level of verification (live integration testing against a real
Supabase project, a security re-audit, load testing, real infra
migration) that no one — human or AI — can responsibly claim from a
static code review in one sitting. Treat this as: the launch-blocking
holes are closed and the most severe newly-discovered ones are too;
what's flagged above in Part 3 is real remaining work, not theoretical
hardening.
