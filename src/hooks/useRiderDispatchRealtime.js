import { useEffect, useRef } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { subscribeRealtimeChannel } from '@/lib/realtime-manager';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

// F6: one foreground dispatch channel per rider portal. Offer/event changes
// invalidate cached offers instead of each page opening its own channel.
export function useRiderDispatchRealtime(riderId, options = {}) {
  const enabled = options.enabled !== false && Boolean(riderId);
  const isActive = useAppLifecycle();
  const refreshTimer = useRef(null);

  useEffect(() => {
    if (!enabled || !isActive || !isSupabaseConfigured) return undefined;

    const invalidateOffers = () => {
      queryClientInstance.invalidateQueries(queryKeys.rider.offers(riderId));
      queryClientInstance.invalidateQueries(queryKeys.orders.rider(riderId));
    };
    // Foreground transitions must reconcile offers/orders even when no
    // realtime event was missed or emitted while the app was backgrounded.
    const reconcile = () => {
      invalidateOffers();
      queryClientInstance.refetchInvalidated();
    };

    return subscribeRealtimeChannel({
      key: `rider-dispatch:${riderId}`,
      build: (channel, emit) => {
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_offers', filter: `rider_id=eq.${riderId}` }, emit)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_assignment_events', filter: `rider_id=eq.${riderId}` }, emit);
      },
      onEvent: invalidateOffers,
      // Reconcile both authoritative offer and order state after a reconnect.
      onRecover: reconcile,
    });
  }, [enabled, isActive, riderId]);

  useEffect(() => {
    if (!enabled || !isActive) return undefined;
    queryClientInstance.invalidateQueries(queryKeys.rider.offers(riderId));
    queryClientInstance.invalidateQueries(queryKeys.orders.rider(riderId));
    queryClientInstance.refetchInvalidated();
    return undefined;
  }, [enabled, isActive, riderId]);
}
