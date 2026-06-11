import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * kyc-verify
 *
 * Required Supabase Vault Secrets:
 *   SUREPASS_API_KEY — SurePass API key for Aadhaar/PAN verification
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Aadhaar Verhoeff (Luhn-equivalent) check ──────────────
// UIDAI's Aadhaar numbers pass the Verhoeff algorithm.
// This is the correct checksum for Indian Aadhaar — not Luhn.
const VERHOEFF_D  = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
]
const VERHOEFF_P  = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
]
const VERHOEFF_INV = [0,4,3,2,1,9,8,7,6,5]

function verhoeffCheck(numStr: string): boolean {
  let c = 0
  const digits = numStr.split('').reverse().map(Number)
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]]
  }
  return c === 0
}

function validateAadhaar(aadhaar: string): { valid: boolean; reason?: string } {
  const clean = aadhaar.replace(/\s/g, '')
  if (!/^\d{12}$/.test(clean)) {
    return { valid: false, reason: 'Aadhaar must be exactly 12 digits' }
  }
  // First digit cannot be 0 or 1 (UIDAI rule)
  if (clean[0] === '0' || clean[0] === '1') {
    return { valid: false, reason: 'Invalid Aadhaar number format' }
  }
  // All-same digits (000000000000, 111111111111, etc.) are invalid
  if (/^(\d)\1{11}$/.test(clean)) {
    return { valid: false, reason: 'Invalid Aadhaar number' }
  }
  if (!verhoeffCheck(clean)) {
    return { valid: false, reason: 'Aadhaar checksum invalid' }
  }
  return { valid: true }
}

// ── GST format validation ─────────────────────────────────
// GST format: 2-digit state code + 10-char PAN + 1-digit entity + Z + 1 check digit
function validateGSTIN(gstin: string): { valid: boolean; reason?: string } {
  const clean = gstin.toUpperCase().replace(/\s/g, '')
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean)) {
    return { valid: false, reason: 'Invalid GSTIN format (expected: 22AAAAA0000A1Z5)' }
  }
  const stateCode = parseInt(clean.slice(0, 2), 10)
  if (stateCode < 1 || stateCode > 38) {
    return { valid: false, reason: 'Invalid state code in GSTIN' }
  }
  return { valid: true }
}

// ── PAN format validation ─────────────────────────────────
function validatePAN(pan: string): { valid: boolean; reason?: string } {
  const clean = pan.toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) {
    return { valid: false, reason: 'Invalid PAN format (expected: ABCDE1234F)' }
  }
  return { valid: true }
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
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { type, data, userId } = body

  if (!type || !userId) {
    return new Response(
      JSON.stringify({ success: false, error: "type and userId are required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ── Validate format locally before any API call ──────────
  let formatCheck: { valid: boolean; reason?: string } = { valid: false, reason: 'Unknown type' }

  if (type === 'aadhaar') {
    formatCheck = validateAadhaar(data?.aadhaarNumber ?? '')
  } else if (type === 'gst') {
    formatCheck = validateGSTIN(data?.gstin ?? '')
  } else if (type === 'pan') {
    formatCheck = validatePAN(data?.pan ?? '')
  } else {
    return new Response(
      JSON.stringify({ success: false, error: `Unknown KYC type: ${type}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (!formatCheck.valid) {
    console.log(`[KYC] Format validation failed for ${type}: ${formatCheck.reason}`)
    return new Response(
      JSON.stringify({ success: false, status: 'invalid_format', error: formatCheck.reason }),
      { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // ── Production: call external KYC partner API ────────────
  // Currently configured for SurePass API (Aadhaar OTP flow).
  // Set SUREPASS_API_KEY in Supabase vault secrets.
  // Uncomment and configure when real KYC partner is onboarded.
  //
  // const SUREPASS_KEY = Deno.env.get('SUREPASS_API_KEY')
  // if (type === 'aadhaar' && SUREPASS_KEY) {
  //   const resp = await fetch('https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp', {
  //     method: 'POST',
  //     headers: { 'Authorization': `Bearer ${SUREPASS_KEY}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ id_number: data.aadhaarNumber }),
  //   })
  //   const result = await resp.json()
  //   if (!result.success) {
  //     return new Response(JSON.stringify({ success: false, error: result.message }), { status: 422, ... })
  //   }
  //   // Store client_id for OTP verification step
  //   // return ok({ requestId: result.data.client_id, otpSent: true })
  // }

  // ── Log submission to kyc_records ────────────────────────
  const { error: dbErr } = await supabase.from('kyc_records').upsert({
    user_id:    userId,
    type:       type,
    status:     'submitted',
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'user_id,type' })

  if (dbErr) {
    console.error('[KYC] Failed to log kyc_records:', dbErr)
    // Non-fatal — format is valid, proceed
  }

  console.log(`[KYC] Format validation passed for ${type}, user ${userId}. Awaiting partner API integration.`)

  return new Response(
    JSON.stringify({
      success:  true,
      status:   'submitted',
      message:  `${type.toUpperCase()} format validated. Verification submitted for processing.`,
      // In production, this will include: requestId, otpSent: true, etc.
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 200 }
  )
})
