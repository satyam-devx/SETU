# SETU — ProductionReadinessChecklist.md

**Document Class:** Production · Living (run before every production release, refined after each launch)
**Owner:** CTO + Head of QA + Principal Security Engineer (joint sign-off required)
**Audience:** CTO, founders, QA, DevOps
**Status:** v1.0 — MVP Launch Checklist
**Depends On:** SecurityRequirements.md, TestingRequirements.md, ErrorHandlingGuide.md, EnvironmentVariables.md

---

## 0. How to Use This Document

This is the final gate before any version of SETU goes live to real users with real money. It synthesizes requirements from every other document into a single go/no-go decision tool.

**Go/No-Go rule:** Every item in Sections 1–7 must be checked `[✅]` before production deployment is authorized. A single unchecked item is a **NO-GO**. There are no exceptions and no "we'll fix it after launch" items on this checklist — if something cannot be checked, it must be resolved first or explicitly documented as a known risk with written Founder + CTO approval.

**Sign-off protocol:** The checklist is completed by three people independently:
1. **CTO** — Technical and architecture items (Sections 1–3)
2. **Head of QA** — Quality and operational items (Sections 4–5)
3. **Founder/CEO** — Business and compliance items (Sections 6–7)

All three must sign Section 8 before deployment proceeds.

---

## 1. Technical Readiness

### 1.1 Build & Deployment

- [ ] Release APK/AAB generated with correct signing keystore (not debug keystore)
- [ ] App version in `pubspec.yaml` matches `APP_VERSION` in production environment variables
- [ ] `flutter build appbundle --release` completes without warnings on CI
- [ ] CI/CD pipeline has successfully deployed to staging with this exact build
- [ ] Rollback plan documented: what is the previous production version and can it be re-deployed within 30 minutes?
  - Previous version: `___________`
  - Rollback command/procedure: `___________`
- [ ] Admin dashboard (Next.js) deployed to production URL and accessible
- [ ] All Supabase Edge Functions deployed to production project (`supabase functions list --project-ref <prod>` shows all 5 services)

### 1.2 Database

- [ ] All migrations from `ImplementationPlan.md` have been applied to production (`supabase migration list --project-ref <prod>` shows 0001–0004 as applied)
- [ ] Seed data verified: Madhepur block active, correct villages present, categories loaded
- [ ] Supabase automated backups enabled and a backup exists from the past 24 hours
- [ ] `supabase db push --dry-run` shows no pending migrations (production schema matches codebase)
- [ ] Production database connection pooler configured (Supabase PgBouncer enabled)

### 1.3 Infrastructure

- [ ] Production Supabase project is on a paid plan (free tier is insufficient for production — connection limits too low)
- [ ] Cloudflare CDN active for `cdn.setu.app` (or equivalent media URL) — verify: product image loads in < 1 second in Bihar connectivity test
- [ ] `APP_ENV=production` is set in production environment (not `development` or `staging`)
- [ ] All domains resolving correctly (admin dashboard URL, API URL, CDN URL)

---

## 2. Security Verification

*Each item below references the specific SecurityRequirements.md section where the requirement originates.*

### 2.1 Authentication

- [ ] OTP rate limiting active: `>3 sends/hour per phone` returns 429 (SecurityRequirements §2.1)
- [ ] JWT access token lifetime: 1 hour maximum — verified by decoding a fresh token (SecurityRequirements §2.2)
- [ ] JWT refresh token rotation working: using refresh token twice invalidates the session (SecurityRequirements §2.2)
- [ ] Admin accounts have TOTP (2FA) configured and tested — log in to Admin Dashboard requires TOTP (SecurityRequirements §2.3)
- [ ] No shared admin accounts — each admin has individual credentials (SecurityRequirements §2.3)

### 2.2 Authorization (RLS)

- [ ] RLS boundary tests from `TestingRequirements.md §3.2` all passing against production DB
  - [ ] Customer cannot read another customer's orders
  - [ ] Vendor cannot read another vendor's orders
  - [ ] Admin (block-scoped) cannot read another block's orders
  - [ ] Rider sees only their assigned deliveries
