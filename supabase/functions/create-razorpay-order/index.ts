import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * create-razorpay-order
 *
 * Required Supabase Vault Secrets:
 *   RAZORPAY_KEY_ID     — Razorpay API key ID (rzp_live_... or rzp_test_...)
 *   RAZORPAY_KEY_SECRET — Razorpay API secret key
 */

const RAZORPAY_KEY_ID     = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { amount, orderId, customerId, type } = body

  // Validate required fields
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return new Response(
      JSON.stringify({ error: "Invalid amount" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "customerId is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('[create-razorpay-order] Razorpay credentials not set')
    return new Response(
      JSON.stringify({ error: "Payment service not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Create Razorpay Order via server-side API (secret never touches client)
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

  let razorpayOrder: any
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(amount * 100), // Razorpay uses paise
        currency: 'INR',
        receipt:  orderId ?? `topup_${Date.now()}`,
        notes: {
          customerId,
          orderId: orderId ?? null,
          type:    type ?? 'order_payment',
        },
      }),
    })

    razorpayOrder = await response.json()
  } catch (fetchErr) {
    console.error('[create-razorpay-order] Razorpay API fetch failed:', fetchErr)
    return new Response(
      JSON.stringify({ error: "Failed to reach payment gateway" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (razorpayOrder.error) {
    console.error('[create-razorpay-order] Razorpay returned error:', razorpayOrder.error)
    return new Response(
      JSON.stringify({ error: razorpayOrder.error.description ?? "Payment order creation failed" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Log to payment_orders for internal tracking
  const { error: dbErr } = await supabase.from('payment_orders').insert({
    razorpay_order_id: razorpayOrder.id,
    order_id:          orderId ?? null,
    user_id:           customerId,
    amount:            amount,
    status:            'created',
    notes:             { type: type ?? 'order_payment' },
  })

  if (dbErr) {
    console.error('[create-razorpay-order] DB insert failed:', dbErr)
    // Non-fatal — order exists in Razorpay; proceed
  }

  return new Response(JSON.stringify(razorpayOrder), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status:  200,
  })
})
