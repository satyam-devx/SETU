// playwright.config.js — SETU E2E test configuration

import { defineConfig, devices } from '@playwright/test';

// Base URL: use local dev server in CI, or override with SETU_E2E_URL
// Must end with a trailing slash: URL resolution treats a base path with no
// trailing slash as a "file" (e.g. ".../SETU") and a relative reference
// replaces it entirely (".../SETU" + "login" → ".../login", losing the
// /SETU subpath), whereas a trailing slash makes it a "directory"
// (".../SETU/" + "login" → ".../SETU/login", correct). This matters for
// GitHub Pages project sites served under a subpath. See fixtures.js and
// CHANGELOG.md.
const RAW_BASE_URL = process.env.SETU_E2E_URL || 'http://localhost:5173';
const BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL : `${RAW_BASE_URL}/`;

export default defineConfig({
  testDir:   './tests/e2e',
  outputDir: './reports/e2e-results',

  // Max time per test (3 min for slow rural-network simulation)
  timeout:       90_000,
  // Fail fast in CI on first failed test within a file
  retries:       process.env.CI ? 2 : 0,
  // Parallelism: limited to avoid flaky tests on shared state
  workers:       process.env.CI ? 4 : 2,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
    // JUnit for GitHub Actions test summary
    ['junit', { outputFile: 'reports/playwright-junit.xml' }],
  ],

  use: {
    baseURL:            BASE_URL,
    // Screenshot on failure
    screenshot:         'only-on-failure',
    // Video for all CI runs (helps debug flakes)
    video:              process.env.CI ? 'retain-on-failure' : 'off',
    // Trace for failures
    trace:              'retain-on-failure',
    // Simulate 3G network for Bihar rural users
    // Enabled via slowMo + throttling in individual test files
    actionTimeout:      15_000,
    navigationTimeout:  30_000,
    // Viewport: mobile-first (most SETU users are on phones)
    viewport:           { width: 390, height: 844 },
    userAgent:          'Mozilla/5.0 (Linux; Android 12; Redmi 9) AppleWebKit/537.36',
  },

  projects: [
    // ── Mobile Chrome (primary — most Bihar users) ──────────────
    {
      name:  'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        locale:   'hi-IN',
        timezone: 'Asia/Kolkata',
      },
      testIgnore: ['**/crawler.spec.js', '**/interaction-crawler.spec.js', '**/visual/**', '**/a11y/**'],
    },

    // ── Desktop Chrome (admin/vendor portals) ───────────────────
    {
      name:  'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        locale:   'hi-IN',
        timezone: 'Asia/Kolkata',
      },
      testIgnore: ['**/crawler.spec.js', '**/interaction-crawler.spec.js', '**/visual/**', '**/a11y/**'],
    },

    // ── Mobile Firefox (broader compatibility) ──────────────────
    {
      name:  'mobile-firefox',
      use: {
        ...devices['Galaxy S9+'],
      },
      testIgnore: ['**/crawler.spec.js', '**/interaction-crawler.spec.js', '**/visual/**', '**/a11y/**'],
    },

    // ── Accessibility: screen reader simulation ──────────────────
    {
      name: 'a11y',
      use: {
        ...devices['Desktop Chrome'],
        // Intentionally no JS disabled — we test with axe-core instead
      },
      testMatch: '**/a11y/**/*.spec.js',
    },

    // ── UI Crawler: every route, checks for console/JS errors, broken
    //    images, failed requests, blank screens. Single browser — this
    //    isn't a cross-browser-compat check, it's a "does the page work"
    //    check, and running it 3× per browser would just triple runtime
    //    for no real signal. See qa/tests/e2e/crawler.spec.js.
    {
      name: 'crawler',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
      testMatch: '**/crawler.spec.js',
    },

    // ── Interaction Crawler: clicks every visible button/link per route.
    //    Slower (one page reload per click) — intended for nightly.yml,
    //    not every push. See qa/tests/e2e/interaction-crawler.spec.js.
    {
      name: 'interaction-crawler',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        // Headless Chrome doesn't grant clipboard-write by default even on
        // a real click, unlike a real user's browser session — without
        // this, every "Copy to clipboard" button (referral codes, etc.)
        // fails with "Write permission denied", which looks like an app
        // crash in the failure report but is a CI-environment permission
        // gap, not a real bug. See CHANGELOG.md.
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      testMatch: '**/interaction-crawler.spec.js',
    },

    // ── Visual regression: screenshot diff every route. Single browser +
    //    fixed viewport is required for stable diffs — screenshots are
    //    OS/renderer-specific, so baselines must be generated on the same
    //    platform they're compared against (the CI runner), not locally
    //    on a different OS. See qa/tests/e2e/visual/visual-regression.spec.js.
    {
      name: 'visual',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/visual/**/*.spec.js',
    },
  ],

  // Dev server: start Vite before running tests only if testing locally
  webServer: (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')) ? {
    command:            'npm run dev',
    cwd:                '../', // SETU project root
    url:                BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout:            120_000,
    env: {
      // Run in demo mode (no real Supabase needed for E2E).
      // VITE_DEMO_MODE must be explicitly set for the app to allow
      // booting without real Supabase env (see CRITICAL-5 fix in
      // src/App.jsx) — it's derived here from whether a real
      // Supabase URL was supplied, so existing CI behavior is
      // unchanged.
      VITE_SUPABASE_URL:      process.env.VITE_SUPABASE_URL      || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      VITE_DEMO_MODE:         process.env.VITE_SUPABASE_URL ? 'false' : 'true',
      VITE_FIREBASE_API_KEY:              'placeholder',
      VITE_FIREBASE_AUTH_DOMAIN:          'placeholder.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID:           'placeholder-project',
      VITE_FIREBASE_STORAGE_BUCKET:       'placeholder.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID:  '000000000000',
      VITE_FIREBASE_APP_ID:               '1:000000000000:web:placeholder',
      VITE_FIREBASE_VAPID_KEY:            'placeholder-vapid',
      VITE_MAPBOX_TOKEN:                  'pk.placeholder',
      VITE_RAZORPAY_KEY_ID:               'rzp_test_placeholder',
    },
  } : undefined,
});
