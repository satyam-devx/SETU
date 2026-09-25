# Phase F5 — Vendor Performance Engineering

## Scope

Vendor-side performance pass for:

- Dashboard
- Product management
- Orders
- Analytics
- Business documents / KYC

F4 customer changes remain in the same working tree. F6 will follow before the combined F4/F5/F6 runtime regression pass.

## Changes implemented

### 1. Vendor identity/query boundary

- `useVendorByOwner()` now participates in the canonical query cache with an abort signal.
- `getVendorByOwnerId()` accepts the query cancellation signal.
- Vendor screens continue to share the same cached vendor-owner query instead of independently resolving the same vendor record.

### 2. Vendor dashboard

- Vendor order filtering is memoized.
- Pending-order and today's-order derivations are memoized.
- Low-stock derivation is memoized.
- Dashboard keeps the existing real-data and skeleton behavior.
- No new realtime channel was introduced.

### 3. Product management

- `ProductRow` is now memoized so unrelated product-list state changes do not rerender every row.
- Existing canonical `useProducts` query/cache and `useProductMutations` mutation boundary remain the source of truth.
- Existing virtualized rendering for larger product lists remains intact.
- Search filtering and availability counts remain memoized.

### 4. Vendor orders

- Pending, filtered, sorted and active-order derivations are memoized.
- Vendor rejection now uses the authenticated user already available from `useAuth()` instead of issuing an additional `supabase.auth.getUser()` request for every rejection action.
- Existing canonical order query + mutation boundaries are preserved.
- Existing vendor-layout realtime ownership is preserved; this page does not add a second order realtime subscription.

### 5. Vendor analytics

- Existing expensive analytics transforms remain memoized: hourly distribution, top products, category mix, repeat-customer data, summary metrics and peak-hour calculation.
- Product inventory data is now fetched only when the **Products** analytics tab is active, avoiding an unnecessary product query when the vendor is viewing Sales or Customers.
- Product data uses the canonical product query/cache.

### 6. Earnings/profile

- Earnings aggregate calculations and settlement projection are memoized.
- Vendor profile metrics (orders, revenue, reviews) are memoized.
- Both continue to reuse the canonical vendor-order cache.

### 7. Business documents / KYC

- Replaced page-local KYC fetching state with canonical `useKycRecords()` query state.
- Added canonical query key: `queryKeys.kyc.byUser(userId)`.
- `getKycRecords()` now accepts an abort signal.
- KYC realtime changes invalidate/refetch the same cached query instead of invoking a separate full page loader.
- Upload success invalidates/refetches the canonical KYC query.
- Retry uses the query's `refetch()` rather than a duplicate custom loader.
- Authenticated user identity is reused from `useAuth()` rather than calling `supabase.auth.getUser()` during the normal document load path.
- Private storage/signed-URL behavior is unchanged.

## Performance model after F5

Vendor server-state domains now follow the same architecture established in F1/F4:

`Page -> canonical query hook -> query cache -> API boundary -> Supabase`

Realtime remains an invalidation/update mechanism rather than a second data-fetching architecture.

## Validation

- All `.js` source files pass `node --check`.
- JSX files cannot be syntax-checked by `node --check`; this is a tooling limitation, not a claim of runtime validation.
- Full Vite/browser/Android runtime verification is intentionally deferred until F6 is complete, as requested.
- No ZIP/artifact package was created.