- [ ] `audit_log` table has no UPDATE or DELETE RLS policy (append-only enforced)
- [ ] All tables have `ENABLE ROW LEVEL SECURITY` confirmed (`SELECT tablename FROM pg_tables WHERE schemaname='public'` and verify RLS enabled for each)

### 2.3 Payments

- [ ] Razorpay webhook signature verification: send a test webhook with wrong signature → NO order status change (SecurityRequirements §4.1)
- [ ] Duplicate webhook idempotency: send same `payment.captured` webhook twice → second is a no-op, single `transactions` row (SecurityRequirements §4.1)
- [ ] Live-mode Razorpay keys confirmed in production environment (not test keys): `RAZORPAY_KEY_ID` starts with `rzp_live_`
- [ ] Payment total is calculated server-side: place an order and confirm the total in the response matches DB-calculated total, not any client-supplied value
- [ ] Vendor payout account is KYC-verified (if manual payouts are configured)

### 2.4 Secrets

- [ ] `trufflehog git` scan of full repository history — zero secrets detected
- [ ] All secrets rotated from development defaults to production values (EnvironmentVariables.md §5.2)
  - [ ] Supabase service role key
  - [ ] Razorpay secret key + webhook secret
  - [ ] Twilio auth token
  - [ ] OpenAI / Claude API keys
  - [ ] Firebase server key
- [ ] `.env.local` is not committed to repository (`git ls-files | grep .env.local` returns empty)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not present in any Flutter app code or assets (search confirmed)
- [ ] Mapbox tokens are production tokens (not development sandbox)

---

## 3. Performance & Reliability

### 3.1 Performance Targets (TestingRequirements §4)

- [ ] App startup time on Budget tier device (₹5,000): **< 3 seconds** from launch to Home Screen — measured and recorded: `___ seconds`
- [ ] Product image load time on 4G connection: **< 2 seconds** per image — measured via Cloudflare analytics or manual test: `___ seconds`
- [ ] `GET /api/v1/discovery/vendors` response time at p95: **< 500ms** — measured against production: `___ ms`
- [ ] `POST /api/v1/orders` response time at p95: **< 1000ms** — measured: `___ ms`
- [ ] Offline map tiles pre-downloaded and verified: Rider App shows Madhepur block map in airplane mode

### 3.2 Load Baseline

- [ ] 50 simultaneous order placements against staging completed without errors or timeouts (TestingRequirements §7 / ImplementationPlan `QA-12`)
- [ ] Supabase connection pool not exhausted during load test (check Supabase Studio metrics)

---

## 4. Quality & Testing Sign-Off

### 4.1 Automated Tests

- [ ] `flutter test` — all unit tests passing, 0 failures
- [ ] `flutter analyze` — 0 issues, 0 warnings
- [ ] `dart format --check` — 0 formatting deviations
- [ ] `deno lint supabase/functions/` — 0 issues
- [ ] `npm audit --audit-level=high` (admin dashboard) — 0 high vulnerabilities
- [ ] `flutter pub audit` — 0 high vulnerabilities
- [ ] All API integration tests passing against staging (`TestingRequirements §3.2` suite)

### 4.2 Manual QA Sign-Off

All scenarios from `TestingRequirements §8` manually verified on production environment or staging environment with production-equivalent data:

**Customer Happy Path:**
- [ ] OTP login on a real phone (not a test number)
- [ ] Village selection loads real villages from DB
- [ ] Place COD order → vendor receives WhatsApp + push notification within 2 minutes
- [ ] Vendor accepts order → customer tracking screen updates within 10 seconds
- [ ] Admin assigns rider → rider app shows delivery within 10 seconds
- [ ] Rider picks up → customer tracking advances
- [ ] Rider delivers with mandatory photo → customer sees "Delivered" + rating prompt
- [ ] Customer submits 5-star rating → vendor's rating in catalog updates

