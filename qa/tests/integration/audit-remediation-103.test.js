import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sanitizeForOrderRoom, ADMIN_EVENTS_ROOM } from '../../../server/realtime/event-sanitizer.mjs';

// Static regression guards for the audit remediation (migration 103 + webhook +
// realtime gateway). Behavioural proof lives in qa/sql/audit_remediation_test.sql.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).sort();
const m103 = read('supabase/migrations/20240101000103_audit_remediation_payments_grants.sql');
const webhook = read('supabase/functions/razorpay-webhook/index.ts');
const createOrder = read('supabase/functions/create-razorpay-order/index.ts');
const gateway = read('server/realtime/index.mjs');
const m104 = read('supabase/migrations/20240101000104_kyc_records_rls_hardening.sql');
const aadhaar = read('supabase/functions/verify-aadhaar/index.ts');
const m105 = read('supabase/migrations/20240101000105_fcm_token_single_owner.sql');
const authCtx = read('src/lib/AuthContext.jsx');
const m106 = read('supabase/migrations/20240101000106_outbox_retention.sql');
const kafkaWorker = read('server/realtime/kafka-worker.mjs');
const domainConsumers = read('server/realtime/domain-consumers.mjs');
const gatewayDockerfile = read('server/realtime/Dockerfile');

describe('F-01: ledger finalizer must not depend on a non-existent column', () => {
  it('no migration other than the fix reads ct.reference without the column existing', () => {
    const addsColumn = migrations.some(f =>
      /alter table credit_transactions\s+add column if not exists reference/i.test(read(`supabase/migrations/${f}`)));
    assert.ok(addsColumn, 'credit_transactions.reference must be created by a migration');
  });
  it('latest finalizer definition matches disbursements via purpose', () => {
    assert.match(m103, /ct\.purpose = 'Order discount ' \|\| o\.order_number/);
    assert.doesNotMatch(m103.split('create or replace function finalize_order_financial_capture')[1].split('$$;')[0], /ct\.reference/);
  });
});

