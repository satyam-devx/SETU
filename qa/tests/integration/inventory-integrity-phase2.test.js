import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIGRATION = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20240101000091_inventory_integrity_phase2.sql'),
  'utf8'
);
const CREATE_ORDER = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20240101000083_create_order_idempotency.sql'),
  'utf8'
);
const WALLET = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20240101000059_fix_real_wallet_checkout_path.sql'),
  'utf8'
);
const PAYMENT = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20240101000088_payment_integrity_phase1.sql'),
  'utf8'
);

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = end ? source.indexOf(end, a + start.length) : source.length;
  expect(a).toBeGreaterThanOrEqual(0);
  return source.slice(a, b >= 0 ? b : source.length);
}

describe('Phase 2 — inventory integrity source contracts', () => {
  it('has a canonical reservation table and lifecycle states', () => {
    expect(MIGRATION).toMatch(/create table if not exists inventory_reservations/i);
    expect(MIGRATION).toMatch(/status\s+text not null default 'reserved'/i);
    expect(MIGRATION).toMatch(/'reserved','committed','released','expired'/i);
    expect(MIGRATION).toMatch(/unique \(order_id, product_id\)/i);
    expect(MIGRATION).toMatch(/idx_inventory_reservations_expiry/i);
  });

  it('records a reservation for every newly inserted order item without double-decrementing stock', () => {
    expect(MIGRATION).toMatch(/after insert on order_items/i);
    expect(MIGRATION).toMatch(/create_inventory_reservation_for_item/i);
    expect(MIGRATION).toMatch(/on conflict \(order_id, product_id\) do update set\s*\n\s*qty = inventory_reservations\.qty \+ excluded\.qty/is);
    expect(MIGRATION).toMatch(/stock was already atomically decremented by create_order/i);
    expect(CREATE_ORDER).toMatch(/update products set stock = stock - v_qty/i);
  });

  it('uses payment-specific reservation expiry and a one-minute timeout worker', () => {
    expect(MIGRATION).toMatch(/when v_method in \('UPI','wallet','credit'\) then interval '15 minutes'/i);
    expect(MIGRATION).toMatch(/else interval '24 hours'/i);
    expect(MIGRATION).toMatch(/create or replace function expire_stale_inventory_reservations/i);
    expect(MIGRATION).toMatch(/expires_at <= now\(\)/i);
    expect(MIGRATION).toMatch(/for update skip locked/i);
    expect(MIGRATION).toMatch(/expire-setu-inventory-reservations/i);
    expect(MIGRATION).toMatch(/\* \* \* \* \*/);
  });

  it('locks the order before timeout release so capture-vs-timeout has one winner', () => {
    const worker = section(MIGRATION, 'create or replace function expire_stale_inventory_reservations', '-- ───────────────────────────────────────────────────────────────────────\n-- Replace cancellation');
    expect(worker).toMatch(/select \* into v_order from orders where id = v_res\.order_id for update/i);
    expect(worker).toMatch(/if v_order\.status = 'pending' and v_order\.payment_status = 'pending'/i);
    expect(worker).toMatch(/release_inventory_for_order\(v_order\.id, 'payment_timeout'\)/i);
    expect(worker).toMatch(/status = 'cancelled'/i);
  });

  it('release is idempotent and restores stock exactly once for reservation-backed orders', () => {
    const release = section(MIGRATION, 'create or replace function release_inventory_for_order', '-- ───────────────────────────────────────────────────────────────────────\n-- Payment/COD success');
    expect(release).toMatch(/for update/i);
    expect(release).toMatch(/status in \('reserved','committed'\)/i);
    expect(release).toMatch(/set stock = stock \+ v_res\.qty/i);
    expect(release).toMatch(/status = 'released'/i);
    expect(release).toMatch(/if not v_has_reservations then/i);
    expect(release).toMatch(/legacy_fallback/i);
  });

  it('commits reservations on authoritative payment success without subtracting stock again', () => {
    expect(MIGRATION).toMatch(/create or replace function commit_inventory_for_order/i);
    expect(MIGRATION).toMatch(/status = 'committed'/i);
    expect(MIGRATION).toMatch(/after update of payment_status on orders/i);
    expect(MIGRATION).toMatch(/new\.payment_status in \('paid','collected'\)/i);
    expect(MIGRATION).toMatch(/stock was already removed when the reservation was created/i);
  });

  it('cancellation path releases reservations and prevents the legacy stock restore from running twice', () => {
    const cancel = section(MIGRATION, 'create or replace function cancel_order_with_refund');
    expect(cancel).toMatch(/for update/i);
    expect(cancel).toMatch(/set_config\('setu\.inventory_release_done', '1', true\)/i);
    expect(cancel).toMatch(/release_inventory_for_order\(p_order_id/i);
    expect(cancel).not.toMatch(/update products p\s+set stock = p\.stock \+ oi\.qty/i);

    const cancelTrigger = section(MIGRATION, 'create or replace function trg_release_inventory_on_cancel', 'drop trigger if exists trg_orders_release_inventory_on_cancel');
    expect(cancelTrigger).toMatch(/new\.status = 'cancelled'/i);
    expect(cancelTrigger).toMatch(/release_inventory_for_order\(new\.id/i);
    expect(cancelTrigger).toMatch(/setu\.inventory_release_done/i);
  });

  it('protects direct update_order_status(..., cancelled) through the cancellation trigger', () => {
    expect(MIGRATION).toMatch(/create trigger trg_orders_release_inventory_on_cancel/i);
    expect(MIGRATION).toMatch(/after update of status on orders/i);
    expect(MIGRATION).toMatch(/new\.status = 'cancelled'/i);
    expect(MIGRATION).toMatch(/current_setting\('setu\.inventory_release_done', true\)/i);
  });

  it('covers wallet payment, Razorpay capture, and partial-failure recovery through the same inventory lifecycle', () => {
    expect(WALLET).toMatch(/update orders set[\s\S]*payment_status = 'paid'/i);
    expect(PAYMENT).toMatch(/update orders set[\s\S]*payment_status = 'paid'/i);
    expect(MIGRATION).toMatch(/trg_commit_inventory_on_payment/i);
    expect(MIGRATION).toMatch(/the database transaction is the recovery boundary/i);
    expect(MIGRATION).toMatch(/legacy fallback/i);
  });

  it('backfills active pre-Phase-2 orders and preserves committed state for already-paid orders', () => {
    expect(MIGRATION).toMatch(/Backfill reservation rows/i);
    expect(MIGRATION).toMatch(/not exists \(select 1 from inventory_reservations/i);
    expect(MIGRATION).toMatch(/case when o\.payment_status in \('paid','collected'\) then 'committed'/i);
  });

  it('keeps reservation mutations trusted-server only', () => {
    expect(MIGRATION).toMatch(/revoke insert, update, delete on inventory_reservations from anon, authenticated/i);
    expect(MIGRATION).toMatch(/grant execute on function release_inventory_for_order\(uuid,text\) to service_role/i);
    expect(MIGRATION).toMatch(/grant execute on function commit_inventory_for_order\(uuid\) to service_role/i);
    expect(MIGRATION).toMatch(/grant execute on function expire_stale_inventory_reservations\(integer\) to service_role/i);
  });
});
