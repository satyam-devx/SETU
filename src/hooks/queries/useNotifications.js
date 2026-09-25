import { useCallback } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { queryKeys } from '@/lib/query-keys';
import { getNotifications } from '@/lib/api';

export function useNotifications(userId, options = {}) {
  const queryFn = useCallback(() => getNotifications(userId, { limit: options.limit ?? 30 }), [userId, options.limit]);
  return useQuery(queryKeys.notifications.list(userId), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}
