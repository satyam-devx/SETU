# SETU — Operations Runbook & Rollback Strategy

Deploys are split across three independently-rollbackable layers:
**frontend**, **Edge Functions**, and **database migrations**. Each has a
different rollback mechanism — there is no single "undo button," so know which
layer you're reverting.

---

## 1. Frontend (static SPA)

**Forward deploy:** `deploy.yml` (GitHub Pages) or `deploy-cloudflare.yml`
(Cloudflare Pages, once enabled).

**Rollback — fastest path:**
- **Cloudflare Pages:** Dashboard → Pages → project → Deployments → pick the
  last-good deployment → "Rollback to this deployment". Instant, no rebuild.
- **GitHub Pages:** revert the offending commit on `main` (`git revert <sha>`)
  and push — the pipeline rebuilds and republishes `gh-pages`. Slower (full
  rebuild) but deterministic.

Frontend is the safest layer to revert: it's stateless. When in doubt, roll the
frontend back first to stop user-facing breakage, then diagnose.

---

## 2. Edge Functions

**Forward deploy:** `deploy.yml` → `deploy-functions` job (`supabase functions
deploy`). Only `razorpay-webhook` is deployed `--no-verify-jwt`.

**Rollback:** Supabase has no built-in function version history, so:
- `git revert` the change and re-run the deploy workflow (redeploys the prior
  code), **or**
- `git checkout <last-good-sha> -- supabase/functions/<fn>` then
  `supabase functions deploy <fn>` locally with a production access token.

**Caution:** A function and the DB migration it depends on can get out of step.
If a function rollback expects an older schema, also assess the DB layer (below).
The webhook is idempotent (`payment_events.event_id`), so redeploying it is safe;
Razorpay retries unprocessed events.

---

## 3. Database migrations (forward-only)

The Supabase CLI (`supabase db push`) applies migrations forward only — there
are **no down-migrations**. Treat the schema as append-only.

**Rollback = forward-fix.** To undo a bad migration `N`, write migration `N+1`
that reverses it (drop the column, restore the prior function body, etc.) and
deploy that. Because every function is `create or replace` and tables use
`if not exists`, a reversing migration is straightforward to author.

**Catastrophic rollback (data corruption / destructive migration):** use
Supabase **Point-in-Time Recovery** (Dashboard → Database → Backups / PITR) to
restore to a timestamp just before the migration ran. This is the only true
"undo" for data loss and means downtime — coordinate before using.

**Pre-deploy guardrails already in CI:**
- `ci.yml` validates migration naming, idempotency, and SQL lint on every PR.
- `db-integrity-tests` runs the money-integrity + permission-guard proofs
  against a fresh `supabase start` on every PR.
- `deploy.yml` runs `scripts/post_migration_health.py` and **hard-fails** the
  pipeline (halting Edge Function + frontend deploy) if post-migration schema
  health is broken.

**Before deploying a migration that alters money paths** (orders, wallets,
escrow, payouts, fees): confirm the two SQL proofs still pass locally
(`supabase start` + `npm run test:db-integrity` in `qa/`), since the expected
amounts encode the intended fee math.

---

## 4. Configuration changes (no deploy needed)

Fee math, feature flags, and limits live in `platform_config` and are read at
runtime via `get_fee_config()` and the admin Settings UI. To change a fee,
update the row (Super Admin → Config) — **no code deploy required**, and it
takes effect on the next order. To "roll back" a config change, set the value
back. All writes are audited (`audit_log`, `updated_by`).

Key fee rows: `platform_commission_pct`, `delivery_fee_default`,
`delivery_fee_free_above`, `rider_earning_per_delivery`, `credit_discount_pct`,
`credit_discount_max`.

---

## 5. Observability — where to look when something breaks

| Signal | Where |
|--------|-------|
| Frontend crashes / uncaught errors | `client_error_logs` table (admin-readable); written via `log_client_error` RPC + `initObservability()` global handlers + ErrorBoundary |
| Payment amount mismatches, fee splits, role changes, payouts | `audit_log` (search `action`) |
| Webhook processing failures | Edge Function logs (Supabase Dashboard → Functions → Logs); failed events have `payment_events.processed_at IS NULL` |
| Unprocessed/stuck payments | `select * from payment_events where processed_at is null` |
| Admin KPI freshness | `admin_dashboard_stats.refreshed_at` (MV refreshes every 5 min via pg_cron) |

External error SaaS (e.g. Sentry) can be wired without code changes by setting
`window.__SETU_SENTRY__` — `src/lib/observability.js` forwards to it if present.

---

## 6. Retention (pg_cron jobs)

| Job | Schedule | Effect |
|-----|----------|--------|
| `prune-rider-locations` | hourly | GPS pings > 48h deleted |
| `prune-rate-limit-hits` | hourly | rate-limit rows > 1 day deleted |
| `prune-notifications` | daily 03:23 | read notifications > 90 days deleted |
| `prune-payment-events` | daily 03:37 | processed webhook events > 180 days deleted |
| `prune-client-errors` | daily 03:47 | client error logs > 30 days deleted |
| `refresh-admin-stats` | every 5 min | refresh `admin_dashboard_stats` MV |

`audit_log` is **never auto-pruned** (financial/compliance record). Archive it
to cold storage on a compliance schedule instead.

**Deferred:** true declarative partitioning of `orders` / `wallet_transactions`
/ `audit_log` is a planned maintenance-window migration (requires recreating
those tables as partitioned parents + rewiring FKs), not done in Phase 3.
