# F3 — Rendering Performance

## Scope

F3 hardens rendering performance after F1/F2 server-state work. The goal is to reduce avoidable context-driven rerenders, keep expensive derived calculations stable, split expensive UI boundaries, and virtualize genuinely long lists without adding virtualization overhead to already-paginated screens.

## Implemented

### 1. Context rerender reduction

Memoized provider values in:
- `AuthContext`
- `CartContext`
- `SettingsContext`
- `PermissionsContext`
- `FeatureFlagsContext`
- `VillageContext`
- `SetuStoreContext`

Broad store consumers were reduced:
- `CustomerHome` now consumes the notification selector rather than the entire store state.
- `CustomerTrust` now consumes the auth-derived score/verification values rather than the entire store.

This prevents unrelated provider renders from forcing consumers to receive a newly-created context value when the exposed values have not changed.

### 2. Justified memoization

`VendorAnalytics` now memoizes:
- completed orders
- rating distribution
- hourly aggregation
- top products
- category revenue distribution
- repeat-customer chart data
- revenue/customer summary
- peak-hour calculation
- low-stock products

The previous repeat-customer calculation performed nested array scans (O(n²)); it is now a single-pass count map (O(n)).

`VendorProducts` memoizes filtered products and available count.

### 3. Component splitting

`VendorAnalyticsSummary` was extracted and wrapped with `React.memo`.

Existing route-level `React.lazy()` boundaries and shared `ProductCard` memoization remain in place.

### 4. Long-list virtualization

Added `src/components/shared/VirtualizedList.jsx`, a dependency-free fixed-row virtualizer.

`VendorProducts` uses it only when more than 40 products are visible. Short lists keep normal rendering, while long vendor inventories mount only the visible window plus overscan.

Customer category pages intentionally remain ordinary lists because they are already paginated/infinite-loaded at 20 products per page; virtualizing those short windows would add complexity without meaningful benefit.

### 5. Image/rendering detail

Virtualized vendor product rows use lazy image loading. Existing shared `Img` lazy-loading and `ProductCard` memoization remain unchanged.

## Deliberate non-changes

- No blanket `React.memo` was applied to every component.
- No `useMemo` was added to trivial calculations where allocation cost is negligible.
- No virtualization was added to 20-item paginated grids.
- No global state was removed merely for theoretical performance; only consumers with clear server-state replacements were migrated.

## Validation

Static source inspection completed for all F3 touched modules. Full Vite/ESLint runtime verification remains dependent on installing the project's npm dependencies in an environment with registry access.
