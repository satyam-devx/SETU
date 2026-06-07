import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

serve(async (req) => {
  const { amount, orderId, customerId, type } = await req.json()

  // 1. Initialize Supabase Admin Client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Create Razorpay Order
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amount * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: orderId || `topup_${Date.now()}`,
      notes: {
        customerId,
        orderId,
        type: type || 'order_payment'
      }
    }),
  })

  const razorpayOrder = await response.json()

  if (razorpayOrder.error) {
    return new Response(JSON.stringify(razorpayOrder), { status: 400 })
  }

  // 3. Log to payment_orders table
  await supabase.from('payment_orders').insert({
    razorpay_order_id: razorpayOrder.id,
    order_id: orderId || null,
    user_id: customerId,
    amount: amount,
    status: 'created',
    notes: { type: type || 'order_payment' }
  })

  return new Response(JSON.stringify(razorpayOrder), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
})
