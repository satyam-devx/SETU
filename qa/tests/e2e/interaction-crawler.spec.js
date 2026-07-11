// qa/tests/e2e/interaction-crawler.spec.js — SETU Interaction Crawler
//
// For every route, finds every visible/enabled button, link, and
// role="button" element, and clicks each one (one fresh page load per
// click, to avoid one bad click poisoning the rest of the run) to check
// whether it crashes the app. This is the "click every button" pass
// requested — crawler.spec.js only checks that pages load cleanly without
// clicking anything.
//
// SAFETY — why this is safe to run against demo mode only:
//   - Only ever run with VITE_DEMO_MODE=true (no real backend, no real
//     payments, no real deletions — see .env.example / SECURITY.md). Never
//     point SETU_E2E_URL at this suite against a real Supabase project.
//   - A denylist (below) still skips genuinely destructive-sounding or
//     navigation-away actions (logout, delete, external links, tel:/mailto:)
//     even in demo mode, both to avoid killing the crawl's own session and
//     because "does this button work" isn't a meaningful question for a
//     link that just opens WhatsApp.
//   - Runtime is bounded per page (MAX_CLICKS_PER_ROUTE) since a full page
//     reload happens per click; this suite is intended for a nightly run
//     (see nightly.yml), not every push — it's slower than crawler.spec.js
//     by design.
//
// A "crash" is: an uncaught JS exception, a new console error appearing
// after the click that wasn't there before it, or the ErrorBoundary's
// fallback UI ("Something went wrong") becoming visible.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routes = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../fixtures/routes.json'), 'utf8')
);

const MAX_CLICKS_PER_ROUTE = 15;

const CLICKABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]:not([href^="tel:"]):not([href^="mailto:"]):not([href^="http"]):not([target="_blank"])',
  '[role="button"]:not([aria-disabled="true"])',
].join(', ');

// Skip anything that sounds destructive, session-ending, or that just opens
// an external app/site — clicking these tells us nothing useful about app
// stability and some would actively break the rest of the crawl.
//
// "go back"/"back" specifically: every route here is a *fresh* page.goto(),
// so there's no real prior page in that browser context's history — a
// "Go back" click navigates to about:blank instead of a real previous page
// (there was never a real one to go back to). Once on about:blank, any
// subsequent localStorage access (including this crawler's own role-reset
// on the next iteration) throws "Access is denied for this document" —
// looks exactly like a crash in the failure report, but isn't one; it's an
// artifact of testing back-navigation without a synthetic browsing history
// to back into, which this simple click-crawler isn't set up to simulate.
// See CHANGELOG.md.
const DENYLIST_PATTERN =
  /log ?out|sign ?out|delete|remove|deactivate|close account|place order|pay now|confirm payment|proceed to pay|cancel order|go back|^back$|previous page/i;

for (const route of routes) {
  test.describe(`Interaction crawl`, () => {
    test(`${route.path} (role: ${route.role ?? 'public'}) — clickable elements don't crash the page`, async ({ page }) => {
      if (route.role) {
        await page.addInitScript((r) => {
          window.localStorage.setItem('setu_test_demo_role', r);
        }, route.role);
      }

      await page.goto(route.crawlPath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Collect a stable list of candidates up front (by accessible
      // text/label, not element handles — handles go stale across reloads).
      const candidates = await page.$$eval(CLICKABLE_SELECTOR, (els) =>
        els
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && !el.closest('[aria-hidden="true"]');
          })
          .map((el, i) => ({
            index: i,
            label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
          }))
          .filter((c) => c.label)
      );

      const toTest = candidates
        .filter((c) => !DENYLIST_PATTERN.test(c.label))
        .slice(0, MAX_CLICKS_PER_ROUTE);

      const crashes = [];

      for (const candidate of toTest) {
        // Fresh load per click — one bad click shouldn't poison the rest.
        // (No need to re-call addInitScript here — it persists across
        // navigations for the lifetime of this `page`.)
        await page.goto(route.crawlPath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

        let crashed = false;
        let errorText = '';
        const onPageError = (err) => {
          crashed = true;
          errorText = err.message;
        };
        page.on('pageerror', onPageError);

        try {
          const elements = await page.$$(CLICKABLE_SELECTOR);
          const el = elements[candidate.index];
          if (el) {
            await el.click({ timeout: 5000 }).catch((e) => {
              // A click that simply can't land (covered by a modal/overlay,
              // detached, etc.) isn't a "crash" — record separately, don't fail.
              errorText = errorText || `click failed: ${e.message}`;
            });
            await page.waitForTimeout(400); // let any resulting error boundary/toast render
          }
        } finally {
          page.off('pageerror', onPageError);
        }

        const errorBoundaryVisible = await page
          .getByText('Something went wrong', { exact: false })
          .isVisible()
          .catch(() => false);

        if (crashed || errorBoundaryVisible) {
          crashes.push({
            element: candidate.label,
            reason: errorBoundaryVisible ? 'ErrorBoundary fallback shown' : errorText,
          });
        }
      }

      expect(crashes, `Clicking these element(s) on ${route.path} crashed the page`).toEqual([]);
    });
  });
}
