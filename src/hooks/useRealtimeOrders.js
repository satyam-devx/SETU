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
import { useAuth } from '@/lib/AuthContext';
import { NotificationAPI, getOrdersByCustomer, getOrdersByVendor, getOrdersByRider } from '@/lib/api';
import { useStore } from '@/lib/store';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { subscribeRealtimeChannel } from '@/lib/realtime-manager';
import { subscribeOrders, subscribeNotifications, subscribe as subscribeSetuRealtime, isSetuRealtimeEnabled } from '@/lib/setu-realtime';

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
export function useRealtimeOrders(roleArg, entityId = null) {
  const { user } = useAuth();
  const channelRef = useRef(null);
  const [fetchDone, setFetchDone] = useState(false);
  const [subReady, setSubReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const fetchGenerationRef = useRef(0);
  const isActive = useAppLifecycle();

  let role, eid;
  if (roleArg && typeof roleArg === 'object') {
    role = roleArg.mode ?? roleArg.role ?? null;
    eid = roleArg.entityId ?? roleArg.vendorId ?? roleArg.riderId ?? roleArg.customerId ?? null;
  } else { role = roleArg; eid = entityId; }
  const uid = eid || user?.id;
  const keyFactory = { customer: queryKeys.orders.customer, vendor: queryKeys.orders.vendor, rider: queryKeys.orders.rider }[role];
  const queryKey = useMemo(() => keyFactory && uid ? [...keyFactory(uid), 0, 50, null] : null, [keyFactory, uid]);

  const fetchInitial = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;
    if (!isSupabaseConfigured || !user || !uid || !queryKey) {
      if (generation === fetchGenerationRef.current) setFetchDone(true);
      return;
    }
    setFetchDone(false);
    const fetchers = { customer: getOrdersByCustomer, vendor: getOrdersByVendor, rider: getOrdersByRider };
    const fetcher = fetchers[role];
    if (fetcher) {
      await queryClientInstance.fetchQuery(queryKey, () => fetcher(uid, { page: 0, limit: 50 }));
      if (generation === fetchGenerationRef.current) {
        const cached = queryClientInstance.getQueryState(queryKey)?.data;
        setOrders(Array.isArray(cached) ? cached : []);
      }
    }
    if (generation === fetchGenerationRef.current) setFetchDone(true);
  }, [user, uid, role, queryKey]);

  useEffect(() => { if (isActive) fetchInitial(); }, [fetchInitial, isActive]);

  useEffect(() => {
    if (!queryKey) { setOrders([]); return undefined; }
    const syncOrders = () => {
      const cached = queryClientInstance.getQueryState(queryKey)?.data;
      setOrders(Array.isArray(cached) ? cached : []);
    };
    syncOrders();
    return queryClientInstance.subscribe(queryKey, syncOrders);
  }, [queryKey]);

  // When the Redis-backed SETU gateway is enabled, order changes also arrive
  // through the app-facing WebSocket. The authoritative row still lives in
  // Supabase, so the event only triggers a normal refetch/cache sync here.
  // Supabase Realtime below remains active as the fail-safe transport.
  useEffect(() => {
    if (!queryKey || !user?.id) return undefined;
    return subscribeOrders(message => {
      const id = message?.entity?.id;
      if (id && message.operation === 'DELETE') queryClientInstance.removeQueries(queryKeys.orders.detail(id));
      else if (id && message.entity) queryClientInstance.setQueryData(queryKeys.orders.detail(id), current => ({ ...(current ?? {}), ...message.entity }));
      // Invalidation refetches active queries from the authoritative database.
      // Do not perform a second explicit fetch here because Supabase Realtime
      // remains enabled as a compatibility transport.
      void queryClientInstance.invalidateQueries({ queryKey });
    });
  }, [queryKey, user?.id, fetchInitial]);

  useEffect(() => {
    if (!isActive) { setSubReady(false); return undefined; }
    if (!isSupabaseConfigured || !user || !uid) { setSubReady(true); return; }
    setSubReady(false);
    let filter;
    if (role === 'customer') filter = `customer_id=eq.${uid}`;
    else if (role === 'vendor') filter = `vendor_id=eq.${uid}`;
    else if (role === 'rider') filter = `rider_id=eq.${uid}`;

    const scopedOrderKey = role === 'customer' ? queryKeys.orders.customer(uid) : role === 'vendor' ? queryKeys.orders.vendor(uid) : role === 'rider' ? queryKeys.orders.rider(uid) : queryKeys.orders.all;
    const unsubscribe = subscribeRealtimeChannel({
      key: `orders:${role}:${uid}`,
      build: (channel, emit) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders', ...(filter ? { filter } : {}) }, emit);
      },
      onEvent: payload => {
        const id = payload.new?.id ?? payload.old?.id;
        if (id && payload.eventType === 'UPDATE') {
          queryClientInstance.setQueryData(queryKeys.orders.detail(id), current => ({ ...(current ?? {}), ...payload.new }));
        }
        if (payload.eventType === 'DELETE' && id) queryClientInstance.removeQueries(queryKeys.orders.detail(id));
        queryClientInstance.invalidateQueries(scopedOrderKey);
        if (id) queryClientInstance.invalidateQueries(queryKeys.orders.detail(id));
      },
      onStatus: status => setSubReady(status === 'SUBSCRIBED'),
      // Realtime reconnect can miss one or more events. Refetch the
      // authoritative scoped list before declaring the channel recovered.
      onRecover: fetchInitial,
    });
    channelRef.current = unsubscribe;
    return () => { unsubscribe(); channelRef.current = null; };
  }, [user, role, uid, isActive]);

  return { orders, isLoading: !fetchDone || !subReady, refetch: fetchInitial };
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
  const seenNotificationIdsRef = useRef(new Set());
  const isActive = useAppLifecycle();
  dispatchRef.current = dispatch;

  // ── Initial history fetch ──────────────────────────────
  // This hook only ever wired up a realtime INSERT listener — it never
  // loaded any notification that existed before the tab opened. In
  // production (non-demo) the store starts with `notifications: []`,
  // so a customer who, say, got their "Order delivered" notification
  // while the app was closed would never see it here at all: the
  // Notifications page would look empty (or only show whatever arrived
  // during the current session) even though real history exists in the
  // database. A separate, fuller hook (hooks/useRealtimeNotifications.js)
  // already did this fetch+hydrate correctly, but nothing ever called
  // it — every layout (Customer/Vendor/Rider) calls this one instead.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    let mounted = true;
    NotificationAPI.getAll(user.id).then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data) {
        // Used to be silently swallowed — a failed history fetch left
        // the customer looking at an empty "No notifications" screen
        // indistinguishable from genuinely having none, with no way to
        // tell something had gone wrong or to retry.
        dispatchRef.current({ type: 'NOTIFICATIONS_LOAD_ERROR', payload: { message: error?.message } });
        return;
      }
      dispatchRef.current({ type: 'HYDRATE_NOTIFICATIONS', payload: { notifications: data } });
      queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), data);
    });
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!isActive || !isSupabaseConfigured || !user || !isSetuRealtimeEnabled()) return;
    return subscribeNotifications(message => {
      const notification = message?.entity;
      if (!notification || seenNotificationIdsRef.current.has(notification.id)) return;
      seenNotificationIdsRef.current.add(notification.id);
      queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), current => {
        const list = Array.isArray(current) ? current : [];
        return list.some(item => item.id === notification.id) ? list : [notification, ...list];
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('setu:notification', {
          detail: { id: notification.id, title: notification.title, body: notification.body, type: notification.type },
        }));
      }
    });
  }, [user, isActive]);

  useEffect(() => {
    if (!isActive || !isSupabaseConfigured || !user) return;

    const recover = () => {
      NotificationAPI.getAll(user.id).then(({ data, error }) => {
        if (error || !data) return;
        dispatchRef.current({ type: 'HYDRATE_NOTIFICATIONS', payload: { notifications: data } });
        queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), data);
      });
    };

    return subscribeRealtimeChannel({
      key: `notifications:${user.id}`,
      build: (channel, emit) => {
        channel.on('postgres_changes', {
          event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
        }, emit);
      },
      onEvent: payload => {
        if (!payload.new) return;
        const notification = payload.new;
        if (payload.eventType === 'INSERT') {
          if (seenNotificationIdsRef.current.has(notification.id)) return;
          seenNotificationIdsRef.current.add(notification.id);
          dispatchRef.current({ type: 'NOTIFICATION_RECEIVED', payload: { notification } });
          queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), current => {
            const list = Array.isArray(current) ? current : [];
            return list.some(item => item.id === notification.id) ? list : [notification, ...list];
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('setu:notification', {
              detail: { id: notification.id, title: notification.title, body: notification.body, type: notification.type },
            }));
          }
        } else if (payload.eventType === 'UPDATE') {
          queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), current =>
            Array.isArray(current) ? current.map(item => item.id === notification.id ? { ...item, ...notification } : item) : current
          );
        } else if (payload.eventType === 'DELETE') {
          queryClientInstance.setQueryData(queryKeys.notifications.list(user.id), current =>
            Array.isArray(current) ? current.filter(item => item.id !== notification.id) : current
          );
        }
      },
      onStatus: status => {
        if (status === 'SUBSCRIBED') console.debug(`[SETU Realtime] Notifications subscribed for ${user.id}`);
      },
      onRecover: recover,
    });
  }, [user, isActive]);
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
  useEffect(() => {
    if (!isSupabaseConfigured || !orderId || !isSetuRealtimeEnabled()) return;
    return subscribeSetuRealtime(`order:${orderId}`, message => {
      const entity = message?.entity;
      if (message?.operation === 'DELETE') queryClientInstance.removeQueries(queryKeys.orders.detail(orderId));
      else if (entity) queryClientInstance.setQueryData(queryKeys.orders.detail(orderId), current => ({ ...(current ?? {}), ...entity }));
      void queryClientInstance.invalidateQueries(queryKeys.orders.detail(orderId));
    });
  }, [orderId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !orderId) return;
    return subscribeRealtimeChannel({
      key: `order-detail:${orderId}`,
      build: (channel, emit) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, emit);
      },
      onEvent: payload => {
        if (payload.eventType === 'DELETE') queryClientInstance.removeQueries(queryKeys.orders.detail(orderId));
        else if (payload.new) queryClientInstance.setQueryData(queryKeys.orders.detail(orderId), current => ({ ...(current ?? {}), ...payload.new }));
        queryClientInstance.invalidateQueries(queryKeys.orders.all);
      },
    });
  }, [orderId]);
}
