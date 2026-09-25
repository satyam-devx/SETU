/** Replay SETU Kafka DLQ events back to their domain topic.
 * Usage: node replay-dlq.mjs --domain payment --limit 100
 * This is an operator tool. It does not mutate PostgreSQL directly.
 */
import { Kafka, logLevel } from 'kafkajs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const domain = args.get('domain');
const limit = Math.max(1, Number(args.get('limit') || 100));
const domains = { payment: 'setu.payment.events', inventory: 'setu.inventory.events', dispatch: 'setu.dispatch.events', financial: 'setu.financial.events' };
if (!domains[domain]) throw new Error(`Unknown --domain. Use one of: ${Object.keys(domains).join(', ')}`);

const brokers = String(process.env.KAFKA_BROKERS || '127.0.0.1:9092').split(',').filter(Boolean);
const kafka = new Kafka({ clientId: 'setu-dlq-replayer', brokers, logLevel: logLevel.WARN });
const consumer = kafka.consumer({ groupId: `setu-dlq-replay-${domain}-${Date.now()}`, allowAutoTopicCreation: false });
const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: false });
const dlq = `setu.${domain}.events.dlq`;
const target = domains[domain];
let count = 0;

await consumer.connect(); await producer.connect();
await consumer.subscribe({ topic: dlq, fromBeginning: true });
await consumer.run({ eachMessage: async ({ message, pause }) => {
  if (count >= limit) { pause(); return; }
  if (!message.value) return;
  const event = JSON.parse(message.value.toString());
  await producer.send({ topic: target, acks: -1, messages: [{ key: event.aggregateId || event.eventId, value: JSON.stringify(event), headers: { 'x-setu-replayed': 'true', 'x-setu-replayed-at': new Date().toISOString(), 'x-setu-event-id': event.eventId } }] });
  count += 1;
  console.log(`replayed ${domain} ${event.eventId}`);
  if (count >= limit) setTimeout(async () => { await consumer.disconnect(); await producer.disconnect(); process.exit(0); }, 50);
}});
