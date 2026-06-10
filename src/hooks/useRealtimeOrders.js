// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeOrders
// Supabase Realtime subscription for order status updates.
//
// Fix log (Phase 0):
//  - Added initial DB fetch so state.orders is populated
//    before any realtime INSERT/UPDATE arrives.
//  - Added DELETE event handling.
//  - isLoading now stays true until BOTH the initial fetch
//    AND the subscription handshake complete.
//  - Rider filter uses rider.id (not user.id) — callers
//    must pass entityId=rider.id for the rider role.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';

/**
 * Subscribe to realtime order updates for a given role and return the
 * matching slice of orders from the global store.
 *
 * @param {'customer'|'vendor'|'rider'|'admin'} role
 * @param {string|null} [entityId]  - entity UUID.
 *   For 'rider' this MUST be the riders.id (PK), not auth user.id.
 *   For other roles it defaults to auth user.id.
 * @returns {{ orders: object[], isLoading: boolean }}
 */
export function useRealtimeOrders(role, entityId = null) {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const channelRef  = useRef(null);
  const fetchedRef  = useRef(false);
  const [fetchDone, setFetchDone]     = useState(false);
  const [subReady,  setSubReady]      = useState(false);

  const isLoading = !fetchDone || !subReady;

  // For non-rider roles fall back to auth user id.
  const uid = entityId || user?.id;

  // ── Derived: filter global store orders by role + id ────
  const orders = useMemo(() => {
    if (!uid || !state.orders) return [];
    if (role === 'customer') return state.orders.filter(o => o.customer_id === uid);
    if (role === 'vendor')   return state.orders.filter(o => o.vendor_id   === uid);
    if (role === 'rider')    return state.orders.filter(o => o.rider_id    === uid);
    if (role === 'admin')    return state.orders;
    return [];
  }, [state.orders, role, uid]);

  // ── Realtime handler: push DB events into the store ─────
  const handlePayload = useCallback((payload) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      dispatch({ type: 'ORDER_CREATED',      payload: { order: payload.new } });
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { orderId: payload.new.id, updates: payload.new } });
    } else if (payload.eventType === 'DELETE' && payload.old?.id) {
      dispatch({ type: 'ORDER_REMOVED',       payload: { orderId: payload.old.id } });
    }
  }, [dispatch]);

  // ── Initial DB fetch ─────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !user || !uid || fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchInitial() {
      let q = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (role === 'customer') q = q.eq('customer_id', uid);
      else if (role === 'vendor')   q = q.eq('vendor_id',   uid);
      else if (role === 'rider')    q = q.eq('rider_id',    uid);
      // admin: no filter

      const { data, error } = await q;
      if (error) {
        console.warn('[useRealtimeOrders] Initial fetch error:', error.message);
      } else if (data?.length) {
        dispatch({ type: 'SET_ORDERS', payload: { orders: data } });
      }
      setFetchDone(true);
    }

    fetchInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, uid]);

  // ── Realtime subscription ────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !user || !uid) {
      setFetchDone(true);
      setSubReady(true);
      return;
    }

    const channelName = `orders-${role}-${uid}`;

    let filter;
    if (role === 'customer') filter = `customer_id=eq.${uid}`;
    else if (role === 'vendor')   filter = `vendor_id=eq.${uid}`;
    else if (role === 'rider')    filter = `rider_id=eq.${uid}`;

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'orders',
        ...(filter ? { filter } : {}),
      }, handlePayload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSubReady(true);
          console.debug(`[SETU Realtime] Subscribed: ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          setSubReady(true); // unblock UI even on error
          console.warn(`[SETU Realtime] Channel error: ${channelName}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, role, uid, handlePayload]);

  return { orders, isLoading };
}

// ── useRealtimeNotifications ──────────────────────────────
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    channelRef.current = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new) {
          dispatch({ type: 'NOTIFICATION_RECEIVED', payload: { notification: payload.new } });
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, dispatch]);
}

// ── useRealtimeOrder (singular) ───────────────────────────
// Used by CustomerOrderDetail to get live updates for one order.
export function useRealtimeOrder(orderId) {
  const { dispatch } = useStore();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !orderId) return;

    channelRef.current = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        if (payload.new) {
          dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { orderId, updates: payload.new } });
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orderId, dispatch]);
}
