// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — RAZORPAY INTEGRATION
// ═══════════════════════════════════════════════════════════

import { supabase } from './supabase';

/**
 * Dynamically loads the Razorpay Checkout script.
 */
export function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates a UPI / Card payment via Razorpay.
 */
export async function initiateUPIPayment({ amount, orderId, customerName, phone }) {
  const isLoaded = await loadRazorpay();
  if (!isLoaded) {
    throw new Error('Razorpay SDK failed to load. Check your internet connection.');
  }

  // 1. Call Edge Function to create Razorpay Order
  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: { amount, orderId, customerId: (await supabase.auth.getUser()).data.user?.id }
  });

  if (error) throw error;

  const { razorpayOrderId } = data;

  return new Promise((resolve, reject) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: data.amount,
      currency: data.currency,
      name: 'SETU Platform',
      description: `Order #${orderId}`,
      order_id: razorpayOrderId,
      handler: function (response) {
        resolve({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      prefill: {
        name: customerName,
        contact: phone,
      },
      theme: {
        color: '#0ea5e9', // primary-500
      },
      modal: {
        ondismiss: function () {
          resolve({ cancelled: true });
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  });
}
