// SETU — Production Performance Measurement
// Measurement only. This module records browser, network, API, realtime,
// render and memory telemetry without changing application behavior.

const MAX_SAMPLES = 1000;
const apiSamples = [];
const renderSamples = [];
const realtimeSamples = [];
const interactionSamples = new Map();
const apiInflight = new Map();
let apiRetryCount = 0;
let initialized = false;
let currentRole = null;
let currentRoute = '/';
let clsValue = 0;
let clsWindowValue = 0;
let clsWindowStart = 0;
let lcpValue = null;
let fcpValue = null;
let inpValue = null;
let observers = [];

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function pushSample(list, sample) {
  list.push(sample);
  if (list.length > MAX_SAMPLES) list.shift();
}

function roleFromPath(pathname = '') {
  const match = String(pathname).match(/^\/(customer|vendor|rider|admin|superadmin)(?:\/|$)/);
  return match ? match[1] : 'public';
}

function activeRole() {
  return currentRole || roleFromPath(typeof window !== 'undefined' ? window.location.pathname : currentRoute);
}

function safeUrl(url) {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || 'unknown').split('?')[0];
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export function setPerformanceContext({ role, route } = {}) {
  if (role) currentRole = role;
  if (route) {
    currentRoute = route;
    if (!role) currentRole = roleFromPath(route);
  }
}

export function recordApiStart({ operation, method = 'GET', url } = {}) {
  const startedAt = now();
  const fingerprint = `${method}:${safeUrl(url || operation)}`;
  const inflight = apiInflight.get(fingerprint) || 0;
  apiInflight.set(fingerprint, inflight + 1);
  return { startedAt, fingerprint, duplicateInFlight: inflight > 0 };
}

export function recordApiEnd({ operation, method = 'GET', url, startedAt, error, fingerprint, duplicateInFlight, retryCount = 0 } = {}) {
  const duration = Math.max(0, now() - Number(startedAt || now()));
  if (fingerprint) {
    const count = apiInflight.get(fingerprint) || 1;
    if (count <= 1) apiInflight.delete(fingerprint);
    else apiInflight.set(fingerprint, count - 1);
  }
  const sample = {
    ts: Date.now(),
    role: activeRole(),
    route: currentRoute,
    operation: operation || 'unknown',
    method,
    url: safeUrl(url || operation),
    durationMs: Math.round(duration * 100) / 100,
    ok: !error,
    retryCount,
    duplicateInFlight: Boolean(duplicateInFlight),
  };
  pushSample(apiSamples, sample);
  return sample;
}

export function recordApiRetry({ operation, failureCount, error } = {}) {
  if (Number(failureCount || 0) <= 0) return;
  apiRetryCount += 1;
  // Keep retries as a separate telemetry event so they never pollute API latency percentiles.
  pushSample(apiSamples, {
    ts: Date.now(),
    role: activeRole(),
    route: currentRoute,
    operation: operation || 'query-retry',
    method: 'RETRY',
    url: operation || 'query-retry',
    durationMs: null,
    ok: false,
    retryCount: Number(failureCount),
    duplicateInFlight: false,
    retryError: error?.message || String(error || ''),
  });
}

export function recordRealtimeLatency({ channel, event, receivedAt, emittedAt, metadata } = {}) {
  if (!receivedAt || !emittedAt) return null;
  const latencyMs = Math.max(0, Number(receivedAt) - Number(emittedAt));
  const sample = {
    ts: Date.now(),
    role: activeRole(),
    route: currentRoute,
    channel: channel || 'unknown',
    event: event || 'unknown',
    latencyMs,
    metadata: metadata || undefined,
  };
  pushSample(realtimeSamples, sample);
  return sample;
}

export function recordRender({ id, phase, actualDuration, baseDuration, startTime, commitTime } = {}) {
  const sample = {
    ts: Date.now(),
    role: activeRole(),
    route: currentRoute,
    id: id || 'unknown',
    phase: phase || 'unknown',
    actualDuration: Number(actualDuration || 0),
    baseDuration: Number(baseDuration || 0),
    startTime: Number(startTime || 0),
    commitTime: Number(commitTime || 0),
  };
  pushSample(renderSamples, sample);
  return sample;
}

