import { useEffect, useState } from 'react';
import { getSetuRealtimeStatus, subscribeStatus } from '@/lib/setu-realtime';

export function useSetuRealtimeStatus() {
  const [state, setState] = useState(getSetuRealtimeStatus());
  useEffect(() => subscribeStatus(setState), []);
  return state;
}
