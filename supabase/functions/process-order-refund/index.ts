import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7?target=deno&no-check=true";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

// Required Supabase Vault Secrets:
//   RAZORPAY_KEY_ID     — Razorpay API key ID
//   RAZORPAY_KEY_SECRET — Razorpay API secret
const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

async function rpc(supabase: ReturnType<typeof createClient>, fn: string, params: Record<string, unknown>) {
  return await supabase.rpc(fn, params);
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { user, error: authError } = await requireUser(req, supabase);
  if (authError || !user) return new Response(JSON.stringify({ error: authError ?? "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }); }
  const orderId = body?.orderId;
  if (!orderId) return new Response(JSON.stringify({ error: "orderId is required" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });

  const { data: order, error: orderErr } = await supabase.from("orders").select("id, customer_id, vendor_id, status, payment_method, payment_status").eq("id", orderId).single();
  if (orderErr || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } });

  const { data: actorProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (actorProfile as any)?.role;
  const isAdmin = role === "admin" || role === "super_admin";
  const { data: vendorOwner } = await supabase.from("vendors").select("id").eq("id", (order as any).vendor_id).eq("owner_id", user.id).maybeSingle();
  const isVendor = !!vendorOwner;
  if ((order as any).customer_id !== user.id && !isAdmin && !isVendor) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });
  if ((order as any).payment_method !== "UPI") return new Response(JSON.stringify({ error: "Order is not a Razorpay payment" }), { status: 409, headers: { ...headers, "Content-Type": "application/json" } });
  if (!KEY_ID || !KEY_SECRET) return new Response(JSON.stringify({ error: "Payment service not configured" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });

  const { data: claim, error: claimErr } = await rpc(supabase, "claim_razorpay_refund", { p_order_id: orderId });
  if (claimErr || !claim?.success) return new Response(JSON.stringify({ error: claim?.error ?? "Refund request unavailable" }), { status: 409, headers: { ...headers, "Content-Type": "application/json" } });
  if (claim.already_completed || claim.in_progress || claim.razorpay_refund_id) return new Response(JSON.stringify({ success: true, status: claim.in_progress ? "processing" : "completed", razorpay_refund_id: claim.razorpay_refund_id }), { headers: { ...headers, "Content-Type": "application/json" } });

  const paymentId = claim.razorpay_payment_id;
  if (!paymentId) return new Response(JSON.stringify({ error: "No captured Razorpay payment is linked to this refund" }), { status: 409, headers: { ...headers, "Content-Type": "application/json" } });

  const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);

  // Recovery guard: if a previous attempt reached Razorpay but lost its
  // response, discover an existing non-failed refund before creating another.
  try {
    const existingResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (existingResponse.ok) {
      const existingBody = await existingResponse.json();
      const existingRefund = (existingBody?.items ?? []).find((item: any) =>
        Number(item.amount) === Math.round(Number(claim.amount) * 100) && item.status !== "failed"
      );
      if (existingRefund?.id) {
        const { error: completeExistingErr } = await rpc(supabase, "complete_razorpay_refund", {
          p_refund_id: claim.refund_id,
          p_razorpay_refund_id: existingRefund.id,
          p_provider_payload: existingRefund,
        });
        if (!completeExistingErr) return new Response(JSON.stringify({ success: true, status: "completed", razorpay_refund_id: existingRefund.id }), { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }
  } catch {
    // Continue to the normal provider call; discovery failure is not proof
    // that no refund exists.
  }

  let response: Response;
  let provider: any;
  try {
    response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(Number(claim.amount) * 100), notes: { setu_order_id: orderId } }),
    });
    provider = await response.json();
  } catch {
    await rpc(supabase, "fail_razorpay_refund", { p_refund_id: claim.refund_id, p_failure_reason: "Failed to reach Razorpay refund API", p_provider_payload: {} });
    return new Response(JSON.stringify({ error: "Refund gateway unreachable", retryable: true }), { status: 502, headers: { ...headers, "Content-Type": "application/json" } });
  }

  if (!response.ok || provider?.error) {
    await rpc(supabase, "fail_razorpay_refund", { p_refund_id: claim.refund_id, p_failure_reason: provider?.error?.description ?? `Razorpay HTTP ${response.status}`, p_provider_payload: provider ?? {} });
    return new Response(JSON.stringify({ error: provider?.error?.description ?? "Razorpay refund failed", retryable: true }), { status: 502, headers: { ...headers, "Content-Type": "application/json" } });
  }

  const { data: completed, error: completeErr } = await rpc(supabase, "complete_razorpay_refund", { p_refund_id: claim.refund_id, p_razorpay_refund_id: provider.id, p_provider_payload: provider });
  if (completeErr || !completed?.success) return new Response(JSON.stringify({ error: "Refund created but SETU reconciliation failed", reconciliation_required: true }), { status: 503, headers: { ...headers, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ success: true, status: "completed", razorpay_refund_id: provider.id }), { headers: { ...headers, "Content-Type": "application/json" } });
});
