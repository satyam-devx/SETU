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

Kafka topics for this overlay are created automatically by the `setu-kafka-init` Job (mirrors docker-compose's `kafka-init` service) — no manual `kafka-topics.sh` step needed.

## CI/CD

`.github/workflows/realtime-deploy.yml` builds and pushes the `setu-realtime` image to GHCR on every push to `main` that touches `server/realtime/**` or `k8s/**`, and validates both `k8s/overlays/local` and `k8s/overlays/production` render cleanly with `kubectl kustomize` on every PR. It does **not** apply anything to a real cluster unless a `KUBE_CONFIG_PRODUCTION` secret is set on the repo — until then, the `deploy` job no-ops and just tells you the image was pushed. Add that secret (base64-encoded kubeconfig) once you have a real production cluster to deploy step 6 below automatically.

## Production

1. ~~Push the realtime image to your registry~~ — CI does this now (see above); just make sure the production overlay's image references point at `ghcr.io/satyam-devx/setu-realtime`.
2. Supply `setu-realtime-secrets` from your secret manager / External Secrets rather than Git.
3. Replace managed Redis/Kafka endpoints in the production ConfigMap (`patch-production-config.yaml`).
4. Point the OTel Collector at a real tracing backend in `patch-production-tracing.yaml` (`SETU_TRACE_BACKEND_ENDPOINT`/`SETU_TRACE_BACKEND_INSECURE`) — `k8s/overlays/local`'s Jaeger is dev-only and isn't deployed in production. Until you set a real endpoint, the collector will log export errors on a retry loop rather than block the app (the app only ever talks to the in-cluster collector, never the backend directly).
5. Install metrics-server for HPA, and the KEDA operator for the Kafka-lag ScaledObjects (see below).
6. Put an ingress/load balancer with WebSocket support in front of `setu-realtime`.
7. Apply with `kubectl apply -k k8s/overlays/production`, or set `KUBE_CONFIG_PRODUCTION` and let CI do it.

## Observability

- Every workload exposes `/metrics` (Prometheus text format: counters, gauges, and histograms with real bucket data for HTTP/Kafka/outbox durations) and `/healthz` (liveness/readiness — tracks actual Kafka producer/consumer connection state, not just "process is running").
- `k8s/overlays/local` ships self-contained Prometheus + Grafana + Jaeger for development. Grafana auto-provisions a 10-panel dashboard (connections, Kafka throughput/retries/DLQ, outbox backlog, HTTP/Kafka/outbox p95 latency, HTTP error rate).
- Prometheus evaluates alerting rules locally out of the box (visible under its own `/alerts` UI even with no Alertmanager configured) — outbox backlog growth, DLQ events, retry storms, elevated HTTP error rate, and worker-down conditions. See `rules.yml` inside `prometheus.yaml`.
- None of Prometheus/Grafana/Jaeger ship in the production overlay — bring your own managed stack, or reuse the local manifests as a starting point for an in-cluster deployment.

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
- `setu-kafka-worker` does two jobs in one process: publishing the Postgres outbox to Kafka, and projecting Kafka into Redis. The projector side is safe to scale — that's what Kafka consumer groups are for. The outbox side needed an explicit fix: rows are claimed via `setu_claim_outbox_batch()` (`FOR UPDATE SKIP LOCKED`, migration `20240101000101`) so concurrent replicas never claim — and double-publish — the same row. A claim that's never finalized (crashed replica) expires after `KAFKA_OUTBOX_LEASE_SECONDS` (default 30s) and becomes claimable again.

Install the KEDA operator in the cluster first. Then apply the normal SETU overlay. For managed Kafka, configure SASL/TLS through a KEDA `TriggerAuthentication` rather than placing credentials in `ScaledObject` metadata.
