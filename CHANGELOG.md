# Changelog

All notable changes to SETU are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); this project uses [Semantic Versioning](https://semver.org/).

> **Note on dates:** this changelog was backfilled from `SECURITY_FIXES.md` and repository state during the July 2026 audit/cleanup pass — this repo's history predates the changelog itself and was not exported with commit history, so entries before `1.0.0` are grouped by phase/theme rather than exact calendar date. Going forward, every release gets a dated entry here in real time.

---

## [1.0.0] — 2026-07-08 — First stable release

Marks SETU's transition from active buildout to a tracked, versioned release line. No functional app changes in this release — it consolidates prior work and fixes repo hygiene/tooling debt found during a full project audit.

### Added
- `CHANGELOG.md` (this file).
- `LICENSE` — proprietary, all rights reserved (SETU is closed-source; no `CONTRIBUTING.md`/`CODE_OF_CONDUCT.md` needed at this stage since outside contributions aren't accepted).
- ESLint (`eslint.config.js`) with React, Hooks, and `jsx-a11y` rules — first automated lint coverage for the ~230 file frontend.
- `qa/scripts/run-semgrep.js` — SAST scan (OWASP Top 10 / security-audit / JS / React rulesets) via Semgrep; previously referenced by `lint:security` but didn't exist. Wired into `qa.yml`'s `security` job and into `test:all`.
- `.github/dependabot.yml` — weekly automated dependency-update PRs for the root app, the `qa/` pipeline, and GitHub Actions versions, plus immediate PRs for CVE-flagged dependencies. Replaces the one-off committed `audit.json` snapshot approach.
- Prettier (`.prettierrc.json`, `.prettierignore`) — shared formatting config.
- `tsconfig.json` — enables `@/` alias resolution in editors and `npm run typecheck` (JS project, no TypeScript migration implied).
- `npm run lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `clean`, `analyze`, `test`, `test:all` scripts at repo root.
- "Last updated" + version metadata headers across all top-level documentation.
- Cross-links between all documentation files from `README.md`.

### Changed
- `README.md` fully rewritten to reflect the actual current app (was describing an early mock-data-only build).
- `SECURITY.md` reporting section updated with a working vulnerability-reporting path (see `SECURITY.md`).
- `package.json` version set to `1.0.0`.
- `vite.config.js`: added an explicit `firebase-vendor` manual chunk name (Firebase was already dynamically imported and code-split — this just gives it a stable chunk name); documented why Leaflet/Mapbox are intentionally *not* npm dependencies.

### Removed
- `leaflet` and `react-leaflet` npm dependencies — confirmed unused. The app loads Leaflet (and Mapbox GL) from a CDN at runtime via `src/lib/maps.js`, by design, to keep mapping libraries off the JS bundle for 2G users (see `PERFORMANCE.md`). The npm packages were dead weight in `package.json`/`package-lock.json` only — they were never imported anywhere in `src/`.
- `database/migrations/007_phase2_hardening.sql` — orphaned duplicate of `supabase/migrations/20240101000007_phase2_hardening.sql` with drifted content; deleted to remove ambiguity about which is authoritative.
- `qa/.github/workflows/` — a stale, non-functional copy of the real CI workflows. GitHub Actions only runs workflows from the repo-root `.github/workflows/`, so this nested copy never executed; it had drifted out of sync with the real `qa.yml`/`nightly.yml` and was actively misleading (referenced in `SECURITY_FIXES.md`'s deploy instructions as if it were live).
- `audit.json` — a committed point-in-time `npm audit` snapshot; removed and added to `.gitignore`. Regenerate on demand via `qa`'s `audit:deps` script.
- `supabase/functions/important_map.json` — typo'd, unreferenced file (Deno's convention is `import_map.json`); it was wired nowhere, so it was deleted rather than fixed. Re-add a correctly named, correctly wired import map if/when one is actually needed.

### Fixed
- `src/pages/rider/RiderSafety.jsx` — placeholder emergency support number (`1800-XXX-XXXX`) replaced/flagged; a rider in a real emergency must not be shown a fake number next to real Police/Ambulance numbers.

---

## [1.0.1] — 2026-07-08 — CI failure fixes

Fixed four distinct CI failures found in a full GitHub Actions run (`qa.yml`), diagnosed from the run's log bundle.

### Fixed
- **Stale CORS static-check (`run-security-suite.js`).** The "Edge functions return CORS headers" check literally grepped `ai-assistant/index.ts` for the string `Access-Control-Allow-Origin`, which stopped appearing there once CORS handling was centralized into `_shared/cors.ts` (the 1.0.0-era hardening work). The check now verifies the real source of truth (`_shared/cors.ts` sets the header, and the function imports/calls `corsHeaders()`) instead of a stale literal string. This was a false-positive test bug, not an actual CORS regression — CORS itself was never broken.
- **WCAG 2.1 AA color-contrast failure on `/customer/profile`** (axe-core, `qa/tests/e2e/a11y/accessibility.spec.js`): the "SETU Score" badge (`bg-primary/15 text-primary`) measured 4.02:1, below the 4.5:1 minimum. Root cause: `--primary` was tuned for 4.5:1 against a *solid white* background, but this tint pattern composites the color at 15% opacity, which lightens the effective background and lowers contrast. Fixed by introducing a shared `.chip-primary` utility (`src/index.css`, 5% opacity, ~4.67:1) and applying it everywhere the same `bg-primary/10`/`bg-primary/15` + `text-primary` text-badge pattern was found — 7 additional files had the identical latent bug, not yet caught only because those routes weren't in the a11y test's page list: `RiderDeliveries.jsx`, `RiderIncentives.jsx` (×2), `SevaJobDetail.jsx`, `VendorOnboarding.jsx`, `VendorProfile.jsx`. Icon-only instances (no text) were left as-is since they're non-text contrast (3:1 threshold), which they already pass.
- **`run-a11y-suite.js` reporting 0 useful results (`ERR_CONNECTION_REFUSED` on every page).** The accessibility job ran this standalone script *after* the Playwright a11y spec step, whose built-in `webServer` had already started and stopped its own dev server by then — so the script had nothing to connect to and its failure was masked by `|| true`. `qa.yml` now explicitly starts a dev server (with a readiness poll) before this step and stops it after.
- **`Post-Deploy E2E (Production)` cascading failures ("Site not found · GitHub Pages").** The job ran unconditionally on every push to `main`, including when `vars.PROD_URL` isn't configured or the target isn't actually deployed/published yet — every test then failed against GitHub's generic Pages 404 page (title mismatch, missing elements, redirect timeouts, ~100+ failures from one root cause). Fixed by: (1) gating the job on `vars.PROD_URL != ''` so it's skipped rather than failing when unset, and (2) adding a "Verify production URL is actually live" pre-flight step that fails fast with a clear `::error::` message instead of letting Playwright produce a wall of confusing downstream failures. Documented the required `PROD_URL` repo variable in `HOSTING.md`.

### Known follow-up (not fixed here, flagged for a dedicated pass)
- `--secondary` (teal) fails WCAG AA text contrast even at full opacity against white (4.12:1, e.g. `.btn-secondary` in `src/index.css`), and `--accent` (green) similarly (3.48:1 solid, e.g. the "Verified" badge in `VendorProfile.jsx`). Unlike `--primary`, these weren't tuned for 4.5:1 on white in the first place. `--secondary` also has a dark-mode-specific problem: darkening it enough to fix `text-secondary`-on-dark-background contrast makes white-text-on-solid-`secondary` buttons fail instead (2.91:1) — the two use cases pull the token in opposite directions, so this needs two separate tokens (a text-on-background variant and a solid-fill variant), not a single-value tweak. Left out of this round since it's a broader design-token change, not a CI-flagged regression.

---

## [1.0.2] — 2026-07-08 — CI infra fixes (Supabase CLI rate limit, Node EOL)

### Fixed
- **`Setup and Build` job failing: "Failed to resolve latest Supabase CLI release: rate limit exceeded."** Every workflow using `supabase/setup-cli` had `version: latest`, which makes the action call GitHub's API to resolve the newest release on every single run — across all jobs/workflows this adds up fast and trips GitHub's API rate limit, independent of the `GITHUB_TOKEN` already being passed in. Pinned all 8 occurrences (across `ci.yml`, `deploy.yml`, `health-monitor.yml`, `secrets-sync.yml`, `qa.yml`) to an explicit CLI version (`2.109.0`, current stable as of this fix) instead of `latest` — this skips the API-resolution call entirely and downloads the pinned release directly. Also bumped the action itself from `supabase/setup-cli@v1` to `@v3` (current major version). Bump the pinned CLI version periodically; Dependabot won't do this automatically since it's a `with:` input, not a dependency file.
- **Node 20 deprecation warning** ("Node 20 is being deprecated... running with Node 24 by default"). Node 20 reached end-of-life on 2026-04-30. Bumped every workflow's `node-version`/`NODE_VERSION` from `'20'` to `'24'` (current Active LTS, supported through April 2028) — `ci.yml`, `deploy.yml`, `deploy-cloudflare.yml`, `health-monitor.yml`, `qa.yml`, `nightly.yml`. No app code changes required for this bump; re-run `npm run test:all` after pulling this change to confirm nothing in the QA suite assumed Node 20 behavior.

---

## [1.0.3] — 2026-07-08 — Build failure: `manualChunks is not a function`

### Fixed
- **`npm run build` failing on Vite 8**: `TypeError: manualChunks is not a function` (rolldown internals). `vite.config.js`'s `build.rollupOptions.output.manualChunks` was the older object-map form (`{ 'chunk-name': ['pkg', ...] }`), which plain Rollup accepted but Vite 8's default bundler (rolldown) rejects outright — it only accepts the function form `manualChunks(id) { ... }`. Rewrote it as an equivalent function that inspects each module's path and returns the same chunk names (`react-vendor`, `supabase-vendor`, `ui-vendor`, `motion-vendor`, `chart-vendor`, `firebase-vendor`) as before — no change in the actual chunking behavior, just a syntax form both Rollup and rolldown accept. Also updated the `vite` version pin in `package.json` from `^5.4.0` (stale — the range didn't reflect what's actually being installed) to `^8.1.3` to match reality and avoid future confusion about which major is in play.

---

## [1.0.4] — 2026-07-09 — Flaky Supabase container start + broken production E2E URLs

### Fixed
- **`db-integrity-tests` job failing: "failed to bind host port for 0.0.0.0:54324 ... address already in use"** (Docker networking race starting the Mailpit/Inbucket container). This job only runs raw `psql` against the Postgres container — it never touches Studio, Mailpit, Kong, PostgREST, etc. `supabase start` now excludes all of those (`-x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`) in `ci.yml`, which avoids the port-binding race entirely and starts faster. Also added a one-time retry (`supabase stop --no-backup` + retry) as defense-in-depth against the same class of transient Docker networking failure.
- **`Post-Deploy E2E (Production)` still failing after 1.0.1's guard fix, now with a real deployed URL** (`Received string: "Site not found · GitHub Pages"` on every route except `/`). Root cause was different from the earlier "unconfigured PROD_URL" issue: `SETU_E2E_URL` is `https://satyam-devx.github.io/SETU` (a GitHub Pages *project* site under the `/SETU` subpath), but every spec called `page.goto('/login')` etc. with a **leading slash**. Per the URL spec, `new URL('/login', 'https://host/SETU')` resolves to `https://host/login` — a leading slash is root-relative and discards the baseURL's `/SETU` segment entirely, so nearly every test was silently hitting a URL that doesn't exist on GitHub Pages at all. This never surfaced locally because `localhost:5173` has no subpath to lose. Fixed centrally rather than by editing all 46 call sites (many via dynamic route arrays): added `qa/tests/e2e/fixtures.js`, a thin wrapper around Playwright's `test`/`page` that strips a leading `/` from `page.goto()` arguments before resolving against `baseURL`; all 4 spec files (`auth.spec.js`, `role-isolation.spec.js`, `customer-portal.spec.js`, `a11y/accessibility.spec.js`) now import `test`/`expect` from it instead of `@playwright/test` directly. Also normalized `BASE_URL` in `playwright.config.js` to always end with a trailing slash — required for the relative-path resolution to land *inside* `/SETU/` rather than replacing it (a base path without a trailing slash is treated as a "file", not a "directory", per URL resolution rules). The site itself was never broken for real users; this was purely a test-URL-construction bug, but it was hiding whatever real production issues might exist behind ~40 false-red failures.

---

## [1.0.5] — 2026-07-09 — `nightly.yml` missing `issues:write` permission + React 19 lockfile drift

### Fixed
- **`Production Smoke Test` (and `CVE Dependency Scan`) failing: `RequestError [HttpError]: Resource not accessible by integration` (403) when `actions/github-script` tried to open a GitHub issue.** `nightly.yml` never declared a `permissions:` block, so `GITHUB_TOKEN` fell back to the repo/org default — which doesn't include `issues: write` on this repo. Added an explicit, minimal workflow-level default (`contents: read`) plus a per-job `issues: write` grant on exactly the two jobs that open issues (`cve-check` on critical/high CVEs, `production-smoke` on a failed smoke test) — least-privilege rather than a blanket write-all token.

### Known issue — needs a local step, not fixable by editing files
- **`npm ci` failing: "Missing: react@19.2.7, react-dom@19.2.7, scheduler@0.27.0 from lock file."** `package.json` now specifies React 19.2.7 (bumped from 18.3.1 — bring `package.json` here in line) but `package-lock.json` was never regenerated to match, so `npm ci`'s strict lockfile-sync check correctly refuses to install. This can't be fixed by editing files in this environment — a real `npm install` run against the live npm registry is required to produce a valid lockfile, and this sandbox has no network access. **Action required:** run `npm install` (repo root) and `cd qa && npm install` locally, then commit the regenerated `package-lock.json` / `qa/package-lock.json`. Also worth running `npm run test:all` once locally afterward in case anything in the QA suite assumed React 18 behavior (unlikely, but cheap to check before the next CI run).

---

## [1.0.6] — 2026-07-09 — Performance budget failure: total JS bundle 2006KB > 2000KB

### Fixed
- **`run-perf-suite.js` FAIL: "Total JS bundle size: 2006KB (budget: 2000KB)"** — 6KB over, but the real story was `motion-vendor` (framer-motion) weighing 118KB for exactly one page's fade/slide-in entrance animations on `RoleSelect.jsx` — the only place framer-motion was used anywhere in the app. `PERFORMANCE.md` had actually flagged this exact swap as a "still worth doing" opportunity already (and separately, incorrectly claimed framer-motion "tree-shakes to ~1 KB in practice" — it measurably didn't). Removed the dependency entirely: the four `motion.div` fade/slide-ins in `RoleSelect.jsx` are now plain `div`s with CSS `@keyframes` (`animate-fade-slide-down`, `animate-fade-slide-up-lg`, `animate-fade-in-delayed` in `index.css`), staggered via inline `animationDelay` — visually identical output, zero JS bytes. Bonus: added a `prefers-reduced-motion` fallback for these animations while touching this code, resolving an existing unchecked item in `ACCESSIBILITY.md`. New bundle total: ~1888KB (112KB of headroom instead of failing by 6KB). Removed `framer-motion` from `package.json` and its `motion-vendor` chunk from `vite.config.js`; updated `PERFORMANCE.md`, `ACCESSIBILITY.md`, and `README.md` references accordingly.

---

## [1.1.0] — 2026-07-09 — UI crawler + visual regression testing

New capability, not a bug fix: automated exploratory-style testing that catches issues real users would hit but scripted flows don't — every page, every role, every visible button, checked automatically instead of relying on someone noticing.

### Added
- **`scripts/extract-routes.js`** — parses `App.jsx`'s `<Route>` tree into a static manifest (`qa/fixtures/routes.json`, 108 routes across 7 portal roles + public). Committed and diffable, regenerated with `node scripts/extract-routes.js`; CI fails loudly if it's out of date with `App.jsx`.
- **`qa/tests/e2e/crawler.spec.js`** — visits every route as every relevant role and fails on: console errors, uncaught JS exceptions, broken images, failed network requests, or a blank page. Runs on every push (`ui-crawler` job in `qa.yml`).
- **`qa/tests/e2e/interaction-crawler.spec.js`** — clicks every visible button/link on every route (bounded to 15/page) and checks for crashes (uncaught error or the ErrorBoundary's "Something went wrong" fallback appearing). One page reload per click makes this the slow one, so it's nightly-only (`interaction-crawler` job in `nightly.yml`), not on every push. A denylist skips destructive-sounding actions (logout, delete, place order, external links) — only ever run against demo mode, never a real backend.
- **`qa/tests/e2e/visual/visual-regression.spec.js`** — screenshots every route and diffs against committed baselines, with animations frozen and live/non-deterministic regions (maps, timestamps) masked. Catches layout/CSS regressions (the exact class of bug found manually in the earlier Super Admin sidebar audit) automatically. **Requires a one-time manual step — see `qa/README.md`'s "First-time setup"**: no baseline screenshots exist yet (can't be generated without a real browser), run `npm run test:visual:update` locally once and commit the resulting PNGs before this check is meaningful in CI.
- **`setu_test_demo_role` localStorage flag** (`AuthContext.jsx`) — demo mode previously always logged in as a hardcoded `role: 'customer'`, so only ~33 of 108 routes were ever reachable without a real backend; every vendor/rider/seva_provider/anchor/admin/super_admin route just redirected to `/login`. This flag (read only when Supabase isn't configured) lets the new crawler/visual suites simulate any role, following the same pattern as the existing `setu_test_unauth` test hook.
- New Playwright projects (`qa/playwright.config.js`): `crawler`, `interaction-crawler`, `visual` — each single-browser (cross-browser-compat isn't the point of these suites, and running them 3× per default browser project would just triple runtime for no signal). Also excluded these, and the pre-existing `a11y` suite, from the 3 default browser projects via `testIgnore` — a11y and the new suites already had (or now have) their own dedicated projects, so they were running redundantly up to 4× before this.
- `qa.yml`: new `ui-crawler` job (crawler + visual regression, every push). `nightly.yml`: new `interaction-crawler` job.
- `qa/package.json` scripts: `test:crawler`, `test:interaction`, `test:visual`, `test:visual:update`, `routes:extract`. Added `test:crawler` and `test:visual` to `test:all` (kept `test:interaction` out — it's the slow nightly one).

---

## [1.1.1] — 2026-07-10 — Generate visual baselines via CI instead of locally

### Added
- **`.github/workflows/generate-visual-baselines.yml`** — manual (`workflow_dispatch`) workflow that installs Playwright's Chromium and runs `npm run test:visual:update` on a real Linux GitHub Actions runner, then commits the resulting baseline screenshots back to the triggering branch automatically.

### Why
Generating the 1.1.0 visual-regression baselines requires a real Chromium browser, which turned out to not be reliably available in a Termux/Android environment even via `proot-distro` — hit, in order: `Unsupported platform: android` (Playwright's own Chromium), then `Unsupported platform: ubuntu26.04-arm64` inside a proot Ubuntu container, then `chromium-browser` (apt) requiring `snapd`, which doesn't function inside `proot-distro` (no real systemd/kernel), then a rolldown-vite native-binding mismatch (`Cannot find module '@rolldown/binding-linux-arm64-gnu'`) after reinstalling node_modules on ARM64 Linux. None of these are fixable from the app side — they're fundamental platform-support gaps in Playwright/Chromium/snapd on this specific device+environment combination.

Running the exact same `npm run test:visual:update` command on GitHub's `ubuntu-latest` runner (x86_64, full systemd, Playwright officially supports it) sidesteps all of it — no local Chromium setup needed at all. **Usage:** GitHub → Actions tab → "SETU — Generate Visual Regression Baselines" → Run workflow → pick branch → Run; pull the resulting commit when it finishes. Re-run any time an intentional UI change needs new baselines.

---

## [1.1.2] — 2026-07-10 — Permanent fix: recurring `npm ci` lockfile-sync failures

Fixes the same `npm ci`/`package-lock.json` failure recurring on essentially every push (documented as a one-off "known issue, needs a local step" in 1.0.5) — this time as a permanent, CI-side fix instead of relying on remembering to run `npm install` locally before every push.

### Root cause
`npm ci` deliberately refuses to install if `package.json` and `package-lock.json` aren't in exact sync — that's the whole point of `ci` vs `install` (fast, deterministic, byte-for-byte reproducible). This project's actual workflow is: edit `package.json` (by hand, via me, or via Dependabot), zip it up, merge, push — without a real npm registry available to regenerate the lockfile at every one of those edit points (this sandbox has no network access, so I can't regenerate a valid lockfile from here either). Every such edit made the committed lockfile drift further from `package.json` (React 18→19, Vite 5→8, etc.), and every push re-triggered the same class of failure in a new shape.

### Fixed
- **All 27 `npm ci` calls across every workflow** (`ci.yml`, `deploy.yml`, `deploy-cloudflare.yml`, `nightly.yml`, `qa.yml`, `generate-visual-baselines.yml`) **replaced with `npm install`.** `npm install` reconciles `package.json` and `package-lock.json` automatically instead of hard-failing on drift — this is the actual permanent fix: CI no longer cares whether the committed lockfile is perfectly in sync, because it just resolves whatever's needed at run time. Trade-off: installs are a little slower than `ci`'s fast path and the committed lockfile stays "descriptive" rather than byte-for-byte authoritative — worth it given how this project's edits actually happen. If you want the stricter/faster `ci` behavior back for a specific job later, that's a deliberate choice to make per-workflow once the lockfile-drift habit is under control, not a default to restore blindly.
- **`.npmrc` (root and `qa/`)** — `legacy-peer-deps=true`, committed once instead of re-declared as a scattered `npm_config_legacy_peer_deps` env var per workflow (which only `qa.yml` had — every other workflow was missing it, which is exactly why the ERESOLVE peer-conflict warnings showed up inconsistently across different jobs). Covers the React 19 vs still-React-18-peer-range packages (`lucide-react@0.383.0`, several `@radix-ui/*` type packages) automatically, everywhere, without needing to remember it per job.

### Recommended (not required anymore, but still good practice)
Periodically run `npm install` (root and `qa/`) on a real machine with network access and commit the regenerated lockfiles — this keeps the lockfile's integrity hashes meaningful for supply-chain verification and keeps installs fast, even though CI no longer strictly requires it to be perfectly current.

---

## [1.2.0] — 2026-07-10 — UI crawler's first real CI run: fixed all 37 false-positive failures

The `ui-crawler` job (added in 1.1.0) ran for real for the first time and failed 37 of 108 routes. Investigated all 37 — every one was a false positive from the same two root causes, not real app bugs.

### Fixed
- **`crawler.spec.js` — every failure was "Console error(s) on `<route>`": `["Failed to load resource: net::ERR_NAME_NOT_RESOLVED", ...]`, on ~35 routes.** Root cause: Chrome's console message for a network-*level* failure (DNS resolution failing, as opposed to an HTTP error status) does **not** include the failing URL in the message text — only the `requestfailed`/`response` events do. `IGNORED_CONSOLE_PATTERNS` was written assuming every ignorable message would contain a matchable domain (`/Failed to load resource.*supabase\.co/`), which structurally can never match this exact Chrome message. Every route's placeholder Firebase/Supabase/Mapbox config in demo mode legitimately can't resolve DNS for those placeholder hostnames — that's expected, not a bug — so this is a real gap in the filter, not a real gap in the app. Added the generic, URL-less Chrome network-failure message patterns (`net::ERR_NAME_NOT_RESOLVED`, `ERR_INTERNET_DISCONNECTED`, `ERR_CONNECTION_REFUSED`, `ERR_FAILED`) to `IGNORED_CONSOLE_PATTERNS` directly — genuinely wrong/unexpected failed requests are still caught separately by the `failedRequests` check, which does filter by URL and wasn't affected by this bug.
- **`crawler.spec.js` — "Broken image(s) on /customer/search": `images.unsplash.com/photo-...`.** `mockData.js` hotlinks real Unsplash photos for demo product images rather than shipping fixtures; Unsplash isn't guaranteed fast/reachable from every CI runner, and that's not an app bug either. Added an `IGNORED_IMAGE_DOMAINS` filter (currently just `images.unsplash.com`) to the broken-image check — same-origin image failures (the app's own assets) still fail the crawl correctly, since those would indicate a real missing file or wrong path. Also added `images.unsplash.com` and `api.mapbox.com` (placeholder token in demo mode) to `IGNORED_FAILED_REQUEST_PATTERNS` for consistency.

### Not a bug — expected, documented behavior
- **`visual-regression.spec.js` failing on every route** with `A snapshot doesn't exist at .../*-visual-linux.png, writing actual.` This is exactly the documented first-time-setup step from 1.1.0/1.1.1 — no baselines have been generated and committed yet. Run the **"SETU — Generate Visual Regression Baselines"** workflow (Actions tab → Run workflow) once, pull the resulting commit, and this stops happening. Not touched in this release since there's nothing to fix in the test itself.

---

## [1.2.1] — 2026-07-11 — UI crawler's second real run: 9 failures, all genuine app bugs this time

Unlike 1.2.0 (37 false positives from the crawler script itself), this run's 9 failures were real — the crawler doing exactly what it's for.

### Fixed
- **Nested `<button>` inside `<button>` on `/customer/language`** (`CustomerLanguage.jsx`'s `LangCard`): React logged `"In HTML, %s cannot be a descendant of <%s>."` — the whole language card was a `<button>` (tap-to-select), with a "Listen" sample-audio `<button>` nested inside it (already needed an `e.stopPropagation()` workaround to avoid double-firing, a sign the markup was wrong). Invalid HTML aside, nested interactive elements break keyboard navigation and screen-reader semantics — a real accessibility bug, not just a console warning. Changed the outer element to `<div role="button" tabIndex={0}>` with an `onKeyDown` handler (Enter/Space activates it, matching native button behavior), keeping the inner Listen `<button>` intact and no longer nested.
- **Six admin/anchor pages establishing Supabase Realtime subscriptions unconditionally**, regardless of demo mode: `AdminCash`, `AdminMonitoring`, `AdminOrders`, `AdminRiders`, `AdminSupport`, `AnchorVillage`. Each tried to open a WebSocket to the placeholder Supabase URL in demo mode (`wss://placeholder.supabase.co/realtime/...`), failing with `net::ERR_NAME_NOT_RESOLVED`. `useRealtimeNotifications`/`useRealtimeOrders` (the shared hooks) already correctly check `isSupabaseConfigured` before subscribing — these six pages each hand-rolled their own `supabase.channel(...)` effect instead of using the hooks, and none of them carried the same guard over. Added `if (!isSupabaseConfigured) return;` to each realtime `useEffect`.
- **`getAdminVillages()` (`src/lib/api.js`) calling a real Supabase RPC unconditionally**, unlike every other function in that file, which goes through the `safeQuery()` wrapper (which already correctly checks `isSupabaseConfigured`). Failed with `TypeError: Failed to fetch` in demo mode, on both `/admin/villages` (direct caller) and `/admin/banners` (which also calls `getVillages()` for a village-picker dropdown). Added the same `isSupabaseConfigured` guard directly, short-circuiting to `{ data: [], error: null }` in demo mode instead of attempting the network call.

### Note for future admin-page work
The realtime-subscription and `getAdminVillages` gaps above are both instances of the same category of bug: code added during the admin platform expansion that talks to Supabase directly instead of through the established `safeQuery()`/hook patterns, and so misses the demo-mode guard those patterns provide for free. If you add a new admin page with its own `supabase.channel()` or `supabase.rpc()` call, prefer `safeQuery()` (queries) or an explicit `if (!isSupabaseConfigured) return;` (realtime effects) rather than calling `supabase` directly — this exact class of bug will keep recurring otherwise, and the crawler will keep finding it one route at a time rather than it being structurally prevented.

---

## [1.2.2] — 2026-07-11 — UI crawler's third real run: down to 1 failure (Mapbox placeholder token)

### Fixed
- **`crawler.spec.js` — last remaining false positive: "Console error(s) on /anchor/village"**, `["Failed to load resource: the server responded with a status of 401 ()", "[VillageMap] Mapbox error: ... invalid Mapbox access token ..."]`. `VillageMap.jsx` correctly logs Mapbox init failures via `console.error('[VillageMap] Mapbox error:', ...)` — good practice — but in CI, `VITE_MAPBOX_TOKEN` is intentionally a placeholder (`pk.placeholder`), so Mapbox's real API correctly rejects it with a genuine 401. This is the same category as the Firebase/Supabase placeholder-config noise fixed in 1.2.0/1.2.1, just a real HTTP status instead of a DNS failure this time — also revealed that Chrome's generic "responded with a status of NNN" console message can lack a URL too, not just DNS-failure messages (corrected an inaccurate comment about this in `crawler.spec.js`). Added the exact `[VillageMap] Mapbox error` message (and `RiderNavigationMap`'s identical pattern, proactively, since it wasn't hit yet but uses the same message format and would hit the same issue on a rider map route) and the generic 401 message to `IGNORED_CONSOLE_PATTERNS`.

Three consecutive real CI runs of the crawler have now gone 37 failures → 9 → 1 → (expected) 0, entirely by fixing either the test script's blind spots or genuine app gaps it found — this is the crawler doing exactly what it was built for.

---

## [1.2.3] — 2026-07-11 — Interaction crawler's first real run: 68 failures, both test-environment artifacts

`interaction-crawler.spec.js` (nightly-only, clicks every button — see 1.1.0) ran for real for the first time and failed 68 tests across every portal. Investigated all of them; both root causes are test-environment limitations, not real app bugs.

### Fixed
- **"Go back" (174 occurrences across ~68 routes) — `"Failed to read the 'localStorage' property from 'Window': Access is denied for this document."`** Every route this suite tests is a *fresh* `page.goto()` with no real prior page in that browser context's history. Clicking "Go back" as the first interaction on such a page navigates to `about:blank` instead of a real previous page — there was never a real one to go back to. Once on `about:blank` (an opaque/null origin), any subsequent `localStorage` access throws a `SecurityError`, which surfaces as a false "crashed the page" failure. This isn't something a simple click-crawler can meaningfully test without simulating a realistic browsing history first, so "Go back"/"Back"/"Previous page" buttons are now skipped — added to `DENYLIST_PATTERN` in `interaction-crawler.spec.js`.
- **"Copy Code" (6 occurrences) — `"Failed to execute 'writeText' on 'Clipboard': Write permission denied."`** Headless Chrome doesn't grant `clipboard-write` by default even on a synthetic click, unlike a real user's browser session responding to a genuine click gesture. Rather than denylisting copy-to-clipboard buttons (a real, safe, worth-testing UI action — unlike "Go back", this one *can* be tested meaningfully), granted `permissions: ['clipboard-read', 'clipboard-write']` on the `interaction-crawler` Playwright project in `qa/playwright.config.js`, so these buttons now get exercised for real instead of skipped or false-failing.

---

## [1.3.0] — 2026-09-02 — Pass 5 forensic-audit remediation

Remediates the P0/P1/P2/P3 findings from the four-pass forensic audit
(`SETU-PASS1-DISCOVERY-REPORT.md` through `SETU-PASS4-FORENSIC-AUDIT-FINAL-REPORT.md`).
Full evidence trail in `SETU-PASS5-REMEDIATION-REPORT.md`.

### Fixed
- `assign_role` — was `service_role`-only with no re-grant, making Super Admin role
  assignment completely non-functional for everyone including legitimate super admins.
  Re-gated with a self-escalation block and target validation (mirroring the existing
  `ban_user`/`unban_user` fix from `migration_025`) and granted to `authenticated`
  (`migration_054`).
- Coupon redemption race — concurrent checkout requests against the same coupon code
  could both pass the per-user/global usage-limit check before either committed,
  over-redeeming a limited-use coupon. `create_order` now takes a row lock on the
  coupon before validating/redeeming it (`migration_053`).
- `cancel_order_with_refund` double-refund race, found during this pass's required
  full audit of that function — concurrent cancellation attempts on the same order
  could both pass the cancellable-status check before either committed, triggering two
  refunds. Now row-locks the order first (`migration_055`).
- `pay_from_wallet` retry idempotency — a client retry (e.g. after a network timeout)
  could debit a wallet twice for one logical operation. Now idempotent per
  (wallet, order reference), backed by a partial unique index (`migration_056`).
- `CustomerVoice.jsx` called a non-existent `AIAPI.transcribeVoice()` method (the API
  only exports `voiceQuery`) and had no real microphone capture at all — every real use
  threw. Rewired to real browser `SpeechRecognition` capture → the existing, correct
  `AIAPI.voiceQuery` → the real `ai-assistant` Edge Function, with unsupported-browser
  and permission-denied states handled honestly. Suggested phrases now go through the
  same real call instead of returning a hardcoded fake "AI result".
- `store_aadhaar`/`decrypt_aadhaar` — found during this pass to have been missed by
  `migration_035`'s PUBLIC-execute lockdown, making them callable directly by any
  authenticated client (`store_aadhaar` has no internal role check, only an ownership
  filter, so a user could write an unverified raw Aadhaar number into their own KYC
  record, bypassing the intended SurePass flow). EXECUTE now revoked from
  PUBLIC/authenticated/anon and not re-granted to anyone (`migration_058`).
- Added `set search_path = public` to four `SECURITY DEFINER`/trigger functions that
  were missing it: `topup_wallet`, `set_default_address`, `_set_internal_payment_flag`,
  `update_updated_at` (`migration_057`).
- Stale code comment in `supabase/functions/razorpay-webhook/index.ts` incorrectly
  implied no `credit_wallet` function exists in this migration tree; corrected to
  explain it exists as an internal refund-only helper, distinct from the legacy,
  top-up-purpose function of the same name that only ever lived in the (non-deployed)
  `database/` tree.

### Changed
- `CustomerReferral.jsx` — removed the hardcoded referral code and fabricated
  friend/earnings data (no `referrals` table or backend has ever existed for this
  screen). Now always shows a truthful "coming soon" state with no financial-looking
  numbers, regardless of the `referral` feature flag's value.

### Documentation
- **Reconciling the discrepancy noted in `[1.0.0]`'s "Removed" section above:** a
  four-pass forensic audit of this exact archive (Sept 2026) found
  `database/migrations/007_phase2_hardening.sql`, `qa/.github/workflows/`,
  `audit.json`, and `supabase/functions/important_map.json` all still present,
  contradicting the removal claimed above. This could not be conclusively resolved —
  it is consistent with either this archive being a snapshot taken before that cleanup
  commit was applied, or an incomplete cleanup; no `.git` history was available in
  any pass to distinguish the two. The `leaflet`/`react-leaflet` npm-dependency removal
  claimed in the same section, by contrast, **is** accurate — `package.json` has no
  such dependencies. Documented here rather than silently editing the `[1.0.0]` entry
  above, since this pass cannot confirm which explanation is correct.
- `place_order` (referenced in earlier audit passes as an open "vs. `create_order`"
  question) is confirmed **intentionally retired**, not ambiguous: `migration_035`'s
  own comment states it is "intentionally retired with no legitimate caller" and locks
  it to no grants at all (not even `service_role`). No code change needed; documented
  here for the record.

---

## [1.4.0] — 2026-09-02 — Pass 7 remediation (real wallet checkout path)

Remediates the seven workstreams identified by the Pass 6 independent re-audit
(`SETU-PASS6-INDEPENDENT-REAUDIT-REPORT.md`). Full evidence trail in
`SETU-PASS7-REMEDIATION-REPORT.md`.

### Fixed
- **`pay_order_from_wallet`** (the RPC the live checkout flow actually calls — Pass
  5's `1.3.0` wallet-idempotency fix targeted `pay_from_wallet`, a function with zero
  frontend callers, and never touched this one). Now locks the order row before
  checking its payment status, closing a concurrent-double-debit race, and reports a
  same-order retry after a real success as an explicit `already_paid: true` outcome
  instead of a generic failure — closing a path where a network-timeout retry could
  cause a correctly-paid order to be auto-cancelled-and-refunded (`migration_059`).
- `CustomerCheckout.jsx` / `src/lib/api.js` — updated to read and act on the new
  `already_paid` signal explicitly, as defense-in-depth alongside the RPC-level fix.
- `assign_role` — closed a PUBLIC/`anon` `EXECUTE` grant left open since `1.3.0`'s
  `migration_054` (a `DROP`+`CREATE FUNCTION`, needed for a return-type change, resets
  grants to Postgres's default-to-PUBLIC and was never followed by an explicit
  `REVOKE ... FROM PUBLIC`). Not previously exploitable — every unauthorized caller was
  already rejected by the function's internal checks — but now matches this schema's
  established grant-restriction pattern (`migration_060`).
- `pay_from_wallet` — its idempotency check (added in `1.3.0`) did not verify that a
  replayed request's amount matched the originally-debited amount, meaning a mismatched
  replay could silently report success without moving the requested money. Fixed with
  an explicit amount-match check, both on the normal replay path and the concurrent-race
  path. Kept (not retired) because `qa/sql/rls_permission_guards_test.sql`'s `T2` test
  provides real regression coverage of this function's ownership guard (`migration_061`).
- `src/lib/mockData.js` — removed a fabricated "Referral bonus — Raj Kumar" label from
  demo-mode wallet-history data (demo-mode only, never shown to real users, but a loose
  end relative to `1.3.0`'s referral-page cleanup).

### Verified, no change required
- Completed the RLS policy-body sweep to 59/59 tables (up from `1.3.0`'s ~27 and Pass
  6's ~33) — the remaining ~26 tables (notification/campaign/admin-config/reporting)
  were read in full this pass and found correctly ownership/permission/admin-scoped,
  with no `USING(true)` on any sensitive table. No additional RLS defect found.
- OPS-01 (the trigger mechanism for `vendor-payout`/`dispatch-notifications`) remains
  genuinely unresolved — this requires live Supabase project/deployment access this
  environment does not have, and was correctly left undiagnosed rather than guessed at,
  consistent with `1.3.0`.



Consolidated from `SECURITY_FIXES.md` ("Round 2" audit response) and prior sessions. Grouped by theme, not chronological.

### Payments & money integrity
- Server-side reconciliation of payment amounts against `orders.total` in `create-razorpay-order` and the Razorpay webhook — client-supplied amounts are no longer trusted.
- `payment.captured` webhook now flags (rather than silently accepts) amount mismatches for manual review instead of auto-releasing escrow.
- Wallet ownership, wallet-minting, and escrow-debit guard vulnerabilities found and fixed (migrations `016`, `037`).
- Order write-path fully locked down to `SECURITY DEFINER` RPCs (`claim_order`, `admin_assign_rider`, `rate_order`); unrestricted client `UPDATE` policies on `orders` dropped (migration `050`).

### Auth & access control
- All Edge Functions now require authentication via `_shared/auth.ts` (`requireUser`, `requireInternalOrAdmin`, `isInternalServiceCall`) except the HMAC-verified Razorpay webhook.
- `--no-verify-jwt` restricted to only the Razorpay webhook function (was previously blanket-applied).
- Dynamic RBAC, `EXECUTE` privilege lockdown on money/escrow/internal RPCs (migrations `021`, `035`).
- Admin privilege-escalation vulnerability in RLS policies found and fixed.

### KYC & identity
- Aadhaar dev-mode bypass no longer client-triggerable; gated behind a server-only `ALLOW_KYC_DEV_BYPASS` secret that must never be set in production.
- Aadhaar data encrypted at rest via `pgcrypto` / Supabase Vault.

### Infrastructure
- CORS hardened across all Edge Functions — replaced wildcard `Access-Control-Allow-Origin: *` with an explicit allow-list (`_shared/cors.ts`).
- Silent demo-mode auto-login fallback removed; app now fails closed (shows a configuration-error screen) unless `VITE_DEMO_MODE=true` is explicitly set.
- Sensitive profile columns (`is_verified`, etc.) made non-self-updatable.
- Migrated production hosting target from GitHub Pages to Cloudflare Pages (feature-flagged rollout) for WAF/CSP support — see `HOSTING.md`.

### Admin platform
- Seven new production database tables; six new admin pages (incidents, refunds, promotions, settlements, rider incentives, inventory).
- Server-side `SECURITY DEFINER` aggregate RPCs for admin dashboards/analytics (migrations `044`, `046`, `047`, `048`) — no raw table downloads to the browser.
- PostgreSQL SLA-breach detection function via `pg_cron`.
- Super Admin panel (17 pages) UI audit: fixed broken Tailwind sidebar color classes, sticky-header collisions across 15 pages, desktop width constraints, hardcoded placeholder data in unwired pages.

### QA & CI/CD
- Full QA pipeline built: Vitest (unit/integration), Playwright (e2e + accessibility via axe-core), k6 (load testing), 15 SQL security/regression proof files.
- Bundle optimization: route-level lazy loading across every portal, `framer-motion`/`recharts` isolated into separate chunks, deferred Firebase load until push-notification opt-in.
- i18n system covering Hindi, Maithili, Bhojpuri, English.

---

## [0.1.0] — Initial buildout

- Initial React/Vite scaffold, mock-data-only demo across 7 portals (Customer, Vendor, Rider, Seva, Anchor, Admin, Super Admin) + onboarding flows.
- Full PostgreSQL schema (18 tables), RLS policies, atomic RPCs (`place_order`, `pay_from_wallet`).
- Real Supabase backend, Razorpay Edge Functions, Realtime hooks, FCM push, Whisper transcription, Anthropic API integration replacing the original stub.
