import crypto from 'node:crypto';
const ENABLED = process.env.OTEL_ENABLED === 'true';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'setu-realtime';
const ENDPOINT = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://127.0.0.1:4318/v1/traces';
const SAMPLE_RATE = Math.min(1, Math.max(0, Number(process.env.OTEL_TRACE_SAMPLE_RATE ?? 1)));
const id = n => crypto.randomBytes(n).toString('hex');
export function extractTraceparent(value) { const m=/^00-([0-9a-f]{32})-([0-9a-f]{16})-([01])$/.exec(String(value||'').toLowerCase()); return m ? {traceId:m[1],parentSpanId:m[2],sampled:m[3]==='1'} : null; }
export function newTraceContext(parent=null) { return {traceId:parent?.traceId||id(16),spanId:id(8),parentSpanId:parent?.parentSpanId||null,sampled:parent?.sampled ?? (Math.random()<SAMPLE_RATE)}; }
export function traceparent(ctx) { return `00-${ctx.traceId}-${ctx.spanId}-${ctx.sampled?'01':'00'}`; }
function attrs(a={}) { return Object.entries(a).filter(([,v])=>v!==undefined&&v!==null).map(([key,value])=>({key,value:typeof value==='boolean'?{boolValue:value}:typeof value==='number'?{doubleValue:value}:{stringValue:String(value)}})); }
export function startSpan(name,{parent,attributes={},kind=1}={}) { const ctx=newTraceContext(parent), start=Date.now(); return {ctx,end(status='OK',extra={}){ if(!ENABLED||!ctx.sampled)return; const body={resourceSpans:[{resource:{attributes:attrs({'service.name':SERVICE_NAME,'service.version':process.env.SETU_VERSION||'unknown'})},scopeSpans:[{scope:{name:'setu-tracing',version:'1.0.0'},spans:[{traceId:ctx.traceId,spanId:ctx.spanId,parentSpanId:ctx.parentSpanId||undefined,name,kind,startTimeUnixNano:String(start*1e6),endTimeUnixNano:String(Date.now()*1e6),attributes:attrs({...attributes,...extra}),status:{code:status==='ERROR'?2:1}}]}]}]}; void fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});}}; }
export function contextFromKafkaHeaders(headers={}) { const raw=headers.traceparent; const v=Buffer.isBuffer(raw)?raw.toString():raw?.toString?.(); return extractTraceparent(v); }
