// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — RAZORPAY HELPERS
// ═══════════════════════════════════════════════════════════

import { supabase } from './supabase';

/**
 * Dynamically loads the Razorpay Checkout script
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates a Razorpay payment via Edge Function.
 *
 * Always resolves to a plain result object — { success }, { cancelled },
 * or { error } — never rejects. It used to let a synchronous failure
 * inside the Promise executor (most commonly `new window.Razorpay(...)`
 * throwing because the checkout.js script never loaded — a real
 * possibility on the poor/2G connections this app targets) escape as an
 * unhandled promise rejection instead of the `{ error }` shape callers
 * check for, which meant a checkout page in this state didn't clean up
 * the order it had just created (see CustomerCheckout's UPI branch).
 */
export async function initiatePayment({ amount, orderId, customerId, customerName, customerPhone, type = 'order_payment' }) {
  try {
    // 1. Create Razorpay Order via Edge Function
    const { data: rzpOrder, error: funcError } = await supabase.functions.invoke('create-razorpay-order', {
      body: { amount, orderId, customerId, type }
    });

    if (funcError || !rzpOrder) throw funcError || new Error('Failed to create payment order');

    if (typeof window === 'undefined' || !window.Razorpay) {
      return { error: 'Payment could not start — check your internet connection and try again, or choose Cash on Delivery.' };
    }

    // 2. Open Razorpay Checkout
    return await new Promise((resolve) => {
      try {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: 'SETU Platform',
          description: type === 'wallet_topup' ? 'Wallet Topup' : `Order #${orderId}`,
          order_id: rzpOrder.id,
          handler: function (response) {
            // Success: Razorpay gives payment_id, order_id, and signature
            resolve({
              success: true,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
          prefill: {
            name: customerName,
            contact: customerPhone,
          },
          theme: {
            color: '#F97316', // primary-orange
          },
          modal: {
            ondismiss: function () {
              resolve({ cancelled: true });
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          resolve({ error: response?.error?.description || 'Payment failed. Please try again.' });
        });
        rzp.open();
      } catch (e) {
        // Constructor/open() failure (e.g. malformed options, SDK loaded
        // but broken) — resolve rather than let it become a rejection.
        resolve({ error: e.message || 'Payment could not start.' });
      }
    });
  } catch (error) {
    console.error('[SETU Payments] Error:', error);
    return { error: error.message };
  }
}
