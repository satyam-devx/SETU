// SETU — Order mutation boundary (F1-D.2).
import { useCallback, useRef, useState } from 'react';
import { placeOrder, updateOrderStatus, cancelOrderWithRefund, rateOrder, assignRider, completeDelivery, updateRiderLocation } from '@/lib/api';
import { invalidateOrderQueries } from '@/hooks/queries/useOrders';

function useMutationRunner() {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const run = useCallback(async fn => {
    setPending(true); setError(null);
    try {
      const result = await fn();
      if (mounted.current && result?.error) setError(result.error);
      return result;
    } catch (e) {
      const normalized = { message: e?.message || String(e) };
      if (mounted.current) setError(normalized);
      return { data: null, error: normalized };
    } finally { if (mounted.current) setPending(false); }
  }, []);
  return { run, isPending, error };
}

export function useOrderMutations() {
  const runner = useMutationRunner();
  const place = useCallback((payload, context = {}) => runner.run(async () => {
    const result = await placeOrder(payload);
    if (!result.error && result.data?.id) invalidateOrderQueries({ ...context, orderId: result.data.id });
    return result;
  }), [runner.run]);

  const updateStatus = useCallback((orderId, status, extra = {}, context = {}) => runner.run(async () => {
    const result = await updateOrderStatus(orderId, status, extra);
    if (!result.error) invalidateOrderQueries({ ...context, orderId });
    return result;
  }), [runner.run]);

  const cancel = useCallback((orderId, actorId, actorRole = 'customer', reason = null, context = {}) => runner.run(async () => {
    const result = await cancelOrderWithRefund(orderId, actorId, actorRole, reason);
    if (!result.error) invalidateOrderQueries({ ...context, orderId });
    return result;
  }), [runner.run]);

  const rate = useCallback((payload, context = {}) => runner.run(async () => {
    const result = await rateOrder(payload);
    if (!result.error) invalidateOrderQueries({ ...context, orderId: payload.orderId });
    return result;
  }), [runner.run]);

  const assign = useCallback((orderId, riderId, riderName, offerId, context = {}) => runner.run(async () => {
    const result = await assignRider(orderId, riderId, riderName, offerId);
    if (!result.error) invalidateOrderQueries({ ...context, orderId, riderId });
    return result;
  }), [runner.run]);

  const deliver = useCallback((orderId, otp, proofFile, location, context = {}) => runner.run(async () => {
    const result = await completeDelivery(orderId, otp, proofFile, location);
    if (!result.error) invalidateOrderQueries({ ...context, orderId });
    return result;
  }), [runner.run]);

  const updateLocation = useCallback((riderId, lat, lng) => runner.run(() => updateRiderLocation(riderId, lat, lng)), [runner.run]);
  return { placeOrder: place, updateOrderStatus: updateStatus, cancelOrder: cancel, rateOrder: rate, assignRider: assign, completeDelivery: deliver, updateRiderLocation: updateLocation, isPending: runner.isPending, error: runner.error };
}
