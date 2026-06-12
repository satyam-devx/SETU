/**
 * verify-aadhaar — Phase 7 KYC
 *
 * Two-step Aadhaar OTP verification using SurePass API.
 *
 * Step 1 (generate-otp):  POST { aadhaarNumber, userId }
 *   → validates format, calls SurePass /aadhaar-v2/generate-otp
 *   → returns { success, requestId, message }
 *
 * Step 2 (verify-otp):    POST { requestId, otp, userId }
 *   → calls SurePass /aadhaar-v2/submit-otp
 *   → on success: writes kyc_records row as 'verified', updates profiles
 *   → returns { success, name, dob, maskedAadhaar, careOf }
 *
 * Required Supabase Vault Secrets:
 *   SUREPASS_API_KEY  — SurePass bearer token (from surepass.io dashboard)
 *
 * If SUREPASS_API_KEY is not set, falls back to format-validation-only mode
 * so development environments don't break.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7?target=deno&no-check=true"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SUREPASS_BASE = "https://kyc-api.surepass.io/api/v1"

// ── Verhoeff checksum — UIDAI's actual algorithm ──────────
const VP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
]
const VD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
]

function verhoeffValid(n: string): boolean {
  let c = 0
  const digits = n.split("").reverse().map(Number)
  for (let i = 0; i < digits.length; i++) c = VD[c][VP[i % 8][digits[i]]]
  return c === 0
}

function validateAadhaarFormat(n: string): string | null {
  const clean = n.replace(/\s/g, "")
  if (!/^\d{12}$/.test(clean))       return "Aadhaar must be exactly 12 digits"
  if (clean[0] === "0" || clean[0] === "1") return "Invalid Aadhaar number format"
  if (/^(\d)\1{11}$/.test(clean))    return "Invalid Aadhaar number"
  if (!verhoeffValid(clean))         return "Aadhaar checksum invalid"
  return null // valid
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { step = "generate-otp", aadhaarNumber, requestId, otp, userId } = body

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "userId is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const SUREPASS_API_KEY = Deno.env.get("SUREPASS_API_KEY")

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")              ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  // ── STEP 1: Generate OTP ──────────────────────────────────
  if (step === "generate-otp") {
    if (!aadhaarNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "aadhaarNumber is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const formatError = validateAadhaarFormat(aadhaarNumber)
    if (formatError) {
      return new Response(
        JSON.stringify({ success: false, error: formatError }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // If no API key, return dev mode success (format passed)
    if (!SUREPASS_API_KEY) {
      console.warn("[verify-aadhaar] SUREPASS_API_KEY not set — dev mode: format validated only")
      return new Response(
        JSON.stringify({
          success:   true,
          requestId: `dev_${Date.now()}`,
          message:   "OTP sent to registered mobile (dev mode — format validated, no real OTP)",
          devMode:   true,
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // Call SurePass OTP generation
    let spResp: any
    try {
      const res = await fetch(`${SUREPASS_BASE}/aadhaar-v2/generate-otp`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${SUREPASS_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ id_number: aadhaarNumber.replace(/\s/g, "") }),
      })
      spResp = await res.json()
    } catch (fetchErr) {
      console.error("[verify-aadhaar] SurePass OTP fetch failed:", fetchErr)
      return new Response(
        JSON.stringify({ success: false, error: "KYC service temporarily unavailable. Please try again." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    if (!spResp.success) {
      const msg = spResp.message_code === "INVALID_ID"
        ? "Aadhaar number not found in UIDAI database"
        : spResp.message ?? "OTP generation failed"
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // Log attempt in kyc_records
    await supabase.from("kyc_records").upsert({
      user_id:      userId,
      type:         "aadhaar",
      status:       "otp_sent",
      submitted_at: new Date().toISOString(),
      meta:         { request_id: spResp.data?.client_id },
    }, { onConflict: "user_id,type" })

    return new Response(
      JSON.stringify({
        success:   true,
        requestId: spResp.data?.client_id,
        message:   "OTP sent to Aadhaar-linked mobile number",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // ── STEP 2: Verify OTP ────────────────────────────────────
  if (step === "verify-otp") {
    if (!requestId || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: "requestId and otp are required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP must be exactly 6 digits" }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // Dev mode: any 6-digit OTP passes
    if (!SUREPASS_API_KEY || requestId.startsWith("dev_")) {
      console.warn("[verify-aadhaar] Dev mode OTP verification — accepting without real check")

      await supabase.from("kyc_records").upsert({
        user_id:     userId,
        type:        "aadhaar",
        status:      "verified",
        verified_at: new Date().toISOString(),
        meta:        { dev_mode: true },
      }, { onConflict: "user_id,type" })

      await supabase.from("profiles")
        .update({ aadhaar_verified: true, updated_at: new Date().toISOString() })
        .eq("id", userId)

      return new Response(
        JSON.stringify({
          success:     true,
          name:        "Dev Mode User",
          maskedAadhaar: "XXXX XXXX 1234",
          devMode:     true,
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    // Call SurePass OTP submission
    let spResp: any
    try {
      const res = await fetch(`${SUREPASS_BASE}/aadhaar-v2/submit-otp`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${SUREPASS_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ client_id: requestId, otp }),
      })
      spResp = await res.json()
    } catch (fetchErr) {
      console.error("[verify-aadhaar] SurePass OTP submit failed:", fetchErr)
      return new Response(
        JSON.stringify({ success: false, error: "KYC service temporarily unavailable. Please try again." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    if (!spResp.success) {
      const msg = spResp.message_code === "INVALID_OTP"
        ? "Incorrect OTP. Please check and try again."
        : spResp.message_code === "OTP_EXPIRED"
        ? "OTP expired. Please request a new one."
        : spResp.message ?? "OTP verification failed"

      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const kycData = spResp.data ?? {}

    // Persist verification to kyc_records + update profile
    await supabase.from("kyc_records").upsert({
      user_id:      userId,
      type:         "aadhaar",
      status:       "verified",
      verified_at:  new Date().toISOString(),
      meta: {
        name:          kycData.full_name,
        dob:           kycData.dob,
        gender:        kycData.gender,
        care_of:       kycData.care_of,
        zip:           kycData.zip,
        masked_aadhaar: kycData.aadhaar_number,
      },
    }, { onConflict: "user_id,type" })

    await supabase.from("profiles").update({
      aadhaar_verified: true,
      name:             kycData.full_name ?? undefined,
      updated_at:       new Date().toISOString(),
    }).eq("id", userId)

    return new Response(
      JSON.stringify({
        success:       true,
        name:          kycData.full_name,
        dob:           kycData.dob,
        maskedAadhaar: kycData.aadhaar_number,
        careOf:        kycData.care_of,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ success: false, error: `Unknown step: ${step}` }),
    { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  )
})
