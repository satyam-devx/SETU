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

// ── Workstream 2: CustomerCheckout.jsx retry handling ─────────
describe('Workstream 2 — CustomerCheckout.jsx no longer cancels an already-paid order', () => {
  const source = read('src/pages/customer/CustomerCheckout.jsx');
  const apiSource = read('src/lib/api.js');

  it('checks walletRes?.already_paid explicitly before treating a response as a fresh payment', () => {
    expect(source).toMatch(/walletRes\?\.already_paid/);
  });

  it('does not call cancelOrderWithRefund on an already_paid result', () => {
    // The already_paid branch must not be inside (or lead into) the
    // cancelOrderWithRefund call — verified by checking the cancel call
    // is only reachable from the walletError branch, not the success branch.
    const walletBlock = source.slice(source.indexOf("payMethod === 'wallet'"), source.indexOf('// COD:'));
    const cancelCallIndex = walletBlock.indexOf('cancelOrderWithRefund');
    const alreadyPaidIndex = walletBlock.indexOf('already_paid');
    expect(cancelCallIndex).toBeGreaterThan(-1);
    expect(alreadyPaidIndex).toBeGreaterThan(-1);
    // cancelOrderWithRefund must appear inside the walletError branch,
    // which textually precedes the already_paid check in this block.
    expect(cancelCallIndex).toBeLessThan(alreadyPaidIndex);
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
