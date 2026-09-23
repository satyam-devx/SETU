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


async function processRazorpayRefund(
  supabase: ReturnType<typeof createClient>, orderId: string, paymentId: string, amount: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return { success: false, error: "Razorpay credentials unavailable" };
  const { data: claim, error: claimErr } = await rpc(supabase, "claim_razorpay_refund", { p_order_id: orderId });
  if (claimErr || !(claim as any)?.success) return { success: false, error: (claim as any)?.error ?? "Could not claim refund" };
  const claimed = claim as any;
  if (claimed.already_completed || claimed.in_progress || claimed.razorpay_refund_id) return { success: true, refundId: claimed.razorpay_refund_id };
  const auth = btoa(`${keyId}:${keySecret}`);

  // Recovery guard: if a previous refund request reached Razorpay but the
  // HTTP response was lost, discover the existing provider refund before
  // issuing another one. This closes the stale-lease duplicate-refund gap.
  try {
    const existingResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (existingResponse.ok) {
      const existingBody = await existingResponse.json();
      const existingRefund = (existingBody?.items ?? []).find((item: any) =>
        Number(item.amount) === Math.round(amount * 100) &&
        item.status !== "failed"
      );
      if (existingRefund?.id) {
        const { error: completeErr } = await rpc(supabase, "complete_razorpay_refund", {
          p_refund_id: claimed.refund_id,
          p_razorpay_refund_id: existingRefund.id,
          p_provider_payload: existingRefund,
        });
        if (!completeErr) return { success: true, refundId: existingRefund.id };
      }
    }
  } catch {
    // A failed discovery call is not proof that no refund exists; the
    // normal POST is still attempted and the durable DB state remains.
  }

  let response: Response; let body: any;
  try {
    response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(amount * 100), notes: { setu_order_id: orderId } }) });
    body = await response.json();
  } catch {
    await rpc(supabase, "fail_razorpay_refund", { p_refund_id: claimed.refund_id, p_failure_reason: "Failed to reach Razorpay refund API", p_provider_payload: {} });
    return { success: false, error: "Refund gateway unreachable" };
  }
  if (!response.ok || body?.error) {
    await rpc(supabase, "fail_razorpay_refund", { p_refund_id: claimed.refund_id, p_failure_reason: body?.error?.description ?? `Razorpay refund HTTP ${response.status}`, p_provider_payload: body ?? {} });
    return { success: false, error: body?.error?.description ?? "Razorpay refund failed" };
  }
  const { error: completeErr } = await rpc(supabase, "complete_razorpay_refund", { p_refund_id: claimed.refund_id, p_razorpay_refund_id: body.id, p_provider_payload: body });
  if (completeErr) return { success: false, error: "Refund created but SETU reconciliation failed" };
  return { success: true, refundId: body.id };
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
  }

  // Atomically claim the event row before running any financial side effect.
  // claim_payment_event() uses SELECT ... FOR UPDATE, so concurrent duplicate
  // deliveries serialize and only one request becomes the active processor.
  const { data: eventClaim, error: eventClaimErr } = await rpc(supabase, "claim_payment_event", {
    p_event_id: eventId,
  });
  if (eventClaimErr || !(eventClaim as any)?.success) {
    console.error("[webhook] Could not claim event state:", eventClaimErr ?? eventClaim);
    return err(CORS_HEADERS, "Webhook state unavailable", 500);
  }
  if ((eventClaim as any).already_processed || (eventClaim as any).dead_letter) {
    return ok(CORS_HEADERS, (eventClaim as any).already_processed ? "Already processed" : "Accepted for manual reconciliation");
  }
  const attemptCount = Number((eventClaim as any).attempt_count ?? 1);

  // 3. Route on event type
  let handlerOk = true;
  try {
    switch (eventType) {
      // ── payment.captured ──────────────────────────────────
      case "payment.captured": {
        const payment = (payload.payload as any)?.payment?.entity;
        if (!payment?.id || !payment?.order_id || typeof payment.amount !== "number") throw new Error("Malformed payment.captured payload");
        const razorpayOrderId: string = payment.order_id; const paymentId: string = payment.id; const amount: number = payment.amount / 100;
        const notes: Record<string, string> = payment.notes ?? {}; const paymentType = notes.type ?? "order_payment";
        await supabase.from("payment_orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("razorpay_order_id", razorpayOrderId);
        await supabase.from("payment_events").update({ order_id: notes.orderId ?? null, payment_id: paymentId }).eq("event_id", eventId);
        if (paymentType === "order_payment") {
          if (!notes.orderId) throw new Error("payment.captured missing orderId note");
          const { data: result, error: reconcileErr } = await rpc(supabase, "reconcile_razorpay_capture", { p_order_id: notes.orderId, p_payment_intent_id: notes.paymentIntentId ?? null, p_razorpay_order_id: razorpayOrderId, p_payment_id: paymentId, p_amount: amount, p_method: payment.method ?? null, p_gateway_payload: payment });
          if (reconcileErr) { handlerOk = false; break; }
          const reconciliation = result as any;
          if (reconciliation?.manual_review) { handlerOk = false; break; }
          if (!reconciliation?.refund_required) {
            const gatewayFee = typeof payment.fee === "number" ? payment.fee / 100 : 0;
            const { error: financeErr } = await rpc(supabase, "finalize_order_financial_capture", { p_order_id: notes.orderId, p_payment_id: paymentId, p_gateway_fee: gatewayFee });
            if (financeErr) { handlerOk = false; break; }
          }
          if (reconciliation?.refund_required) {
            const refundResult = await processRazorpayRefund(supabase, reconciliation.order_id, paymentId, Number(reconciliation.refund_amount));
            if (!refundResult.success) handlerOk = false;
          }
        } else if (paymentType === "wallet_topup" && notes.customerId) {
          const { error: creditErr } = await rpc(supabase, "topup_wallet", { p_user_id: notes.customerId, p_amount: amount, p_reference: paymentId });
          if (creditErr) handlerOk = false;
          const { error: topupErr } = await supabase.from("wallet_topups").update({ status: "completed", payment_id: paymentId, updated_at: new Date().toISOString() }).eq("razorpay_order_id", razorpayOrderId);
          if (topupErr) handlerOk = false;
        } else if (paymentType === "credit_repayment" && notes.customerId) {
          const { data: account, error: acctErr } = await supabase.from("credit_accounts").select("id, outstanding").eq("user_id", notes.customerId).single();
          if (acctErr || !account) handlerOk = false; else {
            const newOutstanding = Math.max(0, Number((account as any).outstanding) - amount);
            const { error: accountErr } = await supabase.from("credit_accounts").update({ outstanding: newOutstanding, updated_at: new Date().toISOString() }).eq("id", (account as any).id);
            if (accountErr) handlerOk = false;
            const { error: txErr } = await supabase.from("credit_transactions").insert({ account_id: (account as any).id, user_id: notes.customerId, type: "repayment", amount, status: "repaid", reference: paymentId, repaid_at: new Date().toISOString() });
            if (txErr && txErr.code !== "23505") handlerOk = false;
          }
        } else console.warn(`[webhook] Unhandled payment type: ${paymentType}`);
        break;
      }

      // ── payment.failed ────────────────────────────────────
      case "payment.failed": {
        const payment = (payload.payload as any)?.payment?.entity;
        if (!payment?.order_id) throw new Error("Malformed payment.failed payload");
        const razorpayOrderId: string = payment.order_id; const paymentId: string | null = payment.id ?? null; const notes: Record<string, string> = payment.notes ?? {};
        await supabase.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("razorpay_order_id", razorpayOrderId);
        await supabase.from("payment_events").update({ order_id: notes.orderId ?? null, payment_id: paymentId }).eq("event_id", eventId);
        if ((notes.type ?? "order_payment") === "order_payment") {
          const { error: failureErr } = await rpc(supabase, "reconcile_razorpay_failure", { p_razorpay_order_id: razorpayOrderId, p_payment_id: paymentId, p_failure_code: payment.error_code ?? payment.error?.code ?? null, p_failure_reason: payment.error_description ?? payment.error?.description ?? null, p_gateway_payload: payment });
          if (failureErr) handlerOk = false;
        }
        break;
      }

      // ── refund.created / refund.processed ──────────────────
      case "refund.created":
      case "refund.processed": {
        const refund = (payload.payload as any)?.refund?.entity;
        if (!refund?.id || !refund?.payment_id) throw new Error("Malformed refund webhook payload");
        const { data: refundRow, error: refundLookupErr } = await supabase.from("order_refunds").select("id, order_id").eq("razorpay_payment_id", refund.payment_id).in("status", ["pending", "processing", "failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (refundLookupErr) throw refundLookupErr;
        if (!refundRow) {
          await supabase.from("audit_log").insert({ actor: "system", action: "refund_unmatched", target: refund.id, detail: `Razorpay refund ${refund.id} references payment ${refund.payment_id}, but no pending SETU refund was found. Manual reconciliation required.` });
          handlerOk = false; break;
        }
        const { error: completeErr } = await rpc(supabase, "complete_razorpay_refund", { p_refund_id: (refundRow as any).id, p_razorpay_refund_id: refund.id, p_provider_payload: refund });
        if (completeErr) handlerOk = false;
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
          await rpc(supabase, "reconcile_financial_payout", { p_type: "vendor", p_payout_id: (vp as any).id, p_provider_payout_id: rzpPayoutId, p_provider_amount: typeof payout.amount === "number" ? payout.amount / 100 : null, p_provider_status: "processed", p_payload: payout });
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
          await rpc(supabase, "reconcile_financial_payout", { p_type: "vendor", p_payout_id: (vp as any).id, p_provider_payout_id: rzpPayoutId, p_provider_amount: typeof payout.amount === "number" ? payout.amount / 100 : null, p_provider_status: eventType === "payout.reversed" ? "reversed" : "failed", p_payload: payout });
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

  // 4. Durable webhook outcome. After repeated failures, move the event
  // to dead-letter/manual-review state so a broken downstream dependency
  // does not create an invisible infinite retry loop.
  if (handlerOk) {
    await supabase.from("payment_events").update({ processed_at: new Date().toISOString(), processing_status: "succeeded", last_error: null }).eq("event_id", eventId);
    return ok(CORS_HEADERS, "OK");
  }

  const deadLetter = attemptCount >= 5;
  await supabase.from("payment_events").update({
    processing_status: deadLetter ? "dead_letter" : "failed",
    dead_letter_at: deadLetter ? new Date().toISOString() : null,
    last_error: deadLetter ? "Webhook moved to dead-letter/manual review after 5 failed attempts" : "Handler failed; provider retry expected",
  }).eq("event_id", eventId);

  return deadLetter ? ok(CORS_HEADERS, "Accepted for manual reconciliation") : err(CORS_HEADERS, "Handler failed — will retry", 500);
});
