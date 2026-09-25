// SETU — authenticated application WebSocket client.
// Redis is server-only. This client handles auth, reconnect, token refresh,
// room subscriptions, heartbeat and lightweight telemetry.
import { supabase } from '@/lib/supabase';

const WS_URL = import.meta.env.VITE_REALTIME_URL;
const MAX_BACKOFF_MS = 15000;
const HEARTBEAT_MS = 25000;
const AUTH_REFRESH_SKEW_MS = 60_000;

let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let connectPromise = null;
let intentionallyClosed = false;
let heartbeatTimer = null;
let authRefreshTimer = null;
let lastMessageAt = 0;
let lastConnectedAt = 0;
let authStateCleanup = null;
let connectionGeneration = 0;
const listeners = new Map();
const pendingRooms = new Set();
const statusListeners = new Set();
const pendingLocationRequests = new Map();

function enabled() {
  return typeof window !== 'undefined' && typeof WebSocket !== 'undefined' && Boolean(WS_URL);
}

function notifyStatus(status, extra = {}) {
  const payload = { status, connected: status === 'connected', at: Date.now(), ...extra };
  for (const listener of statusListeners) listener(payload);
}

function emit(message) {
  const room = message?.room;
  if (room && listeners.has(room)) {
    for (const listener of listeners.get(room)) listener(message);
  }
  if (message?.type === 'order.changed' && listeners.has('__orders__')) {
    for (const listener of listeners.get('__orders__')) listener(message);
  }
  if (message?.type === 'notification.created' && listeners.has('__notifications__')) {
    for (const listener of listeners.get('__notifications__')) listener(message);
  }
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No authenticated Supabase session');
  return session;
}

async function authenticate(ws) {
  const session = await getSession();
  ws.send(JSON.stringify({ type: 'auth', accessToken: session.access_token }));
  return session;
}

function clearHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function clearAuthRefresh() {
  if (authRefreshTimer) clearTimeout(authRefreshTimer);
  authRefreshTimer = null;
}

function scheduleAuthRefresh(expiresAt) {
  clearAuthRefresh();
  if (!expiresAt || !socket || socket.readyState !== WebSocket.OPEN) return;
  const expiresMs = Number(expiresAt) * 1000;
  const delay = Math.max(5_000, expiresMs - Date.now() - AUTH_REFRESH_SKEW_MS);
  authRefreshTimer = setTimeout(async () => {
    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'auth', accessToken: session.access_token }));
        scheduleAuthRefresh(session.expires_at);
      } else {
        scheduleReconnect();
      }
    } catch {
      scheduleReconnect();
    }
  }, delay);
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
  }, HEARTBEAT_MS);
}

function scheduleReconnect() {
  if (intentionallyClosed || reconnectTimer || !enabled()) return;
  const wait = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF_MS);
  reconnectAttempt += 1;
  notifyStatus('reconnecting', { attempt: reconnectAttempt, retryInMs: wait });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect().catch(() => {});
  }, wait);
}

function attachSocket(ws, resolve, reject) {
  let settled = false;
  const generation = ++connectionGeneration;
  socket = ws;

  ws.onopen = async () => {
    try {
      const session = await authenticate(ws);
      scheduleAuthRefresh(session.expires_at);
      startHeartbeat();
      notifyStatus('authenticating', { generation });
    } catch (error) {
      if (!settled) { settled = true; reject(error); }
      ws.close(4001, 'Authentication unavailable');
    }
  };

  ws.onmessage = event => {
    lastMessageAt = Date.now();
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'auth.ok') {
      if (!settled) { settled = true; resolve(true); }
      reconnectAttempt = 0;
      lastConnectedAt = Date.now();
      notifyStatus('connected', { userId: message.userId, role: message.role, generation });
      for (const room of pendingRooms) ws.send(JSON.stringify({ type: 'subscribe', room }));
    }
    if (message.type === 'auth.error') notifyStatus('auth_error', { code: message.code });
    emit(message);
  };

  ws.onerror = error => {
    notifyStatus('error', { error });
    if (!settled) { settled = true; reject(error); }
  };

  ws.onclose = event => {
    clearHeartbeat();
    clearAuthRefresh();
    if (socket === ws) socket = null;
    connectPromise = null;
    notifyStatus('disconnected', { code: event.code, reason: event.reason });
    if (!intentionallyClosed) scheduleReconnect();
  };
}

