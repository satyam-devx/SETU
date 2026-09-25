/**
 * SETU Realtime Gateway
 *
 * Browser-facing WebSocket gateway backed by Redis Pub/Sub and Supabase Realtime.
 *
 * Responsibilities:
 *  - authenticate a WebSocket connection with a Supabase access token
 *  - authorize private rooms before joining them
 *  - bridge selected Supabase Postgres changes into Redis
 *  - fan Redis events out to connected WebSocket clients
 *  - cache the latest rider GPS point in Redis
 *
 * Redis is never exposed to the browser.
 */
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient } from 'redis';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.REALTIME_PORT || 8787);
const HOST = process.env.REALTIME_HOST || '0.0.0.0';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGINS = (process.env.REALTIME_ALLOWED_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean);
const LOCATION_RATE_LIMIT_SECONDS = Math.max(3, Number(process.env.RIDER_LOCATION_MIN_INTERVAL_SECONDS || 5));
const MAX_CONNECTIONS = Math.max(50, Number(process.env.REALTIME_MAX_CONNECTIONS || 5000));

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required by the realtime gateway');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const redis = createRedisClient({ url: REDIS_URL });
const redisSubscriber = redis.duplicate();

const rooms = new Map(); // room -> Set<WebSocket>
const clientState = new WeakMap();
let connectionCount = 0;

function log(...args) {
  console.log('[SETU realtime]', ...args);
}

function isOriginAllowed(origin) {
  if (!origin || ALLOWED_ORIGINS.includes('*')) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function isFiniteCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

async function publishRiderLocation(ws, state, message) {
  if (state.role !== 'rider') {
    send(ws, { type: 'rider.location.error', code: 'RIDER_ROLE_REQUIRED', requestId: message.requestId });
    return;
  }

  const lat = isFiniteCoordinate(message.lat, -90, 90);
  const lng = isFiniteCoordinate(message.lng, -180, 180);
  const accuracy = message.accuracy == null ? null : isFiniteCoordinate(message.accuracy, 0, 10000);
  if (lat == null || lng == null || (message.accuracy != null && accuracy == null)) {
    send(ws, { type: 'rider.location.error', code: 'INVALID_COORDINATES', requestId: message.requestId });
    return;
  }

  // One atomic Redis key per authenticated rider prevents accidental GPS
  // floods across multiple app instances. The normal mobile client publishes
  // every ~10s while this guard keeps a compromised client from spamming DB.
  const limiterKey = `setu:ratelimit:rider-location:${state.userId}`;
  const allowed = await redis.set(limiterKey, '1', { NX: true, EX: LOCATION_RATE_LIMIT_SECONDS });
  if (allowed !== 'OK') {
    send(ws, { type: 'rider.location.throttled', retryAfterSeconds: LOCATION_RATE_LIMIT_SECONDS, requestId: message.requestId });
    return;
  }

  const { data: rider, error: riderError } = await admin
    .from('riders').select('id').eq('user_id', state.userId).maybeSingle();
  if (riderError || !rider) {
    send(ws, { type: 'rider.location.error', code: 'RIDER_NOT_FOUND', requestId: message.requestId });
    return;
  }

  const row = {
    rider_id: rider.id, lat, lng, accuracy,
    is_on_delivery: Boolean(message.isOnDelivery),
    recorded_at: new Date().toISOString(),
  };
  const { error } = await admin.from('rider_locations').upsert(row, { onConflict: 'rider_id' });
  if (error) {
    send(ws, { type: 'rider.location.error', code: 'PERSIST_FAILED', requestId: message.requestId });
    return;
  }

  await cacheRiderLocation(row);
  const event = { room: `rider:${rider.id}`, type: 'rider.location', entity: row, operation: 'UPSERT', source: 'gateway', at: row.recorded_at };
  await publishEvent(event);
  // The gateway also emits a private user-room event so the rider app can
  // observe its own accepted location without opening another room.
  await publishEvent({ ...event, room: `user:${state.userId}` });
  send(ws, { type: 'rider.location.accepted', requestId: message.requestId, recordedAt: row.recorded_at });
}

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  clientState.get(ws).rooms.add(room);
}

function leaveAllRooms(ws) {
  const state = clientState.get(ws);
  if (!state) return;
  for (const room of state.rooms) {
    const members = rooms.get(room);
    if (!members) continue;
    members.delete(ws);
    if (!members.size) rooms.delete(room);
  }
  state.rooms.clear();
}

