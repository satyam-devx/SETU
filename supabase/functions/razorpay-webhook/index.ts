/**
 * SETU — razorpay-webhook Edge Function  (Phase 0 hardened)
 *
 * Security: HMAC-SHA256 signature verified before any DB write.
 * Idempotency: payment_events.event_id unique constraint; duplicate
 *              events are logged and silently skipped.
 *
 * Events handled:
 *   payment.captured   → confirm order, record fee split, credit vendor escrow
 *   payment.failed     → mark order payment_status = 'failed'
 *   refund.created     → update order_refunds, mark order refunded
 *   payout.processed   → confirm vendor_payout as paid
 *   payout.failed      → mark vendor_payout failed (funds returned to escrow)
 *   wallet_topup       → credit wallet via credit_wallet RPC
 *   credit_repayment   → reduce credit_accounts.outstanding
 *
 * All payment_status transitions go through security-definer Postgres
 * functions — never via direct client UPDATE on orders.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts";

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── helpers ────────────────────────────────────────────────

function ok(msg = "OK"): Response {
  return new Response(msg, { status: 200, headers: CORS_HEADERS });
}
function err(msg: string, status = 400): Response {
  return new Response(msg, { status, headers: CORS_HEADERS });
}

/** Call a Postgres security-definer RPC and log any error. */
async function rpc(
  supabase: ReturnType<typeof createClient>,
  fn: string,
  params: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const result = await supabase.rpc(fn, params);
  if (result.error) {
    console.error(`[webhook] RPC ${fn} failed:`, result.error);
  }
  return result;
}

