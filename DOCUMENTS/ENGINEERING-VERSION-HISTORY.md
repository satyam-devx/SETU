# SETU Engineering Version History

This document records the cumulative engineering layers represented by this clean distribution.
The repository contains the final cumulative implementation, not separate full-source copies of each version.
That keeps the project free of duplicate frontend trees while preserving the functionality introduced across the iterations.

## Redis + WebSocket

- Redis-backed caching, coordination, deduplication/idempotency and rate limiting.
- WebSocket realtime gateway and client realtime integration.
- Realtime order/rider/notification flows and Redis-backed fanout/coordination.
- Reconnect/heartbeat/authentication-related realtime infrastructure retained in the final source tree.

## Kafka

- Transactional outbox migrations retained under `supabase/migrations/`.
- Kafka worker and domain-consumer infrastructure retained under `server/realtime/`.
- Retry/DLQ/replay and business-integrity event infrastructure retained.
- Admin Kafka operations UI retained at `src/pages/admin/AdminKafka.jsx` with its route/sidebar/API integration.

## Kubernetes

- Kubernetes base manifests retained under `k8s/base/`.
- Local and production overlays retained under `k8s/overlays/`.
- Redis, Kafka, realtime gateway, domain workers, KEDA, Prometheus/Grafana-related observability, and OpenTelemetry/Jaeger configuration retained where present in the final implementation.
- HPA/PDB/network-policy/configuration manifests retained.

## Repository hygiene

Frontend application source has one authoritative location:

- `src/App.jsx`
- `src/main.jsx`
- `src/index.css`
- `src/components/`
- `src/hooks/`
- `src/lib/`
- `src/pages/`

The accidental root-level copies of those frontend paths were removed. The versions retained under `src/` are the versions containing the later Kafka/observability additions where the duplicate copies had drifted behind.

Root-level infrastructure such as `server/`, `k8s/`, `supabase/`, `qa/`, `scripts/`, `docker/`, `database/`, `public/`, `assets/`, and `DOCUMENTS/` remains in place.

## Important distribution note

A ZIP archive cannot preserve Git commit history by itself. This clean archive preserves the cumulative code/configuration state. The Git repository remains the authoritative place for commit-by-commit history.
