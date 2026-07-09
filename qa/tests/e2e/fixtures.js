// qa/tests/e2e/fixtures.js — shared Playwright test/expect wrapper
//
// Fixes a real bug: SETU_E2E_URL for the production job is
// "https://satyam-devx.github.io/SETU" (a GitHub Pages *project* site,
// served under the /SETU subpath) but every spec in this suite calls
// page.goto('/login'), page.goto('/customer'), etc. with a leading slash.
//
// Per the WHATWG URL spec, `new URL('/login', 'https://host/SETU')` resolves
// to `https://host/login` — a leading slash is root-relative and DISCARDS
// the baseURL's /SETU path segment entirely. Playwright's `page.goto(url, {
// baseURL })` joins exactly this way, so every one of these tests was
// silently hitting the wrong URL (missing /SETU) once run against the real
// deployed site, landing on GitHub's real 404 page instead of the app —
// this only surfaced against production (SETU_E2E_URL), not in local dev,
// because localhost:5173 has no subpath to lose. See CHANGELOG.md.
//
// Fix: re-export `test` with the `page` fixture's `goto` wrapped to strip a
// leading '/' before delegating, so 'https://host/SETU' + 'login' resolves
// correctly to 'https://host/SETU/login'. True absolute URLs (http://...)
// pass through untouched. This is centralized here instead of editing every
// goto('/...') call site (and the several array-based route lists) so any
// future test written the natural, idiomatic way — page.goto('/whatever') —
// keeps working correctly against both local and subpath-deployed targets.
//
// Usage: replace `import { test, expect } from '@playwright/test'` with
// `import { test, expect } from '../fixtures.js'` (adjust relative path)
// in any spec file that calls page.goto() with an app-relative path.

import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);
    page.goto = (url, options) => {
      const fixed = typeof url === 'string' && url.startsWith('/') ? url.slice(1) : url;
      return originalGoto(fixed, options);
    };
    await use(page);
  },
});

export { expect };
