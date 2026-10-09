/**
 * Projection hygiene for realtime fan-out (AUDIT KC-01).
 *
 * Outbox events carry FULL database rows (see migration 099/100). Order rooms
 * (`order:<id>`) are joined by every party to that order — the customer, the
 * vendor owner, the assigned rider and the village anchor — so projecting a raw
 * row into one hands each of them everything in it: Razorpay `gateway_payload`
 * (payer contact / email / VPA / card network & last4), provider ids,
 * `dispatch_events.payload`, other riders' offers, and so on.
 *
 * Rows are therefore projected through a per-aggregate ALLOWLIST. Anything not
 * listed is dropped. Financial-ledger rows are admin-only and never go to an
 * order room.
 */

const ORDER_ROOM_FIELDS = {
  payment: [
    'id', 'order_id', 'status', 'currency', 'amount', 'expected_amount', 'refund_amount',
    'refund_method', 'created_at', 'updated_at', 'captured_at', 'completed_at', 'processing_at',
  ],
  inventory: ['id', 'order_id', 'product_id', 'quantity', 'qty', 'status', 'created_at', 'updated_at'],
  // rider_id intentionally omitted: the order room must not reveal which riders were offered the job.
  dispatch: ['id', 'order_id', 'status', 'event_type', 'created_at', 'updated_at'],
};

export function pickFields(row, allowed) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  return out;
}

/** Returns the safe projection of `row`, or null when this aggregate must not reach an order room. */
export function sanitizeForOrderRoom(aggregate, row) {
  const allowed = ORDER_ROOM_FIELDS[String(aggregate || '')];
  if (!allowed) return null;
  return pickFields(row, allowed);
}

/** Canonical name of the room admin sockets are authorised to join (see authorizeRoom in index.mjs). */
export const ADMIN_EVENTS_ROOM = 'admin:events';
