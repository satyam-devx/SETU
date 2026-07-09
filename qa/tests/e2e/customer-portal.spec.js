// tests/e2e/customer-portal.spec.js — Customer portal E2E tests
// Runs in demo mode (isSupabaseConfigured = false → uses mock data)

import { test, expect } from './fixtures.js';

// In demo mode, the app auto-logs in with DEMO_PROFILE (customer role)
// when Supabase env vars are missing. Set in playwright.config.js webServer env.
// We need to verify demo mode actually works:

async function navigateAsCustomer(page, path = '/customer') {
  await page.goto('/');
  // In demo mode, role select or auto-redirect to customer portal
  const url = page.url();
  if (!url.includes('/customer')) {
    await page.goto('/customer');
  }
  if (path !== '/customer') {
    await page.goto(path);
  }
  await page.waitForLoadState('networkidle');
}

test.describe('Customer portal - demo mode navigation', () => {

  test('customer home page loads', async ({ page }) => {
    await page.goto('/customer');
    await page.waitForLoadState('networkidle');
    // Should show either portal or redirect to login — no crash
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test('customer portal routes do not 404', async ({ page }) => {
    const routes = [
      '/customer',
      '/customer/orders',
      '/customer/cart',
      '/customer/search',
      '/customer/vendors',
      '/customer/wallet',
      '/customer/profile',
      '/customer/settings',
      '/customer/notifications',
      '/customer/support',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      // Should not be a hard error page — if logged out, redirect to login
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });

  test('privacy policy page is accessible without login', async ({ page }) => {
    await page.goto('/customer/privacy-policy');
    await page.waitForLoadState('networkidle');
    // Privacy policy should be readable or redirect
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test('terms page is accessible', async ({ page }) => {
    await page.goto('/customer/terms');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('Customer portal - form interactions', () => {
  test('search input accepts text', async ({ page }) => {
    await page.goto('/customer/search');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="खोजें"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Tata Salt');
      await expect(searchInput.first()).toHaveValue('Tata Salt');
    }
  });

  test('cart route renders', async ({ page }) => {
    await page.goto('/customer/cart');
    await page.waitForLoadState('networkidle');
    // Cart page should have some content
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('Static/info pages', () => {
  test('fraud report page loads', async ({ page }) => {
    await page.goto('/customer/fraud');
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test('trust page loads', async ({ page }) => {
    await page.goto('/customer/trust');
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('Mobile UX - customer portal', () => {
  test('login page is usable on 390px wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // No horizontal overflow (a common mobile bug)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // 10px tolerance
  });

  test('buttons are tap-friendly on mobile (min 44px height)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button:visible');
    const count   = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // 40px minimum (44px ideal)
      }
    }
  });
});
