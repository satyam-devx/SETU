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

- **`update_order_status`** (the one in `initial_schema.sql`, actively
  called from `src/lib/api.js`) has no check that the caller is the
  order's vendor/rider/customer or an admin — any authenticated user
  can advance any order's status, and a `delivered` transition credits
  *some other rider's* `today_earnings`/`cod_balance` if `p_meta.rider_id`
  is supplied. Needs a role-aware rewrite (vendor can confirm/prepare,
  rider can pick-up/deliver, admin can override) — that requires
  knowing the exact intended permission matrix per role, which should
  come from you, not be guessed.
- **`get_vendor_orders(p_vendor_id)`** — needs verifying whether it's
  `security definer` and whether it returns full order detail (customer
  name, payment info) for *any* vendor_id regardless of caller.
- Several other `security definer` functions weren't individually
  audited in this pass (e.g. anything in `database/functions_phase0_payments.sql`
  not ported: `cancel_order_with_refund`, `create_rider_payment_batch`,
  `confirm_rider_payment`). **Treat the entire legacy `database/` tree
  as unverified** until each function is either ported with a
  same-scrutiny pass like this one, or confirmed dead and dropped.
- **Dual migration trees**: `database/` vs `supabase/migrations/` is
  still not unified — only specific functions needed by this round of
  fixes were ported. Recommend picking ONE canonical tree and deleting
  the other, rather than continuing to port piecemeal.
- **Full distributed rate limiting / WAF**: the Postgres-backed
  `check_rate_limit()` added here is real but per-database, not
  per-edge — a sufaciently distributed attacker can still exceed it.
  GitHub Pages has no WAF/rate-limit layer in front of it; this needs
  an infra change (e.g. Cloudflare in front, or move off Pages).
- **Test suite still tests reimplemented logic, not the real code**
  (per the original audit) — none of the fixes above are exercised by
  the existing Vitest/Playwright suite. Worth a follow-up pass to wire
  real integration tests against a local Supabase instance.
- Everything in the original audit's P3–P5 roadmap (hosting/CDN/WAF
  migration off GitHub Pages, observability, bundle diet, partitioning,
  load testing, mock-data page replacement, migration-tree unification)
  is unchanged.

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