**Payment Path:**
- [ ] UPI order → Razorpay payment sheet opens with correct amount (in rupees, matching paise total / 100)
- [ ] UPI payment failure → retry option works
- [ ] UPI payment failure → COD fallback works

**Edge Cases:**
- [ ] Out-of-stock product at checkout: correct 409 error dialog with product name
- [ ] Rider offline pickup: action queued, syncs on reconnect, customer notified
- [ ] Admin COD reconciliation: expected amounts correct, discrepancy highlighting works
- [ ] "Old app version" middleware: sending old `X-App-Version` header returns 426

**Device Coverage (TestingRequirements §4):**
- [ ] Budget tier device (₹5,000–7,000) — all above scenarios tested
- [ ] Mid tier device (₹10,000–12,000) — core ordering flow tested
- [ ] Upper-mid tier device (₹15,000) — spot check

---

## 5. Monitoring & Observability

- [ ] Sentry initialized and receiving events in production project: trigger a test crash, confirm alert received within 5 minutes
- [ ] Sentry source maps uploaded (for minified JS in admin dashboard) — stack traces are readable
- [ ] PostHog receiving events: open app, place order, confirm funnel events appear in PostHog dashboard within 2 minutes
- [ ] UptimeRobot monitoring active with correct production URLs:
  - [ ] `GET /api/v1/discovery/vendors` endpoint monitored (5-minute interval)
  - [ ] Admin dashboard URL monitored
- [ ] Telegram bot alert configured and tested: simulate a P0 alert trigger → Telegram message received by CTO and Founder
- [ ] Supabase metrics dashboard bookmarked and accessible — baseline metrics recorded pre-launch:
  - DB connections: `___`
  - Storage used: `___`
  - API requests/day (from staging extrapolation): `___`

---

## 6. Notifications & Communications

### 6.1 WhatsApp Template Status

- [ ] WhatsApp Business Account created and verified with Meta
- [ ] All message templates submitted for approval (per AppFlow §9 notification table)
- [ ] Template approval status for each template:
  - [ ] `new_order` (vendor notification) — Status: `___________`
  - [ ] `order_confirmed` (customer notification) — Status: `___________`
  - [ ] `order_cancelled` (customer notification) — Status: `___________`
  - [ ] `order_delivered` (customer notification) — Status: `___________`
  - [ ] `vendor_approved` (vendor notification) — Status: `___________`
  - [ ] `vendor_rejected` (vendor notification) — Status: `___________`
- [ ] `WHATSAPP_TEMPLATE_APPROVED=true` set in production environment
- [ ] **If any templates are NOT yet approved:** documented fallback plan exists (e.g., use Twilio sandbox for soft-launch, convert to approved templates before full launch)

### 6.2 FCM

- [ ] Production FCM server key in production environment (not test/dev key)
- [ ] Push notification received on a real device in production mode (not just debug APK)

---

## 7. Compliance & Business Readiness

### 7.1 Legal & Privacy

