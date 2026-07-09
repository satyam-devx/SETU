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

## [Unreleased history] — Security hardening (pre-1.0.0)

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
