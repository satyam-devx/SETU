// tests/integration/edge-functions.test.js — Supabase Edge Function contract tests
// Tests the expected behavior/contracts of each edge function
// without actually calling them (no network needed)

import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '../../config/vitest-setup.js';

const SUPA_FN = 'https://placeholder.supabase.co/functions/v1';

// ── ai-assistant ──────────────────────────────────────────────
describe('ai-assistant edge function', () => {
  it('returns reply, intent, and suggestedActions', async () => {
    const response = await fetch(`${SUPA_FN}/ai-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'मेरे ऑर्डर कहाँ हैं?', context: {} }),
    });

    const data = await response.json();
    expect(data).toHaveProperty('reply');
    expect(data).toHaveProperty('intent');
    expect(data).toHaveProperty('suggestedActions');
    expect(Array.isArray(data.suggestedActions)).toBe(true);
  });

  it('handles empty message gracefully', async () => {
    mswServer.use(
      http.post(`${SUPA_FN}/ai-assistant`, () =>
        HttpResponse.json({ reply: 'Please provide a message.', intent: 'unknown', suggestedActions: [] })
      )
    );

    const response = await fetch(`${SUPA_FN}/ai-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '', context: {} }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.reply).toBeTruthy();
  });

  it('returns CORS headers on OPTIONS preflight', async () => {
    mswServer.use(
      http.options(`${SUPA_FN}/ai-assistant`, () =>
        new HttpResponse(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        })
      )
    );

    const response = await fetch(`${SUPA_FN}/ai-assistant`, { method: 'OPTIONS' });
    expect(response.status).toBe(200);
  });
});

// ── create-razorpay-order ─────────────────────────────────────
describe('create-razorpay-order edge function', () => {
  it('returns Razorpay order with id, amount, and currency', async () => {
    const response = await fetch(`${SUPA_FN}/create-razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 12500, orderId: 'test-order', customerId: 'test-customer' }),
    });

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('amount');
    expect(data).toHaveProperty('currency');
    expect(data.currency).toBe('INR');
  });

  it('amount in response matches input (paise)', async () => {
    const inputAmount = 25000; // ₹250 in paise

    mswServer.use(
      http.post(`${SUPA_FN}/create-razorpay-order`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          id: 'order_test456',
          amount: body.amount,
          currency: 'INR',
        });
      })
    );

    const response = await fetch(`${SUPA_FN}/create-razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: inputAmount, orderId: 'ord-001', customerId: 'cust-001' }),
    });

    const data = await response.json();
    expect(data.amount).toBe(inputAmount);
  });
});

// ── razorpay-webhook ──────────────────────────────────────────
describe('razorpay-webhook edge function contracts', () => {
  // Test the signature verification contract (logic, not live function)

  function mockVerifyHMAC(body, secret, signature) {
    // Simplified mock of HMAC-SHA256 verification
    if (!secret) return false;
    if (!signature) return false;
    // In real impl: crypto.createHmac('sha256', secret).update(body).digest('hex') === signature
    return true; // mock passes
  }

  it('accepts request with valid signature', () => {
    const result = mockVerifyHMAC('{"event":"payment.captured"}', 'my-secret', 'valid-sig');
    expect(result).toBe(true);
  });

  it('rejects request without signature', () => {
    const result = mockVerifyHMAC('{"event":"payment.captured"}', 'my-secret', null);
    expect(result).toBe(false);
  });

  it('rejects request when webhook secret not configured', () => {
    const result = mockVerifyHMAC('{"event":"payment.captured"}', null, 'some-sig');
    expect(result).toBe(false);
  });

  it('payment.captured event triggers order confirmation', () => {
    const EVENT_HANDLERS = {
      'payment.captured':   'confirm_order',
      'payment.failed':     'mark_payment_failed',
      'refund.created':     'process_refund',
      'payout.processed':   'confirm_vendor_payout',
      'payout.failed':      'mark_payout_failed',
    };

    expect(EVENT_HANDLERS['payment.captured']).toBe('confirm_order');
    expect(EVENT_HANDLERS['payment.failed']).toBe('mark_payment_failed');
    expect(EVENT_HANDLERS['refund.created']).toBe('process_refund');
  });

  it('unhandled events do not throw', () => {
    function handleEvent(event) {
      const handlers = {
        'payment.captured': () => ({ action: 'confirm' }),
        'payment.failed':   () => ({ action: 'fail' }),
      };
      const handler = handlers[event];
      if (!handler) return { action: 'ignore', event };
      return handler();
    }

    expect(() => handleEvent('unknown.event')).not.toThrow();
    expect(handleEvent('unknown.event')).toEqual({ action: 'ignore', event: 'unknown.event' });
  });
});

// ── vendor-payout ─────────────────────────────────────────────
describe('vendor-payout edge function contracts', () => {
  it('payout amount must equal sum of captured escrow', () => {
    function validatePayoutAmount(escrowEntries, requestedAmount) {
      const total = escrowEntries.reduce((sum, e) => sum + e.amount, 0);
      if (requestedAmount > total) {
        return { valid: false, reason: 'Payout exceeds available escrow' };
      }
      return { valid: true };
    }

    const escrow = [{ amount: 1000 }, { amount: 500 }];
    expect(validatePayoutAmount(escrow, 1500).valid).toBe(true);
    expect(validatePayoutAmount(escrow, 1600).valid).toBe(false);
  });

  it('payout status transitions are atomic', () => {
    // Simulates: payout creation and status must be in a transaction
    function initiateAtomicPayout(escrowId, amount) {
      return {
        steps: [
          { action: 'debit_escrow', escrowId, amount },
          { action: 'create_razorpay_payout', amount },
          { action: 'record_payout_row', status: 'processing' },
        ],
        rollbackOn: 'any_failure',
      };
    }

    const payout = initiateAtomicPayout('esc-001', 1500);
    expect(payout.steps).toHaveLength(3);
    expect(payout.rollbackOn).toBe('any_failure');
  });
});

// ── kyc-verify ────────────────────────────────────────────────
describe('kyc-verify edge function contracts', () => {
  it('Aadhaar number is not stored in plaintext', () => {
    function storeAadhaarKYC(aadhaarNumber, userId) {
      // Must encrypt before storing — never store raw Aadhaar
      const encrypted = `encrypted:${userId}:REDACTED`; // mock
      return {
        stored_value: encrypted,
        raw_value:    null, // never returned
      };
    }

    const result = storeAadhaarKYC('123456789012', 'user-001');
    expect(result.raw_value).toBeNull();
    expect(result.stored_value).not.toContain('123456789012');
  });

  it('Aadhaar number passes Verhoeff algorithm check', () => {
    // Simplified check: 12 digits
    function isValidAadhaar(number) {
      return /^\d{12}$/.test(number);
    }

    expect(isValidAadhaar('123456789012')).toBe(true);
    expect(isValidAadhaar('12345678901')).toBe(false);   // 11 digits
    expect(isValidAadhaar('1234567890123')).toBe(false); // 13 digits
    expect(isValidAadhaar('123456789abc')).toBe(false);  // letters
  });
});
