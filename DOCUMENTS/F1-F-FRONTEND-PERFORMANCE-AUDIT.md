# SETU — F1-F Frontend Performance & Concurrency Audit

## Scope

- React rendering and dependency/effect patterns
- Supabase Realtime subscription lifecycle
- async race conditions
- pagination / infinite-scroll concurrency
- query-cache memory retention
- mobile/WebView considerations

## Changes applied

### 1. Query-cache garbage collection
`src/lib/query-client.js`

- Added 10-minute garbage-collection window for cache entries with no subscribers and no in-flight request.
- Cancels pending GC when an entry is subscribed to or mutated.
- `removeQueries()` now correctly understands array query-key prefixes such as `['orders']` and removes child keys such as `['orders','customer',id,...]`.
- Clears GC timers when the entire cache is cleared.

This prevents long-lived pagination/realtime cache entries from accumulating indefinitely.

### 2. Order realtime race protection
`src/hooks/useRealtimeOrders.js`

- Added fetch-generation guard so an older role/user fetch cannot overwrite loading state after the active identity changes.
- Order list invalidation is now scoped to the active customer/vendor/rider key instead of invalidating every order query for every realtime event.
- Preserved detail-query updates for exact order records.
- Added the missing `useStore` import required by the legacy-compatible notification hook in this file.

### 3. Pagination race protection
`CustomerCategoryDetail.jsx`
`CustomerOrders.jsx`

- Added synchronous `useRef` locks around load-more operations.
- Prevents duplicate page requests when IntersectionObserver/click events arrive before React has committed the `isLoadingMore` state update.
- Existing server-side page/limit behavior is preserved.

### 4. Vendor order notification effect
`VendorOrders.jsx`

- Fixed previous-count tracking so the baseline is always updated.
- Removed the hook-dependency suppression from this effect.
- New-order detection remains based on the transition from an already-known pending count to a higher count.

### 5. Product-card rendering
`components/customer/ProductCard.jsx`

- Wrapped the card in `React.memo()` so unrelated parent renders do not automatically recreate every product card when its product prop is unchanged.

## Realtime audit

Audited all Supabase `.subscribe()` sites found in `src/`.

Key areas reviewed:

- orders
- single-order tracking
- notifications
- banners
- rider location
- rider offers/dispatch
- admin monitoring
- admin orders/cash/riders/support
- anchor village
- vendor documents
- order tracking map

Existing realtime subscriptions generally have explicit cleanup through `supabase.removeChannel(...)`. No global subscription registry was introduced because current subscriptions are component-scoped and their lifecycle matches the mounted UI surface.

## Async/effect audit notes

Intentional effect dependency suppressions remain in map components where map construction is deliberately separated from live-location updates. They are not blindly removed because adding every prop to those dependency arrays would cause expensive map teardown/recreation.

The remaining `useDataFetch` usage is intentionally not mass-replaced in F1-F. F1-E established the query boundary; specialized admin/anchor/seva/credit flows still need their own query contracts before migration.

## Mobile/WebView considerations

- IntersectionObserver is already used for deferred loading with a fallback for older WebViews.
- Product images use the shared lazy image component.
- Rider GPS watches are cleared on unmount/offline state.
- Leaflet/Mapbox instances are removed during cleanup.
- Realtime channels are removed during cleanup.
- Map-heavy screens should remain route/lifecycle scoped; they should not be mounted globally.
- High-accuracy GPS remains intentionally limited to the rider-online state; the existing 10-second persistence throttle is preserved.

## Validation

- All `src/**/*.js` files pass `node --check`.
- JSX files require the project's Vite/React build for full parsing; `node --check` does not natively parse `.jsx` files.
- Current workspace does not contain `node_modules`, so a full Vite production build was not claimed.
