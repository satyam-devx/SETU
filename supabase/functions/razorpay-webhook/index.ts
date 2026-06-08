import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts"

const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const body      = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  // 1. Verify HMAC-SHA256 Signature — reject anything without valid sig
  if (!WEBHOOK_SECRET) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not set')
    return new Response("Server misconfiguration", { status: 500, headers: CORS_HEADERS })
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex")

  if (signature !== expectedSignature) {
    console.warn('[Webhook] Invalid signature — request rejected')
    return new Response("Invalid signature", { status: 401, headers: CORS_HEADERS })
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS })
  }

  const eventId   = payload.id
  const eventType = payload.event

  if (!eventId || !eventType) {
    return new Response("Missing event fields", { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Idempotency — skip already-processed events
  const { data: existingEvent } = await supabase
    .from('payment_events')
    .select('id')
    .eq('event_id', eventId)
    .single()

  if (existingEvent) {
    console.log(`[Webhook] Event ${eventId} already processed — skipping`)
    return new Response("Event already processed", { status: 200, headers: CORS_HEADERS })
  }

  // 3. Log event immediately for audit trail
  await supabase.from('payment_events').insert({
    event_id: eventId,
    type:     eventType,
    payload:  payload,
  })

  // 4. Route on event type
  if (eventType === 'payment.captured') {
    const payment        = payload.payload.payment.entity
    const razorpayOrderId = payment.order_id
    const amount         = payment.amount / 100   // paise → rupees
    const notes          = payment.notes ?? {}
    const paymentId      = payment.id

    // Update payment_orders row to 'paid'
    await supabase
      .from('payment_orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('razorpay_order_id', razorpayOrderId)

    const paymentType = notes.type ?? 'order_payment'

    // ── 4a. Order Payment ────────────────────────────────────
    if (paymentType === 'order_payment' && notes.orderId) {
      console.log(`[Webhook] Confirming order ${notes.orderId}`)
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status:         'confirmed',
          confirmed_at:   new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        })
        .eq('id', notes.orderId)

      if (orderErr) {
        console.error('[Webhook] Failed to confirm order:', orderErr)
      }
    }

    // ── 4b. Wallet Top-up ────────────────────────────────────
    else if (paymentType === 'wallet_topup' && notes.customerId) {
      console.log(`[Webhook] Topping up wallet for user ${notes.customerId}, amount ₹${amount}`)

      const { data: wallet, error: walletFetchErr } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', notes.customerId)
        .single()

      if (walletFetchErr || !wallet) {
        console.error('[Webhook] Wallet not found:', walletFetchErr)
      } else {
        const newBalance = Number(wallet.balance) + amount

        await supabase
          .from('wallets')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', wallet.id)

        await supabase.from('wallet_transactions').insert({
          wallet_id:   wallet.id,
          user_id:     notes.customerId,
          type:        'credit',
          amount:      amount,
          description: 'Wallet top-up via UPI/Card',
          reference:   paymentId,
          status:      'completed',
        })

        // Update wallet_topups record if present
        await supabase
          .from('wallet_topups')
          .update({ status: 'completed', payment_id: paymentId, updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', razorpayOrderId)
      }
    }

    // ── 4c. Credit Repayment ─────────────────────────────────
    else if (paymentType === 'credit_repayment' && notes.customerId) {
      console.log(`[Webhook] Processing credit repayment for user ${notes.customerId}, amount ₹${amount}`)

      const { data: account, error: acctErr } = await supabase
        .from('credit_accounts')
        .select('id, outstanding')
        .eq('user_id', notes.customerId)
        .single()

      if (acctErr || !account) {
        console.error('[Webhook] Credit account not found:', acctErr)
      } else {
        const newOutstanding = Math.max(0, Number(account.outstanding) - amount)

        await supabase
          .from('credit_accounts')
          .update({ outstanding: newOutstanding, updated_at: new Date().toISOString() })
          .eq('id', account.id)

        await supabase.from('credit_transactions').insert({
          account_id: account.id,
          user_id:    notes.customerId,
          type:       'repayment',
          amount:     amount,
          status:     'repaid',
          reference:  paymentId,
          repaid_at:  new Date().toISOString(),
        })

        console.log(`[Webhook] Credit outstanding reduced to ₹${newOutstanding}`)
      }
    }

    else {
      console.warn(`[Webhook] Unhandled payment type: ${paymentType}`)
    }
  }

  // 5. Handle payment failure
  else if (eventType === 'payment.failed') {
    const payment         = payload.payload.payment.entity
    const razorpayOrderId = payment.order_id
    const notes           = payment.notes ?? {}

    await supabase
      .from('payment_orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('razorpay_order_id', razorpayOrderId)

    // If it was an order payment, mark order payment as failed (keep order pending for retry)
    if ((notes.type ?? 'order_payment') === 'order_payment' && notes.orderId) {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', notes.orderId)
    }
  }

  // 6. Mark event as processed
  await supabase
    .from('payment_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', eventId)

  return new Response("OK", { status: 200, headers: CORS_HEADERS })
})
