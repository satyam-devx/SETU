import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root,'supabase/migrations/20240101000094_financial_ledger_phase5.sql'),'utf8');
const webhook = fs.readFileSync(path.join(root,'supabase/functions/razorpay-webhook/index.ts'),'utf8');

assert.match(migration,/create table if not exists financial_journals/i);
assert.match(migration,/create table if not exists financial_journal_lines/i);
assert.match(migration,/idempotency_key text not null unique/i);
assert.match(migration,/v_debit numeric/i);
assert.match(migration,/Unbalanced financial journal/i);
assert.match(migration,/vendor_payable/i);
assert.match(migration,/rider_payable/i);
assert.match(migration,/platform_commission/i);
assert.match(migration,/discount_subsidy/i);
assert.match(migration,/gateway_fee/i);
assert.match(migration,/cod_liability/i);
assert.match(migration,/create table if not exists financial_settlements/i);
assert.match(migration,/create table if not exists payout_reconciliations/i);
assert.match(migration,/reconcile_financial_payout/i);
assert.match(migration,/finalize_refund_financials/i);
assert.match(migration,/cod-collection:/i);
assert.match(webhook,/finalize_order_financial_capture/i);
assert.match(webhook,/gatewayFee/i);
assert.match(webhook,/reconcile_financial_payout/i);

// No client role can call the money-moving ledger RPCs.
for (const fn of ['post_balanced_journal','finalize_order_financial_capture','finalize_refund_financials','create_financial_settlement','reconcile_financial_payout']) {
  const block = migration.slice(migration.indexOf(`revoke all on function ${fn}`), migration.indexOf(`revoke all on function ${fn}`)+250);
  assert.match(block,/from public,authenticated,anon/i,`${fn} must be service-role only`);
}

console.log('Phase 5 financial-ledger static assertions: PASS');
