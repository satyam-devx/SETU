// SETU — Admin order mutation boundary (F1-D.4).
// Admin UI never calls lifecycle mutation APIs directly.
import { useCallback, useState } from 'react';
import { AdminAPI } from '@/lib/api';
import { invalidateAdminOrderQueries } from '@/lib/admin-query-invalidation';

export function useAdminOrderMutations() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setIsPending(true);
    setError(null);
    try {
      const result = await fn();
      if (result?.error) {
        setError(result.error);
      }
      return result ?? { data: null, error: null };
    } catch (e) {
      const normalized = { message: e?.message || String(e) };
      setError(normalized);
      return { data: null, error: normalized };
    } finally {
      setIsPending(false);
    }
  }, []);

  const updateOrderStatus = useCallback((orderId, status, note = null, context = {}) => run(async () => {
    const result = await AdminAPI.updateOrderStatus(orderId, status, note);
    if (!result?.error) invalidateAdminOrderQueries({ orderId, ...context });
    return result;
  }), [run]);

  const cancelOrder = useCallback((orderId, reason, context = {}) => run(async () => {
    const result = await AdminAPI.cancelOrder(orderId, reason);
    if (!result?.error) invalidateAdminOrderQueries({ orderId, ...context });
    return result;
  }), [run]);

  const assignRider = useCallback((orderId, riderId, riderName, context = {}) => run(async () => {
    const result = await AdminAPI.assignRider(orderId, riderId, riderName);
    if (!result?.error) invalidateAdminOrderQueries({ orderId, riderId, ...context });
    return result;
  }), [run]);

  return { updateOrderStatus, cancelOrder, assignRider, isPending, error };
}
