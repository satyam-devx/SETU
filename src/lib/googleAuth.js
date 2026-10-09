// SETU — Native Google Sign-In + temporary in-app diagnostics.
// Existing authentication behavior is intentionally preserved.
// Diagnostics never persist raw ID/access/refresh tokens or nonce values.

import { SocialLogin } from '@capgo/capacitor-social-login';

let initialized = false;
const DEBUG_KEY = 'setu_google_signin_debug_v1';
const MAX_EVENTS = 300;
const state = {
  version: 1,
  sessionId: `gsi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  startedAt: new Date().toISOString(),
  attempts: 0,
  events: [],
  lastFailure: null,
};

function safe(value, max = 12000) {
  try {
    return String(typeof value === 'string' ? value : JSON.stringify(value)).slice(0, max);
  } catch {
    return String(value ?? '').slice(0, max);
  }
}

function redact(value) {
  if (value == null) return value;
  const s = safe(value);
  if ((s.match(/\./g) || []).length === 2 && s.length > 100) return '[REDACTED_JWT]';
  return s
    .replace(/(access[_-]?token|refresh[_-]?token|id[_-]?token|authorization)\s*[:=]\s*["']?[^"',\s}]+/gi, '$1=[REDACTED]')
    .replace(/(token)\s*[:=]\s*["']?[^"',\s}]+/gi, '$1=[REDACTED]');
}

function errorInfo(error) {
  if (!error) return null;
  const out = {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: redact(error?.message ?? String(error)),
    stack: redact(error?.stack ?? null),
  };
  try {
    for (const key of Object.keys(error)) {
      if (key !== 'message' && key !== 'stack') out[key] = redact(error[key]);
    }
  } catch {}
  return out;
}

function runtime() {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator?.userAgent ?? null,
    platform: navigator?.platform ?? null,
    language: navigator?.language ?? null,
    languages: navigator?.languages ?? null,
    online: navigator?.onLine ?? null,
    origin: (() => { try { return window.location?.origin ?? null; } catch { return null; } })(),
    screen: {
      width: window?.screen?.width ?? null,
      height: window?.screen?.height ?? null,
      pixelRatio: window?.devicePixelRatio ?? null,
    },
  };
}

function clientSummary(id) {
  if (!id) return { present: false };
  const s = String(id);
  const parts = s.split('-');
  return {
    present: true,
    prefix: parts[0] ?? null,
    suffix: parts.length > 1 ? parts.at(-1) : null,
    length: s.length,
    looksLikeGoogleClientId: /\.apps\.googleusercontent\.com$/.test(s),
  };
}

function record(type, data = {}) {
  const event = {
    at: new Date().toISOString(),
    elapsedMs: Date.now() - new Date(state.startedAt).getTime(),
    type,
    data,
  };
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  try {
    localStorage.setItem(DEBUG_KEY, JSON.stringify(state));
  } catch {}
}

function report(extra = {}) {
  let webClientId = null;
  try { webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID; } catch {}
  return {
    reportType: 'SETU Native Google Sign-In Diagnostic',
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    session: { id: state.sessionId, startedAt: state.startedAt, attempts: state.attempts },
    runtime: runtime(),
    google: {
      plugin: '@capgo/capacitor-social-login',
      flow: 'Credential Manager / native Google ID token',
      initialization: {
        initialized,
        webClientId: clientSummary(webClientId),
      },
    },
    lastFailure: state.lastFailure,
    current: extra,
    events: state.events.slice(-MAX_EVENTS),
  };
}

function reportText(extra = {}) {
  return JSON.stringify(report(extra), null, 2);
}

function removePanel() {
  try { document.getElementById('setu-google-debug-panel')?.remove(); } catch {}
}

function showPanel(extra = {}) {
  try {
    removePanel();
    const text = reportText(extra);

    const overlay = document.createElement('div');
    overlay.id = 'setu-google-debug-panel';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;' +
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;';

    const panel = document.createElement('div');
    panel.style.cssText =
      'width:min(100%,760px);max-height:92vh;background:#101114;color:#f5f7fa;' +
      'border:1px solid rgba(255,255,255,.14);border-radius:18px;' +
      'box-shadow:0 20px 70px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText =
      'padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.1);' +
      'display:flex;align-items:center;justify-content:space-between;gap:12px;';

    const title = document.createElement('div');
    title.innerHTML =
      '<div style="font-size:17px;font-weight:700">SETU Google Sign-In Diagnostics</div>' +
      '<div style="font-size:12px;opacity:.68;margin-top:3px">Temporary developer diagnostics • tokens/nonces redacted</div>';

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.cssText = 'border:0;border-radius:10px;padding:9px 12px;background:#24272d;color:#fff;font-weight:600;';
    close.onclick = removePanel;
    header.append(title, close);

    const actions = document.createElement('div');
    actions.style.cssText =
      'padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.1);';

    const button = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'border:0;border-radius:10px;padding:10px 13px;background:#ff7a18;color:#fff;font-weight:700;';
      b.onclick = fn;
      return b;
    };

    const copy = button('Copy report', async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement('textarea');
        area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      copy.textContent = 'Copied ✓';
      setTimeout(() => { copy.textContent = 'Copy report'; }, 1400);
    });

    const download = button('Download report', () => {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `setu-google-signin-${state.sessionId}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    actions.append(copy, download, button('Refresh', () => showPanel(extra)));

    const body = document.createElement('pre');
    body.textContent = text;
    body.style.cssText =
      'margin:0;padding:16px;overflow:auto;white-space:pre-wrap;word-break:break-word;' +
      'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dbe2ea;flex:1;';

    panel.append(header, actions, body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  } catch (e) {
    record('debug_panel_error', { error: errorInfo(e) });
  }
}

