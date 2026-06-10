// ═══════════════════════════════════════════════════════════
// SETU — send-fcm-notification  (Supabase Edge Function)
//
// Sends a push notification to one or more users via Firebase
// Cloud Messaging (FCM v1 HTTP API).
//
// Called by:
//  - razorpay-webhook     after payment.captured
//  - update_order_status  (via pg_net or direct invoke) on status change
//  - Any server-side flow that needs to ping a user's device
//
// Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL               — your project URL
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS)
//   FIREBASE_PROJECT_ID        — from Firebase project settings
//   FIREBASE_SERVICE_ACCOUNT   — JSON string of Firebase Admin SDK service account
//
// Request body (JSON):
//   {
//     user_ids: string[],          // Supabase auth user UUIDs
//     title:    string,
//     body:     string,
//     data?:    Record<string, string>,   // extra key/value for app
//     type?:    'order'|'credit'|'system'|'promo'|'scheme'
//   }
//
// Returns: { sent: number, failed: number, errors: string[] }
// ═══════════════════════════════════════════════════════════

import { serve }         from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── FCM v1 OAuth2 token (cached per invocation) ───────────
let _cachedToken: string | null  = null;
let _tokenExpiry: number         = 0;

async function getFcmAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Date.now() / 1000;
  if (_cachedToken && _tokenExpiry > now + 60) return _cachedToken;

  // Build a JWT for the service account
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   serviceAccount.client_email,
    sub:   serviceAccount.client_email,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   Math.floor(now),
    exp:   Math.floor(now) + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const unsigned = `${encode(header)}.${encode(payload)}`;

  // Import the RSA private key
  const pkcs8 = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pkcs8), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${unsigned}.${signature}`;

  // Exchange JWT for OAuth2 access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`FCM OAuth failed: ${JSON.stringify(tokenData)}`);
  }

  _cachedToken = tokenData.access_token;
  _tokenExpiry = Math.floor(now) + (tokenData.expires_in ?? 3600);
  return _cachedToken!;
}

// ── Send one FCM message ──────────────────────────────────
async function sendFcmMessage(
  token:          string,
  title:          string,
  body:           string,
  data:           Record<string, string>,
  accessToken:    string,
  projectId:      string
): Promise<{ success: boolean; error?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token,
      notification: { title, body },
      data:          Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound:        'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      webpush: {
        notification: {
          icon:  '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          vibrate: [200, 100, 200],
        },
        fcm_options: { link: data.url ?? '/' },
      },
    },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(message),
  });

  if (res.ok) return { success: true };

  const err = await res.json();
  return { success: false, error: err?.error?.message ?? 'FCM send failed' };
}

// ── Main handler ──────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')               ?? '';
  const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?? '';
  const PROJECT_ID        = Deno.env.get('FIREBASE_PROJECT_ID')        ?? '';
  const SERVICE_ACCOUNT_S = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')   ?? '';

  if (!PROJECT_ID || !SERVICE_ACCOUNT_S) {
    return new Response(
      JSON.stringify({ error: 'FCM not configured — set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  let body: {
    user_ids: string[];
    title:    string;
    body:     string;
    data?:    Record<string, string>;
    type?:    string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const { user_ids, title, body: msgBody, data = {}, type = 'system' } = body;

  if (!Array.isArray(user_ids) || user_ids.length === 0 || !title || !msgBody) {
    return new Response(
      JSON.stringify({ error: 'user_ids (array), title, and body are required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Fetch FCM tokens from profiles
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, fcm_token')
    .in('id', user_ids)
    .not('fcm_token', 'is', null);

  if (profileErr) {
    return new Response(
      JSON.stringify({ error: `Supabase error: ${profileErr.message}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const tokensToSend = (profiles ?? []).filter(p => p.fcm_token);

  if (tokensToSend.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, errors: [], reason: 'No FCM tokens found for given user_ids' }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Get FCM OAuth2 token
  let accessToken: string;
  try {
    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_S);
    accessToken = await getFcmAccessToken(serviceAccount);
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: `FCM auth failed: ${e.message}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // 3. Also insert a row into notifications table (for in-app bell)
  const notifRows = user_ids.map(uid => ({
    user_id: uid,
    type:    type as 'order' | 'credit' | 'promo' | 'scheme' | 'system',
    title,
    body:    msgBody,
    data:    Object.keys(data).length ? data : null,
  }));
  // Fire-and-forget; don't block FCM sends on DB
  supabase.from('notifications').insert(notifRows).then(({ error }) => {
    if (error) console.error('[send-fcm] notification insert failed:', error.message);
  });

  // 4. Send FCM messages concurrently
  const results = await Promise.allSettled(
    tokensToSend.map(p =>
      sendFcmMessage(p.fcm_token!, title, msgBody, { ...data, type }, accessToken, PROJECT_ID)
    )
  );

  let sent   = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.success) {
      sent++;
    } else {
      failed++;
      const reason = r.status === 'rejected'
        ? String(r.reason)
        : (r.value.error ?? 'unknown');
      errors.push(`${tokensToSend[i].id}: ${reason}`);

      // If token is invalid/unregistered, clear it from the profile
      if (reason.includes('UNREGISTERED') || reason.includes('INVALID_ARGUMENT')) {
        supabase
          .from('profiles')
          .update({ fcm_token: null })
          .eq('id', tokensToSend[i].id)
          .then(() => {});
      }
    }
  });

  return new Response(
    JSON.stringify({ sent, failed, errors }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
});
