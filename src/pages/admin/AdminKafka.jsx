import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, ServerCrash } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';

const DOMAIN_LABELS = { payment: 'Payment', inventory: 'Inventory', dispatch: 'Dispatch', financial: 'Financial' };
const healthClass = {
  healthy: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
};

function Metric({ label, value }) {
  return <div className="rounded-xl border border-border p-3"><p className="text-lg font-semibold">{value ?? '—'}</p><p className="text-[10px] text-muted-foreground mt-0.5">{label}</p></div>;
}

export default function AdminKafka() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [replaying, setReplaying] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    const result = await AdminAPI.getKafkaMetrics(manual);
    setSnapshot(result?.data ?? null);
    setError(result?.error ?? null);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  const replay = async domain => {
    setReplaying(domain); setMessage('');
    const result = await AdminAPI.replayKafkaDlq(domain, 10);
    if (result?.error) setMessage(`${DOMAIN_LABELS[domain]} replay failed: ${result.error.message}`);
    else setMessage(`${DOMAIN_LABELS[domain]}: replayed ${result.data?.replayed ?? 0} event(s).`);
    setReplaying(null);
    await load(true);
  };

  return (
    <div className="flex-1 overflow-auto pb-8">
      <AppHeader title="Kafka Operations" subtitle="Consumer lag, domain health and DLQ controls" rightAction={
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load(true)} aria-label="Refresh Kafka metrics">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      } />
      <div className="p-4 space-y-4 max-w-4xl">
        {error && <Card className="p-3 border-destructive/20 bg-destructive/5"><p className="text-xs text-destructive">{error.message}</p></Card>}
        {message && <Card className="p-3 border-primary/20 bg-primary/5"><p className="text-xs">{message}</p></Card>}

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div><h2 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> Event Backbone</h2><p className="text-xs text-muted-foreground mt-1">PostgreSQL outbox → Kafka → domain consumers → Redis/WebSocket</p></div>
            <Badge variant="outline">{snapshot?.enabled ? 'Kafka enabled' : 'Kafka unavailable'}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Metric label="Domains" value={snapshot?.domains?.length ?? '—'} />
            <Metric label="Total consumer lag" value={snapshot?.domains?.reduce((n, d) => n + (d.lag || 0), 0).toLocaleString('en-IN') ?? '—'} />
            <Metric label="Brokers" value={snapshot?.brokers?.length ?? '—'} />
            <Metric label="Updated" value={snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : '—'} />
          </div>
        </Card>

        {loading && !snapshot ? <Card className="p-6 text-center text-sm text-muted-foreground">Loading Kafka telemetry…</Card> : null}
        {(snapshot?.domains ?? []).map(domain => {
          const processed = Number(domain.metrics?.processed || 0);
          const retries = Number(domain.metrics?.retry || 0);
          const dlq = Number(domain.metrics?.dlq || 0);
          return <Card key={domain.name} className="p-4 border-border">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">{DOMAIN_LABELS[domain.name] || domain.name}</h3><p className="text-[11px] text-muted-foreground break-all">{domain.topic} · {domain.group}</p></div>
              <span className={`text-[11px] px-2 py-1 rounded-full border ${healthClass[domain.health] || healthClass.warning}`}>
                {domain.health === 'healthy' ? <CheckCircle2 className="inline w-3 h-3 mr-1" /> : <AlertTriangle className="inline w-3 h-3 mr-1" />}{domain.health}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              <Metric label="Lag" value={domain.lag.toLocaleString('en-IN')} />
              <Metric label="Processed" value={processed.toLocaleString('en-IN')} />
              <Metric label="Retries" value={retries.toLocaleString('en-IN')} />
              <Metric label="DLQ" value={dlq.toLocaleString('en-IN')} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[10px] text-muted-foreground">Last event: {domain.last?.eventType || '—'} {domain.last?.at ? `· ${new Date(domain.last.at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}` : ''}</p>
              <Button size="sm" variant="outline" disabled={replaying === domain.name || dlq === 0} onClick={() => replay(domain.name)}>
                {replaying === domain.name ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                Replay up to 10
              </Button>
            </div>
            {domain.partitions?.length ? <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-2">{domain.partitions.map(p => <div key={p.partition} className="text-[10px] text-muted-foreground">P{p.partition}: <span className="font-medium text-foreground">{p.lag.toLocaleString('en-IN')} lag</span></div>)}</div> : null}
          </Card>;
        })}

        {!loading && !snapshot && <Card className="p-8 text-center"><ServerCrash className="w-8 h-8 mx-auto mb-2 text-muted-foreground" /><p className="font-medium">Kafka telemetry unavailable</p><p className="text-xs text-muted-foreground mt-1">Check the realtime gateway, Kafka broker and admin access.</p></Card>}
      </div>
    </div>
  );
}
