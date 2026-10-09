# SETU — Production Audit Report (static pass, October 2026)

**Certification: 🔴 NOT PRODUCTION READY (provisional)**

This is a *static* audit of the `SETU-main` snapshot. The audit sandbox had no network, no
Postgres, and no `node_modules`, so **nothing below was executed against a database, a browser or
a cluster.** Every "fixed" item means "code changed and statically checked", not "verified live".
Items I could not verify are marked **NOT VERIFIED**. No numeric readiness scores are given: most
areas were not inspected deeply enough to score honestly.

## 1. What was and was not checked

| Check | Result |
|---|---|
| `scripts/validate_migrations.py`, `lint_sql.py`, `check_idempotent.py` | pass (structure only) |
| `node --check` on `server/realtime/index.mjs` and the 3 edited edge functions (type-stripped) | pass |
| New test `qa/tests/integration/audit-remediation-103.test.js` (static assertions + a behavioural test of the sanitizer module), run through a plain-node shim because vitest isn't installed here | 21/21 pass |
| YAML parse of edited workflows / kustomize files | pass |
| Crude bracket balance of the 3 edited JSX files | pass (**not** a real JSX/ESLint run) |
| Migrations applied to Postgres, `qa/sql/*.sql`, vitest, Playwright, build, lint, `kubectl kustomize` | **NOT VERIFIED — not run** |

## 1b. CI run on commit `4590e7fb` (first real execution)

The owner pushed v1 to `main`. `deploy.yml` (not gated on CI) applied migrations 103–106 to production
successfully, deployed the edge functions and frontend, and post-deploy validation passed. CI results:

| Result | Detail |
|---|---|
| **Verified on real Postgres** | `audit_remediation_test.sql` A1, A2, B1, B2, B3, B4, C1 passed: `credit_transactions.reference` exists; the finalizer no longer reads it (definition check only — `finalize_order_financial_capture` itself was not executed); wallet top-up and credit repayment apply exactly once across a replay with the surplus going to the wallet; amount-mismatch and payment-type checks reject; service-only RPCs are not executable by `anon` / `authenticated`. |
| **Test bug (mine), fixed** | D1 "passed" for the wrong reason: a bare CI stack grants `authenticated` only SELECT (migration 039), so the insert was denied by the *table-privilege* layer (also SQLSTATE 42501), not by the new RLS policy; D2 then failed with `permission denied for table kyc_records`. The test now mirrors production's default privileges inside its rolled-back transaction and asserts that every denial message contains "row-level security". |
| **My test tripped the secret scanner** | Literal `fcm_token = '…'` assignments; the device id is now passed through a variable. |
| **Pre-existing (files this patch did not touch)** | `src/lib/googleAuth.js:309` secret-scan false positive (now logs `idTokenPresent: true` instead of a token-shaped literal); `pass5-remediation.test.js` DATA-01 expected the words "coming soon" but the page was reworded to "Coming to SETU" (assertion updated to accept the new wording **and** to require the "no referral code … active yet" text, so it is not weakened); Dependency Audit exit 1 (cause not visible in the log — needs the `npm audit` output). |
| **Cascade** | The QA "Generate report" gate failed only because the unit suite failed. |
| **Not run** | Playwright E2E, UI crawler and post-deploy E2E (skipped behind the failing jobs). |

### CI run 2 (after v2)

D1–D3 now pass **for the right reason** (RLS, not the privilege layer) and D2 passes. D4 failed — "same-village anchor could not review (rows=0)" — which exposed K-04 above, a defect older than this patch. The Security-suite and Dependency-audit jobs fail on `npm audit`: **4 high-severity advisories in production dependencies** (package names not in the log; not caused by this patch, which changes no dependency). All 29 other security-suite checks pass, including the secret scan.

## 1c. Live production verification (read-only, via the connected Supabase project)

After the owner connected the production project (`SETU`, ap-south-1) I ran read-only checks. Any
probe that executed a function ran **inside a transaction that was rolled back, with random UUIDs**,
so nothing was written. Production currently holds test-stage data only (9 profiles, 0 wallets,
7 orders, 1 vendor, 0 KYC rows, empty outbox).

