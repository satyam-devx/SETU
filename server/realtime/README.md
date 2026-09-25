# SETU Realtime Gateway

The SETU realtime gateway is the app-facing WebSocket layer introduced in the Redis + WebSocket rollout.

## Data flow

```text
Supabase Postgres changes
        │
        ▼
 Supabase Realtime bridge
        │
        ▼
      Redis Pub/Sub ─── Redis latest-location cache
        │
        ▼
 WebSocket gateway
        │
        ├── Customer
        ├── Vendor
        ├── Rider
        └── Admin
```

Redis is never exposed to the browser. Supabase remains the source of truth for orders, payments and rider-location writes.

## Local run

1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Run the stack with Docker Compose.
3. The Vite app uses `ws://localhost:8787/ws` when `VITE_REALTIME_URL` is set to that value.

The gateway requires:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `REALTIME_ALLOWED_ORIGINS`

## Security model

- A client must authenticate the WebSocket with a Supabase access token.
- Every private room is authorized server-side before subscription.
- `user:<auth-user-id>` is automatically joined after authentication.
- `order:<order-id>` and `rider:<rider-id>` require database-backed authorization.
- Clients cannot publish domain events through the socket. Writes remain in the existing Supabase/API paths.
- The service-role key exists only in the gateway environment.

## Current migrated flows

- Rider live location: `rider:<rider-id>` uses the Redis-backed WebSocket when configured and keeps Supabase Realtime as fallback.
- Order changes: the customer/vendor/rider's private user room emits an `order.changed` event, which triggers an authoritative Supabase refetch/cache sync in `useRealtimeOrders`.
- Notifications: new notification rows emit `notification.created` to the owner's private user room.

This is intentionally an incremental migration. Existing Supabase Realtime channels are not removed until each domain has an equivalent WebSocket path and recovery test coverage.


## Production hardening added in V1.1

- Authenticated WebSocket token refresh before Supabase JWT expiry.
- Heartbeat/ping to keep mobile WebViews and proxies alive.
- Redis-backed rider GPS rate limiting (`RIDER_LOCATION_MIN_INTERVAL_SECONDS`, default 5s).
- Rider GPS gateway writes are identity-bound to the authenticated rider account.
- Gateway health reports active WebSocket connections and room count.
- `REALTIME_MAX_CONNECTIONS` protects the gateway from unbounded connection growth.
- Client falls back to direct Supabase GPS writes if the optional gateway is unavailable.


## Redis distributed data-plane controls

The gateway now exposes a small authenticated HTTP API on the same port as the WebSocket service:

- `GET /v1/cache/categories` — Redis cache-aside for active categories.
- `GET /v1/cache/category-previews` — Redis cache-aside for home category previews.
- `GET /v1/cache/products/:id` — Redis cache-aside for public product details.
- `GET /v1/cache/vendors/:id` — Redis cache-aside for public vendor details.
- `POST /v1/orders` — authenticated order mutation with a required `Idempotency-Key`.

Every `/v1/*` request receives an atomic Redis fixed-window IP limit, plus a user limit when authenticated. Order creation has an additional per-user limit. Redis stores completed idempotent responses for 24h by default and uses a short-lived processing claim to prevent concurrent duplicate execution across gateway replicas.

The database `create_order()` idempotency key remains the final correctness boundary. Redis is an accelerator/coordination layer, not the financial source of truth.

## Kafka event backbone (V1)

SETU now uses a transactional PostgreSQL outbox as the durable event source:

```text
Business transaction
       │
       ├── PostgreSQL row change
       └── setu_event_outbox row (same transaction)
                    │
                    ▼
             Kafka worker
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       Orders   Notifications Delivery
       topic       topic       topic
          │         │           │
          └─────────┼───────────┘
                    ▼
             Redis projector
                    ▼
              WebSocket
```

Kafka is not exposed to the browser. The browser still talks to the WebSocket/API gateway, Redis remains the low-latency transport/cache, and PostgreSQL remains the source of truth.

Topics:
- `setu.order.events`
- `setu.notification.events`
- `setu.delivery.events`
- `setu.domain.events`

The producer uses Kafka idempotence and stable `eventId`s. Consumers also keep a Redis dedupe key so a producer crash between Kafka publish and `published_at` update does not create duplicate realtime delivery.

## Kafka business-integrity events (V2)

SETU now emits durable Kafka events for the four integrity domains in addition to orders/notifications/delivery:

- `setu.payment.events` — payment intents, payment transactions, gateway-event state, refunds.
- `setu.inventory.events` — reservation lifecycle (`reserved`, `committed`, `released`, `expired`).
- `setu.dispatch.events` — dispatch events, rider offers, assignment facts.
- `setu.financial.events` — journal postings, settlements, payout reconciliation state.

All events are created by PostgreSQL triggers inside the same transaction as the business mutation and first land in `setu_event_outbox`. The Kafka worker publishes them asynchronously. Kafka consumers must be idempotent; PostgreSQL remains authoritative.

Payment gateway payloads are redacted before entering the outbox. Do not put card data, OTPs, access tokens, or provider secrets in event payloads.

Recommended event flow:

```text
Payment RPC / Inventory RPC / Dispatch RPC / Ledger RPC
                  |
             PostgreSQL TX
             /           \
      business row     outbox row
                           |
                       Kafka worker
                           |
       +---------+---------+---------+---------+
       |         |         |         |         |
     payment  inventory dispatch financial  order
       |         |         |         |         |
       +---------+---------+---------+---------+
                           |
                  Redis / WebSocket
```

## Domain workers, retries and DLQs

SETU runs independent Kafka consumer groups for payment, inventory, dispatch and financial events. A failure in one domain therefore does not block the others.

Each domain has:

- source topic: `setu.<domain>.events`
- retry topic: `setu.<domain>.events.retry`
- dead-letter topic: `setu.<domain>.events.dlq`
- independent consumer groups
- Redis event-id deduplication
- exponential retry backoff

After the configured retry count, an event is sent to the DLQ with the original topic, attempt count and error metadata in Kafka headers. The worker does not mutate authoritative business state; domain writes remain PostgreSQL RPC/transaction responsibilities.

### DLQ replay

From the realtime worker container or a Node environment with Kafka access:

```bash
npm run replay-dlq -- --domain payment --limit 100
npm run replay-dlq -- --domain inventory --limit 100
npm run replay-dlq -- --domain dispatch --limit 100
npm run replay-dlq -- --domain financial --limit 100
```

Replay republishes the event to its source topic with `x-setu-replayed=true`. Because consumers are idempotent, replay is safe for event delivery; PostgreSQL remains the source of truth.
