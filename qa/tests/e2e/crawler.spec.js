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
  /images\.unsplash\.com/, // demo/mock data hotlinks Unsplash — not always reachable from CI, not an app bug
  /api\.mapbox\.com/,      // demo mode uses a placeholder Mapbox token
];

// Console messages that are expected noise in demo mode / dev builds and
// shouldn't fail the crawl.
//
// IMPORTANT: Chrome's console message for a network-level failure — e.g.
// "Failed to load resource: net::ERR_NAME_NOT_RESOLVED" — does NOT include
// the failing URL in the message text (unlike an HTTP-status failure, which
// does). So a domain-based regex like /supabase\.co/ can never match it;
// the *same* underlying failure also fires as a `requestfailed`/`response`
// event (which DOES have a URL, filtered separately below), but the
// console.error duplicate needs its own message-text-only match. This was
// the root cause of every crawler.spec.js failure in the first real CI
// run — every route's placeholder Firebase/Supabase/Mapbox config in demo
// mode legitimately can't resolve DNS for those placeholder hostnames, and
// each one logs one of these generic, URL-less lines. See CHANGELOG.md.
const IGNORED_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /\[SETU Auth\]/, // AuthContext's own retry/warning logs are informational
  /Failed to load resource.*supabase\.co/,
  /Failed to load resource: net::ERR_NAME_NOT_RESOLVED/,
  /Failed to load resource: net::ERR_INTERNET_DISCONNECTED/,
  /Failed to load resource: net::ERR_CONNECTION_REFUSED/,
  /Failed to load resource: net::ERR_FAILED/,
];

// Demo/mock data (src/lib/mockData.js) hotlinks real product photos from
// Unsplash rather than shipping fixture images. Unsplash isn't guaranteed
// reachable/fast from every CI runner, and a demo photo occasionally being
// slow/unavailable isn't an app bug — only flag broken images that are
// same-origin (the app's own assets), which would indicate a real missing
// file or wrong path.
const IGNORED_IMAGE_DOMAINS = [/images\.unsplash\.com/];

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
      const brokenImages = (await page.$$eval('img', (imgs) =>
        imgs
          .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
          .map((img) => img.src)
      )).filter((src) => !IGNORED_IMAGE_DOMAINS.some((p) => p.test(src)));

      expect(brokenImages, `Broken image(s) on ${route.path}`).toEqual([]);
      expect(consoleErrors, `Console error(s) on ${route.path}`).toEqual([]);
      expect(pageErrors, `Uncaught JS error(s) on ${route.path}`).toEqual([]);
      expect(failedRequests, `Failed network request(s) on ${route.path}`).toEqual([]);
    });
  });
}
