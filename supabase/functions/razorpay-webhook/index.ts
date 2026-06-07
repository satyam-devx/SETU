import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts"

const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  // 1. Verify HMAC Signature
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex")

  if (signature !== expectedSignature) {
    return new Response("Invalid signature", { status: 401 })
  }

  const payload = JSON.parse(body)
  const eventId = payload.id
  const eventType = payload.event

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Idempotency Check
  const { data: existingEvent } = await supabase
    .from('payment_events')
    .select('id')
    .eq('event_id', eventId)
    .single()

  if (existingEvent) {
    return new Response("Event already processed", { status: 200 })
  }

  // 3. Log Event
  await supabase.from('payment_events').insert({
    event_id: eventId,
    type: eventType,
    payload: payload
  })

  // 4. Handle Payment Captured
  if (eventType === 'payment.captured') {
    const payment = payload.payload.payment.entity
    const razorpayOrderId = payment.order_id
    const amount = payment.amount / 100
    const notes = payment.notes

    // Update payment_orders
    await supabase.from('payment_orders')
      .update({ status: 'paid' })
      .eq('razorpay_order_id', razorpayOrderId)

    if (notes.type === 'order_payment' && notes.orderId) {
      // Update Order Status
      await supabase.from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', notes.orderId)

      // Notify Vendor (via DB trigger or Realtime)
    }
    else if (notes.type === 'wallet_topup') {
      // Credit Wallet
      const { data: wallet } = await supabase.from('wallets')
        .select('id, balance')
        .eq('user_id', notes.customerId)
        .single()

      if (wallet) {
        await supabase.from('wallets')
          .update({ balance: wallet.balance + amount })
          .eq('id', wallet.id)

        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          user_id: notes.customerId,
          type: 'credit',
          amount: amount,
          description: 'Wallet top-up via UPI',
          reference: payment.id,
          status: 'completed'
        })
      }
    }
  }

  // 5. Mark as processed
  await supabase.from('payment_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', eventId)

  return new Response("OK", { status: 200 })
})
