/**
 * SETU domain Kafka consumers.
 *
 * Kafka is the durable event backbone; PostgreSQL remains authoritative.
 * Each integrity domain has its own consumer group, retry topic and DLQ.
 * Handlers are intentionally side-effect-light: they project events to Redis
 * and emit operational metrics. Domain mutations remain inside PostgreSQL RPCs.
 */
import { createClient as createRedisClient } from 'redis';
import { Kafka, logLevel } from 'kafkajs';
import http from 'node:http';
import { incCounter, metricsHandler } from './metrics.mjs';
import { contextFromKafkaHeaders, startSpan } from './tracing.mjs';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const BROKERS = String(process.env.KAFKA_BROKERS || '127.0.0.1:9092').split(',').map(s => s.trim()).filter(Boolean);
const CLIENT_ID = process.env.KAFKA_DOMAIN_CLIENT_ID || 'setu-domain-workers';
const MAX_RETRIES = Math.max(1, Number(process.env.KAFKA_MAX_RETRIES || 5));
const RETRY_BASE_MS = Math.max(1000, Number(process.env.KAFKA_RETRY_BASE_MS || 5000));
const RETRY_MAX_MS = Math.max(RETRY_BASE_MS, Number(process.env.KAFKA_RETRY_MAX_MS || 300000));
const DEDUPE_TTL = Math.max(3600, Number(process.env.KAFKA_EVENT_DEDUPE_TTL || 7 * 86400));
const METRICS_PORT = Number(process.env.DOMAIN_WORKER_METRICS_PORT || 9466);

const domains = [
  { name: 'payment', topic: 'setu.payment.events', group: 'setu-payment-worker-v1' },
  { name: 'inventory', topic: 'setu.inventory.events', group: 'setu-inventory-worker-v1' },
  { name: 'dispatch', topic: 'setu.dispatch.events', group: 'setu-dispatch-worker-v1' },
  { name: 'financial', topic: 'setu.financial.events', group: 'setu-financial-worker-v1' },
];

const kafka = new Kafka({ clientId: CLIENT_ID, brokers: BROKERS, logLevel: logLevel.WARN, retry: { retries: 8 } });
const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: false });
const redis = createRedisClient({ url: REDIS_URL });
const consumers = [];
const retryConsumers = [];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const retryTopic = domain => `setu.${domain}.events.retry`;
const dlqTopic = domain => `setu.${domain}.events.dlq`;
const retryDelay = attempt => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1)));

function parseEvent(message) {
  if (!message?.value) throw new Error('empty Kafka message');
  const event = JSON.parse(message.value.toString());
  if (!event.eventId || !event.eventType || !event.aggregateType) throw new Error('invalid SETU event envelope');
  return event;
}

