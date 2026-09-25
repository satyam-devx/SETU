/**
 * SETU Kafka Worker
 *
 * Reliable Postgres -> Kafka outbox publisher + Kafka -> Redis realtime
 * projector. PostgreSQL remains the source of truth; Kafka is the durable
 * event backbone; Redis is only the low-latency delivery/cache layer.
 */
import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient } from 'redis';
import { Kafka, logLevel } from 'kafkajs';
import http from 'node:http';
import { incCounter, setGauge, metricsHandler } from './metrics.mjs';
import { contextFromKafkaHeaders, startSpan, traceparent } from './tracing.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const BROKERS = String(process.env.KAFKA_BROKERS || '127.0.0.1:9092').split(',').map(s => s.trim()).filter(Boolean);
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'setu-gateway';
const GROUP_ID = process.env.KAFKA_REALTIME_GROUP_ID || 'setu-realtime-projector-v1';
const BATCH_SIZE = Math.max(1, Number(process.env.KAFKA_OUTBOX_BATCH_SIZE || 100));
const POLL_MS = Math.max(250, Number(process.env.KAFKA_OUTBOX_POLL_MS || 1000));
const OUTBOX_MAX_ATTEMPTS = Math.max(3, Number(process.env.KAFKA_OUTBOX_MAX_ATTEMPTS || 20));
const ENABLE_PROJECTOR = process.env.KAFKA_REALTIME_PROJECTOR !== 'false';
const METRICS_PORT = Number(process.env.KAFKA_METRICS_PORT || 9465);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const redis = createRedisClient({ url: REDIS_URL });
const kafka = new Kafka({ clientId: CLIENT_ID, brokers: BROKERS, logLevel: logLevel.WARN, retry: { retries: 8 } });
const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: false });
const consumer = kafka.consumer({ groupId: GROUP_ID, allowAutoTopicCreation: false });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const topicFor = type => ({
  order: 'setu.order.events',
  notification: 'setu.notification.events',
  rider_location: 'setu.delivery.events',
  payment: 'setu.payment.events',
  inventory: 'setu.inventory.events',
  dispatch: 'setu.dispatch.events',
  financial_ledger: 'setu.financial.events',
})[type] || 'setu.domain.events';

