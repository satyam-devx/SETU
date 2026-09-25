# SETU — F7 Realtime Engineering

## Objective

Realtime is treated as a correctness subsystem: **single-owner, event-routed, cache-aware, reconnectable, and recoverable**. A websocket subscription existing is not sufficient.

## 1. Subscription ownership

A new `src/lib/realtime-manager.js` owns Supabase channel lifecycle for logical realtime domains.

Properties:
- one active Supabase channel per logical key;
- multiple React consumers may fan out from the same channel without calling `.on()` after `subscribe()`;
- reference-counted teardown;
- browser network awareness;
- channel status tracking;
- exponential reconnect backoff (1s → 2s → 4s → … capped at 15s);
- stale generations cannot deliver events after a channel is replaced;
- foreground hooks can stop ownership entirely when the app is backgrounded.

## 2. Event routing

Event routing follows:

`Supabase event → domain owner → cache patch / invalidation / authoritative refetch → UI`

Current domains:
- Customer/vendor/rider orders: `useRealtimeOrders`
- Single order detail: `useRealtimeOrder`
- Notifications: canonical notifications channel in `useRealtimeOrders`, with legacy hook also routed through the same manager key
- Rider dispatch/offers: `useRiderDispatchRealtime`
- Banners: `useRealtimeBanners`
- Vendor KYC: `VendorDocuments`
- Rider location tracking: `OrderTrackingMap`
- Rider COD: `RiderCOD`
- Admin orders/riders/monitoring/COD/support: manager-backed admin channels
- Anchor rider status: manager-backed village channel

## 3. Cache policy

### Patch cache when
- the event contains a complete entity row;
- identity is stable;
- updating one cached entity is cheaper and safer than refetching the collection.

Examples:
- order UPDATE → patch `orders.detail(id)`;
- notification UPDATE → patch notification list entity;
- admin rider UPDATE → patch rider row;
- rider location UPDATE → patch the map marker directly.

### Invalidate when
- the event changes list membership, ordering, pagination, derived counts, or server-side joins;
- multiple related queries may be affected.

Examples:
- customer/vendor/rider order events → invalidate scoped order list;
- rider offer/dispatch events → invalidate offers + rider orders;
- notification DELETE → update list directly because membership is explicit.

### Authoritative refetch when
- a reconnect may have skipped events;
- the server applies joins/derived state that a payload cannot reconstruct;
- security-sensitive state must be reconciled.

Examples:
- order reconnect → scoped order fetch;
- notifications reconnect → notification history fetch;
- KYC reconnect → canonical KYC query refetch;
- admin monitoring reconnect → analytics reload;
- banners reconnect → banner query refetch.

## 4. Reconnect

`realtime-manager.js` reacts to `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED` with exponential backoff. When the browser/network becomes online again, disconnected logical channels are recreated.

Every successful reconnect runs the domain's `onRecover` callback before considering the domain reconciled.

## 5. Missed-event recovery

Recovery is domain-specific and authoritative rather than attempting to infer every missing event locally.

- Orders: refetch scoped order history.
- Notifications: refetch notification history.
- Rider dispatch: invalidate offers/orders so active queries refetch.
- KYC: refetch KYC records.
- Banners: refetch filtered banner state.
- Admin monitoring: reload live analytics.
- Rider location: read the latest `rider_locations` row after reconnect.
- COD/admin support: reload or reconcile the affected collection.

This prevents a reconnect gap from leaving the UI permanently stale.

## 6. Background/foreground

F6 already established lifecycle-aware ownership for rider dispatch, GPS and order realtime. F7 extends the same principle to manager-backed subscriptions: a hook that is disabled while backgrounded releases its channel; foreground creates a fresh owner and reconciliation occurs through the normal initial fetch/recovery path.

## 7. Duplicate-subscription audit

Direct Supabase channel creation is no longer used by the migrated realtime domains above. Search should show `supabase.channel(` only where a domain is intentionally outside the manager or in comments/docs. Manager keys make shared domains explicit (`admin:orders`, `admin:riders`, `notifications:<user>`, etc.).

## 8. Correctness rules

1. Never add `.on()` handlers after a channel has already subscribed.
2. Never assume a realtime event stream is lossless.
3. Do not blindly refetch every query after every event.
4. Do not trust an event payload to reconstruct server-side joins/derived data.
5. Reconcile authoritative state after reconnect.
6. Use entity IDs to prevent duplicate inserts and stale overwrites.
7. Release subscriptions on unmount/background.
8. Keep financial/order mutations independent from generic offline replay.

## Verification

Source-level verification should include:
- JavaScript syntax check across `src/**/*.js`;
- no stale direct subscription owners for migrated domains;
- manager import coverage for all migrated domains;
- route/source scan for duplicate channel names;
- full Vite build + test suite when dependencies are installed.

The last two runtime commands remain environment-dependent when `node_modules` is unavailable; this document does not mark them green without execution.
