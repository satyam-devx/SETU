# SETU — Phase F6 Rider Performance

## Scope
Realtime, GPS, dispatch, location batching/coalescing, battery usage, and offline handling for the rider portal.

## Changes

### Realtime
- Rider dispatch realtime is centralized in `RiderLayout` through `useRiderDispatchRealtime`.
- `rider_offers` and `dispatch_assignment_events` no longer require separate page-level subscriptions.
- Realtime events invalidate the canonical rider-offer and rider-order queries instead of manually maintaining duplicate page state.
- Dispatch realtime pauses when the app is backgrounded and is recreated when the app returns to the foreground.

### GPS
- `useRiderLocation` now gates the GPS watch on rider online state, network availability, and foreground lifecycle.
- Auth user UUID is resolved to `riders.id` once and guarded against stale async completion.
- GPS accuracy is adaptive: high accuracy is requested during an active delivery; idle-online mode uses lower-power positioning parameters.

### Location batching / coalescing
- GPS callbacks only update the latest in-memory point.
- The latest point is published when the time/distance budget is met rather than once per callback.
- Active delivery: ~10s / ~15m threshold.
- Idle online: ~30s / ~40m threshold.
- The existing `rider_locations` schema stores the rider's latest row via `upsert`, avoiding an unbounded client-side history stream.

### Battery
- No GPS watch while offline, logged out, backgrounded, or explicitly offline.
- High-accuracy GPS is restricted to active delivery mode.
- Idle-online GPS uses a larger interval and distance threshold.
- No independent polling loop was added for dispatch; realtime drives invalidation.

### Offline
- GPS publishing stops immediately when the network is unavailable.
- The latest location remains in memory and can be published after connectivity returns.
- Dispatch/order queries use the existing centralized network-aware query client and retry policy.
- Financial/order mutations are not blindly placed into the generic offline mutation queue.

### Correctness fixes discovered during F6
- Rider dashboard had attempted to call `setAvailableOrders(...)` even though offers came from the query cache; this was replaced with local hidden-offer IDs plus authoritative refetches.
- Rider dashboard no longer opens a second dispatch realtime channel that duplicated the portal-level dispatch subscription.

## Validation
- Source changes were syntax-checked where supported by the available Node parser.
- Full Vite/browser/Android runtime regression is intentionally deferred until F4 + F5 + F6 combined runtime verification.
