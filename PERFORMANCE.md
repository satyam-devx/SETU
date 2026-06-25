# SETU — Performance (2G / low-end device budget)

SETU's audience is Tier-4/5 rural India: 2G/3G connections and entry-level
Android phones. Bytes and main-thread work are the budget.

## Critical-path bundle (what a customer downloads on first paint)

| Chunk | gzip | Notes |
|-------|------|-------|
| `supabase-vendor` | ~55 KB | required (auth + data) |
| `react-vendor` | ~49 KB | required |
| `index` (app) | ~36 KB | app shell + customer entry |
| CSS | ~11 KB | Tailwind, purged |
| **≈ critical total** | **~150 KB** | typical for a React+Supabase SPA |

**Kept OFF the customer critical path:**
- `chart-vendor` (recharts, ~110 KB gz) — analytics/admin/vendor routes only,
  via lazy route imports + an explicit named chunk.
- **Firebase / FCM (~90 KB)** — `useFcmToken` now loads Firebase **only for
  users who have already granted notification permission**. First-time users
  are never auto-prompted and never pull Firebase on the home screen; they opt
  in explicitly via `enablePush()` (wire it to an "Enable notifications"
  button). This was the single biggest 2G win in Phase 5.
- `motion-vendor` (framer-motion) — isolated, tree-shakes to ~1 KB in practice.

## Images — the `<Img>` component

Remote vendor/product photos are the other 2G hazard. Use
`@/components/shared/Img` instead of raw `<img>` for remote images:

```jsx
import Img from '@/components/shared/Img';
<Img src={product.image_url} alt={product.name} width={200} height={112}
     className="w-full h-full object-cover" />
```

It lazy-loads off-screen images, async-decodes, requests a resized/recompressed
source via `optimizedSrc()` (Supabase Storage render transform when applicable),
falls back to the original URL if the transform isn't available, and to a
placeholder if the image itself fails. Always pass an explicit `width`/`height`
to avoid layout shift, and a meaningful `alt`.

**Migrated so far:** `CustomerVendors`, `CustomerSearch` (the highest-traffic
lists). **Migrate incrementally:** `CustomerHome`, `CustomerProductDetail`,
`CustomerVendorProfile`, `CustomerCart`, `CustomerReorder` still use raw `<img>`
— swap them to `<Img>` as they're touched.

## Measuring

- **Bundle analysis (no dep added):** `npx vite-bundle-visualizer` after a build.
- **Budgets** are enforced in CI: `ci.yml` warns on any JS chunk > 600 KB;
  `qa/scripts/run-perf-suite.js` budgets total JS ≤ 800 KB, largest chunk
  ≤ 500 KB, FCP ≤ 1800 ms, LCP ≤ 2500 ms.
- **Load testing:** see `SCALING.md` (k6 catalog + smoke tests).

## Still worth doing (incremental)

- Finish migrating remaining `<img>` usages to `<Img>`.
- Consider replacing framer-motion on the RoleSelect landing with CSS
  transitions to shave the entry further (it's already tiny after splitting).
- A precaching service worker for the app shell (offline-first) — the FCM SW
  exists; an app-shell SW would make repeat loads near-instant on 2G.
