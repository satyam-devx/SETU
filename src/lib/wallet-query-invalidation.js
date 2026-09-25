import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export function invalidateWalletQueries({ userId } = {}) {
  if (!userId) return;
  queryClientInstance.invalidateQueries(queryKeys.wallet.customer(userId));
  queryClientInstance.invalidateQueries(['wallet-transactions', userId]);
}
