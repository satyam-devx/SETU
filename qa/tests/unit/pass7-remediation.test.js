// qa/tests/unit/pass7-remediation.test.js — PASS 7 regression tests
//
// Static, source-level regression guards for the Pass 7 remediation pass
// (see SETU-PASS7-REMEDIATION-REPORT.md), which fixed the highest-severity
// finding from Pass 6: Pass 5's wallet-idempotency fix targeted the WRONG
// function. These tests cannot substitute for live-database concurrency
// tests (no network egress / live Supabase access in this environment —
// see the Pass 7 report §"Tests Blocked") — they exist to catch an
// accidental revert of the source/migration changes this pass made.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// ── Workstream 1: the REAL wallet checkout RPC ────────────────
describe('Workstream 1 — pay_order_from_wallet (the actual checkout path)', () => {
  const migration = read('supabase/migrations/20240101000059_fix_real_wallet_checkout_path.sql');

  it('locks the order row before checking its payment status', () => {
    expect(migration).toMatch(/select \* into v_order from orders where id = p_order_id for update/i);
  });

  it('reports an already-paid retry as success, not a generic failure', () => {
    expect(migration).toMatch(/already_paid/);
    expect(migration).toMatch(/if v_order\.payment_status = 'paid' then[\s\S]*?'success', true, 'already_paid', true/);
  });

  it('still rejects a genuinely non-payable order distinctly (not conflated with already_paid)', () => {
    expect(migration).toMatch(/order_not_payable/);
  });

  it('still derives the amount from the server-recorded order total, never a client-supplied amount', () => {
    expect(migration).toMatch(/balance\s*=\s*balance\s*-\s*v_order\.total/);
    expect(migration).not.toMatch(/p_amount/); // this function has no amount parameter at all
  });

  it('handles a residual unique_violation gracefully rather than letting it crash', () => {
    expect(migration).toMatch(/exception when unique_violation/i);
  });
});

// ── Workstream 2: checkout retry handling ──────────────────────
// F1-D.3 moved this choreography out of CustomerCheckout.jsx into a
// mutation-boundary hook pair. The already_paid literal itself no longer
// appears in the JS layer at all — PaymentAPI.payOrderFromWallet folds
// already_paid into an ordinary *success* response (error: null), so the
// mutation hook's generic "throw only on error" rule is what keeps an
// already-paid retry from ever reaching the cancel branch. These tests
// check that structural guarantee instead of a literal string match.
describe('Workstream 2 — checkout no longer cancels an already-paid wallet retry', () => {
  const checkoutSource = read('src/hooks/mutations/useCheckoutMutations.js');
  const paymentSource = read('src/hooks/mutations/usePaymentMutations.js');
  const apiSource = read('src/lib/api.js');

  it('payWallet only throws on a genuine error, never on an already_paid success', () => {
    // already_paid is bundled into PaymentAPI.payOrderFromWallet's success
    // payload (see below), and this is the only line deciding whether a
    // wallet result becomes a thrown error — so an already_paid response
    // can never reach the catch/cancel branch in useCheckoutMutations.
    expect(paymentSource).toMatch(/if \(result\?\.error\) throw result\.error;/);
  });

  it('does not call cancelOrder on the wallet success path — only inside the catch', () => {
    const walletBlock = checkoutSource.slice(
      checkoutSource.indexOf("paymentMethod === 'wallet'"),
      checkoutSource.indexOf('// COD has no payment provider mutation')
    );
    const catchIndex = walletBlock.indexOf('catch (walletError)');
    const cancelCallIndex = walletBlock.indexOf('cancelOrder(');
    const successReturnIndex = walletBlock.indexOf('return { data: order, payment:');
    expect(catchIndex).toBeGreaterThan(-1);
    expect(cancelCallIndex).toBeGreaterThan(-1);
    expect(successReturnIndex).toBeGreaterThan(-1);
    // cancelOrder must only be reachable from inside the catch block —
    // i.e. it appears after `catch` and before the success return.
    expect(cancelCallIndex).toBeGreaterThan(catchIndex);
    expect(cancelCallIndex).toBeLessThan(successReturnIndex);
  });

  it('api.js passes already_paid through from the RPC response instead of discarding it', () => {
    expect(apiSource).toMatch(/already_paid:\s*data\.already_paid === true/);
  });

  it('api.js distinguishes order_not_payable from a generic wallet failure', () => {
    expect(apiSource).toMatch(/order_not_payable/);
  });
});

// ── Workstream 3: assign_role PUBLIC/anon grant ───────────────
describe('Workstream 3 — assign_role PUBLIC/anon execute grant closed', () => {
  const migration = read('supabase/migrations/20240101000060_fix_assign_role_public_grant.sql');

  it('explicitly revokes execute from public and anon', () => {
    expect(migration).toMatch(/revoke execute on function assign_role\(uuid, text\) from public, anon/i);
  });

  it('does not touch the internal authorization logic', () => {
    expect(migration).not.toMatch(/create or replace function assign_role/i);
  });
});

// ── Workstream 4: pay_from_wallet amount-mismatch fix ─────────
describe('Workstream 4 — pay_from_wallet rejects amount-mismatched replays', () => {
  const migration = read('supabase/migrations/20240101000061_fix_pay_from_wallet_amount_mismatch.sql');

  it('compares the existing recorded amount against the newly-requested amount', () => {
    expect(migration).toMatch(/v_existing\.amount is distinct from p_amount/);
  });

  it('returns an explicit amount_mismatch conflict rather than silent success', () => {
    expect(migration).toMatch(/amount_mismatch/);
  });

  it('preserves the ownership check (kept, not retired)', () => {
    expect(migration).toMatch(/Unauthorized: cannot debit another user''s wallet/);
  });

  it('applies the same amount check on the concurrent-race (unique_violation) path too', () => {
    const exceptionBlock = migration.slice(migration.indexOf('exception when unique_violation'));
    expect(exceptionBlock).toMatch(/amount_mismatch/);
  });
});

// ── Workstream 7: referral mock-data cleanup ──────────────────
describe('Workstream 7 — mockData.js no longer labels fake data as a referral bonus', () => {
  const source = read('src/lib/mockData.js');

  it('contains no "Referral bonus" label', () => {
    expect(source).not.toMatch(/Referral bonus/i);
  });
});