function ensureInitialized() {
  if (initialized) {
    record('initialize_skipped', { reason: 'already_initialized' });
    return;
  }

  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  record('initialize_started', { webClientId: clientSummary(webClientId) });

  if (!webClientId) {
    const error = new Error(
      'VITE_GOOGLE_WEB_CLIENT_ID is not set in the build environment — ' +
      'native Google Sign-In cannot start. See .env.example / ANDROID_APP.md.'
    );
    record('initialize_failed', { error: errorInfo(error) });
    throw error;
  }

  SocialLogin.initialize({ google: { webClientId } });
  initialized = true;
  record('initialize_success', { webClientId: clientSummary(webClientId) });
}

async function sha256Hex(message) {
  const started = performance.now();
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const result = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  record('nonce_hash_created', {
    algorithm: 'SHA-256',
    inputLength: message.length,
    outputLength: result.length,
    durationMs: Math.round(performance.now() - started),
  });
  return result;
}

function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  record('raw_nonce_created', { byteLength: bytes.length, nonceLength: nonce.length, value: '[REDACTED]' });
  return nonce;
}

export async function signInWithGoogleNative() {
  const attemptId = `attempt-${state.attempts + 1}-${Date.now()}`;
  const startedAt = performance.now();
  state.attempts += 1;

  record('sign_in_started', {
    attemptId,
    attemptNumber: state.attempts,
    runtime: runtime(),
  });

  try {
    ensureInitialized();

    const rawNonce = randomNonce();
    const hashedNonce = await sha256Hex(rawNonce);

    record('credential_manager_call_started', {
      attemptId,
      nonce: { raw: '[REDACTED]', hashed: '[REDACTED]', hashedLength: hashedNonce.length },
      options: { provider: 'google', scopes: [], expectedRecovery: 'plugin-managed [16] retry' },
    });

    // ORIGINAL AUTHENTICATION CALL — unchanged.
    const login = await SocialLogin.login({
      provider: 'google',
      options: { nonce: hashedNonce },
    });

    const idToken = login.result?.idToken;

    record('credential_manager_call_succeeded', {
      attemptId,
      durationMs: Math.round(performance.now() - startedAt),
      responseShape: {
        hasResult: Boolean(login?.result),
        resultKeys: login?.result ? Object.keys(login.result) : [],
        hasIdToken: Boolean(idToken),
      },
      idToken: idToken ? '[REDACTED_PRESENT]' : '[ABSENT]',
    });

    if (!idToken) {
      const error = new Error('Google did not return an ID token.');
      state.lastFailure = { attemptId, stage: 'id_token_validation', error: errorInfo(error) };
      record('id_token_missing', state.lastFailure);
      showPanel(state.lastFailure);
      throw error;
    }

    record('sign_in_completed', {
      attemptId,
      durationMs: Math.round(performance.now() - startedAt),
      idTokenPresent: true, // never log the token itself
    });

    return { idToken, nonce: rawNonce };
  } catch (error) {
    const debug = ` [DEBUG code=${error?.code ?? 'none'} message="${error?.message ?? 'none'}"]`;
    const failure = {
      attemptId,
      stage: 'native_google_sign_in',
      durationMs: Math.round(performance.now() - startedAt),
      error: errorInfo(error),
    };

    state.lastFailure = failure;
    record('sign_in_failed', failure);
    showPanel(failure);

    // ORIGINAL CALLER-FACING ERROR FORMAT — unchanged.
    throw new Error('Google sign-in failed.' + debug);
  }
}

// Developer-only console access; no auth flow depends on this.
try {
  if (typeof window !== 'undefined') {
    window.__SETU_GOOGLE_DEBUG__ = {
      getReport: () => report(),
      copy: async () => {
        const text = reportText();
        await navigator.clipboard.writeText(text);
        return text.length;
      },
      download: () => {
        const text = reportText();
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `setu-google-signin-${state.sessionId}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      clear: () => {
        state.events = [];
        state.lastFailure = null;
        localStorage.removeItem(DEBUG_KEY);
      },
      show: () => showPanel(),
    };
  }
} catch {}
