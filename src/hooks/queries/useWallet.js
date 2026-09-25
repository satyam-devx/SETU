import { useCallback } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { queryKeys } from '@/lib/query-keys';
import { getWallet, getWalletTransactions } from '@/lib/api';

export function useWallet(userId, options = {}) {
  const queryFn = useCallback(() => getWallet(userId), [userId]);
  return useQuery(queryKeys.wallet.customer(userId), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}

export function useWalletTransactions(userId, page = 0, limit = 20, options = {}) {
  const queryFn = useCallback(() => getWalletTransactions(userId, { page, limit }), [userId, page, limit]);
  return useQuery(queryKeys.wallet.transactions(userId, page, limit), queryFn, { ...options, enabled: Boolean(userId) && options.enabled !== false });
}