| Check | Result |
|---|---|
| Migrations 103–107 applied | yes |
| Grants: service-only RPCs (F-03) closed to `anon` / `authenticated`; `anchor_manages_user` / `get_village_kyc_queue` open to `authenticated` only | confirmed |
| `credit_transactions.reference`, repayment unique index, FCM trigger, outbox index, both cron jobs | present |
| KYC policies use `anchor_manages_user`; own-insert check forbids `verified` | confirmed |
| SECURITY DEFINER functions without `search_path` | 0 |
| **Supabase security advisors** | **109 definer functions executable by `anon`, 121 by `authenticated`; 6 SECURITY DEFINER views; 1 materialized view exposed → led to A-01 and V-01** |

**My earlier static pass was wrong about this.** I counted ~118 PUBLIC-executable definer functions and
judged them "self-guarded" because their bodies mention `auth.uid()` / `is_admin()`. A guard token is not
a guard: several functions use `auth.uid() IS NULL` to mean *trusted backend*, and an unauthenticated
request has exactly that value.

## 2. Findings

Severity: C = critical, H = high, M = medium, L = low. "Fixed" = changed in this patch, unexecuted.

| ID | Sev | Component | Finding | Fix | Status |
|---|---|---|---|---|---|
| F-01 | C | `finalize_order_financial_capture` (mig. 094) | Reads `credit_transactions.reference`, which no migration creates; handler only catches `undefined_table`, so it raises on every call. Called by the webhook after every captured order payment and by the wallet-payment trigger. | mig. 103: add column; match disbursements on `purpose` (what `create_order` writes) | Fixed, NOT VERIFIED |
| F-02 | H | webhook wallet top-up / credit repayment | Not idempotent (retry double-credits wallet; repayment re-reduces `outstanding` per retry and its insert hit the missing column, so it retried 5×). Beneficiary and type taken from payment notes. `wallet_topups` never written. | mig. 103 RPCs `apply_wallet_topup_payment` / `apply_credit_repayment_payment` (lock `payment_orders`, verify type+amount, exactly-once); webhook rewired; `create-razorpay-order` fails closed if `payment_orders` insert fails | Fixed, NOT VERIFIED |
| F-03 | H | RPC grants | "Service-only" RPCs revoked from `authenticated, anon` only (no-op while PUBLIC has EXECUTE — see mig. 035). `check_rate_limit` was explicitly granted to `anon` with caller-chosen key/limit → anyone could exhaust another user's or the global (`ai-assistant:global:<day>`) bucket. `dispatch_ready_order` / `process_dispatch_timeouts` open to anyone (notification + offer spam). `prune_*`, `refresh_admin_dashboard_stats` never revoked. | mig. 103 revokes PUBLIC/anon/authenticated, grants `service_role` | Fixed, NOT VERIFIED |
| F-04 | M | `get_live_admin_analytics()` | SECURITY DEFINER, no admin check, PUBLIC-executable. Currently errors (missing columns) so no live leak. | locked to service_role; client already falls back to the gated wrapper | Fixed |
| A-01 | **C** | ~96 SECURITY DEFINER RPCs executable by `anon` | `pay_from_wallet`: `if auth.uid() is not null and p_user_id <> auth.uid() then raise` — skipped when unauthenticated, so anyone holding the public anon key can debit another user's wallet (needs the victim's UUID). `update_order_status` / `cancel_order_with_refund`: `v_is_backend := (auth.uid() is null)` — anon treated as backend, can change any order's status or cancel + refund it. `set_default_address`: same pattern. **Confirmed live** (each probe reached the function body past the identity check). Earlier migrations used `REVOKE … FROM authenticated, anon`, a no-op while PUBLIC holds EXECUTE. | mig. 108: revoke PUBLIC + anon on every definer function except an allow-list (pre-login functions + RLS helpers); `authenticated` / `service_role` grants preserved exactly (already-service-only functions are not re-opened); default function privileges no longer grant anon | Fixed in repo; **NOT YET DEPLOYED / NOT VERIFIED** |
| V-01 | H | analytics / reconciliation views | `analytics_daily_{order,payment,delivery,financial}_metrics`, `reconciliation_dashboard` (SECURITY DEFINER views) and `admin_dashboard_stats` (materialized view) were SELECT-able by `anon` and `authenticated`; two held live rows. Migration 072 had locked them, but later migrations recreated them with default grants. No code reads them directly. | mig. 108: service_role only; `category_previews` (public by design) becomes `security_invoker` | Fixed in repo; NOT YET DEPLOYED |
| K-01 | H | `kyc_records` RLS | Owner insert/update only checked `user_id = auth.uid()` → a user could set their own record `verified`. | mig. 104 | Fixed, NOT VERIFIED |
| K-02 | H | KYC review wiring | No policy ever let anchors/admins UPDATE `kyc_records`; `approveKycRecord` / `rejectKycRecord` / `reviewKYC` are plain client UPDATEs → review could not work. | mig. 104 reviewer policy (admin, or same-village anchor; never own record) | Fixed, NOT VERIFIED |
| K-04 | H | anchor KYC visibility | Found by CI (test D4 on real Postgres). The anchor read policy (mig. 014) and my reviewer policy (mig. 104) decided "same village?" with a subquery on `profiles` under the caller's RLS; `profiles` has no anchor-read policy, so it always evaluated to no rows — anchors have never been able to see or review any KYC record. The client's embedded `profiles` join returned null names for the same reason. | mig. 107: `anchor_manages_user()` SECURITY DEFINER predicate, policies recreated on it, `get_village_kyc_queue()` RPC (name/role only, caller's village only), `getVillageKycRecords` rewired to it | Fixed, NOT VERIFIED until CI D4/D7–D9 pass |
| K-03 | M | `verify-aadhaar` verify-otp | `requestId` not bound to the caller → OTP session could be lent to another account. | requires `kyc_records.meta.request_id` match for the caller | Fixed |
| R-01 | M | realtime WS | Re-auth kept rooms of the previous identity/role; no JWT-expiry enforcement on live sockets. | leave all rooms on (re)auth; close at `exp`+30s | Fixed |
| R-03 | M | realtime config | Wildcard origins allowed by default; production overlay still has `YOUR_SETU_DOMAIN`; Android WebView origin `https://localhost` not allow-listed. | exits in production on `*`; warns on placeholders; documented | Partially fixed — **you must set the origin list** |
| G-01 | M | realtime HTTP rate limit | Per-IP limiter keyed on client-controlled left-most `X-Forwarded-For`. | `REALTIME_TRUSTED_PROXY_HOPS` (opt-in so existing deployments don't collapse into one bucket) | Fixed, **needs config** |
| G-02 | M | `/v1/cache/products|vendors/:id` | Unauthenticated, runs on the service-role client with no visibility filter → returned inactive vendors / unavailable products that RLS hides; unvalidated ids; negative results cached 60s per arbitrary key. | UUID validation, `is_active` / `is_available` filters, 10s negative TTL | Fixed |
| D-01 | H | `realtime-deploy.yml` | Applied manifests pinned to `:latest` (+ `IfNotPresent`) and never used the SHA tag it had just built → unchanged manifest = no rollout. | render, pin to SHA, fail if `:latest` remains; kubeconfig via env | Fixed, NOT VERIFIED |
| D-02 | M | k8s NetworkPolicy | Egress rules use `namespaceSelector: {}` (in-cluster pods only) → on an enforcing CNI production pods cannot reach Supabase or managed Redis/Kafka. | production kustomize patch adds public-IP egress on 443/6379/6380/9092/9093 | Fixed, NOT VERIFIED — adjust ports |
| D-03 | L | `ci.yml` | No `permissions:` block. | `contents: read` | Fixed |
| N-01 | M | `profiles.fcm_token` | Not unique and never cleared on logout: after user A logs out and B logs in on the same device, A's order/wallet/credit pushes keep arriving on B's device. | mig. 105: single-owner BEFORE trigger + one-time dedupe; `signOut` detaches the token (time-boxed, never blocks logout) | Fixed, NOT VERIFIED |
| O-01 | M | `setu_event_outbox` | No retention anywhere: full-row JSON snapshots of every business event (incl. every `rider_locations` write) accumulate forever → table/index bloat, slower claim queries, eventual disk exhaustion. | mig. 106: hourly `prune_setu_event_outbox()` (published rows > 3 days, bounded batches, `SKIP LOCKED`, service-only); never deletes unpublished rows | Fixed, NOT VERIFIED |
| KC-01 | H | `kafka-worker.mjs`, `domain-consumers.mjs` | Outbox events carry full rows and were projected verbatim into `order:<id>` rooms, which the customer, vendor owner, rider and anchor can all join. That included `payment_transactions.gateway_payload` (payer contact/email/VPA/card last4), provider ids, `dispatch_events.payload` and every offered rider's `rider_offers` row. | new `event-sanitizer.mjs` allowlist per aggregate; financial rows never go to order rooms; Dockerfile now ships the module | Fixed, NOT VERIFIED (no live broker) |
| KC-02 | L | same | Financial events were published to room `admin`, which `authorizeRoom()` never lets anyone join (`admin:events` is the only admin room), and no UI code subscribes to it. The admin live-financial feed never worked. | publish to `admin:events` | Fixed server-side; **no UI consumer exists** |
| UX-01 | M | support screens | Customer support, fraud report and vendor support hardcoded the placeholder number `8001234567` (call + WhatsApp) — a safety/fraud channel pointing at a dummy number. | read `support_phone` / `support_whatsapp` / `support_email` from `app_settings`; hide buttons when unset | Fixed. NOTE: seed default `support_phone` is the placeholder `1800-000-0000` — set real values in admin settings |

### Found, not fixed

| ID | Sev | Finding | Recommendation |
|---|---|---|---|
| P-01 | M | `vendor-payout` takes the Razorpay `accountId` from the admin request body; it is not bound to the vendor. A compromised admin can pay a vendor's balance to any fund account. Vendors can also edit `vendor_payment_info` at will. | Store a verified `fund_account_id` per vendor (new column + onboarding step), ignore the body value, require a cooling-off period after bank-detail changes. |
| P-02 | L | Webhook sets `payment_orders.status='paid'` before amount reconciliation. | Move after a successful reconcile. |
| P-03 | L | `check_rate_limit` consumers treat only `=== false` as blocked, so an RPC error fails open. | Decide per endpoint (fail closed for KYC/payments). |
| P-04 | L | Delivery OTP uses Postgres `random()`. Bounded by `max_attempts`. | Use `gen_random_bytes`. |
| P-05 | L | `kyc-verify` is a deployed stub that always returns 503 (GST/PAN verification does not exist). | Implement or remove the function and its UI entry points. |
| P-06 | L | No cross-account de-duplication of Aadhaar (only a masked value is stored). | Store a salted hash of the full number server-side and add a unique index. |
| P-07 | L | `qa/sql/seva_credit_test.sql` is in `qa/package.json` but not in `ci.yml`; `ci.yml` lists SQL tests by hand, so new tests are easy to forget. | Glob `qa/sql/*_test.sql`. |
| P-08 | L | `build-android.yml`, `qa.yml`, `realtime-deploy.yml` have broad/implicit token permissions (realtime needs `packages: write`). | Add job-level `permissions`. |
| P-09 | L | Gateway returns raw DB error messages on order-create failure (502). | Map to stable error codes. |
| P-11 | L | Kafka domain consumer claims a Redis dedupe key *before* running the handler; a pod killed mid-handler leaves the key set, so the redelivered event is skipped as a duplicate. Handlers are projection-only (no business state), so impact is a missed realtime hint. | Use a short "processing" lease that is promoted to the long TTL on success. |
| P-12 | L | `payment.*`, `dispatch.*`, `inventory.*` realtime event types have no frontend consumer (grep of `src/`); the Kafka domain workers' output currently reaches no UI. | Wire a consumer or scale the workers down. |
| P-13 | L | `rider_locations` writes go through Postgres → outbox → Kafka as well as WebSocket/Redis; high-volume telemetry through a transactional outbox is costly. | Keep location pings out of the outbox. |
| P-14 | H | `deploy.yml` triggers on every push to `main` and runs `supabase db push` against production with no dependency on CI (CI and deploy ran in parallel; the deploy went green while CI was red). | Gate deploys on a green CI (`workflow_run` or a required-checks branch rule) and require reviewer approval on the `production` environment for the migrate job. |
| P-15 | L | A bare CI Supabase stack grants `authenticated` only SELECT (migration 039) while production has project default privileges (ALL), so RLS *write* policies cannot be exercised in CI without mirroring production's grants, and a CI "permission denied" is indistinguishable from an RLS denial unless the message is checked. | Keep the explicit `grant` + message assertion pattern used in `audit_remediation_test.sql` for any new write-policy tests. |
| P-16 | M | Anchors cannot open the KYC document image either: the `kyc-documents` storage policy allows only the owner or an admin. If anchors are meant to review documents, add a read policy (or signed-URL RPC) scoped with `anchor_manages_user()`; this is a privacy decision (Aadhaar documents), so it was not changed. | Decide, then implement. |
| P-17 | H (gate) / none (runtime) | `npm audit`: 4 high advisories — one chain `@grpc/grpc-js` ≤1.13.5 (GHSA-m9gg-hp2v-232j unauthorised certs from `getAuthContext`; GHSA-f596-whhp-79r4 error-message leak) → `@firebase/firestore` → `@firebase/firestore-compat` → `firebase`. **Not reachable by SETU:** the app imports only `firebase/app` and `firebase/messaging` (never Firestore) and grpc-js is a Node-only library, so nothing from it enters the browser bundle or any SETU server. The CI gate is still correct to block. `npm audit fix --force` proposes `firebase@9.14.0`, a downgrade from the installed 12.14.0 that would break FCM — **do not run it.** | `overrides: {"@grpc/grpc-js": "^1.14.0"}` in `package.json` (firebase pins `~1.9.0`, which has no patched release), then `npm install` to refresh the lockfile and re-audit. Two moderates (react-router open-redirect-via-backslash, protobufjs DoS) are fixed non-breakingly by `npm audit fix`. |
| P-18 | M | Supabase Auth "leaked password protection" is disabled (advisor). Only matters if email/password login is enabled; OTP/Google login is the documented path. | Enable it in Auth → Passwords if password login is on. (Dashboard setting — not changeable from SQL.) |
| P-19 | L | `pg_trgm` is installed in `public` (advisor). | Move to the `extensions` schema in a maintenance window. |
| P-20 | I | Five tables have RLS enabled with no policy (`delivery_attempts`, `delivery_financial_finalizations`, `delivery_otps`, `delivery_proofs`, `rate_limit_hits`). This is the intended deny-all for service-only tables, not a hole. | None. |
| P-21 | M | The `auth.uid() IS NULL ⇒ backend` convention remains in many definer functions. After migration 108 only `service_role` / the DB owner can reach it, but a future `GRANT … TO anon` or a new function with default privileges would reopen it. | Replace with an explicit `auth.role() = 'service_role'` check when each function is next touched. |
| P-10 | I | Production overlay still contains `YOUR_*` placeholders (Redis, Kafka, origins). | Fill in before first deploy. |

## 3. What looked sound (static, approximate)

- All 92 tables have RLS enabled; no write policy uses a literal `true`; public SELECT-true policies exist only on catalog tables (`villages`, `vendor_hours`, `vendor_locations`, `*_categories`, `app_updates`).
- Every SECURITY DEFINER function's latest definition pins `search_path`.
- Razorpay webhook: constant-time HMAC, durable idempotency (`claim_payment_event`), dead-letter after 5 failures; `create-razorpay-order` ignores client amounts for order payments; only the webhook is `--no-verify-jwt`; all other edge functions authenticate and derive identity from the JWT.
- No service-role/secret material in the client bundle sources; `VITE_DEMO_MODE` is `false` in production build paths and demo data is only served when Supabase is unconfigured.
- Delivery OTP stored salted+hashed with attempt limits; transactional Kafka outbox is a real design; `ai-assistant` fixes model, system prompt and token cap server-side with per-user and global caps; `send-fcm-notification` is admin/service only with a recipient cap; `dispatch-notifications` is service-only and records provider failures honestly; Kafka consumers use retry topics + DLQ with release-on-failure dedupe.
- Open-redirect protection exists (`safeInternalRedirect`).

## 4. Not reviewed (or only skimmed)

126 frontend pages (only grep-level sweeps), Kafka worker and domain consumers, the Redis idempotency
path under failure injection, outbox pruning/growth (`rider_locations` writes every few seconds),
most migration
function bodies beyond grant/guard analysis, accessibility, performance measurement, dependency audit,
load behaviour, migration ordering on a fresh database.

## 5. Rollout order

1. Apply migrations `103`–`108` (before deploying functions — the webhook now calls the new RPCs).
2. Deploy `razorpay-webhook`, `create-razorpay-order`, `verify-aadhaar`; rebuild the realtime image (new `event-sanitizer.mjs`).
3. Run `qa/sql/audit_remediation_test.sql` against a local Supabase first; fix any schema detail I could not see.
4. Set `REALTIME_ALLOWED_ORIGINS` (+ `https://localhost` if the Android app uses the gateway) and `REALTIME_TRUSTED_PROXY_HOPS`.
5. Set real `support_phone` / `support_whatsapp` in admin settings.

## 6. Decisions for the owner

- Credit repayment larger than the outstanding balance: the surplus is credited to the wallet (never silently kept). Confirm.
- A user whose KYC record is already `verified` can no longer re-upload over it; a reviewer must reset it first.
- NetworkPolicy egress to public IPs on the listed ports is the minimum for managed Redis/Kafka/Supabase; tighten to your provider's CIDRs if known.
