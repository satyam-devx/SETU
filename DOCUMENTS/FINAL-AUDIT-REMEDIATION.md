# SETU — Final Audit Remediation

Date: 2026-09-25

This document records the remediation pass performed against the previously packaged `SETU-FINAL-COMPLETE.zip` after an independent audit found build/runtime regressions.

## Fixed in this remediation

- CustomerHome duplicate `notifications` declaration and pre-declaration `user` access.
- CustomerLayout pre-declaration `user` access.
- RiderDashboard pre-declaration `myOrders` access.
- RiderEarnings pre-declaration `period` access.
- RiderIncentives stale `riderRow` references.
- CustomerCategoryDetail missing `loadMoreLock` ref.
- AdminCash/AdminSupport missing `supabase` imports.
- VendorCredit/VendorEarnings/VendorSettings malformed import blocks.
- VendorProducts extra JSX closing token.
- VendorAddProduct mutation hook invocation.
- VendorSettings mutation hook invocation.
- VendorOnboarding mutation hooks moved into the child steps that consume them.
- `deleteStorageObject` restored as a real media helper and re-exported through `img.js`.
- Query hook `{data,error}` API envelopes are now normalized before TanStack Query stores data; query errors are thrown so retry/error states work correctly.
- Legacy `useDataFetch` no longer recreates its fetch callback on every render; the latest fetcher/options are held in refs and dependency changes explicitly control reruns.
- `useRealtimeOrders` now returns the authoritative cached order list instead of an unconditional empty array and synchronizes with the query cache.
- Android back-button handling now navigates browser history when possible and exits the native app at the root instead of only dispatching an unconsumed event.
- Rider dispatch foreground/resume reconciliation now invalidates and refetches authoritative offers/orders.
- Rider query invalidation now uses canonical query keys and covers rider profile, offers, orders, earnings and SOS state.
- Offline mutation queue now continues processing independent items after one failure and enforces a retry budget.
- Delivery-proof image validation now permits the documented 8 MB maximum.
- Supabase image transforms no longer request unsupported WebP/AVIF output; format variants are only advertised when the configured CDN supports them.
- Category pagination now fetches one look-ahead junction row and carries `hasMore` metadata so unavailable products do not prematurely terminate pagination.
- CSP now explicitly permits Razorpay checkout, Leaflet/Mapbox scripts and styles, and Razorpay checkout frames.
- Root and QA GitHub workflows use `npm install` rather than strict `npm ci`, matching the project's documented lockfile-drift strategy and allowing the runner to reconcile dependency metadata.
- Python cache patterns restored to `.gitignore`.

## Verification performed in this environment

- Plain JS/MJS/CJS syntax: PASS.
- JSX parse diagnostics using the installed TypeScript parser: PASS, 0 errors.
- `@/` alias import-path existence scan: PASS, 0 missing targets.
- Known audit-listed stale references: remediated.

## Remaining execution boundary

A fresh dependency installation could not be executed in this environment because DNS/network access to the npm registry is unavailable. Therefore a real Vite production build, browser/Playwright execution, Android Gradle build, and device-level accessibility/performance run are not represented as completed by this document.

The dependency version `@tanstack/react-query@5.103.2` is a published npm release as of this remediation date; the local lockfile still requires regeneration by a network-enabled `npm install`. CI workflows have been changed to use `npm install` so the runner can reconcile the lockfile rather than failing the strict `npm ci` synchronization gate.

## Second remediation pass (2026-09-25, follow-up)

An independent audit of this remediation found two remaining issues; both are fixed below.

- **`RiderDashboard.jsx` — reintroduced TDZ crash.** Fixing the earlier `myOrders`
  pre-declaration bug left a new one: `activeDelivery` (a `useMemo` derived from
  `myOrders`, added for delivery-aware GPS accuracy) was declared *after* the
  `useRiderLocation(user?.id, isOnline, activeDelivery)` call that reads it,
  so the dashboard threw `ReferenceError: Cannot access 'activeDelivery' before
  initialization` on every render. The `useRiderOrders`/`activeDelivery`/
  `useOrderMutations` block was moved above `useRiderLocation`. Verified with
  TypeScript's `checkJs` (no more `used before its declaration` diagnostic) and
  a plain-Node reproduction of the pattern.
- **`validateImageSignature()` ignored its caller's `maxBytes`.** It only ever
  took `(file)` and validated against the hard-coded 5 MB default inside
  `validateUpload(file)`, so `completeDelivery()`'s
  `validateImageSignature(proofFile, { maxBytes: 8 * 1024 * 1024 })` silently
  fell back to 5 MB — any proof photo between 5–8 MB was rejected before the
  explicit 8 MB check even ran. The function now accepts and forwards
  `options` to `validateUpload`. `validateDocumentSignature()`'s internal
  image-branch call was updated the same way, which also fixes an equivalent
  latent bug on the vendor KYC path (`VendorDocuments.jsx` requests a 10 MB
  limit for image documents; it was likewise being silently clamped to 5 MB).
  Existing callers that pass no options (`VendorAddProduct.jsx`) keep the
  original 5 MB default unchanged. Verified with a Node-side `File` polyfill
  exercising both the 8 MB delivery-proof and 10 MB KYC call sites at 4/6/7/9 MB.
- **`.env.example` was missing from the previous archive** (dropped during
  packaging, not a deliberate change) and has been restored.
