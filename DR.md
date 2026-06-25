# SETU — Disaster Recovery & Chaos Drills

A platform handling wallets, credit, and KYC must be able to recover from data
loss, provider outages, and credential compromise. This is the drill playbook.
Run each drill in a **staging** project on a schedule (suggested: quarterly).

See `RUNBOOK.md` for routine rollback; this file covers failure recovery.

## Backups & RPO/RTO targets

| | Target | Mechanism |
|--|--------|-----------|
| Database RPO (max data loss) | ≤ 5 min | Supabase Point-in-Time Recovery (PITR) |
| Database RTO (time to restore) | ≤ 1 hr | PITR restore to new project, repoint env |
| Frontend RTO | ≤ 5 min | Cloudflare Pages deployment rollback |
| Edge Functions RTO | ≤ 15 min | redeploy from `main` (git is source of truth) |

Confirm PITR is enabled on the production Supabase project (it requires a paid
tier). Without PITR, the only recovery point is the daily backup — RPO becomes
up to 24h, which is **not acceptable for money data**. Verify this first.

## Drill 1 — Database PITR restore

1. In a staging project, note a known-good timestamp `T`.
2. Make a destructive change after `T` (e.g. delete some test orders).
3. Trigger PITR restore to just before `T`.
4. **Verify:** the destructive change is gone; run
   `qa/sql/phase1_money_integrity_test.sql` + `rls_permission_guards_test.sql`
   against the restored DB — they must still pass (schema intact).
5. Record actual RTO. Document the env-repoint steps (new DB URL → app + Edge
   Function secrets) so production recovery is mechanical, not improvised.

## Drill 2 — Razorpay / payment-provider outage

- Simulate: point `RAZORPAY_KEY_*` at an invalid key in staging.
- **Expected:** `create-razorpay-order` returns a clean error; checkout shows a
  retry message; no order is left in an inconsistent paid state (order stays
  `pending`). COD + wallet paths still work.
- **Webhook backlog:** when the provider recovers, Razorpay re-sends events;
  the idempotent webhook (`payment_events.event_id`) processes them once.
  Watch `get_payment_queue_health()` → `stuck_over_30m` drains to 0.

## Drill 3 — Supabase / region outage

- The frontend is static (Cloudflare) and stays up, but data calls fail.
- **Expected:** the app degrades gracefully (error/empty states, OfflineBanner),
  does **not** white-screen (ErrorBoundary + `client_error_logs` capture it).
- Recovery: if the region is down long-term, PITR-restore to a project in
  another region and repoint env (Drill 1). Practise the repoint.

## Drill 4 — Credential compromise / rotation

Practise rotating each secret without downtime:
- **Supabase anon key / service role:** rotate in dashboard → update GitHub +
  Edge Function secrets → redeploy. (Anon key rotation invalidates active
  sessions — communicate the forced re-login.)
- **Razorpay keys + webhook secret:** rotate in Razorpay → update Edge secrets
  → redeploy webhook → send a Razorpay test event to confirm signature passes.
- **SurePass / Anthropic / Firebase service account:** rotate → update Edge
  secrets. Confirm the relevant function still works (or fail-closed as designed).
- **If a service-role key leaks:** rotate immediately (it bypasses RLS), audit
  `audit_log` for anomalous `actor='system'` writes, and review
  `client_error_logs` / payment mismatches around the exposure window.

## Drill 5 — pg_cron job failure

- Disable `refresh-admin-stats` in staging; confirm the admin dashboard shows a
  stale-but-present snapshot (degrades, doesn't crash) and `refreshed_at` ages.
- Confirm retention jobs (`prune-*`) and `flag-stuck-payments` are scheduled:
  `select jobname, schedule from cron.job;`

## After every drill

Record: what broke, actual RTO/RPO vs target, and any manual step that should be
scripted. The goal is that production recovery is a checklist, never a first-time
improvisation.
