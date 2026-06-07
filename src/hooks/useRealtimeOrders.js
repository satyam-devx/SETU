// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeOrders
// Subscribes to Supabase Realtime on the orders table.
// Filters by the caller's role: customer / vendor / rider.
// Falls back to store state when Supabase is not configured.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { OrderAPI } from '@/lib/api';

/**
 * @param {Object} options
 * @param {'customer'|'vendor'|'rider'|'single'} options.mode
 * @param {string}  options.userId      - auth user id (customer/vendor owner)
 * @param {string}  options.vendorId    - vendor uuid
 * @param {string}  options.riderId     - rider uuid
 * @param {string}  options.orderId     - single order id (mode:'single')
 * @param {boolean} options.activeOnly  - only non-terminal orders
 */
export function useRealtimeOrders({
  mode       = 'customer',
  userId     = null,
  vendorId   = null,
  riderId    = null,
  orderId    = null,
  activeOnly = false,
} = {}) {
  const { state, dispatch } = useStore();
  const [orders, setOrders]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const channelRef = useRef(null);

  // ── Filter helper for store fallback ──
  const filterStoreOrders = useCallback((storeOrders) => {
    let result = storeOrders;
    if (mode === 'single' && orderId) {
      const found = storeOrders.find(o => o.id === orderId);
      return found ? [found] : [];
    }
    if (mode === 'customer' && userId)  result = result.filter(o => o.customerId === userId || !o.customerId);
    if (mode === 'vendor'   && vendorId) result = result.filter(o => o.vendorId === vendorId);
    if (mode === 'rider'    && riderId)  result = result.filter(o => o.riderId   === riderId);
    if (activeOnly) result = result.filter(o => !['delivered','cancelled'].includes(o.status));
    return result;
  }, [mode, userId, vendorId, riderId, orderId, activeOnly]);

  // ── Initial fetch ──
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      // Use store state as source of truth in demo mode
      setOrders(filterStoreOrders(state.orders));
      setIsLoading(false);
      return;
    }

    try {
      let result;
      if (mode === 'single' && orderId) {
        const { data, error: e } = await OrderAPI.getDetail(orderId);
        if (e) throw e;
        result = data ? [data] : [];
      } else if (mode === 'customer' && userId) {
        const { data, error: e } = await OrderAPI.getHistory(userId);
        if (e) throw e;
        result = data ?? [];
      } else if (mode === 'vendor' && vendorId) {
        const { data, error: e } = await supabase
          .from('orders')
          .select('*, order_items(id,name,qty,price)')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });
        if (e) throw e;
        result = data ?? [];
      } else if (mode === 'rider') {
        const { data, error: e } = await supabase
          .from('orders')
          .select('*, order_items(id,name,qty,price)')
          .or(`rider_id.eq.${riderId},and(status.eq.pending,rider_id.is.null)`)
          .order('created_at', { ascending: true });
        if (e) throw e;
        result = data ?? [];
      } else {
        result = filterStoreOrders(state.orders);
      }

      if (activeOnly) {
        result = result.filter(o => !['delivered','cancelled'].includes(o.status));
      }

      setOrders(result);

      // Hydrate store with fresh DB data
      if (result.length) {
        dispatch({ type: 'HYDRATE_ORDERS', payload: { orders: result, mode } });
      }
    } catch (e) {
      setError(e);
      // Fall back to store
      setOrders(filterStoreOrders(state.orders));
    } finally {
      setIsLoading(false);
    }
  }, [mode, userId, vendorId, riderId, orderId, activeOnly, filterStoreOrders, dispatch, state.orders]);

  // ── Realtime subscription ──
  useEffect(() => {
    fetchOrders();

    if (!isSupabaseConfigured) return;

    // Build filter for the subscription
    let filter = null;
    if (mode === 'single'   && orderId)  filter = `id=eq.${orderId}`;
    if (mode === 'customer' && userId)   filter = `customer_id=eq.${userId}`;
    if (mode === 'vendor'   && vendorId) filter = `vendor_id=eq.${vendorId}`;
    if (mode === 'rider'    && riderId)  filter = `rider_id=eq.${riderId}`;

    const channelName = `orders-${mode}-${orderId || userId || vendorId || riderId || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'orders',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          setOrders(prev => {
            if (eventType === 'INSERT') {
              // Don't duplicate
              if (prev.find(o => o.id === newRow.id)) return prev;
              return [newRow, ...prev];
            }
            if (eventType === 'UPDATE') {
              return prev.map(o => o.id === newRow.id ? { ...o, ...newRow } : o);
            }
            if (eventType === 'DELETE') {
              return prev.filter(o => o.id !== oldRow.id);
            }
            return prev;
          });

          // Also update store
          if (eventType === 'UPDATE' && newRow.status) {
            dispatch({
              type: 'ORDER_ADVANCE_STATUS',
              payload: { orderId: newRow.id, newStatus: newRow.status, meta: newRow },
            });
          }
          if (eventType === 'INSERT') {
            dispatch({ type: 'ORDER_PLACE', payload: newRow });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // Only re-subscribe when identity params change, not on every state.orders change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId, vendorId, riderId, orderId, activeOnly]);

  // ── Keep in sync with store in demo mode ──
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setOrders(filterStoreOrders(state.orders));
    }
  }, [state.orders, filterStoreOrders]);

  const refetch = useCallback(() => fetchOrders(), [fetchOrders]);

  // Convenience: single order (mode:'single')
  const order = mode === 'single' ? (orders[0] ?? null) : null;

  return { orders, order, isLoading, error, refetch };
}

/**
 * Convenience hook: single order with real-time updates.
 */
export function useRealtimeOrder(orderId) {
  const { order, isLoading, error, refetch } = useRealtimeOrders({
    mode: 'single',
    orderId,
  });
  return { order, isLoading, error, refetch };
}
