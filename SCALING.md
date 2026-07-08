# SETU — Scaling & Cost Controls (Phase 4)

**Version:** 1.0.0 · **Last updated:** 2026-07-08

How SETU scales reads, protects third-party spend, keeps the payment
queue observable, and how to load-test before a traffic event.

---

## 1. Read scaling — optional read replica

Public catalog reads (vendors, products, categories, schemes, villages) are
the highest-volume, least-sensitive queries. They're routed through
`supabaseRead` (`src/lib/supabase.js`), which uses a read replica when
`VITE_SUPABASE_REPLICA_URL` is set and otherwise falls back to the primary —
so behaviour is unchanged by default.

**Enable:** create a Supabase read replica, set `VITE_SUPABASE_REPLICA_URL` to
its URL, rebuild. Reads may be slightly stale (replication lag), which is fine
for a catalog. The replica client carries **no user session** (anon role), so
it only ever sees data exposed by public RLS policies — never auth, orders,
wallet, or credit. Those stay on the authenticated primary client.

Measure the win with the catalog load test (section 5) before/after enabling.

---

## 2. Third-party cost controls (bill protection)

Per-user rate limits already exist (migration 014). Phase 4 adds **global daily
caps** so a distributed abuse run can't run up an unbounded vendor bill:

| Function | Env var | Default | Behaviour past cap |
|----------|---------|---------|--------------------|
| `ai-assistant` (Anthropic) | `AI_DAILY_CAP` | 5000 / UTC day | `503` "at capacity" |
| `verify-aadhaar` (SurePass) | `KYC_DAILY_CAP` | 2000 / UTC day | `503` "at capacity" |

Set these as Edge Function secrets to match your budget. Both are enforced via
the existing `check_rate_limit()` with a per-day global key, on top of the
per-user limit.

---

## 3. Payment queue — durability & visibility

The `razorpay-webhook` is already a durable, idempotent queue: every event is
persisted to `payment_events` (unique `event_id`), the handler is idempotent,
and a failed handler returns `500` so Razorpay **retries** (events stay
`processed_at IS NULL` until they succeed). Amount-mismatch events are parked
for manual review rather than auto-confirmed.

Phase 4 adds **visibility** (migration 020):
- `flag_stuck_payment_events()` (pg_cron, every 10 min) raises an `audit_log`
  alert for any event unprocessed for > 30 min — once per event (`alert_sent`).
- `get_payment_queue_health()` (admin-only RPC) returns a live snapshot:
  `pending`, `stuck_over_30m`, `processed_24h`, `mismatch_flags_24h`. Wire it
  into the admin monitoring dashboard.

Where to look when payments seem stuck:
```sql
select * from payment_events where processed_at is null order by created_at;
select * from audit_log where action in ('payment_event_stuck','payment_amount_mismatch')
  order by created_at desc;
```

**Deferred (larger change):** fully decoupling ingestion from processing
(webhook enqueues only; a separate worker drains) would raise peak throughput
further. The current retry-based design is sufficient at expected volume; revisit
if webhook latency under burst becomes a bottleneck.

---

## 4. Edge rate-limiting / WAF (Cloudflare)

The Postgres `check_rate_limit()` is per-database and adds DB write load — it
stops the cheapest abuse but is not a substitute for an edge layer. Once on
Cloudflare (see `HOSTING.md`), add in the Cloudflare dashboard:

- **WAF Rate-limiting rules** on the Edge Function paths
  (`/functions/v1/create-razorpay-order`, `/functions/v1/verify-aadhaar`,
  `/functions/v1/ai-assistant`) — e.g. 60 req/min per IP, challenge above.
- **Managed WAF ruleset** (OWASP) in front of the SPA + API.
- **Bot Fight Mode** to shed scripted abuse before it reaches Supabase.

These run at the edge (no DB cost) and protect against the distributed attacks
the per-DB limiter can't.

---

## 5. Load testing (k6)

Scripts in `qa/load/`, runnable locally or via the manual
`load-test.yml` workflow (workflow_dispatch — never on push).

```bash
# Catalog read scaling (point at STAGING):
k6 run -e SUPABASE_URL=https://<ref>.supabase.co -e SUPABASE_ANON_KEY=<anon> \
       -e VUS=100 -e HOLD=2m qa/load/k6-catalog-read.js

# Frontend smoke:
k6 run -e BASE_URL=https://<host>/ qa/load/k6-smoke.js
```

Thresholds: catalog reads fail the run if error rate ≥ 1% or p95 ≥ 800ms;
smoke fails at ≥ 5% errors or p95 ≥ 2s. **Load-test staging**, not production,
unless you've planned a window with Supabase.

---

## 6. Scale expectations (current architecture)

| Users | Status with Phase 1–4 done | Next lever |
|-------|----------------------------|------------|
| 1k | Comfortable | — |
| 10k | OK behind Cloudflare + cached admin stats | enable read replica |
| 100k | Needs replica + edge WAF + connection pooling (Supabase pooler) | partition `orders`/`wallet_transactions`; queue worker |
| 1M | Re-platform: partitioned/sharded data, dedicated queue, multi-region CDN | — |

**Still deferred** (planned maintenance-window work, not in Phase 4): declarative
partitioning of `orders` / `wallet_transactions` / `audit_log`, and a dedicated
async payment-processing worker.
