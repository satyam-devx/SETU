// Tiny dependency-free Prometheus metrics registry used by SETU runtime services.
const counters = new Map();
const gauges = new Map();
const histograms = new Map();
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const labelsKey = labels => Object.entries(labels || {}).sort().map(([k,v]) => `${k}="${String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')}"`).join(',');
const series = (labels) => labelsKey(labels);
export function incCounter(name, labels = {}, value = 1, help = '') {
  const key = `${name}|${series(labels)}`;
  const current = counters.get(key) || { name, labels, value: 0, help };
  current.value += value; counters.set(key, current);
}
export function setGauge(name, labels = {}, value = 0, help = '') {
  const key = `${name}|${series(labels)}`;
  gauges.set(key, { name, labels, value: Number(value) || 0, help });
}
// Real Prometheus histogram: cumulative bucket counts plus _sum/_count, so
// Grafana/PromQL can compute rates and percentiles (histogram_quantile).
// `value` is expected in seconds, matching Prometheus convention.
export function observeHistogram(name, labels = {}, value, help = '', buckets = DEFAULT_BUCKETS) {
  const key = `${name}|${series(labels)}`;
  let h = histograms.get(key);
  if (!h) {
    const sortedBuckets = [...buckets].sort((a, b) => a - b);
    h = { name, labels, help, buckets: sortedBuckets, counts: new Array(sortedBuckets.length).fill(0), sum: 0, count: 0 };
    histograms.set(key, h);
  }
  const v = Math.max(0, Number(value) || 0);
  h.sum += v; h.count += 1;
  for (let i = 0; i < h.buckets.length; i += 1) if (v <= h.buckets[i]) h.counts[i] += 1;
}
// Back-compat helper for "time since startedAt" call sites — startedAt is a
// Date.now() ms timestamp; this converts to seconds before recording.
export function observeDuration(name, labels, startedAt, help, buckets) {
  observeHistogram(name, labels, Math.max(0, Date.now() - startedAt) / 1000, help, buckets);
}
function render(map, type) {
  const out = [];
  const seen = new Set();
  for (const item of map.values()) {
    if (!seen.has(item.name)) { out.push(`# HELP ${item.name} ${item.help || item.name}`); out.push(`# TYPE ${item.name} ${type}`); seen.add(item.name); }
    out.push(`${item.name}${item.labels && Object.keys(item.labels).length ? `{${labelsKey(item.labels)}}` : ''} ${item.value}`);
  }
  return out;
}
function renderHistograms() {
  const out = [];
  const seen = new Set();
  for (const h of histograms.values()) {
    if (!seen.has(h.name)) { out.push(`# HELP ${h.name} ${h.help || h.name}`); out.push(`# TYPE ${h.name} histogram`); seen.add(h.name); }
    const baseLabels = h.labels && Object.keys(h.labels).length ? `${labelsKey(h.labels)},` : '';
    for (let i = 0; i < h.buckets.length; i += 1) out.push(`${h.name}_bucket{${baseLabels}le="${h.buckets[i]}"} ${h.counts[i]}`);
    out.push(`${h.name}_bucket{${baseLabels}le="+Inf"} ${h.count}`);
    out.push(`${h.name}_sum${h.labels && Object.keys(h.labels).length ? `{${labelsKey(h.labels)}}` : ''} ${h.sum}`);
    out.push(`${h.name}_count${h.labels && Object.keys(h.labels).length ? `{${labelsKey(h.labels)}}` : ''} ${h.count}`);
  }
  return out;
}
export function metricsText(extra = {}) {
  const out = ['# HELP setu_process_up SETU process is alive', '# TYPE setu_process_up gauge', 'setu_process_up 1'];
  out.push(...render(counters, 'counter'), ...render(gauges, 'gauge'), ...renderHistograms());
  for (const [name, value] of Object.entries(extra)) out.push(`# TYPE ${name} gauge`, `${name} ${Number(value) || 0}`);
  return `${out.join('\n')}\n`;
}
export function metricsHandler(extra = () => ({})) {
  return (_req, res) => { res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' }); res.end(metricsText(extra())); };
}
