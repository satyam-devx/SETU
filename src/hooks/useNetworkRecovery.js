import { useEffect, useState } from 'react';
import { subscribeNetwork, isNetworkOnline } from '@/lib/network-state';
import { queryClientInstance } from '@/lib/query-client';

export function useNetworkRecovery() {
  const [isOnline, setIsOnline] = useState(isNetworkOnline());
  useEffect(() => subscribeNetwork(online => {
    setIsOnline(online);
    if (online) queryClientInstance.refetchInvalidated();
  }), []);
  return isOnline;
}
