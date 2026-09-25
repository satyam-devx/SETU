import { useEffect, useState } from 'react';
import { subscribeNetwork, isNetworkOnline } from '@/lib/network-state';
import { flushOfflineMutations } from '@/lib/offline-mutation-queue';
import { queryClientInstance } from '@/lib/query-client';

export function useOfflineRecovery() {
  const [isOnline, setIsOnline] = useState(isNetworkOnline());
  useEffect(() => subscribeNetwork(async online => {
    setIsOnline(online);
    if (online) {
      await flushOfflineMutations();
      await queryClientInstance.refetchInvalidated();
    }
  }), []);
  return isOnline;
}