async function emitOperational(domain, status, event, extra = {}) {
  await redis.hIncrBy(`setu:kafka:metrics:${domain}`, status, 1);
  incCounter(`setu_kafka_events_${status}_total`, { domain }, 1, `Kafka domain events ${status}`);
  await redis.hSet(`setu:kafka:last:${domain}`, {
    status,
    eventId: event?.eventId || '',
    eventType: event?.eventType || '',
    at: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
}

async function projectDomainEvent(domain, event) {
  const row = event.payload?.new || event.payload?.old || event.payload;
  const orderId = row?.order_id;
  const eventMessage = JSON.stringify({
    room: orderId ? `order:${orderId}` : 'admin',
    type: `${domain}.event`,
    eventType: event.eventType,
    entity: row,
    eventId: event.eventId,
    source: 'kafka-domain-worker',
    at: new Date().toISOString(),
  });

  // Domain-specific projection. No handler writes authoritative business state.
  if (orderId) await redis.publish(`setu:events:order:${orderId}`, eventMessage);
  if (domain === 'dispatch' && row?.rider_id) {
    await redis.publish(`setu:events:rider:${row.rider_id}`, JSON.stringify({ ...JSON.parse(eventMessage), room: `rider:${row.rider_id}` }));
  }
  if (domain === 'financial') {
    await redis.publish('setu:events:admin', JSON.stringify({ ...JSON.parse(eventMessage), room: 'admin', type: 'financial.changed' }));
  }
}

async function claimOnce(domain, eventId) {
  return redis.set(`setu:kafka:processed:${domain}:${eventId}`, '1', { NX: true, EX: DEDUPE_TTL });
}

async function publishRetry(domain, event, attempt, originalMessage) {
  const nextAttempt = attempt + 1;
  const delay = retryDelay(nextAttempt);
  await producer.send({
    topic: retryTopic(domain),
    acks: -1,
    messages: [{
      key: event.aggregateId || event.eventId,
      value: JSON.stringify(event),
      headers: {
        'x-setu-event-id': event.eventId,
        'x-setu-retry-attempt': String(nextAttempt),
        'x-setu-retry-after-ms': String(delay),
        'x-setu-original-topic': originalMessage.topic || '',
      },
    }],
  });
}

async function publishDlq(domain, event, error, attempt, originalMessage) {
  await producer.send({
    topic: dlqTopic(domain),
    acks: -1,
    messages: [{
      key: event.aggregateId || event.eventId,
      value: JSON.stringify(event),
      headers: {
        'x-setu-event-id': event.eventId,
        'x-setu-retry-attempt': String(attempt),
        'x-setu-original-topic': originalMessage.topic || '',
        'x-setu-error': String(error?.message || error).slice(0, 1000),
        'x-setu-failed-at': new Date().toISOString(),
      },
    }],
  });
}

async function handle(domain, event) {
  await projectDomainEvent(domain, event);
}

async function processMessage(domain, message, isRetry = false) {
  const event = parseEvent(message);
  const span = startSpan(`kafka.${domain}.${isRetry ? 'retry' : 'process'}`, { parent: contextFromKafkaHeaders(message.headers || {}), attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': message.topic, 'setu.event.id': event.eventId, 'setu.event.type': event.eventType, 'setu.domain': domain } });
  const attempt = Number(message.headers?.['x-setu-retry-attempt']?.toString() || 0);

  if (isRetry) {
    const delay = Number(message.headers?.['x-setu-retry-after-ms']?.toString() || 0);
    if (delay > 0) await sleep(Math.min(delay, RETRY_MAX_MS));
  }

  const claimed = await claimOnce(domain, event.eventId);
  if (claimed !== 'OK') {
    await emitOperational(domain, 'duplicate', event);
    span.end('OK', { 'setu.duplicate': true });
    return;
  }

  try {
    await handle(domain, event);
    await emitOperational(domain, 'processed', event, { attempt });
    span.end('OK', { 'setu.attempt': attempt });
  } catch (error) {
    // Release the dedupe key so a retry can execute the handler again.
    await redis.del(`setu:kafka:processed:${domain}:${event.eventId}`);
    if (attempt >= MAX_RETRIES) {
      await publishDlq(domain, event, error, attempt, message);
      await emitOperational(domain, 'dlq', event, { attempt, error: error?.message || error });
      span.end('ERROR', { 'setu.dead_lettered': true });
      return;
    }
    await publishRetry(domain, event, attempt, message);
    await emitOperational(domain, 'retry', event, { attempt: attempt + 1, error: error?.message || error });
    span.end('ERROR', { 'setu.retry_scheduled': true });
  }
}

async function start() {
  await redis.connect();
  await producer.connect();

  const metricsServer = http.createServer((req, res) => { if (req.url === '/metrics') return metricsHandler()(req, res); res.writeHead(404); res.end(); });
  metricsServer.listen(METRICS_PORT, '0.0.0.0');

  for (const domain of domains) {
    const consumer = kafka.consumer({ groupId: domain.group, allowAutoTopicCreation: false });
    const retryConsumer = kafka.consumer({ groupId: `${domain.group}-retry`, allowAutoTopicCreation: false });
    await consumer.connect();
    await retryConsumer.connect();
    await consumer.subscribe({ topic: domain.topic, fromBeginning: false });
    await retryConsumer.subscribe({ topic: retryTopic(domain.name), fromBeginning: false });

    await consumer.run({ eachMessage: async ({ message }) => processMessage(domain.name, message, false) });
    await retryConsumer.run({ eachMessage: async ({ message }) => processMessage(domain.name, message, true) });
    consumers.push(consumer);
    retryConsumers.push(retryConsumer);
  }

  console.log(`[SETU domain workers] started: ${domains.map(d => d.name).join(', ')}`);
}

async function shutdown(signal) {
  console.log(`[SETU domain workers] ${signal}`);
  await Promise.allSettled([...consumers, ...retryConsumers].map(c => c.disconnect()));
  await producer.disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(error => { console.error('[SETU domain workers] fatal', error); process.exit(1); });
