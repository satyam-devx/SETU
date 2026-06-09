// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeOrders
// Supabase Realtime subscription for order status updates.
// Constitution: "Realtime order tracking for customers, vendors, riders"
//
// Design:
//  - Returns { orders, isLoading } — consistent signature for all callers
//  - orders: filtered from global store by role + id (derived, no duplication)
//  - isLoading: true until the initial subscription is SUBSCRIBED
//  - Supabase channel is a side-effect only; it writes into the store
//  - Cleans up subscription on unmount
//  - Falls back gracefully when offline or Supabase unavailable
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
 * @param {string|null} [entityId]  - override entity UUID (defaults to auth user id)
 * @returns {{ orders: object[], isLoading: boolean }}
 */
export function useRealtimeOrders(role, entityId = null) {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const channelRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Derived: filter global store orders by role + id ────
  const uid = entityId || user?.id;
  const orders = useMemo(() => {
    if (!uid || !state.orders) return [];
    if (role === 'customer')  return state.orders.filter(o => o.customer_id === uid);
    if (role === 'vendor')    return state.orders.filter(o => o.vendor_id   === uid);
    if (role === 'rider')     return state.orders.filter(o => o.rider_id    === uid);
    if (role === 'admin')     return state.orders; // all orders
    return [];
  }, [state.orders, role, uid]);

  // ── Realtime side-effect: push DB events into the store ─
  const handlePayload = useCallback((payload) => {
    const order = payload.new;
    if (!order) return;

    if (payload.eventType === 'INSERT') {
      dispatch({ type: 'ORDER_CREATED', payload: { order } });
    } else if (payload.eventType === 'UPDATE') {
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { orderId: order.id, updates: order } });
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user || !uid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const channelName = `orders-${role}-${uid}`;

    let filter;
    if (role === 'customer') filter = `customer_id=eq.${uid}`;
    else if (role === 'vendor') filter = `vendor_id=eq.${uid}`;
    else if (role === 'rider')  filter = `rider_id=eq.${uid}`;
    // admin: no filter — receives all order events

    const channelConfig = {
      event:  '*',
      schema: 'public',
      table:  'orders',
      ...(filter ? { filter } : {}),
    };

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handlePayload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLoading(false);
          console.debug(`[SETU Realtime] Subscribed: ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          setIsLoading(false);
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
