# SETU QA Pipeline

**Version:** 1.2.3 · **Last updated:** 2026-07-11

Automated quality assurance and security pipeline for the SETU platform.  
Runs on every push and PR. Generates an HTML dashboard. Fails builds when critical issues are found.

---

## Architecture

```
qa/
├── tests/
│   ├── unit/                     # Vitest unit tests
│   │   ├── utils.test.js         # Utility functions, business logic
│   │   └── api.test.js           # API layer contracts, cart logic
│   ├── integration/              # Vitest integration tests
│   │   ├── auth.test.jsx         # Auth flows, ProtectedRoute, role access
│   │   ├── payments.test.js      # Payment state machines, fee splits
│   │   ├── database-security.test.js  # RLS policy simulation
│   │   └── edge-functions.test.js     # Edge function contracts
│   └── e2e/                      # Playwright E2E tests
│       ├── auth.spec.js          # Login page, redirects, 404
│       ├── customer-portal.spec.js    # Customer portal flows
│       ├── role-isolation.spec.js     # Protected route enforcement
│       └── a11y/
│           └── accessibility.spec.js  # axe-core WCAG 2.1 AA audit
├── config/
│   └── vitest-setup.js           # MSW mocks, global test fixtures
├── sql/
│   └── phase1_money_integrity_test.sql  # Real-RPC/RLS money-integrity proof (psql)
├── scripts/
│   ├── run-security-suite.js     # Static security checks
│   ├── run-perf-suite.js         # Bundle size + Core Web Vitals
│   ├── run-a11y-suite.js         # axe-core runner
│   ├── generate-report.js        # Unified HTML dashboard
│   └── validate-migrations.py    # SQL migration validator
├── reports/                      # Generated (git-ignored)
├── .github/workflows/
│   ├── qa.yml                    # Main CI pipeline (push/PR)
│   └── nightly.yml               # Nightly CVE + regression monitor
├── vitest.config.js
├── playwright.config.js
└── package.json
```

---

## Test Coverage

### Unit & Integration (Vitest + MSW)
| Area | Tests |
|------|-------|
| Role → portal path mapping | 7 roles × edge cases |
| Order state machine | All valid/invalid transitions |
| Payment state machine | captured/failed/refunded |
| Cart operations | add, remove, update qty, total |
| RLS policy simulation | profiles, villages, orders, wallets, audit_log |
| Auth OTP validation | phone format, OTP length, error messages |
| Privilege escalation prevention | Self-role elevation blocked |
| Wallet balance | Credit, debit, insufficient funds |
| Credit limits | Limit enforcement, blocked accounts |
| COD reconciliation | Balanced, shortage, excess |
| Platform fee split | 2.5% calculation, vendor majority |
| Pagination | Range calculations |
| Retry backoff | Exponential + jitter + 5s cap |
| Edge function contracts | ai-assistant, razorpay-webhook, vendor-payout, kyc-verify |
| Webhook idempotency | Duplicate event prevention |
| Aadhaar handling | Validation, no plaintext storage |

### E2E (Playwright — Mobile Chrome + Desktop)
| Flow | Tests |
|------|-------|
| Login page loads | No errors, phone input present |
| All protected routes redirect | 9 portal root routes + deep links |
| Admin sub-routes protected | 9 admin routes |
| Superadmin sub-routes protected | 6 routes |
| Onboarding pages load | 4 routes |
| 404 page renders | Unknown routes |
| Mobile viewport usability | 390px, button tap targets |
| No horizontal overflow | Mobile layout check |
| No broken images | Login page |
| Security headers | No X-Powered-By |
| Error boundary | Deep-link to fake UUID |

### UI Crawler (every route, every role — qa/tests/e2e/crawler.spec.js)

Visits all 108 routes (`qa/fixtures/routes.json`, generated from `App.jsx`
by `scripts/extract-routes.js`) as every relevant role, and fails a route
on: console errors, uncaught JS exceptions, broken images, failed network
requests, or a blank page. Runs on every push (`ui-crawler` job in
`qa.yml`). Regenerate the manifest whenever routes change:

```bash
node scripts/extract-routes.js   # run from repo root
```

CI verifies the committed manifest is up to date and fails with a clear
message if it isn't.

### Visual Regression (every route — qa/tests/e2e/visual/)

Screenshots every route and diffs against committed baselines
(`qa/tests/e2e/visual/visual-regression.spec.js-snapshots/`). Catches
layout/CSS regressions (like the Super Admin sidebar bugs found in an
earlier manual audit) automatically instead of relying on someone noticing.

**First-time setup (required, not automatic):** this suite ships with no
baseline screenshots — Playwright needs a real Chromium browser to generate
them.

