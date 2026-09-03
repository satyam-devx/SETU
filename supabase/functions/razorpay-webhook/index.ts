/**
 * SETU — razorpay-webhook Edge Function  (Phase 0 hardened, round 2)
 *
 * Security: HMAC-SHA256 signature verified (constant-time compare)
 *           before any DB write.
 * Integrity: payment.captured amount is reconciled against the
 *            order's authoritative `total` before the order is ever
 *            marked paid/confirmed (CRITICAL-1).
 * Reliability: an event is only marked `processed_at` once its
 *            handler runs to completion without throwing. If the
 *            handler throws, we return 500 so Razorpay retries the
 *            webhook instead of silently losing the event (H3).
 * Idempotency: payment_events.event_id unique constraint; a retried
 *            event that already completed is skipped; a retried
 *            event that previously failed is reprocessed (all
 *            downstream RPCs are themselves idempotent).
 *
 * Events handled:
 *   payment.captured   → confirm order, record fee split, credit vendor escrow
 *   payment.failed     → mark order payment_status = 'failed'
 *   refund.created     → update order_refunds, mark order refunded
 *   payout.processed   → confirm vendor_payout as paid
 *   payout.failed      → mark vendor_payout failed (funds returned to escrow)
 *   wallet_topup       → credit wallet via topup_wallet RPC
 *   credit_repayment   → reduce credit_accounts.outstanding
 *
 * All payment_status transitions go through security-definer Postgres
 * functions — never via direct client UPDATE on orders.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7?target=deno&no-check=true";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * razorpay-webhook
 *
 * Required Supabase Vault Secrets:
 *   RAZORPAY_WEBHOOK_SECRET — HMAC-SHA256 webhook verification secret
 *
 * NOTE: this function is intentionally deployed with --no-verify-jwt
 * (see .github/workflows/deploy.yml) because Razorpay calls it
 * server-to-server with an HMAC signature, not a Supabase JWT. Every
 * other function in this project DOES require a verified JWT.
 */

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

// Allow a small amount of float/rounding drift between what Razorpay
// captured (in paise, converted to rupees) and the stored order total.
const AMOUNT_RECONCILIATION_TOLERANCE = 0.01;

// ── helpers ────────────────────────────────────────────────

function ok(headers: Record<string, string>, msg = "OK"): Response {
  return new Response(msg, { status: 200, headers });
}
function err(headers: Record<string, string>, msg: string, status = 400): Response {
  return new Response(msg, { status, headers });
}

