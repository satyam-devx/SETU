# F12 — Production Performance Engineering: Measurement Baseline

## Purpose

F12 is a **measurement phase**, not an optimization-by-guesswork phase. The goal is to establish repeatable, role-specific performance measurements before making further performance changes.

## Measurement dimensions

### Core Web Vitals / browser metrics
- FCP — First Contentful Paint
- LCP — Largest Contentful Paint
- INP — Interaction to Next Paint
- CLS — Cumulative Layout Shift
- TTFB — Time to First Byte
- navigation timing: DNS, connection, request/response, DOMContentLoaded, load

### Bundle / network
- total resource count
- total transferred bytes
- JavaScript bytes
- CSS bytes
- image bytes
- font bytes
- API request count
- duplicate resource requests
- API duplicate-in-flight detection
- slowest API calls

### Backend interaction
- API latency samples
- API p50
- API p95
- failed requests
- retry count
- slowest operations
- realtime latency samples where producer and receiver timestamps are available

### Rendering
- React Profiler render samples
- actual render duration
- base render duration
- expensive renders >= 16 ms
- slowest renders
- total measured render duration

### Memory
- JS heap used/total/limit where `performance.memory` is exposed (typically Chromium)
- resource/image/font transfer size
- future native/WebView heap measurements remain a separate platform-level measurement task

## Instrumentation added

### Browser performance
`src/lib/performance-monitor.js` uses browser Performance APIs only. It does not add a third-party analytics dependency.

It observes:
- `paint`
- `largest-contentful-paint`
- `layout-shift`
- `event`
- navigation timing
- resource timing

The monitor exposes a read-only measurement surface at `window.__SETU_PERF__.snapshot()` for controlled QA/profiling sessions.

### API timing
`src/lib/api.js` records API timing at the shared `safeQuery()` boundary. This gives a consistent measurement point for the canonical API layer without modifying individual pages.

Recorded fields include:
- role
- route
- operation
- duration
- success/failure
- retry count when supplied
- duplicate in-flight detection

### React rendering
`src/App.jsx` wraps the route tree with React Profiler and records render durations by route context.

## Role-specific measurement matrix

| Role | Required journeys |
|---|---|
| Customer | Home, search, category, product, cart, checkout, orders |
| Vendor | Dashboard, products, orders, analytics, earnings, KYC |
| Rider | Dispatch, GPS, delivery, realtime, background/resume |
| Admin | Dashboard, orders, vendors, riders, support, analytics |
| Superadmin | System-wide dashboards, monitoring, configuration, analytics |

For every journey, collect the same metric set. Do not compare a cold first load with a warm navigation run without labeling them separately.

## Required test modes

### Cold-load run
- clear browser cache/storage as appropriate
- fresh navigation
- no previous route chunk loaded
- record Core Web Vitals and resource timing

### Warm-navigation run
- app already booted
- navigate from an existing portal page
- record route-specific resource/network/render timings

### Slow-network run
- controlled throttling such as Slow 4G / 3G
- repeat the same journey
- record waterfall, API retries, loading states and LCP/INP/CLS

### Offline/recovery run
- disable network during a representative interaction
- record failed requests, retries, recovery latency and UI state

### Native/WebView run
- Android release/debug build under controlled conditions
- measure startup, route navigation, API timing, realtime behavior, memory and battery/GPS separately from browser metrics

## Important interpretation rules

1. A single run is not a baseline.
2. p50/p95 require a meaningful sample set; do not report them from one request.
3. Resource `transferSize` can be zero because of cache, opaque responses, or browser privacy behavior; report that limitation rather than treating zero as zero-byte content.
4. `performance.memory` is non-standard and is unavailable in many browsers.
5. INP is only meaningful after representative interactions have occurred.
6. Realtime latency requires a producer timestamp; client receipt time alone is not a true end-to-end latency measurement.
7. Web and Android WebView measurements must remain separate populations.
8. Do not change application behavior solely because a metric looks suspicious; first reproduce and attribute it to a concrete resource, route, request, render or platform condition.

## Current environment limitation

The current workspace does not contain `node_modules`. Therefore the F12 instrumentation has been source-validated only; a real browser/Vite run has **not** yet produced a trustworthy numerical baseline. Existing F2 dependency/runtime blockage remains active until dependencies can be installed and the app can be executed.

## F12 completion status

### Implemented
- browser performance instrumentation
- API timing instrumentation at the canonical API boundary
- React render instrumentation
- role/route context
- resource byte/request measurement
- duplicate resource and duplicate-in-flight measurement
- performance snapshot surface
- role-specific measurement matrix and controlled test protocol

### Not yet measured
- actual FCP/LCP/INP/CLS/TTFB numbers
- actual per-role bundle/network bytes
- actual API p50/p95
- actual slow endpoints from production traffic
- actual render counts/durations per page
- actual JS heap/WebView memory
- actual realtime end-to-end latency

Those require a successful browser/native runtime and controlled measurement runs; they must not be fabricated from static source inspection.
