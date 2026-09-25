// SETU — Checkout mutation boundary (F1-D.3).
// Owns the checkout transaction choreography while leaving the actual
// server/provider APIs in their existing canonical boundaries.
import { useCallback, useState } from 'react';
import { useOrderMutations } from '@/hooks/mutations/useOrderMutations';
import { usePaymentMutations } from '@/hooks/mutations/usePaymentMutations';
import { invalidatePaymentQueries } from '@/lib/payment-query-invalidation';
import { invalidateOrderQueries } from '@/hooks/queries/useOrders';

export function useCheckoutMutations() {
  const { placeOrder, cancelOrder } = useOrderMutations();
  const { payWallet, payOnline } = usePaymentMutations();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const submitCheckout = useCallback(async ({
    orderPayload,
    paymentMethod = 'cod',
    customerId,
    vendorId,
    customerName,
    customerPhone,
  }) => {
    if (isPending) throw new Error('Checkout is already in progress.');
    setIsPending(true);
    setError(null);

    let order = null;
    try {
      const created = await placeOrder(orderPayload, { customerId, vendorId });
      if (created?.error) throw created.error;
      order = created?.data;
      if (!order?.id) throw new Error('Order could not be created. Please try again.');

      invalidateOrderQueries({ customerId, vendorId, orderId: order.id });
      invalidatePaymentQueries({ customerId, orderId: order.id });

      const serverTotal = order.total;

      // Idempotent replay: the server may return an already-paid order when
      // the previous response was lost. Never charge it a second time.
      if (order.payment_status === 'paid') {
        return { data: order, error: null, alreadyPaid: true };
      }

      if (paymentMethod === 'upi') {
        let payment;
        try {
          payment = await payOnline({
          amount: serverTotal,
          orderId: order.id,
          customerId,
          customerName,
          customerPhone,
          vendorId,
          });
        } catch (paymentError) {
          await cancelOrder(order.id, customerId, 'customer', 'Payment failed', { customerId, vendorId }).catch(() => {});
          invalidatePaymentQueries({ customerId, orderId: order.id });
          throw paymentError;
        }

        if (payment?.data?.cancelled) {
          await cancelOrder(order.id, customerId, 'customer', 'Payment cancelled by user', { customerId, vendorId });
          invalidatePaymentQueries({ customerId, orderId: order.id });
          return { data: order, error: null, cancelled: true, orderCancelled: true };
        }

        if (payment?.data?.error) {
          await cancelOrder(order.id, customerId, 'customer', 'Payment failed', { customerId, vendorId }).catch(() => {});
          throw new Error(payment.data.error);
        }
      } else if (paymentMethod === 'wallet') {
        let walletResult;
        try {
          walletResult = await payWallet(order.id, { customerId, vendorId });
        } catch (walletError) {
          await cancelOrder(order.id, customerId, 'customer', 'Wallet payment failed', { customerId, vendorId }).catch(() => {});
          invalidatePaymentQueries({ customerId, orderId: order.id });
          throw walletError;
        }
        invalidatePaymentQueries({ customerId, orderId: order.id });
        invalidateOrderQueries({ customerId, vendorId, orderId: order.id });
        return { data: order, payment: walletResult.data ?? walletResult, error: null };
      }

      // COD has no payment provider mutation. UPI success is webhook-driven;
      // the order cache is invalidated so the next read reconciles server state.
      invalidatePaymentQueries({ customerId, orderId: order.id });
      invalidateOrderQueries({ customerId, vendorId, orderId: order.id });
      return { data: order, error: null };
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, [isPending, placeOrder, cancelOrder, payOnline, payWallet]);

  const cancelCheckoutPayment = useCallback(async ({ orderId, customerId, vendorId, reason = 'Payment cancelled by user' }) => {
    const result = await cancelOrder(orderId, customerId, 'customer', reason, { customerId, vendorId });
    invalidatePaymentQueries({ customerId, orderId });
    invalidateOrderQueries({ customerId, vendorId, orderId });
    return result;
  }, [cancelOrder]);

  return { submitCheckout, cancelCheckoutPayment, isPending, error };
}
