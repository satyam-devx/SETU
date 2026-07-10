// qa/tests/visual/visual-regression.spec.js — SETU Visual Regression
//
// Screenshots every route in qa/fixtures/routes.json and diffs it against a
// committed baseline (qa/tests/e2e/visual/visual-regression.spec.js-snapshots/).
// Catches exactly the class of bug found manually in the Super Admin sidebar
// audit (broken Tailwind classes, sticky-header collisions, layout breaks)
// automatically, on every run, for every page — not just the ones someone
// happens to look at.
//
// First run / after an intentional UI change:
//   npx playwright test --project=visual --update-snapshots
// (run from qa/) then review the diffs in the git status before committing the new
// baselines — a snapshot update should always be a deliberate, reviewed
// step, never blind.
//
// Notes:
//   - Animations are disabled (page.emulateMedia + CSS override below) so
//     the fade/slide-in entrance animations (RoleSelect.jsx) and any toast/
//     skeleton transitions don't cause flaky, timing-dependent diffs.
//   - Live/realtime content (rider location maps, "last updated Xs ago"
//     timestamps) is masked rather than compared pixel-for-pixel, since it's
//     expected to differ between runs by design, not because of a bug.
//   - Runs against demo mode only, same role-simulation approach as
//     crawler.spec.js.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routes = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../fixtures/routes.json'), 'utf8')
);

// Skip routes that are inherently non-deterministic even with masking (e.g.
// nothing to render meaningfully for a bare index redirect) or that are
// exact duplicates of a parent's visual state.
const SKIP_PATHS = new Set([
  '/auth/callback', // transient redirect page, nothing stable to screenshot
]);

test.beforeEach(async ({ page }) => {
  // Freeze CSS animations/transitions so entrance animations, skeleton
  // shimmer, and spinners don't produce flaky screenshot diffs.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
});

for (const route of routes.filter((r) => !SKIP_PATHS.has(r.path))) {
  test.describe(`Visual`, () => {
    test(`${route.path} (role: ${route.role ?? 'public'})`, async ({ page }) => {
      if (route.role) {
        await page.addInitScript((r) => {
          window.localStorage.setItem('setu_test_demo_role', r);
        }, route.role);
      }

      await page.goto(route.crawlPath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Mask elements likely to contain live/non-deterministic content
      // (relative timestamps, live maps, randomized order IDs in demo data)
      // instead of excluding the whole page from visual testing.
      const masks = await page
        .locator('[data-testid="live-map"], [data-testid="relative-time"], .leaflet-container, .mapboxgl-map')
        .all();

      // Derive a filesystem-safe snapshot name from the route path.
      const snapshotName = `${(route.role ?? 'public')}${route.path}`
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '') + '.png';

      await expect(page).toHaveScreenshot(snapshotName, {
        fullPage: true,
        mask: masks,
        maxDiffPixelRatio: 0.02, // small tolerance for anti-aliasing/font hinting differences
        timeout: 10000,
      });
    });
  });
}