function broadcast(room, payload) {
  const members = rooms.get(room);
  if (!members) return;
  for (const ws of members) send(ws, payload);
}

async function getRole(userId) {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || null;
}

async function canAccessOrder(userId, orderId, role) {
  let query = admin.from('orders').select('id,customer_id,vendor_id,rider_id,village_id,status').eq('id', orderId).maybeSingle();
  const { data: order, error } = await query;
  if (error || !order) return false;
  if (['admin', 'super_admin'].includes(role)) return true;
  if (order.customer_id === userId) return true;

  if (role === 'vendor') {
    const { data } = await admin.from('vendors').select('id').eq('id', order.vendor_id).eq('owner_id', userId).maybeSingle();
    return Boolean(data);
  }
  if (role === 'rider') {
    const { data } = await admin.from('riders').select('id').eq('id', order.rider_id).eq('user_id', userId).maybeSingle();
    return Boolean(data);
  }
  if (role === 'anchor') {
    const { data } = await admin.from('profiles').select('village_id').eq('id', userId).maybeSingle();
    return Boolean(data?.village_id && data.village_id === order.village_id);
  }
  return false;
}

async function canAccessRider(userId, riderId, role) {
  if (['admin', 'super_admin'].includes(role)) return true;
  const { data: rider } = await admin.from('riders').select('id,user_id').eq('id', riderId).maybeSingle();
  if (!rider) return false;
  if (rider.user_id === userId) return true;
  if (role === 'customer') {
    const { data } = await admin.from('orders').select('id').eq('rider_id', riderId).eq('customer_id', userId)
      .in('status', ['picked_up', 'on_the_way']).limit(1).maybeSingle();
    return Boolean(data);
  }
  return false;
}

async function authorizeRoom(userId, role, room) {
  const [kind, id] = room.split(':');
  if (!kind || !id || !id.length) return false;
  if (kind === 'user') return id === userId;
  if (kind === 'order') return canAccessOrder(userId, id, role);
  if (kind === 'rider') return canAccessRider(userId, id, role);
  return false;
}

async function publishEvent(event) {
  const channel = `setu:events:${event.room}`;
  await redis.publish(channel, JSON.stringify(event));
}

async function cacheRiderLocation(row) {
  if (!row?.rider_id) return;
  await redis.set(`setu:rider-location:${row.rider_id}`, JSON.stringify(row), { EX: 120 });
}

async function bridgeSupabase() {
  const channel = admin.channel('setu-realtime-gateway');

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async payload => {
    const row = payload.new || payload.old;
    if (!row?.id) return;
    const recipients = new Set();
    if (row.customer_id) recipients.add(`user:${row.customer_id}`);
    if (row.rider_id) {
      const { data: rider } = await admin.from('riders').select('user_id').eq('id', row.rider_id).maybeSingle();
      if (rider?.user_id) recipients.add(`user:${rider.user_id}`);
    }
    if (row.vendor_id) {
      const { data: vendor } = await admin.from('vendors').select('owner_id').eq('id', row.vendor_id).maybeSingle();
      if (vendor?.owner_id) recipients.add(`user:${vendor.owner_id}`);
    }
    const event = { type: 'order.changed', entity: row, operation: payload.eventType, at: new Date().toISOString() };
    for (const room of recipients) await publishEvent({ ...event, room });
    await publishEvent({ ...event, room: `order:${row.id}` });
  });

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rider_locations' }, async payload => {
    const row = payload.new || payload.old;
    if (!row?.rider_id) return;
    if (payload.eventType !== 'DELETE') await cacheRiderLocation(row);
    const event = { room: `rider:${row.rider_id}`, type: 'rider.location', entity: row, operation: payload.eventType, at: new Date().toISOString() };
    await publishEvent(event);
  });

  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async payload => {
    const row = payload.new;
    if (!row?.user_id) return;
    await publishEvent({ room: `user:${row.user_id}`, type: 'notification.created', entity: row, operation: 'INSERT', at: new Date().toISOString() });
  });

  const status = await channel.subscribe();
  log('Supabase bridge:', status);
}