describe('F-02: wallet top-up / credit repayment are exactly-once and server-derived', () => {
  it('RPCs lock payment_orders and verify type + amount', () => {
    for (const fn of ['apply_wallet_topup_payment', 'apply_credit_repayment_payment']) {
      const body = m103.split(`create or replace function ${fn}(`)[1].split('$$;')[0];
      assert.match(body, /from payment_orders[\s\S]*for update/i);
      assert.match(body, /v_po\.notes ->> 'type'/);
      assert.match(body, /round\(v_po\.amount, 2\) <> round\(p_amount, 2\)/);
      assert.match(body, /security definer/i);
    }
    assert.match(m103, /uq_credit_txn_repayment_reference/);
  });
  it('webhook no longer trusts payment notes for the beneficiary or mutates balances directly', () => {
    assert.match(webhook, /apply_wallet_topup_payment/);
    assert.match(webhook, /apply_credit_repayment_payment/);
    assert.doesNotMatch(webhook, /notes\.customerId/);
    assert.doesNotMatch(webhook, /from\("credit_accounts"\)\.update/);
    assert.doesNotMatch(webhook, /rpc\(supabase, "topup_wallet"/);
  });
  it('order creation fails closed when the payment_orders row cannot be stored', () => {
    assert.match(createOrder, /Could not record payment/);
  });
});

describe('F-03/F-04: service-only RPCs revoke PUBLIC, not just anon/authenticated', () => {
  it('lockdown loop revokes from public, anon, authenticated and grants service_role', () => {
    assert.match(m103, /revoke execute on function %s from public, anon, authenticated/);
    assert.match(m103, /grant execute on function %s to service_role/);
    for (const fn of ['process_dispatch_timeouts', 'dispatch_ready_order', 'check_rate_limit',
      'prune_rate_limit_hits', 'refresh_admin_dashboard_stats', 'get_live_admin_analytics']) {
      assert.ok(m103.includes(`'${fn}'`), `${fn} missing from lockdown list`);
    }
  });
  it('no later migration re-grants these functions to anon/authenticated', () => {
    const later = migrations.filter(f => f > '20240101000103');
    for (const f of later) {
      assert.doesNotMatch(read(`supabase/migrations/${f}`),
        /grant execute on function (check_rate_limit|dispatch_ready_order|process_dispatch_timeouts)[^;]*to[^;]*(anon|authenticated)/i);
    }
  });
});

describe('R-01/R-03: realtime gateway session hygiene', () => {
  it('re-authentication drops rooms from the previous identity', () => {
    const authBlock = gateway.split("message.type === 'auth'")[1].split("message.type === 'subscribe'")[0];
    assert.ok(authBlock.indexOf('leaveAllRooms(ws)') > -1);
    assert.ok(authBlock.indexOf('leaveAllRooms(ws)') < authBlock.indexOf('state.userId = data.user.id'));
  });
  it('enforces JWT expiry on messages and in the heartbeat sweep', () => {
    assert.match(gateway, /function isTokenExpired/);
    assert.match(gateway, /TOKEN_EXPIRED/);
    assert.ok((gateway.match(/isTokenExpired\(state\)/g) || []).length >= 2);
  });
  it('refuses wildcard origins in production', () => {
    assert.match(gateway, /NODE_ENV === 'production' && ALLOWED_ORIGINS\.includes\('\*'\)/);
  });
});

describe('K-01/K-02/K-03: KYC authorization', () => {
  it('owners cannot write a verified status; reviewers can, but never on themselves', () => {
    assert.match(m104, /create policy "kyc_records_own_insert"[\s\S]*status in \('pending', 'submitted'\)[\s\S]*verified_at is null/);
    assert.match(m104, /create policy "kyc_records_own_update"[\s\S]*status in \('pending', 'submitted'\)/);
    assert.match(m104, /create policy "kyc_records_reviewer_update"[\s\S]*user_id <> auth\.uid\(\)/);
  });
  it('no migration re-opens an unrestricted owner write on kyc_records', () => {
    const later = migrations.filter(f => f > '20240101000104');
    for (const f of later) {
      assert.doesNotMatch(read(`supabase/migrations/${f}`), /on kyc_records for (insert|update|all)[^;]*(with check|using)\s*\(\s*user_id = auth\.uid\(\)\s*\)/i);
    }
  });
  it('verify-aadhaar binds requestId to the caller\'s own OTP session', () => {
    assert.match(aadhaar, /meta\?\.request_id !== requestId/);
    assert.ok(aadhaar.indexOf('request_id !== requestId') < aadhaar.lastIndexOf('/aadhaar-v2/submit-otp'));
  });
});

describe('N-01: push tokens are single-owner and detached on sign-out', () => {
  it('trigger clears the token from other profiles before the row is written', () => {
    assert.match(m105, /before insert or update of fcm_token on profiles/);
    assert.match(m105, /where fcm_token = new\.fcm_token\s+and id <> new\.id/);
  });
  it('signOut detaches the token before ending the session without blocking logout', () => {
    const body = authCtx.split('const signOut = useCallback')[1].split('// ── sendOTP')[0];
    assert.ok(body.indexOf("fcm_token: null") > -1);
    assert.ok(body.indexOf("fcm_token: null") < body.indexOf('supabase.auth.signOut()'));
    assert.match(body, /setTimeout\(resolve, 2000\)/);
  });
});

describe('O-01: outbox has a retention policy that cannot lose unpublished events', () => {
  it('prunes only published rows, in bounded batches, service-only', () => {
    assert.match(m106, /where published_at is not null\s+and published_at < now\(\) - p_published_keep/);
    assert.match(m106, /for update skip locked/);
    assert.doesNotMatch(m106.split('create or replace function public.prune_setu_event_outbox')[1].split('$$;')[0], /published_at is null/);
    assert.match(m106, /revoke execute on function public\.prune_setu_event_outbox\(interval, integer\) from public, anon, authenticated/);
  });
});

describe('KC-01/KC-02: realtime fan-out never leaks payment/dispatch internals to order rooms', () => {
  const tx = {
    id: 't1', order_id: 'o1', status: 'captured', amount: 120,
    provider_payment_id: 'pay_1', provider_order_id: 'order_1',
    gateway_payload: { contact: '+919999999999', email: 'a@b.c', vpa: 'x@upi', card: { last4: '1111' } },
  };
  it('payment rows are projected through an allowlist', () => {
    const safe = sanitizeForOrderRoom('payment', tx);
    assert.deepEqual(safe, { id: 't1', order_id: 'o1', status: 'captured', amount: 120 });
    assert.ok(!JSON.stringify(safe).includes('gateway_payload'));
    assert.ok(!JSON.stringify(safe).includes('pay_1'));
  });
  it('dispatch rows never reveal which riders were offered the job', () => {
    const safe = sanitizeForOrderRoom('dispatch', { id: 'd', order_id: 'o1', rider_id: 'r9', payload: { candidates: ['r1', 'r2'] }, status: 'offered' });
    assert.deepEqual(safe, { id: 'd', order_id: 'o1', status: 'offered' });
  });
  it('financial rows have no order-room projection at all, and unknown aggregates are dropped', () => {
    assert.equal(sanitizeForOrderRoom('financial', { id: 1, order_id: 'o1' }), null);
    assert.equal(sanitizeForOrderRoom('something_new', { id: 1, order_id: 'o1' }), null);
    assert.equal(sanitizeForOrderRoom('payment', null), null);
  });
  it('both workers use the sanitizer and publish admin events to the joinable room', () => {
    for (const src of [kafkaWorker, domainConsumers]) {
      assert.match(src, /sanitizeForOrderRoom/);
      assert.match(src, /ADMIN_EVENTS_ROOM/);
      assert.doesNotMatch(src, /room: 'admin'[,\s]/);
      assert.doesNotMatch(src, /publish\('setu:events:admin'/);
    }
    assert.doesNotMatch(kafkaWorker, /type: 'payment\.changed', entity: row/);
    assert.equal(ADMIN_EVENTS_ROOM, 'admin:events');
  });
  it('the gateway image actually ships the sanitizer module', () => {
    assert.match(gatewayDockerfile, /event-sanitizer\.mjs/);
  });
});
