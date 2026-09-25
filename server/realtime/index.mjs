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
import crypto from 'node:crypto';
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
const API_RATE_LIMIT = Math.max(10, Number(process.env.API_RATE_LIMIT_PER_MINUTE || 120));
const API_RATE_WINDOW_SECONDS = Math.max(10, Number(process.env.API_RATE_LIMIT_WINDOW_SECONDS || 60));
const ORDER_RATE_LIMIT = Math.max(1, Number(process.env.ORDER_RATE_LIMIT_PER_MINUTE || 10));
const CACHE_TTL_SECONDS = Math.max(5, Number(process.env.REDIS_CACHE_TTL_SECONDS || 60));
const IDEMPOTENCY_TTL_SECONDS = Math.max(300, Number(process.env.REDIS_IDEMPOTENCY_TTL_SECONDS || 86400));
const IDEMPOTENCY_LOCK_SECONDS = Math.max(15, Number(process.env.REDIS_IDEMPOTENCY_LOCK_SECONDS || 120));
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return current
`;

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

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async payload => {
    const row = payload.new || payload.old;
    if (row?.id) await redis.del(`setu:cache:v1:product:${row.id}`);
    if (row?.vendor_id) await redis.del(`setu:cache:v1:vendor:${row.vendor_id}`);
    await redis.del('setu:cache:v1:category-previews');
  });

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, async payload => {
    const row = payload.new || payload.old;
    if (row?.id) await redis.del(`setu:cache:v1:vendor:${row.id}`);
    await redis.del('setu:cache:v1:category-previews');
  });

  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async payload => {
    const row = payload.new || payload.old;
    if (row?.id) await redis.del(`setu:cache:v1:category:${row.id}`);
    await redis.del('setu:cache:v1:categories');
    await redis.del('setu:cache:v1:category-previews');
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


function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getBearerUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token };
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

async function rateLimit(key, limit, windowSeconds) {
  const count = Number(await redis.eval(RATE_LIMIT_SCRIPT, {
    keys: [key],
    arguments: [String(limit), String(windowSeconds)],
  }));
  return { allowed: count <= limit, count, limit, windowSeconds };
}

async function cacheAside(key, ttlSeconds, loader) {
  const cached = await redis.get(key);
  if (cached !== null) {
    try { return { value: JSON.parse(cached), hit: true }; } catch { await redis.del(key); }
  }

  // Single-flight across gateway replicas. If another instance is filling
  // the same key, briefly wait for it instead of stampeding Postgres.
  const lockKey = `${key}:fill-lock`;
  const lock = await redis.set(lockKey, '1', { NX: true, EX: 10 });
  if (lock !== 'OK') {
    for (let i = 0; i < 5; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 40 * (i + 1)));
      const retry = await redis.get(key);
      if (retry !== null) {
        try { return { value: JSON.parse(retry), hit: true }; } catch { break; }
      }
    }
  }

  const value = await loader();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  if (lock === 'OK') await redis.del(lockKey);
  return { value, hit: false };
}

async function readJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) { reject(Object.assign(new Error('Request body too large'), { statusCode: 413 })); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(payload);
}

async function cachedPublicData(pathname, url) {
  if (pathname === '/v1/cache/categories') {
    return cacheAside('setu:cache:v1:categories', CACHE_TTL_SECONDS, async () => {
      const { data, error } = await admin.from('categories')
        .select('id,name,name_hindi,icon,image_url,sort_order,is_active')
        .eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    });
  }
  if (pathname === '/v1/cache/category-previews') {
    return cacheAside('setu:cache:v1:category-previews', CACHE_TTL_SECONDS, async () => {
      const { data, error } = await admin.from('category_previews').select('*').order('sort_order');
      if (error) throw error;
      return data || [];
    });
  }
  const productMatch = pathname.match(/^\/v1\/cache\/products\/([^/]+)$/);
  if (productMatch) {
    const id = decodeURIComponent(productMatch[1]);
    return cacheAside(`setu:cache:v1:product:${id}`, CACHE_TTL_SECONDS, async () => {
      const { data, error } = await admin.from('products')
        .select('id,vendor_id,name,name_hindi,description,price,mrp,unit,stock,image_url,is_available,category,category_id,is_seasonal,vendors(id,name,rating,village)')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      return data || null;
    });
  }
  const vendorMatch = pathname.match(/^\/v1\/cache\/vendors\/([^/]+)$/);
  if (vendorMatch) {
    const id = decodeURIComponent(vendorMatch[1]);
    return cacheAside(`setu:cache:v1:vendor:${id}`, CACHE_TTL_SECONDS, async () => {
      const { data, error } = await admin.from('vendors')
        .select('id,name,category,village_id,village,image_url,rating,review_count,is_open,delivery_radius,trust_score,subscription_tier,lat,lng,is_active')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      return data || null;
    });
  }
  return null;
}

async function handleHttpApi(req, res, url) {
  const pathname = url.pathname;
  if (!pathname.startsWith('/v1/')) return false;

  const ipLimit = await rateLimit(`setu:rl:v1:ip:${clientIp(req)}`, API_RATE_LIMIT, API_RATE_WINDOW_SECONDS);
  if (!ipLimit.allowed) {
    sendJson(res, 429, { error: 'Too many requests', code: 'RATE_LIMITED', retryAfterSeconds: API_RATE_WINDOW_SECONDS }, {
      'retry-after': String(API_RATE_WINDOW_SECONDS), 'x-ratelimit-limit': String(ipLimit.limit), 'x-ratelimit-remaining': '0',
    });
    return true;
  }

  const auth = await getBearerUser(req);
  if (auth) {
    const userLimit = await rateLimit(`setu:rl:v1:user:${auth.user.id}`, API_RATE_LIMIT, API_RATE_WINDOW_SECONDS);
    if (!userLimit.allowed) {
      sendJson(res, 429, { error: 'Too many requests', code: 'RATE_LIMITED', retryAfterSeconds: API_RATE_WINDOW_SECONDS }, {
        'retry-after': String(API_RATE_WINDOW_SECONDS), 'x-ratelimit-limit': String(userLimit.limit), 'x-ratelimit-remaining': '0',
      });
      return true;
    }
  }

  if (req.method === 'GET') {
    const cached = await cachedPublicData(pathname, url);
    if (cached) {
      sendJson(res, 200, cached.value, { 'x-setu-cache': cached.hit ? 'HIT' : 'MISS', 'x-ratelimit-limit': String(ipLimit.limit) });
      return true;
    }
  }

  if (req.method === 'POST' && pathname === '/v1/orders') {
    if (!auth) { sendJson(res, 401, { error: 'Authentication required', code: 'AUTH_REQUIRED' }); return true; }
    const orderLimit = await rateLimit(`setu:rl:orders:${auth.user.id}`, ORDER_RATE_LIMIT, 60);
    if (!orderLimit.allowed) {
      sendJson(res, 429, { error: 'Too many order attempts', code: 'ORDER_RATE_LIMITED', retryAfterSeconds: 60 }, { 'retry-after': '60' });
      return true;
    }

    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      sendJson(res, 400, { error: 'A valid Idempotency-Key header is required', code: 'IDEMPOTENCY_KEY_REQUIRED' });
      return true;
    }

    let body;
    try { body = await readJson(req); } catch (error) { sendJson(res, error.statusCode || 400, { error: error.message }); return true; }
    const fingerprint = sha256(stableStringify(body));
    const resultKey = `setu:idempotency:v1:${auth.user.id}:${idempotencyKey}`;
    const existingRaw = await redis.get(resultKey);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (existing.fingerprint !== fingerprint) {
        sendJson(res, 409, { error: 'Idempotency key was already used with a different request', code: 'IDEMPOTENCY_KEY_REUSED' });
        return true;
      }
      if (existing.state === 'completed') {
        sendJson(res, existing.status || 200, existing.body, { 'x-setu-idempotent-replay': 'true' });
        return true;
      }
      sendJson(res, 409, { error: 'This request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      return true;
    }

    const claim = { state: 'processing', fingerprint, createdAt: new Date().toISOString() };
    const claimed = await redis.set(resultKey, JSON.stringify(claim), { NX: true, EX: IDEMPOTENCY_LOCK_SECONDS });
    if (claimed !== 'OK') {
      const raced = await redis.get(resultKey);
      if (raced) {
        const parsed = JSON.parse(raced);
        if (parsed.fingerprint !== fingerprint) { sendJson(res, 409, { error: 'Idempotency key was already used with a different request', code: 'IDEMPOTENCY_KEY_REUSED' }); return true; }
        if (parsed.state === 'completed') { sendJson(res, parsed.status || 200, parsed.body, { 'x-setu-idempotent-replay': 'true' }); return true; }
      }
      sendJson(res, 409, { error: 'This request is already being processed', code: 'IDEMPOTENCY_IN_PROGRESS' });
      return true;
    }

    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${auth.token}` } },
      });
      const { data, error } = await client.rpc('create_order', {
        p_vendor_id: body.vendor_id,
        p_items: (body.items || []).map(i => ({ product_id: i.product_id, qty: i.qty })),
        p_payment_method: body.payment_method,
        p_delivery_address: body.delivery_address ?? null,
        p_village_id: body.village_id ?? null,
        p_delivery_notes: body.delivery_notes ?? null,
        p_use_credit: !!body.use_credit,
        p_coupon_code: body.coupon_code ?? null,
        p_idempotency_key: idempotencyKey,
        p_address_id: body.address_id ?? null,
      });
      if (error) throw error;
      if (!data?.success) {
        const status = /authentication|permission/i.test(String(data?.error)) ? 403 : 409;
        const responseBody = { error: data?.error || 'Could not create order', code: 'ORDER_REJECTED' };
        await redis.set(resultKey, JSON.stringify({ state: 'completed', fingerprint, status, body: responseBody }), { EX: IDEMPOTENCY_TTL_SECONDS });
        sendJson(res, status, responseBody);
        return true;
      }
      const responseBody = data;
      await redis.set(resultKey, JSON.stringify({ state: 'completed', fingerprint, status: 200, body: responseBody }), { EX: IDEMPOTENCY_TTL_SECONDS });
      // Order creation changes product stock and order data; invalidate the
      // affected cache entries rather than serving stale inventory forever.
      if (body.items?.length) for (const item of body.items) await redis.del(`setu:cache:v1:product:${item.product_id}`);
      sendJson(res, 200, responseBody, { 'x-setu-idempotency': 'stored' });
      return true;
    } catch (error) {
      // Keep the DB's own idempotency key as the final safety net. Redis
      // claim expires automatically so a transient gateway crash cannot
      // permanently wedge a checkout attempt.
      await redis.del(resultKey);
      sendJson(res, 502, { error: error.message || 'Order service unavailable', code: 'ORDER_SERVICE_ERROR' });
      return true;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
  return true;
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

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestOrigin = String(req.headers.origin || '');
    if (requestOrigin && isOriginAllowed(requestOrigin)) {
      res.setHeader('access-control-allow-origin', requestOrigin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, Idempotency-Key');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('access-control-max-age', '600');
    }
    if (requestUrl.pathname.startsWith('/v1/') && req.method === 'OPTIONS') {
      res.writeHead(isOriginAllowed(requestOrigin) ? 204 : 403);
      res.end();
      return;
    }
    if (requestUrl.pathname.startsWith('/v1/')) {
      try {
        await handleHttpApi(req, res, requestUrl);
      } catch (error) {
        console.error('[SETU realtime] HTTP API error:', error);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error', code: 'INTERNAL_ERROR' });
      }
      return;
    }
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
