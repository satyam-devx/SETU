# SETU Kubernetes

This is the first Kubernetes layer for SETU. It orchestrates the stateful realtime/Kafka workers without moving PostgreSQL/Supabase into the cluster.

## Workloads

- `setu-realtime`: authenticated WebSocket + HTTP gateway; horizontally scalable.
- `setu-kafka-worker`: transactional outbox publisher + Kafka-to-Redis projector.
- `setu-domain-workers`: payment, inventory, dispatch and financial Kafka consumer groups with retry/DLQ behavior already implemented in the image.

## Stateful dependencies

`k8s/overlays/local` includes single-node Redis and Kafka for cluster-level development only. Do **not** treat those manifests as HA production infrastructure.

Production should point `REDIS_URL` and `KAFKA_BROKERS` at managed/HA services (or a separately operated Kafka/Redis cluster). Supabase/Postgres remains the authoritative database outside Kubernetes.

## Deploy local

```bash
kubectl apply -k k8s/overlays/local
kubectl -n setu get pods -w
kubectl -n setu port-forward svc/setu-realtime 8787:8787
curl http://127.0.0.1:8787/healthz
```

Create real secrets separately; do not commit `secret.yaml` with production credentials.

## Production

1. Push the realtime image to your registry and update the image in the production overlay.
2. Supply `setu-realtime-secrets` from your secret manager / External Secrets rather than Git.
3. Replace managed Redis/Kafka endpoints in the production ConfigMap.
4. Install metrics-server for HPA.
5. Put an ingress/load balancer with WebSocket support in front of `setu-realtime`.
6. Apply with `kubectl apply -k k8s/overlays/production`.

## Safety boundaries

- Kubernetes does not become the source of truth.
- PostgreSQL/Supabase owns payment, inventory, dispatch and financial state.
- Kafka remains the durable event backbone.
- Redis remains cache/dedupe/realtime coordination.
- WebSocket remains client delivery.

## KEDA Kafka-lag autoscaling

KEDA is now part of the SETU autoscaling design. The Kafka worker and domain workers scale from **consumer-group lag**, not only CPU.

- `setu-kafka-worker`: 2–12 replicas
- `setu-domain-workers`: 2–16 replicas
- Main and retry topics are covered for payment, inventory, dispatch, and financial workers.
- Scale-down is intentionally slower than scale-up to avoid thrashing during bursts.
- KEDA fallback keeps a minimum worker count if the scaler cannot read Kafka metrics.

Install the KEDA operator in the cluster first. Then apply the normal SETU overlay. For managed Kafka, configure SASL/TLS through a KEDA `TriggerAuthentication` rather than placing credentials in `ScaledObject` metadata.
