import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7?target=deno&no-check=true"
import { corsHeaders } from "../_shared/cors.ts"
import { requireUser } from "../_shared/auth.ts"

/**
 * create-razorpay-order
 *
 * Required Supabase Vault Secrets:
 *   RAZORPAY_KEY_ID     — Razorpay API key ID (rzp_live_... or rzp_test_...)
 *   RAZORPAY_KEY_SECRET — Razorpay API secret key
 */

const RAZORPAY_KEY_ID     = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  // ── Auth: Verify JWT ──────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { user, error: authError } = await requireUser(req, supabase)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: authError ?? "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // ── Basic rate limit: 10 order-creation attempts / 5 min / user ──
  const { data: withinLimit } = await supabase.rpc('check_rate_limit', {
    p_key: `create-razorpay-order:${user.id}`,
    p_max_count: 10,
    p_window_seconds: 300,
  })
  if (withinLimit === false) {
    return new Response(
      JSON.stringify({ error: "Too many payment attempts. Please wait a few minutes and try again." }),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
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

  let { amount, orderId, customerId, type } = body
  type = type ?? 'order_payment'

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "customerId is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Ensure user can only create orders for themselves
  if (customerId !== user.id) {
    return new Response(
      JSON.stringify({ error: "Forbidden: customerId mismatch" }),
      { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // ── CRITICAL-1 FIX ──────────────────────────────────────────
  // The client-supplied `amount` used to be trusted verbatim and
  // sent straight to Razorpay. An attacker could open checkout on a
  // ₹10,000 order, then call this function directly with
  // amount: 1, pay ₹1, and have the webhook mark the full order as
  // paid + release the full amount from escrow to the vendor.
  //
  // For real order payments we now IGNORE the client amount and
  // load the authoritative total from the orders table ourselves.
  // For wallet top-ups / credit repayments there is no "order" to
  // check against — it's the customer adding their own money — but
  // we still bound it to a sane range to stop fat-finger / abuse
  // amounts reaching Razorpay.
  let serverAmount: number

  if (type === 'order_payment') {
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "orderId is required for order_payment" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_id, total, payment_status')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    if ((order as any).customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: not your order" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    if (!['pending', 'failed'].includes((order as any).payment_status)) {
      return new Response(
        JSON.stringify({ error: `Order payment_status is '${(order as any).payment_status}' — cannot create a new payment order` }),
        { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    serverAmount = Number((order as any).total)
  } else if (type === 'wallet_topup' || type === 'credit_repayment') {
    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }
    // Sane bounds — tune to your real product limits.
    const MAX_TOPUP = 50000
    if (amount > MAX_TOPUP) {
      return new Response(
        JSON.stringify({ error: `Amount exceeds maximum allowed (₹${MAX_TOPUP})` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }
    serverAmount = amount
  } else {
    return new Response(
      JSON.stringify({ error: `Unknown payment type: ${type}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (!serverAmount || serverAmount <= 0) {
    return new Response(
      JSON.stringify({ error: "Invalid amount" }),
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
        amount:   Math.round(serverAmount * 100), // Razorpay uses paise
        currency: 'INR',
        receipt:  orderId ?? `topup_${Date.now()}`,
        notes: {
          customerId,
          orderId: orderId ?? null,
          type,
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
    amount:            serverAmount,
    status:            'created',
    notes:             { type },
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