async function publishOutboxBatch() {
  const { data: rows, error } = await supabase.from('setu_event_outbox')
    .select('id,event_id,event_type,aggregate_type,aggregate_id,payload,attempts')
    .is('published_at', null)
    .lt('attempts', OUTBOX_MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw error;
  if (!rows?.length) return 0;
  const batchSpan = startSpan('outbox.publish', { attributes: { 'setu.outbox.batch_size': rows.length, 'messaging.system': 'kafka' } });
  incCounter('setu_outbox_batches_total', {}, 1, 'Outbox batches attempted');

  const messagesByTopic = new Map();
  for (const row of rows) {
    const topic = topicFor(row.aggregate_type);
    if (!messagesByTopic.has(topic)) messagesByTopic.set(topic, []);
    messagesByTopic.get(topic).push({
      key: row.aggregate_id || row.event_id,
      value: JSON.stringify({
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        payload: row.payload,
        occurredAt: row.payload?.occurred_at || new Date().toISOString(),
        schemaVersion: 1,
      }),
      headers: { 'x-setu-event-id': row.event_id, 'x-setu-schema-version': '1', traceparent: traceparent(batchSpan.ctx) },
    });
  }

  for (const [topic, messages] of messagesByTopic) {
    await producer.send({ topic, acks: -1, messages });
  }

  const ids = rows.map(row => row.id);
  const now = new Date().toISOString();
  const { error: markError } = await supabase.from('setu_event_outbox')
    .update({ published_at: now })
    .in('id', ids);
  if (markError) { batchSpan.end('ERROR', { 'error.type': markError.message || 'outbox_mark_failed' }); throw markError; }
  batchSpan.end('OK', { 'setu.outbox.published': rows.length });
  incCounter('setu_outbox_events_published_total', {}, rows.length, 'Outbox events published to Kafka');
  return rows.length;
}

async function resolveOrderRecipients(order) {
  const rooms = new Set();
  if (order?.customer_id) rooms.add(`user:${order.customer_id}`);
  if (order?.vendor_id) {
    const { data } = await supabase.from('vendors').select('owner_id').eq('id', order.vendor_id).maybeSingle();
    if (data?.owner_id) rooms.add(`user:${data.owner_id}`);
  }
  if (order?.rider_id) {
    const { data } = await supabase.from('riders').select('user_id').eq('id', order.rider_id).maybeSingle();
    if (data?.user_id) rooms.add(`user:${data.user_id}`);
  }
  if (order?.id) rooms.add(`order:${order.id}`);
  return [...rooms];
}

async function projectToRedis(event) {
  const { eventId, aggregateType, aggregateId, payload } = event;
  const dedupeKey = `setu:kafka:projected:${eventId}`;
  const claimed = await redis.set(dedupeKey, '1', { NX: true, EX: 86400 });
  if (claimed !== 'OK') return;

  if (aggregateType === 'order') {
    const row = payload?.new || payload?.old || payload;
    for (const room of await resolveOrderRecipients(row)) {
      await redis.publish(`setu:events:${room}`, JSON.stringify({
        room, type: 'order.changed', entity: row, operation: payload?.operation, eventId, source: 'kafka', at: new Date().toISOString(),
      }));
    }
    return;
  }

  if (aggregateType === 'notification') {
    const row = payload?.new || payload?.old || payload;
    if (row?.user_id) {
      const room = `user:${row.user_id}`;
      await redis.publish(`setu:events:${room}`, JSON.stringify({ room, type: 'notification.created', entity: row, operation: 'INSERT', eventId, source: 'kafka', at: new Date().toISOString() }));
    }
    return;
  }

  if (aggregateType === 'rider_location') {
    const row = payload?.new || payload?.old || payload;
    if (row?.rider_id) {
      const room = `rider:${row.rider_id}`;
      await redis.set(`setu:rider-location:${row.rider_id}`, JSON.stringify(row), { EX: 120 });
      await redis.publish(`setu:events:${room}`, JSON.stringify({ room, type: 'rider.location', entity: row, operation: payload?.operation, eventId, source: 'kafka', at: new Date().toISOString() }));
    }
    return;
  }

  // Business-integrity events are projected only as notifications/revalidation
  // hints. They never mutate authoritative financial, inventory or dispatch
  // state from Redis/WebSocket.
  const row = payload?.new || payload?.old || payload;
  if (aggregateType === 'payment') {
    const orderId = row?.order_id;
    if (orderId) {
      await redis.publish(`setu:events:order:${orderId}`, JSON.stringify({
        room: `order:${orderId}`, type: 'payment.changed', entity: row,
        operation: payload?.operation, eventType: event.eventType, eventId, source: 'kafka', at: new Date().toISOString(),
      }));
    }
    return;
  }

  if (aggregateType === 'inventory') {
    const orderId = row?.order_id;
    if (orderId) {
      await redis.publish(`setu:events:order:${orderId}`, JSON.stringify({
        room: `order:${orderId}`, type: 'inventory.changed', entity: row,
        operation: payload?.operation, eventType: event.eventType, eventId, source: 'kafka', at: new Date().toISOString(),
      }));
    }
    return;
  }

  if (aggregateType === 'dispatch') {
    const orderId = row?.order_id;
    if (orderId) {
      await redis.publish(`setu:events:order:${orderId}`, JSON.stringify({
        room: `order:${orderId}`, type: 'dispatch.changed', entity: row,
        operation: payload?.operation, eventType: event.eventType, eventId, source: 'kafka', at: new Date().toISOString(),
      }));
    }
    if (row?.rider_id) {
      await redis.publish(`setu:events:rider:${row.rider_id}`, JSON.stringify({
        room: `rider:${row.rider_id}`, type: 'dispatch.changed', entity: row,
        operation: payload?.operation, eventType: event.eventType, eventId, source: 'kafka', at: new Date().toISOString(),
      }));
    }
    return;
  }

  if (aggregateType === 'financial_ledger') {
    // Financial events are intentionally admin-scoped. The WebSocket layer
    // performs its own authorization before a client can join admin rooms.
    await redis.publish('setu:events:admin', JSON.stringify({
      room: 'admin', type: 'financial.changed', entity: row,
      operation: payload?.operation, eventType: event.eventType, eventId, source: 'kafka', at: new Date().toISOString(),
    }));
  }
}

async function start() {
  await redis.connect();
  await producer.connect();
  if (ENABLE_PROJECTOR) {
    await consumer.connect();
    await consumer.subscribe({ topics: ['setu.order.events', 'setu.notification.events', 'setu.delivery.events', 'setu.payment.events', 'setu.inventory.events', 'setu.dispatch.events', 'setu.financial.events', 'setu.domain.events'], fromBeginning: false });
    await consumer.run({ eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());
      const span = startSpan('kafka.project', { parent: contextFromKafkaHeaders(message.headers || {}), attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': message.topic, 'messaging.kafka.partition': message.partition, 'setu.event.id': event.eventId, 'setu.event.type': event.eventType } });
      try { await projectToRedis(event); span.end('OK'); }
      catch (error) { span.end('ERROR', { 'error.type': error?.name || 'Error' }); console.error('[SETU kafka projector]', error); throw error; }
    } });
  }

  let stopping = false;
  const shutdown = async signal => {
    if (stopping) return; stopping = true;
    console.log(`[SETU kafka] received ${signal}; shutting down`);
    try { if (ENABLE_PROJECTOR) await consumer.disconnect(); } catch {}
    try { await producer.disconnect(); } catch {}
    try { await redis.quit(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const metricsServer = http.createServer((req, res) => { if (req.url === '/metrics') return metricsHandler()(req, res); res.writeHead(404); res.end(); });
  metricsServer.listen(METRICS_PORT, '0.0.0.0');

  while (!stopping) {
    try {
      const count = await publishOutboxBatch();
      if (!count) await sleep(POLL_MS);
    } catch (error) {
      console.error('[SETU kafka outbox]', error?.message || error);
      await sleep(Math.min(POLL_MS * 5, 5000));
    }
  }
}

start().catch(error => { console.error('[SETU kafka] fatal:', error); process.exit(1); });
