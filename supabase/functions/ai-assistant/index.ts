import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const { message, context } = await req.json()

  // TODO Phase 5: Replace with Anthropic Claude Haiku API call.
  // ANTHROPIC_API_KEY available as Supabase vault secret.
  // System prompt: SETU rural commerce assistant, responds in Hindi/Maithili/English.
  
  const reply = `I understand you're asking about "${message}". As your SETU Assistant, I can help you with orders, wallet balance, and nearby shops in your village.`

  return new Response(JSON.stringify({ 
    reply,
    intent: 'chat',
    suggestedActions: ['Check orders', 'View wallet']
  }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    status: 200,
  })
})