- [ ] DPDP Act 2023 consent screen present in onboarding flow (AppFlow §1.3, SecurityRequirements §6.2)
- [ ] Privacy policy document created and linked in Play Store listing
- [ ] Terms of service document created and linked in Play Store listing
- [ ] Data retention policy documented (in SecurityRequirements §6.2 and this document's Appendix)

### 7.2 Play Store

- [ ] App passes all Play Store policy checks (no policy violations flagged during internal testing review)
- [ ] App description in Hindi and English — no misleading claims
- [ ] Screenshots show real app screens (not mockups) — 3 screenshot sizes uploaded
- [ ] Feature graphic uploaded (1024×500px)
- [ ] Content rating questionnaire completed — rating received and appropriate for target audience
- [ ] App category set correctly (Shopping or similar — confirm with Play Store policy)
- [ ] FSSAI disclosure present if food vendors are listed (required for food delivery apps in India)

### 7.3 Operational Readiness

- [ ] Village Anchor network: at least 3 Village Anchors identified and briefed in Madhepur block (per Execution Bible)
- [ ] Minimum 10 verified vendors active in the system before soft launch (per PRD — empty marketplace kills first impressions)
- [ ] At least 2 riders available and briefed on Day 1
- [ ] Admin (Ops Lead) trained on Admin Dashboard — can approve vendors, assign riders, run COD reconciliation
- [ ] Support contact (WhatsApp number) configured and monitored — customers and vendors know how to reach SETU

---

## 8. Go/No-Go Sign-Off

**Release Version:** `v0.1.0`
**Target Launch Date:** `___________`
**Deployment Window:** `2:00 AM – 4:00 AM IST` (low-traffic window per Technical Constitution Part 8)

| Role | Name | Checklist Sections Reviewed | Sign-Off | Date |
|---|---|---|---|---|
| CTO | ___________ | Sections 1, 2, 3 | `[ ] APPROVED` / `[ ] NOT APPROVED` | ___ |
| Head of QA | ___________ | Sections 4, 5 | `[ ] APPROVED` / `[ ] NOT APPROVED` | ___ |
| Founder/CEO | ___________ | Sections 6, 7 | `[ ] APPROVED` / `[ ] NOT APPROVED` | ___ |

**Deployment authorized when:** All three sign `APPROVED`. If any sign `NOT APPROVED`, the blocking items are documented below and resolved before re-review.

**Blocking items (if any):**
```
1.
2.
3.
```

**Final deployment command:**
```bash
# Only execute after all three approvals above
supabase functions deploy --project-ref <prod-ref>
# Then: trigger Play Store production rollout in Play Console
# Then: monitor Sentry + PostHog + UptimeRobot for 2 hours
```

---

## 9. Post-Launch Monitoring Protocol

For the first 24 hours after launch, the following monitoring cadence applies:

| Time Post-Launch | Action | Owner |
|---|---|---|
| 0–30 min | Watch Sentry real-time for any new error types | CTO |
| 0–30 min | Watch PostHog for first user sessions — are they completing OTP? | Founder |
| 1 hour | Check Supabase metrics: connection count, query latency | CTO |
| 2 hours | Manually verify 3 complete orders end-to-end as a real user | QA |
| 4 hours | Review all Sentry events — any P1 issues? | CTO |
| 12 hours | First operational metrics review: orders placed, fulfillment rate, any COD reconciliation issues | Ops Lead |
| 24 hours | Full post-launch summary: what worked, what broke, what needs immediate fix | All |

**P0 Response (if triggered in first 24 hours):**
Per SecurityRequirements.md §10 — 30-minute response time. If payment system shows errors or data breach suspected:
1. Immediately disable the production `SUPABASE_ANON_KEY` via Supabase dashboard (takes app offline, prevents further damage)
2. CTO + Founder on call within 30 minutes
3. Follow P0 protocol in SecurityRequirements.md §10

---

## 10. Appendix — Data Retention Policy (DPDP Act Compliance)

This appendix documents SETU's data retention and deletion commitments to satisfy DPDP Act 2023 §4 (purpose limitation) and §8 (data erasure).

| Data Category | Retention Period | Deletion Mechanism |
|---|---|---|
| `users.phone`, `users.name` | Duration of active account + 90 days post-deactivation | Admin manually nulls PII fields; automated deletion in V1+ |
| `user_addresses` | Duration of active account + 90 days | Hard-delete (no financial history attached) |
| `orders`, `order_items` | 7 years (GST record-keeping requirement) | Records retained; PII fields nulled after 2 years |
| `transactions` | 7 years (financial regulation) | Never deleted; PII fields nulled after 2 years |
| `reviews` | Duration of vendor's active listing | Soft-deleted with vendor if vendor deactivated |
| `audit_log` | 3 years | Never deleted within retention period |
| `notifications` | 90 days | Automated cleanup via `pg_cron` job |
| Analytics events (PostHog) | 12 months in cloud; IP anonymized immediately | PostHog data deletion API if user requests |

---

*End of ProductionReadinessChecklist.md — v1.0*