function observe(type, callback, options) {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) callback(entry);
    });
    observer.observe({ type, buffered: true, ...options });
    observers.push(observer);
  } catch {
    // Unsupported PerformanceObserver entry type.
  }
}

function installBrowserObservers() {
  observe('paint', entry => {
    if (entry.name === 'first-contentful-paint') fcpValue = entry.startTime;
  });

  observe('largest-contentful-paint', entry => {
    lcpValue = entry.startTime;
  });

  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return;
    const start = entry.startTime;
    // CLS uses a session window of <=1s between shifts and <=5s total window.
    if (!clsWindowStart || start - clsWindowStart > 1000 || start - clsWindowStart > 5000) {
      clsWindowStart = start;
      clsWindowValue = 0;
    }
    clsWindowValue += Number(entry.value || 0);
    clsValue = Math.max(clsValue, clsWindowValue);
  });

  observe('event', entry => {
    if (!entry.interactionId || !Number.isFinite(entry.duration)) return;
    const interactionId = entry.interactionId;
    const previous = interactionSamples.get(interactionId) || 0;
    interactionSamples.set(interactionId, Math.max(previous, entry.duration));
    const durations = [...interactionSamples.values()];
    // INP is the p98 interaction latency for a page with >50 interactions,
    // otherwise the maximum interaction latency.
    inpValue = durations.length > 50 ? percentile(durations, 0.98) : Math.max(...durations);
  }, { durationThreshold: 16 });
}

function navigationMetrics() {
  if (typeof performance === 'undefined') return null;
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) return null;
  return {
    dnsMs: Math.max(0, nav.domainLookupEnd - nav.domainLookupStart),
    connectMs: Math.max(0, nav.connectEnd - nav.connectStart),
    requestMs: Math.max(0, nav.responseStart - nav.requestStart),
    responseMs: Math.max(0, nav.responseEnd - nav.responseStart),
    // Navigation Timing defines TTFB as responseStart - startTime.
    ttfbMs: Math.max(0, nav.responseStart - nav.startTime),
    domContentLoadedMs: nav.domContentLoadedEventEnd,
    loadEventMs: nav.loadEventEnd,
    transferBytes: nav.transferSize || nav.encodedBodySize || 0,
  };
}

function resourceMetrics() {
  if (typeof performance === 'undefined') return null;
  const resources = performance.getEntriesByType('resource');
  const metrics = {
    total: 0,
    totalBytes: 0,
    jsBytes: 0,
    cssBytes: 0,
    imageBytes: 0,
    fontBytes: 0,
    apiRequests: 0,
    apiBytes: 0,
    duplicateResourceRequests: 0,
    byType: {},
    waterfall: [],
  };
  const seen = new Map();
  for (const entry of resources) {
    const bytes = Number(entry.transferSize || entry.encodedBodySize || 0);
    const name = safeUrl(entry.name);
    const initiator = entry.initiatorType || 'other';
    metrics.total += 1;
    metrics.totalBytes += bytes;
    metrics.byType[initiator] = (metrics.byType[initiator] || 0) + 1;
    if (initiator === 'script') metrics.jsBytes += bytes;
    else if (initiator === 'link' || initiator === 'css') metrics.cssBytes += bytes;
    else if (initiator === 'img' || initiator === 'image') metrics.imageBytes += bytes;
    if (/\.(woff2?|ttf|otf)(?:$|\?)/i.test(entry.name)) metrics.fontBytes += bytes;
    if (/supabase|\/rest\/v1\/|\/rpc\/|\/functions\/v1\//i.test(entry.name)) {
      metrics.apiRequests += 1;
      metrics.apiBytes += bytes;
    }
    const count = (seen.get(`${initiator}:${name}`) || 0) + 1;
    seen.set(`${initiator}:${name}`, count);
    metrics.waterfall.push({
      name,
      initiator,
      startMs: Number(entry.startTime.toFixed(2)),
      durationMs: Number(entry.duration.toFixed(2)),
      transferBytes: bytes,
    });
  }
  for (const count of seen.values()) if (count > 1) metrics.duplicateResourceRequests += count - 1;
  metrics.waterfall.sort((a, b) => a.startMs - b.startMs);
  return metrics;
}