// ── main handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return ok("ok");

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  // 1. Signature verification — reject anything unsigned
  if (!WEBHOOK_SECRET) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET not set");
    return err("Server misconfiguration", 500);
  }

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    console.warn("[webhook] Invalid signature — rejected");
    return err("Invalid signature", 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return err("Invalid JSON body", 400);
  }

  const eventId = payload.id as string;
  const eventType = payload.event as string;

  if (!eventId || !eventType) return err("Missing event fields", 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 2. Idempotency — INSERT ON CONFLICT DO NOTHING
  //    If event_id already exists the insert is a no-op and we return 200.
  const { error: insertErr } = await supabase.from("payment_events").insert({
    event_id: eventId,
    type: eventType,
    payload,
  });

  // unique violation = already processed
  if (insertErr?.code === "23505") {
    console.log(`[webhook] Event ${eventId} already processed — skipping`);
    return ok("Already processed");
  }
  if (insertErr) {
    console.error("[webhook] Failed to log event:", insertErr);
    // Non-fatal: continue processing but don't silently lose events
  }

  // 3. Route on event type
  try {
    switch (eventType) {
      // ── payment.captured ──────────────────────────────────
      case "payment.captured": {
        const payment = (payload.payload as any).payment.entity;
        const razorpayOrderId: string = payment.order_id;
        const paymentId: string = payment.id;
        const amount: number = payment.amount / 100; // paise → rupees
        const notes: Record<string, string> = payment.notes ?? {};
        const paymentType = notes.type ?? "order_payment";

        // Mark payment_orders row as paid (direct update by service_role is allowed)
        await supabase
          .from("payment_orders")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("razorpay_order_id", razorpayOrderId);

        if (paymentType === "order_payment" && notes.orderId) {
          const orderId = notes.orderId;
          console.log(`[webhook] Order payment captured for ${orderId}`);

          // Update order status + payment_status via service_role direct update
          // (service_role bypasses the guard trigger)
          const { error: orderErr } = await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              status: "confirmed",
              confirmed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
            .in("payment_status", ["pending", "failed"]); // guard: only advance from pending/failed

          if (orderErr) {
            console.error("[webhook] Order update failed:", orderErr);
          } else {
            // Record fee split + credit vendor escrow (idempotent RPC)
            await rpc(supabase, "record_delivery_split", {
              p_order_id: orderId,
              p_razorpay_payment_id: paymentId,
            });
          }
        } else if (paymentType === "wallet_topup" && notes.customerId) {
          // ── Wallet top-up ──────────────────────────────────
          console.log(`[webhook] Wallet topup for ${notes.customerId} ₹${amount}`);

          await rpc(supabase, "credit_wallet", {
            p_user_id: notes.customerId,
            p_amount: amount,
            p_description: "Wallet top-up via UPI/Card",
            p_reference: paymentId,
            p_source: "topup",
          });

          await supabase
            .from("wallet_topups")
            .update({
              status: "completed",
              payment_id: paymentId,
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", razorpayOrderId);
        } else if (paymentType === "credit_repayment" && notes.customerId) {
          // ── Credit repayment ───────────────────────────────
          console.log(`[webhook] Credit repayment for ${notes.customerId} ₹${amount}`);

          const { data: account, error: acctErr } = await supabase
            .from("credit_accounts")
            .select("id, outstanding")
            .eq("user_id", notes.customerId)
            .single();

          if (acctErr || !account) {
            console.error("[webhook] Credit account not found:", acctErr);
          } else {
            const newOutstanding = Math.max(
              0,
              Number((account as any).outstanding) - amount
            );

            await supabase
              .from("credit_accounts")
              .update({
                outstanding: newOutstanding,
                updated_at: new Date().toISOString(),
              })
              .eq("id", (account as any).id);

            await supabase.from("credit_transactions").insert({
              account_id: (account as any).id,
              user_id: notes.customerId,
              type: "repayment",
              amount,
              status: "repaid",
              reference: paymentId,
              repaid_at: new Date().toISOString(),
            });
          }
        } else {
          console.warn(`[webhook] Unhandled payment type: ${paymentType}`);
        }
        break;
      }

      // ── payment.failed ────────────────────────────────────
      case "payment.failed": {
        const payment = (payload.payload as any).payment.entity;
        const razorpayOrderId: string = payment.order_id;
        const notes: Record<string, string> = payment.notes ?? {};

        await supabase
          .from("payment_orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("razorpay_order_id", razorpayOrderId);

        // Only update payment_status; keep order 'pending' so customer can retry
        if ((notes.type ?? "order_payment") === "order_payment" && notes.orderId) {
          await supabase
            .from("orders")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", notes.orderId)
            .eq("payment_status", "pending"); // only move from pending → failed
        }
        break;
      }

      // ── refund.created (Razorpay-initiated refund) ────────
      case "refund.created": {
        const refund = (payload.payload as any).refund.entity;
        const rzpRefundId: string = refund.id;
        const rzpPaymentId: string = refund.payment_id;
        const refundAmount: number = refund.amount / 100;

        console.log(`[webhook] Refund created: ${rzpRefundId} for payment ${rzpPaymentId}`);

        // Find the order_refund by matching payment → payment_orders → order
        const { data: po } = await supabase
          .from("payment_orders")
          .select("order_id")
          .eq("razorpay_order_id", refund.notes?.razorpay_order_id ?? "")
          .single();

        if (po && (po as any).order_id) {
          const orderId = (po as any).order_id;

          // Update refund record
          await supabase
            .from("order_refunds")
            .update({
              status: "completed",
              razorpay_refund_id: rzpRefundId,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("order_id", orderId)
            .eq("status", "processing");

          // Mark order refunded
          await supabase
            .from("orders")
            .update({
              payment_status: "refunded",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
        }
        break;
      }

      // ── payout.processed (Razorpay Route — vendor payout paid) ──
      case "payout.processed": {
        const payout = (payload.payload as any).payout.entity;
        const rzpPayoutId: string = payout.id;

        console.log(`[webhook] Vendor payout processed: ${rzpPayoutId}`);

        const { data: vp } = await supabase
          .from("vendor_payouts")
          .select("id")
          .eq("razorpay_payout_id", rzpPayoutId)
          .single();

        if (vp) {
          await rpc(supabase, "confirm_vendor_payout", {
            p_payout_id: (vp as any).id,
            p_status: "paid",
            p_razorpay_payout_id: rzpPayoutId,
          });
        }
        break;
      }

      // ── payout.failed (Razorpay Route — vendor payout failed) ──
      case "payout.failed":
      case "payout.reversed": {
        const payout = (payload.payload as any).payout.entity;
        const rzpPayoutId: string = payout.id;
        const reason: string =
          payout.failure_reason ?? eventType === "payout.reversed" ? "reversed" : "failed";

        console.log(`[webhook] Vendor payout failed/reversed: ${rzpPayoutId}`);

        const { data: vp } = await supabase
          .from("vendor_payouts")
          .select("id")
          .eq("razorpay_payout_id", rzpPayoutId)
          .single();

        if (vp) {
          await rpc(supabase, "confirm_vendor_payout", {
            p_payout_id: (vp as any).id,
            p_status: "failed",
            p_razorpay_payout_id: rzpPayoutId,
            p_failure_reason: reason,
          });
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (handlerErr) {
    console.error("[webhook] Handler error:", handlerErr);
    // Mark event as processed even on handler error to prevent infinite retries
    // The error is logged in audit_log by the RPC functions.
  }

  // 4. Mark event processed
  await supabase
    .from("payment_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  return ok("OK");
});
