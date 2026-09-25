import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateRiderQueries({ riderId, userId } = {}) {
  let count = 0;
  if (riderId) {
    count += queryClientInstance.invalidateQueries(queryKeys.rider.offers(riderId));
    count += queryClientInstance.invalidateQueries(queryKeys.orders.rider(riderId));
    count += queryClientInstance.invalidateQueries(queryKeys.rider.sos(riderId));
  }
  if (userId) {
    count += queryClientInstance.invalidateQueries(queryKeys.rider.byUser(userId));
    count += queryClientInstance.invalidateQueries(queryKeys.rider.earnings(userId, 'week'));
    count += queryClientInstance.invalidateQueries(queryKeys.rider.earnings(userId, 'month'));
    count += queryClientInstance.invalidateQueries(queryKeys.rider.earnings(userId, 'day'));
  }
  return count;
}
