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
