// Tiny dependency-free Prometheus metrics registry used by SETU runtime services.
const counters = new Map();
const gauges = new Map();
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
export function observeDuration(name, labels, startedAt, help) {
  incCounter(name, labels, Math.max(0, Date.now() - startedAt), help);
}
function render(map) {
  const out = [];
  const seen = new Set();
  for (const item of map.values()) {
    if (!seen.has(item.name)) { out.push(`# HELP ${item.name} ${item.help || item.name}`); out.push(`# TYPE ${item.name} ${map === counters ? 'counter' : 'gauge'}`); seen.add(item.name); }
    out.push(`${item.name}${item.labels && Object.keys(item.labels).length ? `{${labelsKey(item.labels)}}` : ''} ${item.value}`);
  }
  return out;
}
export function metricsText(extra = {}) {
  const out = ['# HELP setu_process_up SETU process is alive', '# TYPE setu_process_up gauge', 'setu_process_up 1'];
  out.push(...render(counters), ...render(gauges));
  for (const [name, value] of Object.entries(extra)) out.push(`# TYPE ${name} gauge`, `${name} ${Number(value) || 0}`);
  return `${out.join('\n')}\n`;
}
export function metricsHandler(extra = () => ({})) {
  return (_req, res) => { res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' }); res.end(metricsText(extra())); };
}
