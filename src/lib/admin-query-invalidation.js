// SETU — Admin query invalidation (F1-D.4).
// Admin mutations invalidate server-state domains without owning UI state.
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { invalidateOrderQueries } from '@/hooks/queries/useOrders';
import { invalidatePaymentQueries } from '@/lib/payment-query-invalidation';

export function invalidateAdminOrderQueries({ orderId, customerId, vendorId, riderId } = {}) {
  let count = invalidateOrderQueries({ orderId, customerId, vendorId, riderId });
  // Admin-specific detail/list consumers may be added later. The canonical
  // order prefix is intentionally invalidated here so no admin screen can
  // retain stale lifecycle state after an admin action.
  count += queryClientInstance.invalidateQueries(queryKeys.orders.all);
  if (orderId) count += queryClientInstance.invalidateQueries(queryKeys.orders.detail(orderId));
  if (orderId || customerId) count += invalidatePaymentQueries({ customerId, orderId });
  return count;
}
