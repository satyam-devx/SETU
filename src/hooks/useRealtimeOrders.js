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
//
// FIX: handlePayload is stored in a ref (handlePayloadRef) so the
//      subscription useEffect never needs it as a dependency.
//      This prevents the "cannot add postgres_changes callbacks
//      after subscribe()" error caused by React StrictMode running
//      effects twice — the channel is created exactly once per
//      uid/role change, never re-subscribed mid-lifecycle.
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
  // Stored in a ref so the subscription effect never needs it as a dep.
  // This is the key fix: if handlePayload were in the effect's dep array,
  // React StrictMode's double-invoke would recreate the channel while the
  // old one is still subscribed, triggering the "cannot add postgres_changes
  // callbacks after subscribe()" error.
  const handlePayloadRef = useRef(null);
  handlePayloadRef.current = useCallback((payload) => {
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
  // Deps: only [user, role, uid] — NOT handlePayload.
  // The ref pattern above ensures the latest handler is always called
  // without the effect needing to re-run when dispatch changes.
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

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'orders',
        ...(filter ? { filter } : {}),
      }, (payload) => {
        // Always call the latest version of the handler via ref
        handlePayloadRef.current?.(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSubReady(true);
          console.debug(`[SETU Realtime] Subscribed: ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          setSubReady(true);
          console.warn(`[SETU Realtime] Channel error: ${channelName}`);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, role, uid]); // ← no handlePayload here — that's the fix

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
  const { user }     = useAuth();
  const { dispatch } = useStore();
  const dispatchRef  = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (!payload.new) return;
        const notification = payload.new;

        dispatchRef.current({ type: 'NOTIFICATION_RECEIVED', payload: { notification } });

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
      supabase.removeChannel(channel);
    };
  }, [user]); // ← dispatch removed from deps, accessed via ref
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
  const dispatchRef  = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!isSupabaseConfigured || !orderId) return;

    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        if (payload.new) {
          dispatchRef.current({
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
      supabase.removeChannel(channel);
    };
  }, [orderId]); // ← dispatch removed from deps, accessed via ref
}
