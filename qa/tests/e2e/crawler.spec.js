// qa/tests/e2e/crawler.spec.js — SETU UI Crawler
//
// Visits every route in qa/fixtures/routes.json (generated from App.jsx by
// scripts/extract-routes.js) as a real browser would, and fails a route if
// it finds:
//   - any browser console error
//   - any uncaught JS exception (React error boundary trips, etc.)
//   - any broken image (loaded, 0×0 / failed decode)
//   - any failed network request (4xx/5xx) that isn't an expected one
//   - a blank/empty page (nothing rendered — usually a silent crash)
//
// This does NOT click anything — see interaction-crawler.spec.js for the
// (separate, riskier) click-every-button pass. Keeping "does it load
// cleanly" and "does clicking things break it" as separate suites makes
// failures much easier to triage: a crawler.spec.js failure means the page
// itself is broken; an interaction-crawler.spec.js failure means a specific
// interactive element is broken.
//
// Runs against every role by setting `setu_test_demo_role` in demo mode
// (see AuthContext.jsx) before navigating, so admin/vendor/rider/etc pages
// are actually reachable and not just redirects to /login.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routes = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../fixtures/routes.json'), 'utf8')
);

// Requests to these are expected to fail/be irrelevant in demo mode (no
// real backend) and shouldn't count as bugs. Match against the request URL.
const IGNORED_FAILED_REQUEST_PATTERNS = [
  /supabase\.co/,          // demo mode has no real Supabase project
  /firebaseinstallations/, // Firebase init in demo mode with placeholder keys
  /fcm\.googleapis/,
  /google-analytics|googletagmanager/,
  /favicon\.ico$/,
];

// Console messages that are expected noise in demo mode / dev builds and
// shouldn't fail the crawl.
const IGNORED_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /\[SETU Auth\]/, // AuthContext's own retry/warning logs are informational
  /Failed to load resource.*supabase\.co/,
];

for (const route of routes) {
  test.describe(`Crawl`, () => {
    test(`${route.path} (role: ${route.role ?? 'public'}) loads cleanly`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
        consoleErrors.push(text);
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      page.on('requestfailed', (req) => {
        const url = req.url();
        if (IGNORED_FAILED_REQUEST_PATTERNS.some((p) => p.test(url))) return;
        failedRequests.push(`${req.failure()?.errorText || 'failed'} — ${url}`);
      });

      page.on('response', (res) => {
        if (res.status() < 400) return;
        const url = res.url();
        if (IGNORED_FAILED_REQUEST_PATTERNS.some((p) => p.test(url))) return;
        failedRequests.push(`${res.status()} — ${url}`);
      });

      if (route.role) {
        await page.addInitScript((r) => {
          window.localStorage.setItem('setu_test_demo_role', r);
        }, route.role);
      }

      await page.goto(route.crawlPath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        // Some pages (realtime maps, polling dashboards) never truly go
        // idle — that's fine, we still get a stable-enough snapshot after
        // the timeout for the checks below.
      });

      // Blank-screen check: something meaningful should be on the page.
      const bodyText = await page.locator('body').innerText().catch(() => '');
      expect(bodyText.trim().length, `${route.path} rendered a blank page`).toBeGreaterThan(0);

      // Broken images: loaded (complete) but failed to decode (naturalWidth 0).
      const brokenImages = await page.$$eval('img', (imgs) =>
        imgs
          .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
          .map((img) => img.src)
      );

      expect(brokenImages, `Broken image(s) on ${route.path}`).toEqual([]);
      expect(consoleErrors, `Console error(s) on ${route.path}`).toEqual([]);
      expect(pageErrors, `Uncaught JS error(s) on ${route.path}`).toEqual([]);
      expect(failedRequests, `Failed network request(s) on ${route.path}`).toEqual([]);
    });
  });
}
