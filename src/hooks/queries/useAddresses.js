import { useCallback } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { queryKeys } from '@/lib/query-keys';
import { getAddresses } from '@/lib/api';

export function useAddresses(customerId, options = {}) {
  const queryFn = useCallback(({ signal } = {}) => getAddresses(customerId, signal), [customerId]);
  return useQuery(queryKeys.addresses.customer(customerId), queryFn, { ...options, enabled: Boolean(customerId) && options.enabled !== false });
}
