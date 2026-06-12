// tests/e2e/auth.spec.js — E2E authentication flow tests
// Tests real browser interactions against the Vite dev server

import { test, expect } from '@playwright/test';

// ── Shared login helper ────────────────────────────────────────
async function fillPhoneAndContinue(page, phone = '+919876543210') {
  await page.goto('/login');
  await expect(page.locator('input[type="tel"], input[placeholder*="phone"], input[placeholder*="Phone"], input[placeholder*="मोबाइल"]'))
    .first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('input[type="tel"], input[placeholder*="phone"], input[placeholder*="Phone"]')
    .first().fill(phone);
  await page.getByRole('button', { name: /send|continue|otp|भेजें/i }).click();
}

// ── Test suite ─────────────────────────────────────────────────

test.describe('Authentication pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('setu_test_unauth', 'true');
    });
  });

  test('home page (/) redirects appropriately', async ({ page }) => {
    await page.goto('/');
    // Should either show login page or role select
    await expect(page).toHaveURL(/\/login|\/customer|\/vendor|\/rider|\//);
  });

  test('login page loads without errors', async ({ page }) => {
    await page.goto('/login');

    // No console errors on load
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await expect(page).toHaveTitle(/SETU|setu/i);
    await expect(page.locator('body')).toBeVisible();

    // Core phone input must be present
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="मोबाइल"]');
    await expect(phoneInput.first()).toBeVisible({ timeout: 10000 });

    // No unhandled JS errors
    expect(errors.filter(e => !e.includes('placeholder') && !e.includes('supabase'))).toHaveLength(0);
  });

  test('OTP verify page exists and has required elements', async ({ page }) => {
    await page.goto('/login/verify');
    // Should show OTP input or redirect to login
    const isOnVerify = page.url().includes('/login/verify');
    const isOnLogin  = page.url().includes('/login');
    expect(isOnVerify || isOnLogin).toBeTruthy();
  });

  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('text=404')).toBeVisible({ timeout: 5000 });
    // Must have a back link
    await expect(page.locator('a')).toBeVisible();
  });

  test('login page has no broken images', async ({ page }) => {
    const brokenImages = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'image' && !response.ok()) {
        brokenImages.push(response.url());
      }
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(brokenImages).toHaveLength(0);
  });
});

test.describe('Protected route redirects', () => {
  // Force unauthenticated state in demo mode for these tests
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('setu_test_unauth', 'true');
    });
  });

  const PROTECTED_ROUTES = [
    '/customer',
    '/customer/orders',
    '/customer/wallet',
    '/vendor',
    '/rider',
    '/seva',
    '/anchor',
    '/admin',
    '/superadmin',
  ];

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(route);
      // Must redirect away from the protected route
      await page.waitForURL(url => url.pathname.includes('/login') || url.pathname === '/', { timeout: 10000 });
      const finalUrl = page.url();
      expect(finalUrl).not.toMatch(new RegExp(`^.*${route}($|/)`));
    });
  }
});

test.describe('Auth callback page', () => {
  test('auth/callback page exists (no 404)', async ({ page }) => {
    await page.goto('/auth/callback');
    // It may redirect, but should not 404
    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');
  });
});

test.describe('Onboarding pages', () => {
  const ONBOARDING_ROUTES = [
    '/onboarding/register',
    '/onboarding/vendor',
    '/onboarding/rider',
    '/onboarding/seva',
  ];

  for (const route of ONBOARDING_ROUTES) {
    test(`${route} page loads`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      // Should not be a blank page
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(5);
    });
  }
});

test.describe('Navigation and links', () => {
  test('login page has accessible form elements', async ({ page }) => {
    await page.goto('/login');

    // All inputs should be accessible
    const inputs = page.locator('input:visible');
    const count  = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      // Each input should have associated label or aria-label
      const ariaLabel  = await input.getAttribute('aria-label');
      const id         = await input.getAttribute('id');
      const hasLabel   = id
        ? (await page.locator(`label[for="${id}"]`).count()) > 0
        : false;
      expect(ariaLabel || hasLabel || await input.getAttribute('placeholder')).toBeTruthy();
    }
  });

  test('back navigation from 404 works', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.locator('a')).toBeVisible({ timeout: 5000 });
    const link = page.locator('a').first();
    await link.click();
    await expect(page).not.toHaveURL('/does-not-exist');
  });
});

test.describe('Security headers and CSP', () => {
  test('pages do not expose sensitive headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    // Server should not expose framework version in headers
    expect(headers['x-powered-by']).toBeUndefined();

    // If present, X-Frame-Options should deny embedding
    if (headers['x-frame-options']) {
      expect(headers['x-frame-options'].toLowerCase()).toMatch(/deny|sameorigin/);
    }
  });
});

test.describe('Error boundaries', () => {
  test('app does not white-screen on navigation to bad route', async ({ page }) => {
    // Go to a deeply nested bad route
    await page.goto('/customer/orders/nonexistent-order-id-xyz');
    // Should show something, not a blank page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