**Recommended: generate them via CI, not locally.** GitHub → Actions tab →
**"SETU — Generate Visual Regression Baselines"** → Run workflow → pick your
branch → Run. It installs Chromium on a real Linux runner, generates the
baselines, and commits them back to your branch automatically — no local
browser setup needed. (This path exists because generating them locally on
Android/Termux hit several dead-end platform-support issues — unsupported
Playwright platform, `snapd` not working inside `proot-distro`, rolldown
native-binding mismatches — none of which are fixable from the app side.)

If you're on a regular Linux/macOS/Windows dev machine and want to do it
locally instead:

```bash
cd qa
npx playwright install --with-deps chromium
npm run test:visual:update
```

Either way, review the generated PNGs under `qa/tests/e2e/visual/*-snapshots/`
before committing. After that, any future visual diff shows up as a CI failure
with a rendered before/after/diff image in the Playwright HTML report
artifact. To intentionally update baselines after a real UI change, rerun
`npm run test:visual:update` and review the diff before committing.

### Interaction Crawler (every button, every route — nightly only)

`qa/tests/e2e/interaction-crawler.spec.js` clicks every visible button/link
on every route (bounded to 15 per page) and checks whether the click
crashes the app (uncaught error, or the ErrorBoundary's "Something went
wrong" fallback appearing). One full page reload per click makes this the
slowest suite here, so it runs nightly (`interaction-crawler` job in
`nightly.yml`) rather than on every push. A denylist skips destructive-
sounding actions (logout, delete, place order, external links) — see the
file header for the full list and reasoning. Only ever run this against
demo mode (`VITE_DEMO_MODE=true`), never a real Supabase project.

### Database Money-Integrity Proof (real RPCs + RLS, not mocks)

Unlike the Vitest suites (which test re-implemented logic), `qa/sql/phase1_money_integrity_test.sql`
runs the **actual** migration-017 RPCs and RLS policies against a real Postgres
with Supabase's `auth.uid()` driven by JWT-claim GUCs. It is executable proof
that the audit's three CRITICAL money-trust holes are closed.

| Test | Proves |
|------|--------|
| A — CRITICAL-A | Direct `orders`/`order_items` INSERT denied; `create_order` recomputes totals from `products.price` (client prices ignored) |
| B — CRITICAL-B | Outsiders can't change an order; non-assigned rider can't deliver/self-credit; `p_meta.rider_id` ignored for non-admins |
| C — CRITICAL-C | SETU Credit discount rejected without a funded active account; recorded as a real drawdown when granted |
| D — payment divergence | `pay_order_from_wallet` charges the authoritative server total and credits vendor escrow atomically |
| E — fee single-source | changing `platform_config` commission makes `create_order` produce a different total (fees are config-driven via `get_fee_config()`, not hardcoded) |

A second file, `qa/sql/rls_permission_guards_test.sql`, proves the migration
013/014/016 hardening the same way: `topup_wallet` revoked from `authenticated`,
`pay_from_wallet` ownership guard, role/`is_verified` self-escalation blocked by
RLS, `upsert_platform_config` admin-only, and `set_default_address` ownership.

Run them locally (needs Docker + the Supabase CLI):

```bash
# from repo root
supabase start                         # applies all migrations, incl. 017/018
cd qa
npm run test:db-integrity              # runs BOTH proof scripts; each rolls back
```

Or directly:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -v ON_ERROR_STOP=1 -f qa/sql/phase1_money_integrity_test.sql
```

The whole script runs in one transaction and **ends with `ROLLBACK`**, so it
leaves your database untouched. A passing run prints
`✅ ALL PHASE-1 MONEY-INTEGRITY TESTS PASSED`; any failed assertion aborts the
run (it's strictly pass/fail). In CI this is the `db-integrity-tests` job in
`.github/workflows/ci.yml`, which spins up a local Supabase on every push/PR.

### Security Checks
| Category | Checks |
|----------|--------|
| Secret scan | No committed API keys / JWTs |
| npm audit | High + critical CVEs |
| Source code patterns | eval(), dangerouslySetInnerHTML, document.write, service_role in frontend |
| Environment config | No .env committed, HTTPS URLs |
| Transport security | HTTPS-only, Razorpay script, OAuth callback URL |
| Database security | RLS on all tables, WITH CHECK on INSERT, Aadhaar encryption |
| Edge function security | HMAC signature verification, Vault secrets, CORS headers |

### Accessibility (axe-core WCAG 2.1 AA)
Audits: Login, OTP Verify, Register, Privacy Policy, Terms, Role Error  
Critical rules enforced: `color-contrast`, `label`, `button-name`, `link-name`, `image-alt`, `heading-order`

### Performance Budgets
| Metric | Budget |
|--------|--------|
| Total JS bundle | ≤ 800 KB |
| Largest JS chunk | ≤ 500 KB |
| First Contentful Paint | ≤ 1800 ms |
| Largest Contentful Paint | ≤ 2500 ms |
| index.html size | ≤ 10 KB |

---

## Installation

### Step 1: Add the qa/ directory to your SETU repo

```bash
# From your SETU repo root:
cp -r /path/to/setu_qa_pipeline ./qa
```

### Step 2: Install dependencies

```bash
cd qa
npm install
npx playwright install --with-deps chromium firefox
```

### Step 3: Add GitHub Secrets

These are already needed by your existing CI — no new secrets required.  
The QA pipeline uses the same secrets as `ci.yml` and `deploy.yml`.

Optional new variable for post-deploy E2E:
```
PROD_URL = https://satyam-devx.github.io/SETU
```

### Step 4: Copy workflow files

```bash
cp qa/.github/workflows/qa.yml      .github/workflows/
cp qa/.github/workflows/nightly.yml .github/workflows/
```

### Step 5: Update package.json paths (if needed)

The QA pipeline expects to be in `./qa/` relative to SETU root.  
If you put it elsewhere, update `QA_DIR: qa` in both workflow files.

---

## Running Locally

```bash
cd qa

# All tests (requires Vite dev server running)
npm run test:all

# Unit + integration only (no server needed)
npm run test:coverage

# E2E (starts Vite dev server automatically)
npm run test:e2e

# E2E with visual UI
npm run test:e2e:ui

# Security audit only
npm run test:security

# Accessibility audit (requires server)
npm run test:a11y

# Performance audit (requires npm run build first)
npm run test:perf

# Generate HTML report from latest results
npm run report
```

The HTML report is at `qa/reports/qa-dashboard.html`.

---

## CI/CD Integration

### What triggers what

| Event | Jobs |
|-------|------|
| Push to any branch | setup → unit-tests + security (parallel) → e2e + a11y + performance (parallel) → report |
| PR to main/staging | Same + posts summary comment |
| Push to main | All above + post-deploy E2E against PROD_URL |
| Nightly 02:00 IST | CVE scan + production smoke + bundle regression + RLS audit |

### Pass/fail gates

The `report` job's final step gates the whole pipeline:
- Unit tests fail → ✗ blocks
- Security checks fail → ✗ blocks  
- E2E tests fail → ✗ blocks
- A11y failures → ⚠ warns (critical pages block)
- Performance failures → ⚠ warns

---

## Extending the Pipeline

### Add a new unit test
Create a file in `tests/unit/` or `tests/integration/` — Vitest picks it up automatically.

### Add a new E2E spec
Create `tests/e2e/my-feature.spec.js` — Playwright picks it up automatically.

### Add a new security check
Add an entry to `SOURCE_CHECKS` or `DB_CHECKS` in `scripts/run-security-suite.js`.

### Add a new performance budget
Add an entry to `BUNDLE_BUDGETS` or `PAGE_BUDGETS` in `scripts/run-perf-suite.js`.

### Test a new portal
Add its protected routes to `PROTECTED_ROUTES` in `tests/e2e/role-isolation.spec.js`.

---

## Reports

After every run, the following artifacts are uploaded to GitHub Actions:

| Artifact | Contents |
|----------|----------|
| `qa-report-{sha}` | `qa-dashboard.html` — unified HTML dashboard |
| `coverage-{sha}` | Istanbul HTML coverage report |
| `playwright-results-{sha}` | HTML traces + screenshots + JSON |
| `security-report-{sha}` | security-report.json + npm-audit.json |
| `a11y-report-{sha}` | Violations by page |
| `perf-report-{sha}` | Bundle sizes + Core Web Vitals |

Artifacts are retained for 14–30 days depending on type.

---

## Tool Stack

| Tool | Version | Purpose |
|------|---------|---------|
| [Vitest](https://vitest.dev) | ^1.6.0 | Unit & integration tests |
| [@testing-library/react](https://testing-library.com) | ^16.0.0 | React component testing |
| [MSW (Mock Service Worker)](https://mswjs.io) | ^2.3.1 | API mocking |
| [Playwright](https://playwright.dev) | ^1.44.0 | E2E browser automation |
| [axe-core](https://www.deque.com/axe/) | ^4.9.1 | WCAG accessibility audit |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | ^2.0.1 | axe + Playwright integration |
| [jsdom](https://github.com/jsdom/jsdom) | ^24.1.0 | DOM environment for Vitest |

All tools are open-source and free. No paid services required.