function roleBreakdown(samples, selector) {
  const roles = ['customer', 'vendor', 'rider', 'admin', 'superadmin', 'public'];
  return Object.fromEntries(roles.map(role => {
    const subset = samples.filter(sample => sample.role === role).filter(selector);
    return [role, subset];
  }));
}

function apiSnapshot(samples) {
  const actual = samples.filter(sample => sample.method !== 'RETRY' && Number.isFinite(sample.durationMs));
  const durations = actual.map(s => s.durationMs);
  return {
    samples: actual.length,
    p50Ms: percentile(durations, 0.50),
    p95Ms: percentile(durations, 0.95),
    failed: actual.filter(s => !s.ok).length,
    retries: samples.filter(s => s.method === 'RETRY').length,
    duplicateInFlight: actual.filter(s => s.duplicateInFlight).length,
    slowest: [...actual].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10),
  };
}

export function snapshotPerformance() {
  const apiByRole = Object.fromEntries(Object.entries(roleBreakdown(apiSamples, s => s.method !== 'RETRY')).map(([role, samples]) => [role, apiSnapshot(samples)]));
  const renderByRole = Object.fromEntries(Object.entries(roleBreakdown(renderSamples, () => true)).map(([role, samples]) => [role, {
    samples: samples.length,
    totalActualDurationMs: samples.reduce((sum, s) => sum + s.actualDuration, 0),
    expensiveRenders: samples.filter(s => s.actualDuration >= 16).length,
    slowest: [...samples].sort((a, b) => b.actualDuration - a.actualDuration).slice(0, 10),
  }]));
  const realtimeDurations = realtimeSamples.map(s => s.latencyMs);
  return {
    context: { role: activeRole(), route: currentRoute },
    coreWebVitals: {
      fcpMs: fcpValue,
      lcpMs: lcpValue,
      inpMs: inpValue,
      cls: clsValue,
      ...navigationMetrics(),
    },
    network: resourceMetrics(),
    api: {
      ...apiSnapshot(apiSamples),
      byRole: apiByRole,
    },
    rendering: {
      samples: renderSamples.length,
      totalActualDurationMs: renderSamples.reduce((sum, s) => sum + s.actualDuration, 0),
      expensiveRenders: renderSamples.filter(s => s.actualDuration >= 16).length,
      slowest: [...renderSamples].sort((a, b) => b.actualDuration - a.actualDuration).slice(0, 10),
      byRole: renderByRole,
    },
    realtime: {
      samples: realtimeSamples.length,
      p50Ms: percentile(realtimeDurations, 0.50),
      p95Ms: percentile(realtimeDurations, 0.95),
      slowest: [...realtimeSamples].sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 10),
    },
    memory: typeof performance !== 'undefined' && performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      source: 'performance.memory',
    } : null,
    measurementLimitations: {
      eventListenerCount: 'browser does not expose a standard global listener count',
      webViewMemory: 'requires native Android profiling / platform memory APIs',
      imageMemory: 'browser does not expose per-image decoded-memory usage as a standard metric',
    },
  };
}

export function markRoute(route) {
  const startedAt = now();
  currentRoute = route || '/';
  currentRole = roleFromPath(currentRoute);
  if (typeof performance !== 'undefined' && performance.mark) {
    const name = `setu-route:${currentRoute}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
    try { performance.mark(`${name}:start`); } catch {}
  }
  return startedAt;
}

export function initPerformanceMonitoring() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  currentRoute = window.location.pathname;
  currentRole = roleFromPath(currentRoute);
  installBrowserObservers();
  window.__SETU_PERF__ = {
    snapshot: snapshotPerformance,
    setContext: setPerformanceContext,
    apiSamples,
    renderSamples,
    realtimeSamples,
  };
}

export function destroyPerformanceMonitoring() {
  observers.forEach(observer => observer.disconnect());
  observers = [];
  initialized = false;
}
