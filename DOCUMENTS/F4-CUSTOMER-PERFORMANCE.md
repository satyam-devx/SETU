# F4 — Customer Performance

## Scope
Home critical path, category loading, search, product detail, vendor detail, cart and checkout.

## Implemented
- Home below-the-fold vendors, seva, products and schemes are deferred with IntersectionObserver-backed query `enabled` flags.
- Home critical path keeps location, notifications/order status, banners and categories available without eagerly fetching every lower section.
- Home live-order and vendor ordering derivations are memoized.
- Search result filtering/sorting uses `useMemo` to avoid repeated array work on unrelated renders.
- Product detail uses the canonical `useProductCategories` query boundary.
- Vendor detail no longer fetches `products(*)` as part of the vendor row. Vendor metadata and vendor products are separate cached queries, with a bounded product page.
- Cart items are `React.memo` components and receive stable mutation callbacks from CartContext, reducing unrelated item rerenders during quantity changes.
- Checkout fee configuration is cached through the query layer instead of issuing a direct fetch on every checkout mount.
- Checkout payment-method derivation is memoized.

## Regression checks
- All `src/**/*.js` files pass `node --check`.
- No customer page currently directly calls product/vendor query APIs outside the canonical query hooks for the audited flows.
- Existing F1/F2 query keys, invalidation, cancellation and realtime boundaries were preserved.

## Runtime gate
Full Vite/browser/Android runtime verification remains dependent on installing the repository's locked dependencies. The current environment does not have a complete `node_modules` tree, so this document does not claim a runtime-green build.