async function start() {
  await redis.connect();
  await redisSubscriber.connect();

  await redisSubscriber.pSubscribe('setu:events:*', message => {
    try {
      const event = JSON.parse(message);
      if (event?.room) broadcast(event.room, event);
    } catch (error) {
      console.error('[SETU realtime] Invalid Redis event:', error.message);
    }
  });

  await bridgeSupabase();

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'setu-realtime', redis: redis.isReady, connections: connectionCount, rooms: rooms.size }));
      return;
    }
    if (req.url?.startsWith('/cache/rider/')) {
      const riderId = req.url.split('/').pop();
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Use WebSocket subscription for rider locations' }));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  // Protocol-level heartbeat detects dead mobile sockets even when the
  // browser/WebView stops delivering application messages.
  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      const state = clientState.get(ws);
      if (state?.isAlive === false) { ws.terminate(); continue; }
      if (state) state.isAlive = false;
      try { ws.ping(); } catch { ws.terminate(); }
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeatTimer));

  server.on('upgrade', (req, socket, head) => {
    if (connectionCount >= MAX_CONNECTIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    if (req.url !== '/ws') {
      socket.destroy();
      return;
    }
    if (!isOriginAllowed(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', ws => {
    connectionCount += 1;
    clientState.set(ws, { authenticated: false, userId: null, role: null, rooms: new Set(), authenticatedAt: null, lastPongAt: Date.now(), isAlive: true });
    ws.on('pong', () => { const state = clientState.get(ws); if (state) { state.isAlive = true; state.lastPongAt = Date.now(); } });
    send(ws, { type: 'hello', service: 'setu-realtime', version: 1 });

    const authTimeout = setTimeout(() => {
      const state = clientState.get(ws);
      if (!state?.authenticated) ws.close(4001, 'Authentication required');
    }, 10_000);

    ws.on('message', async raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', code: 'BAD_JSON' }); return; }
      const state = clientState.get(ws);
      if (!state) return;

      if (message.type === 'auth') {
        const token = String(message.accessToken || '');
        if (!token) { send(ws, { type: 'auth.error', code: 'TOKEN_REQUIRED' }); return; }
        const { data, error } = await authClient.auth.getUser(token);
        if (error || !data.user) {
          send(ws, { type: 'auth.error', code: 'INVALID_TOKEN' });
          ws.close(4003, 'Invalid token');
          return;
        }
        state.authenticated = true;
        state.userId = data.user.id;
        state.role = await getRole(data.user.id);
        state.authenticatedAt = Date.now();
        clearTimeout(authTimeout);
        joinRoom(ws, `user:${state.userId}`);
        send(ws, { type: 'auth.ok', userId: state.userId, role: state.role, reauthenticated: Boolean(state.authenticatedAt) });
        return;
      }

      if (!state.authenticated) { send(ws, { type: 'error', code: 'NOT_AUTHENTICATED' }); return; }

      if (message.type === 'subscribe') {
        const room = String(message.room || '');
        if (!await authorizeRoom(state.userId, state.role, room)) {
          send(ws, { type: 'subscription.error', room, code: 'FORBIDDEN' });
          return;
        }
        joinRoom(ws, room);
        send(ws, { type: 'subscription.ok', room });
        if (room.startsWith('rider:')) {
          const riderId = room.slice('rider:'.length);
          const cached = await redis.get(`setu:rider-location:${riderId}`);
          if (cached) send(ws, { type: 'rider.location', entity: JSON.parse(cached), source: 'redis-cache', at: new Date().toISOString() });
        }
        return;
      }

      if (message.type === 'unsubscribe') {
        const room = String(message.room || '');
        const members = rooms.get(room);
        if (members) members.delete(ws);
        state.rooms.delete(room);
        send(ws, { type: 'subscription.removed', room });
        return;
      }

      if (message.type === 'ping') {
        state.lastPongAt = Date.now();
        send(ws, { type: 'pong', at: Date.now() });
        return;
      }

      if (message.type === 'rider.location.publish') {
        try { await publishRiderLocation(ws, state, message); }
        catch (error) {
          console.error('[SETU realtime] rider location error:', error.message);
          send(ws, { type: 'rider.location.error', code: 'INTERNAL_ERROR', requestId: message.requestId });
        }
        return;
      }

      // Client-originated domain events are deliberately not accepted here.
      // Orders/payments/location writes remain authoritative in Supabase APIs.
      send(ws, { type: 'error', code: 'UNSUPPORTED_MESSAGE' });
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      leaveAllRooms(ws);
      clientState.delete(ws);
      connectionCount = Math.max(0, connectionCount - 1);
    });
  });

  server.listen(PORT, HOST, () => log(`listening on ${HOST}:${PORT}`));

  const shutdown = async signal => {
    log(`received ${signal}; shutting down`);
    server.close();
    try { await redisSubscriber.quit(); } catch {}
    try { await redis.quit(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(error => {
  console.error('[SETU realtime] fatal:', error);
  process.exit(1);
});
