# SETU — F1-E Frontend State Architecture Audit

## Scope

F1-E audits the frontend after F1-A through F1-D. It separates server state from client/UI state, identifies remaining direct API access, and migrates high-traffic customer/vendor/rider reads to the canonical query layer without deleting the compatibility adapter prematurely.

## Canonical architecture

```text
Page/UI
  -> domain query hook / mutation hook
  -> src/lib/api.js or provider service
  -> Supabase / Edge Function / payment provider
  -> query invalidation / realtime cache update
  -> query client
  -> UI
```

`src/hooks/useDataFetch.js` remains as a compatibility adapter. It is no longer the target architecture and should only be used while a domain-specific query hook is unavailable.

## Completed in F1-E

### Customer server-state migration

Migrated customer category, vendor, product, scheme and seva-provider reads to canonical query hooks:

- `useCategories`
- `useCategoryPreviews`
- `useVendors`
- `useVendorsByVillage`
- `useSchemes`
- `useSevaProvidersByVillage`
- `useProducts`
- `useVendor`
- `useVendorCategories`

Customer search now uses query-cache-backed category/product/vendor reads. Customer notifications use the notification query and mutation boundaries.

### Vendor server-state migration

Vendor profile reads now consistently use `useVendorByOwner`.

Vendor product/category reads migrated where domain hooks already existed:

- Vendor dashboard products
- Vendor analytics products
- Add product categories
- Edit product categories
- Edit product category junction
- Vendor settings: profile, hours, categories

### Rider server-state migration

Rider identity/profile reads now use `useRiderByUser` across the rider portal.

Available rider offers use `useRiderOffers` rather than a component-owned fetch loop. Rider earnings has a canonical earnings query hook available. Rider safety uses `useActiveSOSAlert`.

### Realtime/query convergence

Notification realtime now hydrates and updates the canonical notification query cache in addition to the existing compatibility store path. This allows pages to consume notification server state from the query layer while existing portal realtime wiring remains safe.

## Query-key additions

Added canonical identities for:

- category previews
- village-filtered vendors
- schemes
- village/category-filtered seva providers
- product categories

## Remaining intentional compatibility / migration surface

`useDataFetch` is still present in legacy/admin-heavy screens and some specialized domains. These were not blindly converted because their APIs represent distinct admin, anchor, seva, credit, KYC, finance, or analytics domains and need their own query/mutation contracts rather than generic wrappers.

Examples include admin dashboards/queues, anchor operations, seva operations, credit flows, and specialized finance/security screens.

Direct provider/API calls that remain should be classified as one of:

1. domain mutation/query boundary not yet created,
2. provider-specific operation that should remain behind its service,
3. realtime/storage/browser integration rather than ordinary server-state fetching.

They should not be replaced merely to reduce grep counts.

## State ownership rule after F1-E

### Server state

Orders, products, vendors, categories, addresses, wallet, payments, notifications, rider identity/offers/earnings, and similar persisted data belong in query cache/domain hooks.

### Client state

UI filters, modal visibility, form drafts, temporary upload progress, navigation state, optimistic presentation-only flags, and device/browser state may remain local React state or a dedicated client-state store.

### Realtime

Realtime events update or invalidate query cache. They must not become a second authoritative database-shaped store.

## Validation

JavaScript query/realtime modules were syntax-checked with Node after the F1-E changes. Full Vite compilation is still environment-dependent because the working workspace does not currently contain `node_modules`.

No ZIP/checkpoint was generated during F1-E.
