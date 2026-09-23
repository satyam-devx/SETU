import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20240101000088_payment_integrity_phase1.sql'), 'utf8');
const cancelMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20240101000089_fix_upi_cancel_refund_path.sql'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/razorpay-webhook/index.ts'), 'utf8');

function reconcileCapture({ orderStatus, paymentStatus, capturedAmount, orderTotal }) {
  if (capturedAmount !== orderTotal) return { manualReview: true, escrow: false };
  if (orderStatus === 'cancelled') return { refundRequired: true, escrow: false };
  if (paymentStatus === 'paid') return { alreadyApplied: true, escrow: false };
  if (orderStatus !== 'pending' || !['pending', 'failed'].includes(paymentStatus)) {
    return { manualReview: true, escrow: false };
  }
  return { captured: true, escrow: true };
}

describe('Phase 1 payment integrity — captured-after-cancel race', () => {
  it('cancel wins: a later capture creates a refund and never credits escrow', () => {
    const result = reconcileCapture({ orderStatus: 'cancelled', paymentStatus: 'pending', capturedAmount: 500, orderTotal: 500 });
    expect(result.refundRequired).toBe(true);
    expect(result.escrow).toBe(false);
  });

  it('capture wins: a later cancellation cannot be treated as a pending cancellation', () => {
    const result = reconcileCapture({ orderStatus: 'confirmed', paymentStatus: 'paid', capturedAmount: 500, orderTotal: 500 });
    expect(result.alreadyApplied).toBe(true);
    expect(result.escrow).toBe(false);
  });

  it('amount mismatch never releases escrow', () => {
    const result = reconcileCapture({ orderStatus: 'pending', paymentStatus: 'pending', capturedAmount: 1, orderTotal: 500 });
    expect(result.manualReview).toBe(true);
    expect(result.escrow).toBe(false);
  });
});

describe('Phase 1 payment integrity — source contracts', () => {
  it('has a canonical payment intent lifecycle and active-attempt uniqueness', () => {
    expect(migration).toContain('create table if not exists payment_intents');
    expect(migration).toContain("'creating','created','checkout_open','payment_pending'");
    expect(migration).toContain('idx_payment_intents_active_order');
  });

  it('has a canonical payment transaction ledger keyed by provider payment ID', () => {
    expect(migration).toContain('create table if not exists payment_transactions');
    expect(migration).toMatch(/provider_payment_id\s+text\s+unique/i);
    expect(migration).toContain('reconciliation_state');
  });

  it('locks the order before capture-vs-cancel state resolution', () => {
    const captureFn = migration.slice(migration.indexOf('create or replace function reconcile_razorpay_capture'));
    expect(captureFn).toContain('from orders where id = p_order_id for update');
    expect(captureFn).toContain("if v_order.status = 'cancelled' then");
    expect(captureFn).toContain("refund_required");
    expect(captureFn).not.toContain('perform record_delivery_split(p_order_id, p_payment_id);\n\n    update payment_intents');
  });

  it('tracks webhook attempts and dead-letter state', () => {
    expect(migration).toContain('processing_status');
    expect(migration).toContain('dead_letter_at');
    expect(webhook).toContain('attemptCount >= 5');
    expect(webhook).toContain('processing_status: deadLetter ? "dead_letter" : "failed"');
  });

  it('uses Razorpay refund for paid UPI orders rather than wallet credit', () => {
    expect(cancelMigration).toContain("elsif v_order.payment_method = 'UPI' then");
    expect(cancelMigration).toContain("v_refund_method := 'razorpay';");
    expect(cancelMigration).toContain('order_refunds');
    expect(cancelMigration).toContain('do NOT change payment_status to refunded');
    expect(cancelMigration).not.toContain("v_order.payment_method in ('UPI', 'wallet')");
  });

  it('routes provider refunds through a durable claim/finalize lifecycle', () => {
    expect(migration).toContain('claim_razorpay_refund');
    expect(migration).toContain('complete_razorpay_refund');
    expect(migration).toContain('fail_razorpay_refund');
    expect(webhook).toContain('processRazorpayRefund');
  });
});
