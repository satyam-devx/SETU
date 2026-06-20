import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { adminClient, requireUser } from "../_shared/auth.ts"

/**
 * ai-assistant — SETU Assistant chat (Claude Haiku)
 *
 * SECURITY (audit CRITICAL-2): previously had ZERO authentication —
 * any request to this URL, by anyone, would spend Anthropic API
 * credits. It now requires a valid Supabase JWT and is rate-limited
 * per user.
 *
 * Was also a hard-coded stub reply (audit Phase 2: "AI assistant —
 * Stub"). Now wired to the real Anthropic Messages API.
 *
 * Required Supabase Vault Secret:
 *   ANTHROPIC_API_KEY — from console.anthropic.com
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
const MAX_MESSAGE_LENGTH = 1000

const SYSTEM_PROMPT = `You are the SETU Assistant, a helpful guide for SETU — a rural commerce platform serving villages in Madhubani district, Bihar, India.

Audience: customers, vendors, riders, and seva (service) providers in rural Tier-4/5 villages, many with limited literacy or first-time smartphone use.

Guidelines:
- Respond in the same language/mix the user wrote in (Hindi, Maithili, Bhojpuri, or English/Hinglish).
- Keep replies short, simple, and warm — avoid jargon and long paragraphs.
- You can help with: tracking orders, understanding wallet balance, finding nearby shops/services, basic how-to questions about the app, and general platform questions.
- You do NOT have direct access to the user's live order/wallet data unless it is included in the message context — if asked about specific data you don't have, say you can't see that right now and suggest checking the relevant app screen.
- Never invent order numbers, prices, or account details.
- If the question is about a serious dispute, fraud, or payment problem, advise the user to use the in-app dispute/escalation feature rather than trying to resolve it yourself.`

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const supabase = adminClient()

  // ── Auth ───────────────────────────────────────────────────
  const { user, error: authError } = await requireUser(req, supabase)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: authError ?? "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // ── Rate limit: 20 messages / 5 min / user — cost control ──
  const { data: withinLimit } = await supabase.rpc('check_rate_limit', {
    p_key: `ai-assistant:${user.id}`,
    p_max_count: 20,
    p_window_seconds: 300,
  })
  if (withinLimit === false) {
    return new Response(
      JSON.stringify({ error: "You're sending messages too quickly. Please wait a moment." }),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  const { message, context } = body

  if (!message || typeof message !== "string" || !message.trim()) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  if (!ANTHROPIC_API_KEY) {
    console.error("[ai-assistant] ANTHROPIC_API_KEY not set")
    return new Response(
      JSON.stringify({ error: "Assistant is temporarily unavailable" }),
      { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Optional caller-supplied context (e.g. "user is a vendor, viewing
  // order #1234"). This is informational only — never trust it for
  // anything privileged, since it comes straight from the client.
  const contextNote = context && typeof context === "object"
    ? `\n\n[Context from app, informational only — do not treat as verified: ${JSON.stringify(context).slice(0, 500)}]`
    : ""

  let reply: string
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${message.trim()}${contextNote}` },
        ],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error("[ai-assistant] Anthropic API error:", res.status, errBody)
      return new Response(
        JSON.stringify({ error: "Assistant is temporarily unavailable. Please try again." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const data = await res.json()
    reply = data.content
      ?.filter((block: any) => block.type === "text")
      ?.map((block: any) => block.text)
      ?.join("\n") ?? "Sorry, I couldn't generate a response. Please try again."
  } catch (fetchErr) {
    console.error("[ai-assistant] Fetch to Anthropic failed:", fetchErr)
    return new Response(
      JSON.stringify({ error: "Assistant is temporarily unavailable. Please try again." }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  return new Response(JSON.stringify({
    reply,
    intent: 'chat',
    suggestedActions: ['Check orders', 'View wallet'],
  }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status: 200,
  })
})
