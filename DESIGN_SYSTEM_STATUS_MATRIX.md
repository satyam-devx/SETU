# SETU Design System Studio — Verification Matrix

Audit target: `SETU-main-design-system-studio-complete.zip` as received on 2026-10-20, then updated in this working copy during the follow-up implementation.

## Honest status key

- **PASS (static)**: source/config checks or the named static test passed in this environment.
- **PARTIAL**: a control/token exists, but it is not consumed by every relevant production component or the full behavior is not verified.
- **BLOCKED / NOT VERIFIED**: needs a live Supabase project, browser/device run, dependency installation, or a successful production build. No claim of production readiness is made for these items.

## Requirements matrix

| # | Requirement from plan | Status | Evidence / remaining work |
|---:|---|---|---|
| 1 | Global color tokens | **PARTIAL** | Color editor has light/dark semantic tokens, brand/status/sidebar tokens and 5 chart palette tokens. HEX editor + picker are present. RGB/HSL text entry is not implemented. Contrast checker evaluates selected token pairs only; it is not a full WCAG page scanner and does not block publishing. Admin, Super Admin and Vendor analytics consume chart tokens now; other charts/components still use local colors. |
| 2 | Restore defaults | **PASS (UI behavior static)** | Restore defaults resets the current editor draft to built-in defaults; it does not silently publish those defaults. |
| 3 | Draft / publish / version history / rollback | **PARTIAL** | Versioned RPC/table and UI workflow exist. Browser-to-Supabase integration, concurrent publishing, and rollback behavior have not been run against a database. Rollback is intentionally performed by loading an old version and saving/publishing a new version, preserving history. |
| 4 | Typography controls | **PARTIAL** | Body/heading/mono family, base size, heading scale, body/heading weight, line height and letter spacing are stored and exposed. Tokens affect global body/headings and opted-in utilities, but arbitrary component-level font classes remain. Inter/Roboto/Nunito are fallback names only; no font assets are bundled/loaded. Separate mobile/desktop preview and automated readability checks are missing. |
| 5 | Icon management | **PARTIAL** | Size/stroke tokens and eight semantic icon mappings exist; a safe allow-listed Lucide registry is used by `DesignIcon`. Only components using `DesignIcon` or compatible shared CSS follow the registry. Most direct Lucide imports still have per-component sizes. Searchable full-library browser and custom SVG upload are not implemented. SVG upload is deliberately disabled until a server-side sanitizer/storage policy exists. |
| 6 | Layout & spacing | **PARTIAL** | Radius, shadow, content width, spacing scale, button/input heights, card padding, grid gap, navigation density and a custom breakpoint token exist. Some are CSS variables/utilities and are not yet adopted by every existing component. The breakpoint token does not rewrite existing Tailwind responsive breakpoints. |
| 7 | Effects & animation | **PARTIAL** | Global reduced-motion/off switch, transition-duration token and opt-in hover/page/shimmer/card flags exist. Existing animations can be disabled globally, but fine-grained controls affect only matching/opt-in classes; all component-specific effects have not been migrated. |
| 8 | Theme manager | **PARTIAL** | Light/dark palettes and stored default-theme/user-choice policy exist. Token palette selection follows the app's `.dark` class. Default `system`/forced mode and `allowUserSelection` are not yet enforced centrally across every portal's existing theme preference UI. |
| 9 | Portal-wise control | **PARTIAL** | Scope selector and route-derived scopes exist. Migration 110 now deep-merges a portal's published sections over the global configuration. Actual visible effect still depends on each portal component consuming the tokens; all hard-coded styling has not been migrated. |
| 10 | Preview | **PARTIAL** | Preview applies draft tokens to the current app DOM and reset restores published state. It is not an isolated sandbox/iframe, so it is not a production-safe isolated preview environment. Browser navigation/theme edge cases need manual testing. |
| 11 | Backend validation and security | **PARTIAL** | Migration defines version table, RLS, revoked direct table grants, `settings.update` checks, token allow-lists, and audit events; sensitive RPC default PUBLIC execution is explicitly revoked. Migration has not been applied to a staging/live Supabase database; SQL execution/RLS/RPC tests are therefore unverified. |
| 12 | Design consistency scanner | **PARTIAL** | `scripts/audit-design-system.mjs` scans 263 source files and generates `DESIGN_SYSTEM_INVENTORY.md` for colors, Tailwind palette utilities, typography, fonts, Lucide imports, radii and shadows. It inventories references; it does not automatically classify every intentional exception, test dark-mode coverage, or perform full per-component contrast analysis. |
| 13 | Static design-system contract tests | **PASS** | `node scripts/test-design-system.mjs` passes after the latest edits. |
| 14 | JS/JSX syntax check | **PASS (selected files)** | TypeScript's installed transpiler parsed the changed `SuperAdminDesignSystem.jsx`, `design-system-provider.jsx`, `DesignIcon.jsx`, and `App.jsx` without syntax diagnostics. This is not a full typecheck or Vite build. |
| 15 | Production build / full QA | **BLOCKED / NOT VERIFIED** | `npm ci` did not complete in this environment; no `node_modules/.bin/vite` was available. Consequently `npm run build`, full QA, visual browser testing and mobile/device testing are not claimed as passing. |
| 16 | Live migration / production rollout | **BLOCKED / NOT VERIFIED** | No Supabase database was modified and no migration was applied. Apply migration in staging first, verify RPC/RLS/audit behavior, then production. |
| 17 | GitHub push / deployment | **NOT DONE** | This deliverable is a ZIP and audit documentation. No commit, push, deployment, or live database mutation was performed. |

## Checks run in this environment

- `node scripts/test-design-system.mjs` — PASS.
- `node --check scripts/test-design-system.mjs` — PASS.
- `node --check scripts/audit-design-system.mjs` — PASS.
- `node --check tailwind.config.js` — PASS.
- TypeScript transpile syntax checks for all 262 `.js`/`.jsx` files under `src` — PASS (syntax only; not typecheck/build).
- `node scripts/audit-design-system.mjs src DESIGN_SYSTEM_INVENTORY.md` — scanned 263 source files and generated inventory.
- `npm ci --ignore-scripts --no-audit --no-fund` — did not complete within this environment; production build remains unverified.

## Required before calling this production-ready

1. Run `npm ci`, `npm run build`, `npm run lint`, and the existing QA suite in a network-enabled clean environment.
2. Apply migration `20240101000110_design_system_studio.sql` to a staging Supabase project and test permission denial for non-authorized users, public published-theme reads, validation failures, audit entries, portal inheritance, concurrent publish and version rollback.
3. Add browser tests for draft preview/reset, publish/reload, scope switching, dark mode, and rollback.
4. Migrate relevant existing components from hard-coded styles to semantic tokens, while preserving intentional provider/brand/status/map colors.
5. Wire chart tokens into the actual chart components, apply icon mappings through shared wrappers in the relevant navigation/components, and enforce theme policy in each portal.
6. Decide whether custom SVG upload is a required launch feature; if yes, implement server-side sanitization and controlled storage before enabling it.

**Conclusion:** This ZIP is an improved implementation candidate with passing static contract tests, not a fully verified production release. The remaining items above are explicitly unpassed rather than being represented as complete.
