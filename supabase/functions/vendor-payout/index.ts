/**
 * SETU — vendor-payout Edge Function  (Phase 0)
 *
 * Admin-only endpoint. Initiates a payout from vendor escrow
 * to vendor bank account via Razorpay Route (or marks manual).
 *
 * Request body:
 *   {
 *     vendorId:    string,   // vendors.id
 *     amount:      number,   // INR
 *     method:      'razorpay_route' | 'manual_neft' | 'upi',
 *     accountId?:  string,   // Razorpay Fund Account ID (for Route)
 *     notes?:      string,
 *   }
 *
 * Flow:
 *   1. Verify caller is admin (service_role JWT checked).
 *   2. Call initiate_vendor_payout() — reserves funds in escrow.
 *   3. If razorpay_route: call Razorpay Payouts API, store payout_id.
 *   4. Return payout_id for caller to track.
 *
 * Confirmation (paid/failed) comes back via razorpay-webhook
 * events payout.processed / payout.failed.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser, getUserRole } from "../_shared/auth.ts";

/**
 * vendor-payout
 *
 * Required Supabase Vault Secrets:
 *   RAZORPAY_KEY_ID          — Razorpay API key ID
 *   RAZORPAY_KEY_SECRET      — Razorpay API secret key
 *   RAZORPAY_ACCOUNT_NUMBER  — Razorpay linked account number for payouts
 */

const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  // ── Auth: only admin/super_admin JWT allowed ──────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { user, error: authErr } = await requireUser(req, supabase);

  if (authErr || !user) {
    return new Response(
      JSON.stringify({ error: authErr ?? "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Check admin role
  const role = await getUserRole(supabase, user.id);

  if (!role || !["admin", "super_admin"].includes(role)) {
    return new Response(
      JSON.stringify({ error: "Admin role required" }),
      { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // ── Rate limit: 20 payout initiations / 10 min / admin ────
  const { data: withinLimit } = await supabase.rpc('check_rate_limit', {
    p_key: `vendor-payout:${user.id}`,
    p_max_count: 20,
    p_window_seconds: 600,
  });
  if (withinLimit === false) {
    return new Response(
      JSON.stringify({ error: "Too many payout requests. Please wait a few minutes." }),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────
  let body: {
    vendorId: string;
    amount: number;
    method?: string;
    accountId?: string;  // Razorpay Fund Account ID
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { vendorId, amount, method = "razorpay_route", accountId, notes } = body;

  if (!vendorId || !amount || amount <= 0) {
    return new Response(
      JSON.stringify({ error: "vendorId and positive amount are required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // ── Step 1: Reserve funds in escrow via RPC ────────────────
  const { data: initiateResult, error: initErr } = await supabase.rpc(
    "initiate_vendor_payout",
    {
      p_vendor_id:    vendorId,
      p_amount:       amount,
      p_method:       method,
      p_initiated_by: user.id,
      p_notes:        notes ?? null,
    }
  );

  if (initErr || !(initiateResult as any)?.success) {
    return new Response(
      JSON.stringify({
        error: (initiateResult as any)?.error ?? initErr?.message ?? "Escrow reservation failed",
      }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const payoutId: string = (initiateResult as any).payout_id;

  // ── Step 2: Razorpay Route payout (if applicable) ─────────
  if (method === "razorpay_route") {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("[vendor-payout] Razorpay credentials missing");
      // Payout is reserved in escrow; admin must manually complete
      return new Response(
        JSON.stringify({
          success: true,
          payout_id: payoutId,
          warning: "Razorpay credentials not configured — payout reserved but not sent",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId (Razorpay Fund Account ID) required for razorpay_route" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    let rzpPayout: any;

    try {
      const resp = await fetch("https://api.razorpay.com/v1/payouts", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
          "X-Payout-Idempotency": payoutId, // use our DB payout_id as idempotency key
        },
        body: JSON.stringify({
          account_number: Deno.env.get("RAZORPAY_ACCOUNT_NUMBER"), // source account
          fund_account_id: accountId,
          amount: Math.round(amount * 100), // paise
          currency: "INR",
          mode: "NEFT",
          purpose: "vendor_settlement",
          queue_if_low_balance: false,
          reference_id: payoutId,
          narration: `SETU vendor payout ${payoutId.slice(0, 8)}`,
          notes: { setu_payout_id: payoutId, vendor_id: vendorId },
        }),
      });

      rzpPayout = await resp.json();
    } catch (fetchErr) {
      console.error("[vendor-payout] Razorpay API error:", fetchErr);
      // Escrow already reserved; payout stays in 'processing'; webhook won't come.
      // Admin should manually confirm or retry.
      return new Response(
        JSON.stringify({
          success: false,
          payout_id: payoutId,
          error: "Failed to reach Razorpay API. Funds reserved in escrow — retry or confirm manually.",
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (rzpPayout.error) {
      console.error("[vendor-payout] Razorpay returned error:", rzpPayout.error);
      // Return funds to escrow via confirm_vendor_payout(failed)
      await supabase.rpc("confirm_vendor_payout", {
        p_payout_id:           payoutId,
        p_status:              "failed",
        p_failure_reason:      rzpPayout.error.description ?? "Razorpay payout creation failed",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: rzpPayout.error.description ?? "Payout creation failed",
        }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Store the Razorpay payout ID; confirmation comes via webhook
    await supabase
      .from("vendor_payouts")
      .update({
        razorpay_payout_id: rzpPayout.id,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);

    return new Response(
      JSON.stringify({
        success: true,
        payout_id: payoutId,
        razorpay_payout_id: rzpPayout.id,
        status: rzpPayout.status,
        message: "Payout initiated. Confirmation will arrive via webhook.",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // ── Manual / UPI payout: record as processing, admin confirms manually ──
  return new Response(
    JSON.stringify({
      success: true,
      payout_id: payoutId,
      status: "processing",
      message: `Manual payout of ₹${amount} reserved. Mark as paid via /vendor-payout/confirm.`,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