export async function connect() {
  if (!enabled()) return false;
  if (socket?.readyState === WebSocket.OPEN) return true;
  if (connectPromise) return connectPromise;

  intentionallyClosed = false;
  connectPromise = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(WS_URL);
      attachSocket(ws, resolve, reject);
    } catch (error) {
      reject(error);
    }
  }).catch(error => {
    connectPromise = null;
    scheduleReconnect();
    throw error;
  });
  return connectPromise;
}

export function subscribe(room, listener) {
  if (!enabled() || !room || typeof listener !== 'function') return () => {};
  if (!listeners.has(room)) listeners.set(room, new Set());
  listeners.get(room).add(listener);
  pendingRooms.add(room);
  void connect().catch(() => {});

  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'subscribe', room }));
  }

  return () => {
    const set = listeners.get(room);
    if (!set) return;
    set.delete(listener);
    if (!set.size) {
      listeners.delete(room);
      pendingRooms.delete(room);
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'unsubscribe', room }));
    }
  };
}

export function subscribeOrders(listener) { return subscribe('__orders__', listener); }
export function subscribeNotifications(listener) { return subscribe('__notifications__', listener); }

export function subscribeStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  statusListeners.add(listener);
  listener({ status: socket?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected', connected: socket?.readyState === WebSocket.OPEN, at: Date.now() });
  return () => statusListeners.delete(listener);
}

/**
 * Publish the latest rider GPS point through the gateway. The gateway
 * validates that the authenticated socket belongs to the rider and applies
 * Redis-backed rate limiting before persisting/cache/fan-out.
 * Returns false when the gateway is unavailable; callers should then use the
 * existing Supabase write path as a safe fallback.
 */
export async function publishRiderLocation({ lat, lng, accuracy = null, isOnDelivery = false }) {
  if (!enabled()) return false;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    try { await connect(); } catch { return false; }
  }
  if (socket?.readyState !== WebSocket.OPEN) return false;
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return await new Promise(resolve => {
    const timer = setTimeout(() => {
      pendingLocationRequests.delete(requestId);
      resolve(false);
    }, 4000);
    pendingLocationRequests.set(requestId, { resolve, timer });
    socket.send(JSON.stringify({ type: 'rider.location.publish', requestId, lat, lng, accuracy, isOnDelivery }));
  });
}

export function getSetuRealtimeStatus() {
  return {
    enabled: enabled(),
    connected: socket?.readyState === WebSocket.OPEN,
    reconnectAttempt,
    lastConnectedAt,
    lastMessageAt,
    pendingRooms: pendingRooms.size,
  };
}

if (typeof window !== 'undefined') {
  authStateCleanup = supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.access_token) {
      if (event === 'SIGNED_OUT') disconnect();
      return;
    }
    if (socket?.readyState === WebSocket.OPEN && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
      socket.send(JSON.stringify({ type: 'auth', accessToken: session.access_token }));
      scheduleAuthRefresh(session.expires_at);
    }
  }).data.subscription;
}

export function disconnect() {
  intentionallyClosed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  clearHeartbeat();
  clearAuthRefresh();
  connectPromise = null;
  pendingRooms.clear();
  for (const pending of pendingLocationRequests.values()) {
    clearTimeout(pending.timer);
    pending.resolve(false);
  }
  pendingLocationRequests.clear();
  if (socket) socket.close(1000, 'client shutdown');
  socket = null;
  notifyStatus('disconnected');
}

export function isSetuRealtimeEnabled() { return enabled(); }

export function disposeSetuRealtime() {
  disconnect();
  authStateCleanup?.unsubscribe?.();
  authStateCleanup = null;
}
