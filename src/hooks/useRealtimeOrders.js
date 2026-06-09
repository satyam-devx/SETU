// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeOrders
// Supabase Realtime subscription for order status updates.
// Constitution: "Realtime order tracking for customers, vendors, riders"
//
// Design:
//  - Subscribes to INSERT + UPDATE on orders table
//  - Filters by role: customer_id / vendor_id / rider_id
//  - Updates global store optimistically
//  - Cleans up subscription on unmount
//  - Falls back gracefully when offline or Supabase unavailable
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';

/**
 * @param {string} role  - 'customer' | 'vendor' | 'rider' | 'admin'
 * @param {string} [entityId] - vendor UUID or rider UUID (override for vendor/rider)
 */
export function useRealtimeOrders(role, entityId = null) {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const channelRef = useRef(null);

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
    if (!isSupabaseConfigured || !user) return;

    const uid = entityId || user.id;
    const channelName = `orders-${role}-${uid}`;

    // Build filter based on role
    let filter;
    if (role === 'customer') filter = `customer_id=eq.${uid}`;
    else if (role === 'vendor') filter = `vendor_id=eq.${uid}`;
    else if (role === 'rider')  filter = `rider_id=eq.${uid}`;
    // admin: no filter — listens to all orders

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
          console.debug(`[SETU Realtime] Subscribed: ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[SETU Realtime] Channel error: ${channelName}`);
        }
      });

    return () => {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [user, role, entityId, handlePayload]);
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
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [orderId, dispatch]);
}
