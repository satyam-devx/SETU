// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Developer Center
//
// Real ops observability (read-only): DB health, pg_cron jobs + last
// run, applied migrations, payment-queue health, and recent client
// errors. All live from the database via developer.view-gated RPCs.
// No mock data. Platform-only signals (storage/API/backups/deploys)
// are intentionally not shown — they require the Supabase Management
// API, not the SQL layer.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Database, Clock, GitCommit, AlertTriangle, Loader2, AlertCircle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { DeveloperAPI } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

export default function SuperAdminDeveloper() {
  const [tab, setTab]   = useState('cron');
  const [overview, setOverview] = useState(null);
  const [queue, setQueue]       = useState(null);
  const [cron, setCron]         = useState([]);
  const [db, setDb]             = useState(null);
  const [migrations, setMigrations] = useState(null);
  const [errors, setErrors]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, q, cr, d, mg, er] = await Promise.all([
      DeveloperAPI.overview(), DeveloperAPI.queueHealth(), DeveloperAPI.cronJobs(),
      DeveloperAPI.dbHealth(), DeveloperAPI.migrations(), DeveloperAPI.errors(50),
    ]);
    if (ov.error && cr.error && d.error) { setError('Could not load developer data. Tap retry.'); setLoading(false); return; }
    setOverview(ov.data ?? null);
    setQueue(q.data ?? null);
    setCron(Array.isArray(cr.data) ? cr.data : []);
    setDb(d.data ?? null);
    setMigrations(mg.data ?? null);
    setErrors(Array.isArray(er.data) ? er.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex-1 overflow-auto pb-24" role="main">
      <AppHeader
        title="Developer Center"
        subtitle="Live database, cron, migration & error observability"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} aria-label="Refresh developer data">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="DB Size"         value={loading ? '…' : (overview?.db_size ?? '—')}                   icon={Database} />
          <StatCard title="Migrations"      value={loading ? '…' : String(overview?.migrations_applied ?? '—')}  icon={GitCommit} />
          <StatCard title="Cron Jobs"       value={loading ? '…' : `${overview?.cron_jobs_active ?? 0}/${overview?.cron_jobs ?? 0}`} icon={Clock} />
          <StatCard title="Errors (24h)"    value={loading ? '…' : String(overview?.errors_24h ?? 0)}            icon={AlertTriangle} />
        </div>
        {queue && (queue.pending > 0 || queue.stuck_over_30m > 0) && (
          <Card className={`p-3 ${queue.stuck_over_30m > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-amber-300 bg-amber-50/60'}`}>
            <p className="text-xs">
              Payment queue: <strong>{queue.pending}</strong> pending
              {queue.stuck_over_30m > 0 && <> · <strong className="text-destructive">{queue.stuck_over_30m} stuck &gt; 30m</strong></>}
              {queue.mismatch_flags_24h > 0 && <> · {queue.mismatch_flags_24h} mismatch flags (24h)</>}
            </p>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="cron"    className="text-xs">Cron</TabsTrigger>
            <TabsTrigger value="db"      className="text-xs">Database</TabsTrigger>
            <TabsTrigger value="mig"     className="text-xs">Migrations</TabsTrigger>
            <TabsTrigger value="errors"  className="text-xs">Errors</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
          </div>
        ) : tab === 'cron' ? (
          cron.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No cron jobs.</p> : (
            <div className="space-y-2">
              {cron.map(j => (
                <Card key={j.jobid} className="p-3 border-border flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{j.jobname}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{j.schedule}</p>
                    {j.last_run && <p className="text-[10px] text-muted-foreground">last run {timeAgo(j.last_run)}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {j.last_status && (
                      j.last_status === 'succeeded'
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" aria-label="succeeded" />
                        : <XCircle className="w-4 h-4 text-destructive" aria-label={j.last_status} />
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border-0 ${j.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {j.active ? 'active' : 'paused'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : tab === 'db' ? (
          !db ? <p className="text-sm text-muted-foreground text-center py-8">No data.</p> : (
            <Card className="p-3 border-border">
              <p className="text-xs text-muted-foreground mb-2">Total: <span className="font-semibold text-foreground">{db.db_size}</span></p>
              <div className="space-y-1">
                {(db.tables ?? []).map(t => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate mr-2">{t.name}</span>
                    <span className="text-muted-foreground shrink-0">{Number(t.rows).toLocaleString()} rows · {t.size}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        ) : tab === 'mig' ? (
          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground mb-2">
              {migrations?.count ?? 0} applied · latest <span className="font-mono">{migrations?.latest ?? '—'}</span>
            </p>
            <div className="space-y-0.5">
              {(migrations?.recent ?? []).map(v => (
                <p key={v} className="text-[11px] font-mono text-muted-foreground">{v}</p>
              ))}
            </div>
          </Card>
        ) : (
          errors.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No errors logged. 🎉</p> : (
            <div className="space-y-1.5">
              {errors.map(e => (
                <Card key={e.id} className="p-2.5 border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${e.level === 'fatal' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{e.level}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
                  </div>
                  <p className="text-xs mt-1 break-words">{e.message}</p>
                  {e.url && <p className="text-[10px] text-muted-foreground truncate">{e.url}</p>}
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
