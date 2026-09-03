// qa/tests/unit/pass5-remediation.test.js — PASS 5 regression tests
//
// Static, source-level regression guards for the Pass 5 remediation pass
// (see SETU-PASS5-REMEDIATION-REPORT.md). These cannot substitute for the
// live-database concurrency/authorization tests Pass 6 must run (no live
// Supabase connection or network egress is available in this environment —
// report §18/§19) — they exist to catch an accidental revert of the source
// and migration changes this pass made, and to fail loudly in a CI
// environment that *can* run `npm install`/live-DB tests.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

// ── FUNC-01: assign_role ──────────────────────────────────────
describe('FUNC-01 — assign_role authorization', () => {
  const apiSource = read('src/lib/api.js');
  const migration = read('supabase/migrations/20240101000054_fix_assign_role_authorization.sql');

  it('assignRole() still calls the standard client (never a service-role client)', () => {
    // The frontend must never hold or use a service-role key — assign_role's
    // fix works by moving authorization *inside* the SECURITY DEFINER
    // function, not by elevating the client.
    expect(apiSource).toMatch(/assignRole[\s\S]*?supabase\.rpc\('assign_role'/);
    expect(apiSource).not.toMatch(/service_role/i);
  });

  it('migration 054 blocks self-escalation', () => {
    expect(migration).toMatch(/p_user_id = v_uid/);
    expect(migration).toMatch(/cannot change your own role/i);
  });

  it('migration 054 validates the target user exists', () => {
    expect(migration).toMatch(/target user not found/i);
  });

  it('migration 054 retains the super_admin-only check', () => {
    expect(migration).toMatch(/get_my_role\(\)\s*<>\s*'super_admin'/);
  });

  it('migration 054 sets an explicit search_path', () => {
    expect(migration).toMatch(/set search_path = public/);
  });

  it('migration 054 grants execute to authenticated (the actual fix)', () => {
    expect(migration).toMatch(/grant execute on function assign_role\(uuid, text\) to authenticated/);
  });
});

// ── DATA-02: coupon redemption race ───────────────────────────
describe('DATA-02 — coupon redemption race fix', () => {
  const migration = read('supabase/migrations/20240101000053_fix_coupon_redemption_race.sql');

  it('locks the coupon row before evaluating/redeeming it', () => {
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(/select id into v_lock_id[\s\S]*?from coupons/i);
  });

  it('does NOT add an overly-broad UNIQUE(coupon_id, user_id) constraint', () => {
    // per_user_limit can legitimately be > 1 — a blind unique constraint
    // would break that. The fix must be locking-based, not constraint-based.
    expect(migration).not.toMatch(/unique\s*\(\s*coupon_id\s*,\s*user_id\s*\)/i);
  });

  it('still calls the existing _evaluate_coupon rather than duplicating its logic', () => {
    expect(migration).toMatch(/_evaluate_coupon\(/);
  });
});

// ── PASS-5-DISCOVERED: cancel_order_with_refund double-refund race ──
describe('P2 — cancel_order_with_refund race fix (PASS-5-DISCOVERED)', () => {
  const migration = read('supabase/migrations/20240101000055_fix_cancel_order_refund_race.sql');

  it('locks the order row before checking its cancellable status', () => {
    expect(migration).toMatch(/select \* into v_order from orders where id = p_order_id for update/i);
  });

  it('refund amount still derives from the server-recorded order total, not a client input', () => {
    expect(migration).toMatch(/v_refund_amount := v_order\.total/);
  });
});

// ── DATA-03: wallet debit idempotency ─────────────────────────
describe('DATA-03 — wallet debit idempotency', () => {
  const migration = read('supabase/migrations/20240101000056_wallet_debit_idempotency.sql');

  it('adds a database-level (not just application-level) uniqueness guarantee', () => {
    expect(migration).toMatch(/create unique index/i);
    expect(migration).toMatch(/wallet_id, reference/);
    expect(migration).toMatch(/where type = 'debit' and status = 'completed'/i);
  });

  it('checks for an existing completed debit before performing a new one', () => {
    expect(migration).toMatch(/idempotent_replay/);
  });

  it('preserves the atomic conditional balance-check UPDATE (race-safety, unchanged)', () => {
    expect(migration).toMatch(/balance\s*=\s*balance\s*-\s*p_amount/);
    expect(migration).toMatch(/where\s+user_id\s*=\s*p_user_id[\s\S]*?balance\s*>=\s*p_amount/i);
  });

  it('does not change the RPC signature callers depend on', () => {
    expect(migration).toMatch(/function pay_from_wallet\(\s*p_user_id\s+uuid,\s*p_amount\s+numeric,\s*p_order_id\s+uuid default null\s*\)/i);
  });
});

// ── SEC-04: search_path hardening ─────────────────────────────
describe('SEC-04 — SECURITY DEFINER search_path hardening', () => {
  const migration = read('supabase/migrations/20240101000057_security_definer_search_path_hardening.sql');
  const fns = ['topup_wallet', 'set_default_address', '_set_internal_payment_flag', 'update_updated_at'];

  it.each(fns)('%s now sets an explicit search_path', (fnName) => {
    const idx = migration.indexOf(`function ${fnName}(`);
    expect(idx).toBeGreaterThan(-1);
    const nextFnIdx = migration.indexOf('create or replace function', idx + 1);
    const slice = migration.slice(idx, nextFnIdx === -1 ? undefined : nextFnIdx);
    expect(slice).toMatch(/set search_path = public/);
  });
});

// ── PASS-5-DISCOVERED: dead Aadhaar functions PUBLIC-execute gap ──
describe('P3 — store_aadhaar/decrypt_aadhaar lockdown (PASS-5-DISCOVERED)', () => {
  const migration = read('supabase/migrations/20240101000058_lockdown_dead_aadhaar_functions.sql');

  it('revokes execute from PUBLIC, authenticated, and anon for both functions', () => {
    expect(migration).toMatch(/revoke execute on function store_aadhaar\(uuid, text\) from public, authenticated, anon/i);
    expect(migration).toMatch(/revoke execute on function decrypt_aadhaar\(uuid\)\s*from public, authenticated, anon/i);
  });

  it('does not re-grant either function to any role', () => {
    expect(migration).not.toMatch(/grant execute on function (store_aadhaar|decrypt_aadhaar)/i);
  });
});

// ── DATA-01: Referral fabricated data removed ─────────────────
describe('DATA-01 — Referral no longer shows fabricated financial data', () => {
  const source = read('src/pages/customer/CustomerReferral.jsx');

  it('contains no hardcoded referral code', () => {
    expect(source).not.toMatch(/REFERRAL_CODE\s*=\s*['"][A-Z-]+['"]/);
  });

  it('contains no hardcoded currency figures', () => {
    expect(source).not.toMatch(/₹\d/);
  });

  it('contains no hardcoded friend/referral-history array', () => {
    expect(source).not.toMatch(/Rekha Kumari|Mohan Lal|Priya Singh/);
  });

  it('renders a truthful unavailable/coming-soon state', () => {
    expect(source).toMatch(/coming soon/i);
  });
});
