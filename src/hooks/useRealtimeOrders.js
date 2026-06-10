// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeOrders  (Phase 3 merged)
//
// Merges:
//  YOUR changes  — initial DB fetch, DELETE handling, dual-gate
//                  isLoading (fetchDone + subReady), rider entityId
//                  clarification, fetchedRef idempotency guard
//  Phase 3 adds  — CustomEvent 'setu:notification' from
//                  useRealtimeNotifications so CustomerHome can
//                  show in-app toast without prop-drilling;
//                  channel name suffix on useRealtimeOrder to
//                  avoid collision with useRealtimeOrders
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';

// ── useRealtimeOrders ─────────────────────────────────────
/**
 * Subscribe to realtime order updates for a given role and return the
 * matching slice of orders from the global store.
 *
 * @param {'customer'|'vendor'|'rider'|'admin'} role
 * @param {string|null} [entityId]
 *   For 'rider' this MUST be riders.id (PK), NOT auth uid.
 *   For all other roles defaults to auth uid.
 * @returns {{ orders: object[], isLoading: boolean }}
 *
 * isLoading is true until BOTH:
 *   1. The initial DB fetch completes (so state.orders is populated
 *      before the first realtime event arrives), AND
 *   2. The Supabase channel confirms SUBSCRIBED.
 */
export function useRealtimeOrders(role, entityId = null) {
  const { user }            = useAuth();
  const { state, dispatch } = useStore();
  const channelRef          = useRef(null);
  const fetchedRef          = useRef(false);   // prevents double-fetch in StrictMode

  const [fetchDone, setFetchDone] = useState(false);
  const [subReady,  setSubReady]  = useState(false);
  const isLoading = !fetchDone || !subReady;

  const uid = entityId || user?.id;

  // ── Derived: filter global store by role + id ────────────
  const orders = useMemo(() => {
    if (!uid || !state.orders) return [];
    if (role === 'customer') return state.orders.filter(o => o.customer_id === uid || o.customerId === uid);
    if (role === 'vendor')   return state.orders.filter(o => o.vendor_id   === uid || o.vendorId   === uid);
    if (role === 'rider')    return state.orders.filter(o => o.rider_id    === uid || o.riderId    === uid);
    if (role === 'admin')    return state.orders;
    return [];
  }, [state.orders, role, uid]);

  // ── Realtime payload handler ──────────────────────────────
  const handlePayload = useCallback((payload) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      dispatch({ type: 'ORDER_CREATED',       payload: { order: payload.new } });
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { orderId: payload.new.id, updates: payload.new } });
    } else if (payload.eventType === 'DELETE' && payload.old?.id) {
      dispatch({ type: 'ORDER_REMOVED',       payload: { orderId: payload.old.id } });
    }
  }, [dispatch]);

  // ── 1. Initial DB fetch ───────────────────────────────────
  // Populates state.orders before any realtime events arrive,
  // so the list never flashes empty on first render.
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
      // admin: no filter — all orders

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

  // ── 2. Realtime subscription ──────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !user || !uid) {
      // Not configured or not logged in — unblock UI immediately
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
/**
 * Call once at the customer-portal root (CustomerHome / CustomerLayout).
 *
 * Two things happen on each incoming notification:
 *  1. Dispatches NOTIFICATION_RECEIVED into the global store
 *     → bumps unreadCount, prepends to notification list.
 *  2. Fires a DOM CustomEvent 'setu:notification' so CustomerHome
 *     can show an in-app toast without prop-drilling or a new context.
 *
 *     window.addEventListener('setu:notification', (e) => showToast(e.detail))
 */
export function useRealtimeNotifications() {
  const { user }    = useAuth();
  const { dispatch } = useStore();
  const channelRef  = useRef(null);

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
        if (!payload.new) return;
        const notification = payload.new;

        // 1. Global store — bell badge + notification list
        dispatch({ type: 'NOTIFICATION_RECEIVED', payload: { notification } });

        // 2. DOM CustomEvent — CustomerHome listens and shows toast
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('setu:notification', {
              detail: {
                id:    notification.id,
                title: notification.title,
                body:  notification.body,
                type:  notification.type,
              },
            })
          );
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug(`[SETU Realtime] Notifications subscribed for ${user.id}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, dispatch]);
}

// ── useRealtimeOrder (single order) ──────────────────────
/**
 * Used by CustomerOrderDetail — subscribes to UPDATE on one order row.
 * Writes into the global store; the component reads from state.orders.
 *
 * Channel name uses '-detail-' suffix to avoid colliding with
 * useRealtimeOrders which may have an open channel named 'order-{uid}'
 * on the same page.
 *
 * @param {string|null} orderId
 */
export function useRealtimeOrder(orderId) {
  const { dispatch } = useStore();
  const channelRef   = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !orderId) return;

    channelRef.current = supabase
      .channel(`order-detail-${orderId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        if (payload.new) {
          dispatch({
            type:    'UPDATE_ORDER_STATUS',
            payload: { orderId, updates: payload.new },
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug(`[SETU Realtime] Single-order subscribed: ${orderId}`);
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orderId, dispatch]);
}