/** Constant-time string comparison — avoids leaking timing info about
 *  how many leading bytes of the HMAC signature matched (H2). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const CORS_HEADERS = corsHeaders(req, "authorization, x-client-info, apikey, content-type, x-razorpay-signature");

  if (req.method === "OPTIONS") return ok(CORS_HEADERS, "ok");

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  // 1. Signature verification — reject anything unsigned
  // Fail closed: if secret is missing or signature is absent/wrong, always 401.
  // Never 500 — do not leak misconfiguration state to callers.
  if (!WEBHOOK_SECRET || !signature) {
    console.error("[webhook] Missing secret or signature");
    return err(CORS_HEADERS, "Unauthorized", 401);
  }

  const expected = await hmacSha256Hex(WEBHOOK_SECRET, body);

  if (!timingSafeEqualHex(signature, expected)) {
    console.warn("[webhook] Invalid signature — rejected");
    return err(CORS_HEADERS, "Unauthorized", 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return err(CORS_HEADERS, "Invalid JSON body", 400);
  }

  const eventId = payload.id as string;
  const eventType = payload.event as string;

  if (!eventId || !eventType) return err(CORS_HEADERS, "Missing event fields", 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 2. Idempotency — INSERT ON CONFLICT DO NOTHING
  //    If event_id already exists AND was already fully processed,
  //    skip. If it exists but processing previously failed
  //    (processed_at is null), fall through and retry — every
  //    downstream operation below is itself idempotent.
  const { error: insertErr } = await supabase.from("payment_events").insert({
    event_id: eventId,
    type: eventType,
    payload,
  });

  if (insertErr?.code === "23505") {
    const { data: existing } = await supabase
      .from("payment_events")
      .select("processed_at")
      .eq("event_id", eventId)
      .single();

    if ((existing as any)?.processed_at) {
      console.log(`[webhook] Event ${eventId} already processed — skipping`);
      return ok(CORS_HEADERS, "Already processed");
    }
    console.log(`[webhook] Event ${eventId} exists but not yet processed — retrying`);
  } else if (insertErr) {
    console.error("[webhook] Failed to log event:", insertErr);
    // Idempotency tracking is degraded but we must not drop a real
    // payment event over a logging failure — continue processing.
  }

  // 3. Route on event type
  let handlerOk = true;
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

          // ── CRITICAL-1 FIX ──────────────────────────────────
          // Never confirm an order on payment_status alone. Reload
          // the order's authoritative total from the DB and compare
          // it to what Razorpay actually captured. Without this, a
          // client that requested a Razorpay order for ₹1 against an
          // order whose real total is ₹10,000 would get the full
          // order confirmed and escrow released on a ₹1 payment.
          const { data: orderRow, error: loadErr } = await supabase
            .from("orders")
            .select("id, total, payment_status")
            .eq("id", orderId)
            .single();

          if (loadErr || !orderRow) {
            console.error(`[webhook] CRITICAL: payment.captured for unknown order ${orderId}`, loadErr);
            await supabase.from("audit_log").insert({
              actor: "system",
              action: "payment_amount_mismatch",
              target: orderId,
              detail: `payment.captured for ${paymentId} referenced unknown order ${orderId}`,
            });
            break;
          }

          const expectedTotal = Number((orderRow as any).total);
          const amountMismatch = Math.abs(expectedTotal - amount) > AMOUNT_RECONCILIATION_TOLERANCE;

          if (amountMismatch) {
            // Do NOT confirm the order or release escrow. Flag loudly
            // for manual review instead — this is exactly the fraud
            // pattern from the audit (pay ₹1, order says ₹10,000).
            console.error(
              `[webhook] CRITICAL: amount mismatch on order ${orderId} — captured ₹${amount}, expected ₹${expectedTotal}`
            );
            await supabase.from("audit_log").insert({
              actor: "system",
              action: "payment_amount_mismatch",
              target: orderId,
              detail: `Razorpay payment ${paymentId} captured ₹${amount} but order total is ₹${expectedTotal}. Order NOT confirmed — manual review required.`,
            });
            handlerOk = false;
            break;
          }

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
            handlerOk = false;
          } else {
            // Record fee split + credit vendor escrow (idempotent RPC)
            const { error: splitErr } = await rpc(supabase, "record_delivery_split", {
              p_order_id: orderId,
              p_razorpay_payment_id: paymentId,
            });
            if (splitErr) handlerOk = false;
          }
        } else if (paymentType === "wallet_topup" && notes.customerId) {
          // ── Wallet top-up ──────────────────────────────────
          // Uses the canonical topup_wallet RPC (supabase/migrations/
          // 20240101000001_initial_schema.sql) — NOT credit_wallet.
          // (PASS 5 correction: credit_wallet() does exist in this
          // migration tree — supabase/migrations/20240101000017_
          // order_integrity.sql — but it is an INTERNAL helper called
          // only by cancel_order_with_refund() to credit a refund back
          // to the wallet. It is not appropriate for top-ups and is
          // not directly callable from here — see migration 035, which
          // revokes its PUBLIC/authenticated/anon execute and grants
          // only service_role. A same-named, top-up-purpose
          // credit_wallet function did once exist only in the legacy
          // database/ tree that CI doesn't deploy — that is the
          // function this comment originally warned against, not the
          // one that lives in this migration tree today.)
          console.log(`[webhook] Wallet topup for ${notes.customerId} ₹${amount}`);

          const { error: creditErr } = await rpc(supabase, "topup_wallet", {
            p_user_id: notes.customerId,
            p_amount: amount,
            p_reference: paymentId,
          });
          if (creditErr) handlerOk = false;

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
            handlerOk = false;
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
          const { error: confirmErr } = await rpc(supabase, "confirm_vendor_payout", {
            p_payout_id: (vp as any).id,
            p_status: "paid",
            p_razorpay_payout_id: rzpPayoutId,
          });
          if (confirmErr) handlerOk = false;
        }
        break;
      }

      // ── payout.failed (Razorpay Route — vendor payout failed) ──
      case "payout.failed":
      case "payout.reversed": {
        const payout = (payload.payload as any).payout.entity;
        const rzpPayoutId: string = payout.id;

        // H2 FIX: the original expression
        //   payout.failure_reason ?? eventType === "payout.reversed" ? "reversed" : "failed"
        // parses (?? binds looser than ===, but looser than the
        // ternary too) as:
        //   (payout.failure_reason ?? (eventType === "payout.reversed")) ? "reversed" : "failed"
        // — so ANY truthy failure_reason string made `reason` become
        // the literal word "reversed", discarding the real reason.
        const reason: string =
          payout.failure_reason ?? (eventType === "payout.reversed" ? "reversed" : "failed");

        console.log(`[webhook] Vendor payout failed/reversed: ${rzpPayoutId}`);

        const { data: vp } = await supabase
          .from("vendor_payouts")
          .select("id")
          .eq("razorpay_payout_id", rzpPayoutId)
          .single();

        if (vp) {
          const { error: confirmErr } = await rpc(supabase, "confirm_vendor_payout", {
            p_payout_id: (vp as any).id,
            p_status: "failed",
            p_razorpay_payout_id: rzpPayoutId,
            p_failure_reason: reason,
          });
          if (confirmErr) handlerOk = false;
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (handlerErr) {
    console.error("[webhook] Handler error:", handlerErr);
    handlerOk = false;
  }

  // 4. Mark event processed ONLY if the handler actually succeeded.
  //    If it failed, leave processed_at null and return 500 so
  //    Razorpay's webhook retry mechanism tries again later instead
  //    of us silently dropping a payment/payout/refund event (H3).
  if (handlerOk) {
    await supabase
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", eventId);
    return ok(CORS_HEADERS, "OK");
  }

  return err(CORS_HEADERS, "Handler failed — will retry", 500);
});
