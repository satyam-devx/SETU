// SETU — Payment mutation boundary (F1-D.3).
// Provider-specific work stays in lib/payments / PaymentAPI; this hook owns
// mutation orchestration and cross-domain cache invalidation.
import { useCallback, useRef, useState } from 'react';
import { PaymentAPI } from '@/lib/api';
import { initiatePayment } from '@/lib/payments';
import { invalidatePaymentQueries } from '@/lib/payment-query-invalidation';
import { invalidateOrderQueries } from '@/hooks/queries/useOrders';

export function usePaymentMutations() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const run = useCallback(async (fn) => {
    if (isPending) return { data: null, error: new Error('Payment operation already in progress.') };
    setIsPending(true);
    setError(null);
    try {
      const result = await fn();
      if (result?.error) throw result.error;
      return result ?? { data: null, error: null };
    } catch (e) {
      if (mounted.current) setError(e);
      throw e;
    } finally {
      if (mounted.current) setIsPending(false);
    }
  }, [isPending]);

  const payWallet = useCallback(async (orderId, context = {}) => run(async () => {
    const result = await PaymentAPI.payOrderFromWallet(orderId);
    if (result?.error) return result;
    invalidatePaymentQueries({ customerId: context.customerId, orderId });
    invalidateOrderQueries({ customerId: context.customerId, vendorId: context.vendorId, orderId });
    return result;
  }), [run]);

  const payOnline = useCallback(async (paymentContext) => run(async () => {
    const result = await initiatePayment(paymentContext);
    if (result?.success) {
      invalidatePaymentQueries({ customerId: paymentContext.customerId, orderId: paymentContext.orderId });
      invalidateOrderQueries({ customerId: paymentContext.customerId, vendorId: paymentContext.vendorId, orderId: paymentContext.orderId });
    }
    return { data: result, error: result?.error ? new Error(result.error) : null };
  }), [run]);

  return { payWallet, payOnline, isPending, error };
}
