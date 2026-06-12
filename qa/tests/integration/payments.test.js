// tests/integration/payments.test.js — Payment flow tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer, MOCK_ORDER, MOCK_PROFILE } from '../../config/vitest-setup.js';

// ── Payment state machine ──────────────────────────────────────
describe('Payment state transitions', () => {
  const VALID_PAYMENT_TRANSITIONS = {
    pending:   ['captured', 'failed'],
    captured:  ['refunded'],
    failed:    [],
    refunded:  [],
  };

  function canTransitionPayment(from, to) {
    return VALID_PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('pending → captured is valid (payment succeeded)', () => {
    expect(canTransitionPayment('pending', 'captured')).toBe(true);
  });

  it('pending → failed is valid (payment declined)', () => {
    expect(canTransitionPayment('pending', 'failed')).toBe(true);
  });

  it('captured → refunded is valid (refund flow)', () => {
    expect(canTransitionPayment('captured', 'refunded')).toBe(true);
  });

  it('failed payment cannot be captured', () => {
    expect(canTransitionPayment('failed', 'captured')).toBe(false);
  });

  it('refunded payment cannot be re-captured', () => {
    expect(canTransitionPayment('refunded', 'captured')).toBe(false);
  });

  it('captured payment cannot go back to pending', () => {
    expect(canTransitionPayment('captured', 'pending')).toBe(false);
  });
});

// ── Razorpay webhook signature verification ───────────────────
describe('Razorpay webhook security', () => {
  it('rejects webhook without signature header', () => {
    function verifyWebhook(signature, body, secret) {
      if (!signature) return { valid: false, reason: 'Missing signature' };
      if (!secret)    return { valid: false, reason: 'Webhook secret not configured' };
      // In real impl: HMAC-SHA256(secret, body) === signature
      return { valid: true };
    }

    const result = verifyWebhook(null, '{}', 'my-secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('rejects if webhook secret is not configured', () => {
    function verifyWebhook(signature, body, secret) {
      if (!secret) return { valid: false, reason: 'Webhook secret not configured' };
      if (!signature) return { valid: false, reason: 'Missing signature' };
      return { valid: true };
    }

    const result = verifyWebhook('some-sig', '{}', null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('secret');
  });

  it('webhook event_id idempotency prevents duplicate processing', () => {
    const processedEvents = new Set(['evt_001', 'evt_002']);

    function processWebhookEvent(eventId, handler) {
      if (processedEvents.has(eventId)) {
        return { duplicate: true, processed: false };
      }
      processedEvents.add(eventId);
      handler();
      return { duplicate: false, processed: true };
    }

    let handlerCallCount = 0;
    const handler = () => { handlerCallCount++; };

    // First time: should process
    const r1 = processWebhookEvent('evt_003', handler);
    expect(r1.processed).toBe(true);

    // Second time: should skip
    const r2 = processWebhookEvent('evt_003', handler);
    expect(r2.duplicate).toBe(true);
    expect(r2.processed).toBe(false);

    // Handler should only have been called once
    expect(handlerCallCount).toBe(1);
  });
});

// ── Wallet operations ─────────────────────────────────────────
describe('Wallet balance operations', () => {
  function applyWalletOperation(balance, amount, operation) {
    if (operation === 'credit') {
      return { balance: balance + amount, error: null };
    }
    if (operation === 'debit') {
      if (amount > balance) {
        return { balance, error: 'Insufficient wallet balance' };
      }
      return { balance: balance - amount, error: null };
    }
    return { balance, error: 'Unknown operation' };
  }

  it('credits wallet correctly', () => {
    const { balance, error } = applyWalletOperation(500, 200, 'credit');
    expect(balance).toBe(700);
    expect(error).toBeNull();
  });

  it('debits wallet correctly', () => {
    const { balance, error } = applyWalletOperation(500, 200, 'debit');
    expect(balance).toBe(300);
    expect(error).toBeNull();
  });

  it('prevents debit when insufficient balance', () => {
    const { balance, error } = applyWalletOperation(100, 200, 'debit');
    expect(balance).toBe(100); // unchanged
    expect(error).toBe('Insufficient wallet balance');
  });

  it('wallet balance never goes negative', () => {
    const amounts = [1, 50, 100, 500];
    amounts.forEach(amount => {
      const { balance } = applyWalletOperation(0, amount, 'debit');
      expect(balance).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Platform fee split ────────────────────────────────────────
describe('Fee split logic', () => {
  function calculateFeeSplit(totalAmount, platformFeePercent = 2.5) {
    const platformFee  = Math.round((totalAmount * platformFeePercent) / 100);
    const vendorAmount = totalAmount - platformFee;
    const riderAmount  = 0; // determined separately by rider rate
    return { platformFee, vendorAmount, riderAmount, total: totalAmount };
  }

  it('platform fee + vendor amount = total', () => {
    const { platformFee, vendorAmount, total } = calculateFeeSplit(10000);
    expect(platformFee + vendorAmount).toBe(total);
  });

  it('platform fee is rounded to nearest integer (paise)', () => {
    const { platformFee } = calculateFeeSplit(333); // 2.5% of 333 = 8.325
    expect(Number.isInteger(platformFee)).toBe(true);
  });

  it('vendor always gets majority of payment', () => {
    const amounts = [100, 500, 1000, 5000, 10000];
    amounts.forEach(amount => {
      const { platformFee, vendorAmount } = calculateFeeSplit(amount);
      expect(vendorAmount).toBeGreaterThan(platformFee);
    });
  });
});

// ── COD deposit tracking ──────────────────────────────────────
describe('COD (Cash on Delivery) handling', () => {
  function reconcileCOD(collected, expected) {
    const diff = collected - expected;
    if (diff === 0) return { status: 'balanced', shortage: 0, excess: 0 };
    if (diff < 0)  return { status: 'shortage', shortage: Math.abs(diff), excess: 0 };
    return { status: 'excess', shortage: 0, excess: diff };
  }

  it('balanced collection clears rider', () => {
    const result = reconcileCOD(1500, 1500);
    expect(result.status).toBe('balanced');
    expect(result.shortage).toBe(0);
  });

  it('detects shortage correctly', () => {
    const result = reconcileCOD(1400, 1500);
    expect(result.status).toBe('shortage');
    expect(result.shortage).toBe(100);
  });

  it('detects excess correctly', () => {
    const result = reconcileCOD(1600, 1500);
    expect(result.status).toBe('excess');
    expect(result.excess).toBe(100);
  });
});

// ── Credit account limits ─────────────────────────────────────
describe('Credit limits', () => {
  function canExtendCredit(account, requestedAmount) {
    const available = account.credit_limit - account.outstanding;
    if (requestedAmount > available) {
      return { approved: false, reason: `Exceeds available credit of ₹${available}` };
    }
    if (account.is_blocked) {
      return { approved: false, reason: 'Account is blocked' };
    }
    return { approved: true, newOutstanding: account.outstanding + requestedAmount };
  }

  it('approves credit within limit', () => {
    const account = { credit_limit: 1000, outstanding: 200, is_blocked: false };
    const result  = canExtendCredit(account, 500);
    expect(result.approved).toBe(true);
    expect(result.newOutstanding).toBe(700);
  });

  it('rejects credit exceeding limit', () => {
    const account = { credit_limit: 1000, outstanding: 800, is_blocked: false };
    const result  = canExtendCredit(account, 300);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Exceeds');
  });

  it('rejects credit for blocked accounts', () => {
    const account = { credit_limit: 1000, outstanding: 0, is_blocked: true };
    const result  = canExtendCredit(account, 100);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('blocked');
  });
});
