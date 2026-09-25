import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateNotificationQueries({ userId } = {}) {
  if (userId) queryClientInstance.invalidateQueries(queryKeys.notifications.list(userId));
}
