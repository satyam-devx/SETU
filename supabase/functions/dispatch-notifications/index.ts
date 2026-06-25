// ═══════════════════════════════════════════════════════════
// SETU — dispatch-notifications  (Supabase Edge Function)
//
// The delivery worker for the multi-channel notification pipeline
// (migration 034). It:
//   1. Claims a batch of pending notification_deliveries
//      (claim_pending_deliveries RPC — service_role only).
//   2. Sends each via the provider configured for its channel.
//   3. Records the outcome (mark_delivery RPC).
//
// Provider-agnostic: the provider id is read from platform_config
// (sms_provider / email_provider / whatsapp_provider) and the
// corresponding credential from an Edge secret. The operator turns a
// channel on and sets the provider from the Admin → Settings screen —
// NO code change. If a provider/secret is not configured, the delivery
// is marked failed with a clear, honest error (never silently dropped,
// never faked as sent).
//
// Invoke: schedule via cron (e.g. every minute) with the service-role
// key, or trigger after a campaign dispatch.
//
// Secrets (set only the providers you use):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   MSG91_AUTHKEY, MSG91_SENDER, MSG91_TEMPLATE_ID         (sms: msg91)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM     (sms/whatsapp: twilio)
//   TWILIO_WHATSAPP_FROM                                   (whatsapp: twilio)
//   RESEND_API_KEY, RESEND_FROM                            (email: resend)
// ═══════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, isInternalServiceCall } from '../_shared/auth.ts';

interface Delivery {
  id: string;
  channel: 'sms' | 'email' | 'whatsapp';
  destination: string;
  title: string | null;
  body: string;
}

async function getProvider(supabase: any, key: string): Promise<string> {
  const { data } = await supabase.from('platform_config').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? '').trim().toLowerCase();
}

// ── SMS senders ───────────────────────────────────────────
async function sendSmsMsg91(d: Delivery): Promise<{ ref?: string }> {
  const authKey = Deno.env.get('MSG91_AUTHKEY');
  const sender = Deno.env.get('MSG91_SENDER') ?? 'SETUAP';
  if (!authKey) throw new Error('MSG91_AUTHKEY not configured');
  const res = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: authKey },
    body: JSON.stringify({
      sender,
      template_id: Deno.env.get('MSG91_TEMPLATE_ID') ?? '',
      recipients: [{ mobiles: d.destination.replace(/\D/g, ''), body: d.body }],
    }),
  });
  if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`);
  const j = await res.json().catch(() => ({}));
  return { ref: j?.request_id ?? j?.type };
}

async function sendTwilio(d: Delivery, channel: 'sms' | 'whatsapp'): Promise<{ ref?: string }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured');
  const from = channel === 'whatsapp'
    ? `whatsapp:${Deno.env.get('TWILIO_WHATSAPP_FROM') ?? ''}`
    : (Deno.env.get('TWILIO_FROM') ?? '');
  if (!from || from === 'whatsapp:') throw new Error(`Twilio "from" number not configured for ${channel}`);
  const to = channel === 'whatsapp' ? `whatsapp:${d.destination}` : d.destination;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
    },
    body: new URLSearchParams({ From: from, To: to, Body: d.body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  const j = await res.json().catch(() => ({}));
  return { ref: j?.sid };
}

async function sendEmailResend(d: Delivery): Promise<{ ref?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!key || !from) throw new Error('RESEND_API_KEY / RESEND_FROM not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from,
      to: [d.destination],
      subject: d.title ?? 'SETU',
      text: d.body,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const j = await res.json().catch(() => ({}));
  return { ref: j?.id };
}

async function dispatchOne(supabase: any, d: Delivery): Promise<{ ok: boolean; provider: string; ref?: string; error?: string }> {
  try {
    if (d.channel === 'sms') {
      const provider = await getProvider(supabase, 'sms_provider');
      if (provider === 'msg91') return { ok: true, provider, ...(await sendSmsMsg91(d)) };
      if (provider === 'twilio') return { ok: true, provider, ...(await sendTwilio(d, 'sms')) };
      throw new Error(`SMS provider "${provider || 'unset'}" not supported — set sms_provider in Settings`);
    }
    if (d.channel === 'whatsapp') {
      const provider = await getProvider(supabase, 'whatsapp_provider');
      if (provider === 'twilio') return { ok: true, provider, ...(await sendTwilio(d, 'whatsapp')) };
      throw new Error(`WhatsApp provider "${provider || 'unset'}" not supported — set whatsapp_provider in Settings`);
    }
    if (d.channel === 'email') {
      const provider = await getProvider(supabase, 'email_provider');
      if (provider === 'resend') return { ok: true, provider, ...(await sendEmailResend(d)) };
      throw new Error(`Email provider "${provider || 'unset'}" not supported — set email_provider in Settings`);
    }
    throw new Error(`Unknown channel ${d.channel}`);
  } catch (e: any) {
    return { ok: false, provider: 'none', error: e?.message ?? String(e) };
  }
}

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  // Worker endpoint — service-role (cron/backend) only.
  if (!isInternalServiceCall(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized: service-role required' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const supabase = adminClient();

  let limit = 50;
  try { const b = await req.json(); if (b?.limit) limit = Math.min(Number(b.limit), 200); } catch { /* default */ }

  const { data: claimed, error } = await supabase.rpc('claim_pending_deliveries', { p_limit: limit });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  const deliveries: Delivery[] = (claimed ?? []) as Delivery[];
  let sent = 0, failed = 0;

  for (const d of deliveries) {
    const r = await dispatchOne(supabase, d);
    await supabase.rpc('mark_delivery', {
      p_id: d.id,
      p_status: r.ok ? 'sent' : 'failed',
      p_provider: r.provider,
      p_provider_ref: r.ref ?? null,
      p_error: r.error ?? null,
    });
    if (r.ok) sent++; else failed++;
  }

  return new Response(JSON.stringify({ claimed: deliveries.length, sent, failed }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
