# SETU Design System Studio — Audit Summary

Super Admin route: `/superadmin/design-system` (requires `settings.update`).

## Architecture

```
src/lib/design/            pure, DOM-free, unit-tested (no React, runs under plain Node)
  color.js                 parse HEX/rgb()/hsl(), WCAG contrast, minimal-change auto-fix, brand derivation
  schema.js                single source of truth: tokens, options, defaults, validation, wiring status
  css.js                   config -> CSS custom properties (used by runtime, preview, boot cache, export)
  a11y.js                  contrast audit + auto-fix + publish-gate summary
  diff.js                  config diff, scoped-override extraction
  history.js               undo/redo with coalescing
  exporters.js             CSS variables, W3C design tokens, JSON backup + strict import
  presets.js               four AA-verified presets plus the shipped default
  cache.js                 offline-first cache, boot payload, preview session
src/lib/design-system.js           public surface + Supabase RPC client
src/lib/design-system-provider.jsx runtime provider (stale-while-revalidate, preview context)
public/design-boot.js              applies cached design before first paint
src/pages/superadmin/design-system/   Studio UI (state hook + panels)
scripts/sync-design-defaults.mjs   generates the index.css token baseline from DEFAULT_DESIGN
scripts/test-design-*.mjs          engine, state-machine and static-contract tests
```

## What the Studio does

- Colors: HEX/RGB/HSL entry, brand generator, inline contrast with one-click fixes, light and dark palettes.
- Accessibility: 12 blocking text pairs and 8 advisory UI pairs per palette, touch-target and font-size advisories, "Fix all", publish gate with explicit acknowledgement.
- Isolated live preview (real components, phone/tablet/wide, light/dark/both) plus "Preview in app" for this browser only.
- Undo/redo, dirty tracking, unsaved-changes guards, `Ctrl+S` / `Ctrl+Z` / `Ctrl+Shift+Z`.
- Presets, theme policy, typography, layout, motion and icon controls, each labelled **Live / Limited / Experimental** according to what the app actually consumes.
- Versions: history, compare with editor, load into editor, one-click rollback, conflict check before publishing.
- Portals save only overrides on top of Global; Global changes keep flowing through.
- Export CSS variables, W3C design tokens (for Figma/Style Dictionary) and a JSON backup; strict import.

## Findings this upgrade surfaced

1. **No component outside the Studio consumed the layout tokens** (button/input height, card padding, etc.). Button, Input, Select and Tailwind's default transition duration now do, with defaults identical to before. Remaining unwired controls are listed in the UI as Experimental.
2. **`index.css` and `DEFAULT_DESIGN` disagreed** (up to 44/255), causing a visible color jump after mount. The CSS baseline is now generated from `DEFAULT_DESIGN` and checked in CI.
3. **Scoped saves froze a full copy of Global**, so later Global changes never reached that portal. Scoped saves are now minimal overrides.
4. **The shipped default palette fails WCAG AA** for four text pairs (see matrix #19). Not changed silently.
5. The earlier claim that font assets are not loaded was wrong: Inter, Roboto and Nunito Sans load from Google Fonts via `index.html`.

## Limitations

- Not run here: `npm ci`, `vite build`, `eslint`, the QA/Playwright suites, any browser or device, any live Supabase database (no network in this environment).
- Migration 110 is unchanged and has not been applied anywhere. The Studio state tests run against an in-memory fake that mirrors its semantics, which is not a substitute for a staging test.
- Preview frame width does not simulate Tailwind responsive breakpoints.
- Experimental tokens (shadow, spacing, content width, card padding, grid gap, breakpoint, nav density, hover/page/card flags, icon mappings, theme policy) are stored and validated but not consumed by shared components.
- No custom SVG icon upload (deliberately, until server-side sanitization exists). Full-page accessibility scanning is out of scope: the audit covers token pairs only.

See `DESIGN_SYSTEM_STATUS_MATRIX.md` for the checklist and exact evidence.
