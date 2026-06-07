import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

serve(async (req) => {
  const { amount, orderId, customerId } = await req.json()

  // 1. Create Razorpay Order via Fetch API
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
  const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      receipt: orderId,
    })
  })

  const rzpOrder = await rzpResponse.json()

  if (rzpOrder.error) {
    return new Response(JSON.stringify(rzpOrder), { status: 400 })
  }

  // 2. Persist to Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabase.from('payment_orders').insert({
    razorpay_order_id: rzpOrder.id,
    order_id: orderId,
    user_id: customerId,
    amount: amount,
    status: 'created'
  })

  return new Response(JSON.stringify({
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency
  }), { headers: { 'Content-Type': 'application/json' } })
})
