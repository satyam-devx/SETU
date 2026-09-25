// SETU — Payment cross-domain cache invalidation (F1-D.3).
// Payment state is server-owned and can affect orders, wallet balance,
// wallet transactions, and payment/order detail views.
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidatePaymentQueries({ customerId, orderId } = {}) {
  let count = 0;
  if (customerId) {
    count += queryClientInstance.invalidateQueries(queryKeys.wallet.customer(customerId));
    count += queryClientInstance.invalidateQueries(queryKeys.wallet.transactions(customerId));
  }
  if (orderId) count += queryClientInstance.invalidateQueries(queryKeys.payments.detail(orderId));
  return count;
}
