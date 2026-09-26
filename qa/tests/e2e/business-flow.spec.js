import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { BusinessFlowAgent } from '../../agents/business-flow-agent.js';
import { BUSINESS_FLOW_CONFIG } from '../../agents/business-flow.config.js';

const runtime = JSON.parse(fs.readFileSync('reports/business-flow/runtime.json', 'utf8'));
const reportDir = path.resolve('reports/business-flow', runtime.runId);
const agent = new BusinessFlowAgent({ runId: runtime.runId, reportDir, timeoutMs: BUSINESS_FLOW_CONFIG.timeoutMs });

function storageKey() {
  const url = new URL(process.env.VITE_SUPABASE_URL);
  return `sb-${url.hostname.split('.')[0]}-auth-token`;
}

async function seedSession(page, role, session) {
  await page.addInitScript(({ key, session, role }) => {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('setu_test_business_role', role);
  }, { key: storageKey(), session, role });
}

test('SETU full customer → vendor → dispatch → rider → delivery business flow', async ({ browser }) => {
  test.setTimeout(6 * 60 * 1000);
  const diagnostics = [];
  const pages = {};
  for (const role of ['customer', 'vendor', 'rider']) {
    const context = await browser.newContext({ locale: 'hi-IN', timezoneId: 'Asia/Kolkata', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await seedSession(page, role, runtime[role].session);
    page.on('console', msg => { if (msg.type() === 'error') diagnostics.push(`${role} console: ${msg.text()}`); });
    page.on('pageerror', err => diagnostics.push(`${role} pageerror: ${err.message}`));
    page.on('requestfailed', req => diagnostics.push(`${role} requestfailed: ${req.failure()?.errorText || 'failed'} ${req.url()}`));
    page.on('response', res => { if (res.status() >= 500) diagnostics.push(`${role} HTTP ${res.status()}: ${res.url()}`); });
    pages[role] = { context, page };
  }
  try {
    const customer = pages.customer.page;
    await agent.step('Customer opens test product', async () => {
      await customer.goto(`/customer/product/${runtime.product.id}`);
      await expect(customer.getByText(runtime.product.name, { exact: true })).toBeVisible();
    });
    await agent.step('Customer adds product to cart', async () => {
      await customer.getByRole('button', { name: /Add to Cart/i }).click();
      await expect(customer.getByRole('button', { name: /Added!/i })).toBeVisible();
    });
    await agent.step('Customer proceeds to checkout', async () => {
      await customer.goto('/customer/cart');
      await expect(customer.getByText(runtime.product.name, { exact: true })).toBeVisible();
      await customer.getByRole('button', { name: /Proceed to Checkout/i }).click();
      await expect(customer).toHaveURL(/\/customer\/checkout/);
    });
    await agent.step('Customer selects COD', async () => {
      await customer.getByRole('radio', { name: /Cash on Delivery/i }).click();
      await expect(customer.getByRole('radio', { name: /Cash on Delivery/i })).toHaveAttribute('aria-checked', 'true');
    });
    await agent.step('Customer places order', async () => {
      await customer.getByRole('slider', { name: /Slide to Place Order/i }).press('Enter');
      await expect(customer.getByText('Order Placed!', { exact: true })).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.timeoutMs });
      await customer.waitForURL(/\/customer\/orders\/[^/?#]+/, { timeout: 15000 });
      runtime.orderId = new URL(customer.url()).pathname.split('/').pop();
    });
    await agent.step('Vendor receives the new order', async () => {
      const vendor = pages.vendor.page;
      await vendor.goto('/vendor/orders');
      await expect(vendor.getByText('SETU E2E Customer', { exact: true })).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.realtimeTimeoutMs });
    });
    await agent.step('Vendor confirms → prepares → marks ready', async () => {
      const vendor = pages.vendor.page;
      await vendor.getByRole('button', { name: /^Accept$/ }).first().click();
      await expect(vendor.getByRole('button', { name: /Start Preparing/i })).toBeVisible();
      await vendor.getByRole('button', { name: /Start Preparing/i }).click();
      await expect(vendor.getByRole('button', { name: /Mark Ready/i })).toBeVisible();
      await vendor.getByRole('button', { name: /Mark Ready/i }).click();
      await expect(vendor.getByText(/ready/i).first()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.timeoutMs });
    });
    await agent.step('Rider comes online and accepts dispatch offer', async () => {
      const rider = pages.rider.page;
      await rider.goto('/rider');
      const onlineSwitch = rider.getByRole('switch').first();
      if (await onlineSwitch.count()) {
        const checked = await onlineSwitch.getAttribute('aria-checked');
        if (checked !== 'true') await onlineSwitch.click();
      }
      await expect(rider.getByRole('button', { name: /^Accept$/ }).last()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.realtimeTimeoutMs });
      await rider.getByRole('button', { name: /^Accept$/ }).last().click();
      await expect(rider.getByText(/accepted|ready|picked up/i).first()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.timeoutMs });
    });
    await agent.step('Rider advances pickup and on-the-way through the secured RPC', async () => {
      const rider = pages.rider.page;
      const token = runtime.rider.session.access_token;
      const apiBase = process.env.VITE_SUPABASE_URL.replace(/\/$/, '');
      for (const status of ['picked_up', 'on_the_way']) {
        const res = await rider.request.post(`${apiBase}/rest/v1/rpc/update_order_status`, {
          headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { p_order_id: runtime.orderId, p_new_status: status, p_actor_id: null, p_meta: {} },
        });
        const body = await res.json().catch(() => null);
        expect(res.ok(), `RPC ${status} failed: ${JSON.stringify(body)}`).toBeTruthy();
        if (body?.error) throw new Error(`RPC ${status}: ${body.error}`);
      }
    });
    await agent.step('Customer receives live on-the-way state and reveals OTP', async () => {
      await customer.bringToFront();
      await expect(customer.getByText(/Almost there|On the Way/i).first()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.realtimeTimeoutMs });
      await customer.getByRole('button', { name: /Show OTP/i }).click();
      const otp = await customer.locator('p.text-2xl.font-mono').innerText();
      if (!/^\d{6}$/.test(otp.trim())) throw new Error(`Invalid delivery OTP: ${otp}`);
      runtime.deliveryOtp = otp.trim();
    });
    await agent.step('Rider completes delivery with OTP and proof', async () => {
      const rider = pages.rider.page;
      await rider.bringToFront();
      await rider.getByRole('button', { name: /^Delivered$/ }).first().click();
      await rider.getByPlaceholder('6-digit OTP').fill(runtime.deliveryOtp);
      await rider.locator('input[type=file]').setInputFiles({
        name: 'e2e-delivery-proof.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      });
      await rider.getByRole('button', { name: /Verify & Deliver/i }).click();
      await expect(rider.getByText(/Delivered|No active deliveries|All caught up/i).first()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.timeoutMs });
    });
    await agent.step('Customer observes delivered state in realtime', async () => {
      await customer.bringToFront();
      await expect(customer.getByText(/Delivered!/i).first()).toBeVisible({ timeout: BUSINESS_FLOW_CONFIG.realtimeTimeoutMs });
    });
    await agent.step('Backend integrity verifies the completed transaction', async () => {
      const apiBase = process.env.VITE_SUPABASE_URL.replace(/\/$/, '');
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for backend integrity verification.');
      const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
      const get = async (path) => {
        const response = await fetch(`${apiBase}${path}`, { headers });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`Integrity query failed ${response.status}: ${JSON.stringify(body)}`);
        return body;
      };
      const [order] = await get(`/rest/v1/orders?id=eq.${runtime.orderId}&select=id,status,payment_method,payment_status,total,rider_id`);
      expect(order?.status).toBe('delivered');
      expect(order?.payment_method).toBe('COD');
      expect(order?.payment_status).toBe('collected');
      expect(order?.rider_id).toBe(runtime.rider.riderId);
      expect(Number(order?.total)).toBeGreaterThan(0);
      const [finalization] = await get(`/rest/v1/delivery_financial_finalizations?order_id=eq.${runtime.orderId}&select=order_id,rider_id,rider_earning,cod_amount,payment_finalized,rider_earning_finalized`);
      expect(finalization?.rider_id).toBe(runtime.rider.riderId);
      expect(finalization?.payment_finalized).toBe(true);
      expect(finalization?.rider_earning_finalized).toBe(true);
      expect(Number(finalization?.cod_amount)).toBe(Number(order.total));
      const [proof] = await get(`/rest/v1/delivery_proofs?order_id=eq.${runtime.orderId}&select=order_id,rider_id,proof_type,sha256`);
      expect(proof?.rider_id).toBe(runtime.rider.riderId);
      expect(proof?.proof_type).toBe('photo');
      const [otp] = await get(`/rest/v1/delivery_otps?order_id=eq.${runtime.orderId}&select=status,consumed_by`);
      expect(otp?.status).toBe('consumed');
      expect(otp?.consumed_by).toBe(runtime.rider.riderId);
      const [product] = await get(`/rest/v1/products?id=eq.${runtime.product.id}&select=stock`);
      expect(Number(product?.stock)).toBe(99);
    });
    agent.writeReport({ orderId: runtime.orderId, diagnostics });
    expect(diagnostics, 'Unexpected browser console/page errors during business flow').toEqual([]);
  } catch (error) {
    for (const [role, { page }] of Object.entries(pages)) await agent.screenshot(page, `${role}-failure.png`);
    agent.writeReport({ orderId: runtime.orderId || null, diagnostics });
    throw error;
  } finally {
    for (const { context } of Object.values(pages)) await context.close();
  }
});
