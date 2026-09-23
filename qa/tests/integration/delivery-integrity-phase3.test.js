import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20240101000092_delivery_integrity_phase3.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8');
const rider = fs.readFileSync(path.join(root, 'src/pages/rider/RiderDashboard.jsx'), 'utf8');
const customer = fs.readFileSync(path.join(root, 'src/pages/customer/CustomerOrderDetail.jsx'), 'utf8');


describe('Phase 3 delivery-integrity static assertions', () => {
  it('matches the required source contracts', () => {
    assert.match(sql, /create table if not exists delivery_otps/);
    assert.match(sql, /otp_hash text not null/);
    assert.match(sql, /digest\(v_otp \|\| ':' \|\| v_salt, 'sha256'\)/);
    assert.match(sql, /interval '15 minutes'/);
    assert.match(sql, /max_attempts integer not null default 5/);
    assert.match(sql, /status='locked'/);
    assert.match(sql, /rider_id uuid references riders/);
    assert.match(sql, /create table if not exists delivery_attempts/);
    assert.match(sql, /create table if not exists delivery_proofs/);
    assert.match(sql, /create table if not exists delivery_financial_finalizations/);
    assert.match(sql, /unique\(order_id\)/);
    assert.match(sql, /create or replace function complete_delivery/);
    assert.match(sql, /v_order\.rider_id <> v_rider\.id/);
    assert.match(sql, /p_proof_type <> 'none'/);
    assert.match(sql, /status='consumed'/);
    assert.match(sql, /status='delivered'/);
    assert.match(sql, /payment_status=case when is_cod then 'collected'/);
    assert.match(sql, /on conflict\(order_id\) do nothing/);
    assert.match(sql, /trg_guard_rider_direct_delivery/);
    assert.match(sql, /delivery-proofs/);
    
    assert.match(api, /export async function getDeliveryOTP/);
    assert.match(api, /export async function completeDelivery/);
    assert.match(api, /supabase\.storage\.from\('delivery-proofs'\)/);
    assert.match(api, /complete_delivery/);
    assert.match(rider, /Customer OTP/);
    assert.match(rider, /Delivery proof photo/);
    assert.match(rider, /RiderAPI\.markDelivered\(/);
    assert.match(customer, /getDeliveryOTP/);
    assert.match(customer, /Delivery OTP/);
  });
});
