# SETU — F1-G Offline / Network Resilience / WebView Lifecycle

## Implemented

- Central network state (`src/lib/network-state.js`) shared by offline UI and recovery logic.
- Query fetches pause while offline instead of burning retry attempts against a dead connection.
- Invalidated active queries are refetched after connectivity returns.
- Durable, explicitly opt-in mutation queue (`src/lib/offline-mutation-queue.js`) for safe idempotent/retryable mutations.
- Financial mutations are intentionally excluded from the generic offline queue; payment capture, refunds and wallet debits remain server-authoritative.
- App foreground/background lifecycle hook (`src/hooks/useAppLifecycle.js`) for Capacitor + browser visibility.
- Order realtime subscriptions are torn down while the WebView is backgrounded and recreated/refetched on resume.
- Rider online/offline toggle keeps optimistic UX but rolls back when the server mutation fails.
- Offline banner now consumes the centralized network state.

## Deliberately not implemented

- No fake successful payment while offline.
- No optimistic wallet balance changes.
- No optimistic order-success state that bypasses `create_order`.
- No blind replay of arbitrary API mutations.
- No local inventory decrement.

Those domains require server idempotency/reconciliation and must remain authoritative.
