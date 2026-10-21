# SETU Design System Studio — Verification Matrix

Baseline: `SETU-main-design-system-studio-audited.zip` as received on 2026-10-21. This revision documents the "startup grade" upgrade applied on top of it.

## Honest status key

- **PASS (tested)**: covered by an automated test that was executed in this environment (see "Checks run").
- **PASS (static)**: source/config checks passed; behaviour not executed.
- **PARTIAL**: exists and works, but is not consumed by every relevant component, or only part of it is verified.
- **NOT VERIFIED / BLOCKED**: needs a live Supabase project, a browser/device, installed dependencies, or a successful production build. No claim is made for these.

## Requirements matrix

| # | Requirement | Status | Evidence / remaining work |
|---:|---|---|---|
| 1 | Color tokens | **PASS (tested)** editor logic · **PARTIAL** app adoption | HEX, `rgb()` and `hsl()` entry (normalized to HEX), per-token contrast chips with one-click Fix, brand-color generator (primary, label, ring, sidebar accents, chart 1 for both palettes). Contrast audit covers 12 text pairs (blocking) and 8 UI/graphics pairs (advisory) in light and dark, with "Fix all" that terminates and reports conflicts honestly. Components still using local colors are listed in `DESIGN_SYSTEM_INVENTORY.md`. |
| 2 | Restore / reset | **PASS (tested)** | Undo/redo with per-control coalescing, Discard (back to live), Reset to Global (scoped), and the "SETU Default" preset. None of these publish anything. |
| 3 | Draft / publish / versions / rollback | **PASS (tested against a fake DB)** · **NOT VERIFIED** on real Supabase | Publish dialog shows a grouped diff and the accessibility result; failures need explicit acknowledgement and are tagged in the version note. Publishing checks that nobody published to the scope since the Studio loaded (conflict warning, "publish anyway" is explicit). One-click rollback of a replaced version. Version compare/diff against the editor. The fake DB mirrors the migration's semantics but is not the migration. |
| 4 | Typography | **PARTIAL** | All stored controls are exposed. Body/heading/mono families, body weight, letter spacing are live; base size, heading weight and line height apply only where components do not set their own classes (UI says so). Heading scale is experimental. **Correction to the earlier audit:** Inter, Roboto and Nunito Sans *are* loaded (Google Fonts links in `index.html`, allowed by the CSP). |
| 5 | Icons | **PARTIAL** | Size/stroke apply to Lucide icons without their own size classes. Semantic mappings are stored and previewed, but **no app component uses `DesignIcon` yet** (it was only used by the Studio), so mappings are marked experimental. Resolution is alias-safe across Lucide renames. Full icon browser and custom SVG upload are not implemented (SVG upload stays disabled until server-side sanitization exists). |
| 6 | Layout & spacing | **PARTIAL** | Radius, **button height** and **input height** now drive the shared `Button`, `Input` and `Select` (defaults are pixel-identical to before). Shadow, content width, spacing scale, card padding, grid gap, breakpoint and nav density are stored and validated but no shared component reads them; the UI files them under "Experimental". |
| 7 | Motion | **PARTIAL** | Global off switch and **transition speed now drive every Tailwind `transition-*` utility** (default 150 ms equals Tailwind's own). Loading-shimmer toggle exposed. Hover/page/card flags remain opt-in-class only (experimental). |
| 8 | Theme manager | **PARTIAL** | Palettes follow the app's `.dark` class. Five curated presets (each tested to pass AA text in both modes except the shipped default, see #19). Default-mode and user-choice policy are stored but not enforced by portal theme switchers. |
| 9 | Portal-wise control | **PASS (tested against a fake DB)** · **PARTIAL** visible effect | Scoped portals now save **only their overrides**, so they keep inheriting later Global changes (previously a scoped save froze a full copy of Global). Verified: Global edit propagates into a portal while its own override is preserved. |
| 10 | Preview | **PASS (static)** · **NOT VERIFIED** in a browser | Isolated live preview: tokens are scoped to a wrapper element (the app is untouched), real `Button`/`Input`/`Switch` render inside it, with phone/tablet/wide frames and light/dark/both. "Preview in app" applies the draft across the real portals for this browser tab only, with a visible exit banner. The `window.__SETU_DESIGN_PREVIEW__` global is gone. Frame width does not simulate responsive breakpoints. |
| 11 | Backend validation and security | **PARTIAL** | Migration 110 is unchanged (no new migration is needed). New: a test parses the migration and fails if any allow-list or numeric range differs from `src/lib/design/schema.js`. The migration has still not been applied to a database; RLS/RPC/audit behaviour is unverified. |
| 12 | Consistency scanner | **PARTIAL** | Now excludes `src/lib/design/` (the token source of truth) so hex values there are not reported as hard-coded. Still an inventory, not a classifier. |
| 13 | Automated tests | **PASS (tested)** | `npm run test:design-system`: static contract + 38 engine tests + 12 Studio state-machine tests + CSS-baseline sync check. Added to the CI `build` job. |
| 14 | Syntax / static checks | **PASS (static)** | Every changed file transpiles; a custom checker verified every `@/` import resolves, every named import is exported, no unused imports/locals, no bare quotes in JSX text, and every Lucide icon used by the Studio is already imported by other app code. This is not ESLint and not a type-check. |
| 15 | Production build / full QA | **BLOCKED** | No network in this environment (`npm view` timed out), so no `node_modules`, `vite build`, `eslint`, QA suite or visual tests were run. |
| 16 | Live migration / rollout | **NOT DONE** | No database was touched. |
| 17 | GitHub push / deploy | **NOT DONE** | Deliverable is a ZIP. |
| 18 | No-flash, offline-first runtime | **PASS (tested)** · **NOT VERIFIED** in a browser | The provider caches the last published design per scope, paints it immediately, revalidates in the background and on focus/online, and keeps the cached design (instead of snapping to defaults) when the network fails. `public/design-boot.js` applies the cache before first paint; it is a same-origin script because the CSP forbids inline scripts, and is tested in a sandbox against corrupt and hostile cache entries. |
| 19 | Accessibility of the shipped defaults | **FINDING** | The built-in default palette fails WCAG AA text contrast for 4 pairs: accent label on accent (light 3.5:1, dark 2.7:1), dark secondary label (3.0:1) and dark destructive label (3.4:1). The old Studio checked only 5 pairs so it never surfaced this. **Not changed here**, to avoid altering production visuals silently. Open Studio, Access tab, "Fix all text contrast", then publish. |
| 20 | CSS baseline equals runtime defaults | **PASS (tested)** | Previously `index.css` and `DEFAULT_DESIGN` disagreed by up to 44/255 on some tokens, so colors visibly jumped right after React mounted. `index.css` tokens are now generated from `DEFAULT_DESIGN` (`npm run sync:design-defaults`) and CI fails if they drift. |

## Behaviour changes to know before deploying

1. First-paint colors now equal `DEFAULT_DESIGN` (what users saw after mount before). Final rendered colors are unchanged except sub-1/255 rounding differences from higher-precision HSL output.
2. The `inputHeight` preset values changed so `standard` equals the existing `Input` size (2.5 rem); `motion.duration` `normal` is now 150 ms (was 180 ms) to equal Tailwind's default. Stored configs keep working because the option keys are unchanged.
3. `Button`, `Input` and `Select` heights and the Tailwind default transition duration read CSS variables with fallbacks equal to the old fixed values, so nothing changes until an admin picks another value. Pages that pass their own `h-*` class still win.
4. On RPC failure the provider keeps the cached/last design instead of resetting to defaults.
5. `index.html` now loads `/design-boot.js` before the app bundle.

## Checks run in this environment

- `npm run test:design-system` — PASS (static contract, 38 engine tests, 12 Studio flow tests, CSS sync).
- TypeScript transpile of every changed `.js`/`.jsx`/`.mjs` file — PASS (syntax only).
- Custom import-graph / unused-symbol / JSX-entity / Lucide-safety check over all changed files — PASS.
- `node scripts/audit-design-system.mjs` — regenerated the inventory (274 files).
- `npm view` / `npm ci` — blocked (no network).

## Required before calling this production-ready

1. Run `npm ci`, `npm run lint`, `npm run build` and the QA suite (including Playwright visual regression) in a network-enabled environment. The defaults-preserving changes are designed not to move pixels, but that is unverified here.
2. Open the Studio in a browser on desktop and a phone: edit, undo/redo, preview, "Preview in app", publish, scope switch, rollback.
3. Apply migration `20240101000110_design_system_studio.sql` to staging; verify permission denial, public published read, validation failures, audit entries, portal inheritance, and concurrent publish.
4. Decide on the four AA failures in the default palette (#19).
5. Migrate remaining components to semantic tokens and adopt `DesignIcon` where icon mappings should apply; then promote the matching controls from "Experimental" to "Live" in `src/lib/design/schema.js` (`WIRING`).

**Conclusion:** a substantially stronger implementation candidate whose engine and state logic are tested, not a verified production release. Browser rendering, the build, lint and the database remain unverified.
