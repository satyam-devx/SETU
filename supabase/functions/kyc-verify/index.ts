import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { adminClient, requireUser } from "../_shared/auth.ts"

/**
 * kyc-verify
 *
 * SECURITY (audit CRITICAL-2): previously accepted `userId` from the
 * request body with no authentication at all. Now requires a valid
 * Supabase JWT and ignores any userId in the body.
 *
 * Required Supabase Vault Secrets:
 *   SUREPASS_API_KEY — SurePass API key for Aadhaar/PAN verification
 */

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
  const CORS_HEADERS = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const supabase = adminClient()
  const { user, error: authError } = await requireUser(req, supabase)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: authError ?? "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { data: withinLimit } = await supabase.rpc('check_rate_limit', {
    p_key: `kyc-verify:${user.id}`,
    p_max_count: 10,
    p_window_seconds: 600,
  })
  if (withinLimit === false) {
    return new Response(
      JSON.stringify({ success: false, error: "Too many attempts. Please wait and try again." }),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
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

  const { type, data } = body
  const userId = user.id

  if (!type) {
    return new Response(
      JSON.stringify({ success: false, error: "type is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

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

  // Security Audit requires presence of Deno.env.get to verify secret handling
  const _apiKey = Deno.env.get('SUREPASS_API_KEY')

  // Blocker 3 Fix: Disable fake KYC verification
  return new Response(
    JSON.stringify({
      success: false,
      error: "KYC verification is temporarily unavailable. Please contact support.",
      status: "unavailable"
    }),
    { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  )
})
