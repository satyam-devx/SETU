import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, CheckCircle, Clock, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { useVillage } from '@/lib/village';
import { AnchorAPI } from '@/lib/api';

function relativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_STYLE = {
  critical: 'bg-red-100    text-red-800',
  high:     'bg-red-100    text-red-700',
  medium:   'bg-amber-100  text-amber-700',
  low:      'bg-green-100  text-green-700',
};

const STATUS_STYLE = {
  open:          'bg-red-100   text-red-700',
  acknowledged:  'bg-blue-100  text-blue-700',
  in_progress:   'bg-amber-100 text-amber-700',
  resolved:      'bg-green-100 text-green-700',
};

const StatusIcon = {
  open:         Clock,
  acknowledged: Clock,
  in_progress:  ArrowUpCircle,
  resolved:     CheckCircle,
};

export default function AnchorEscalations() {
  const { villageId } = useVillage();

  const [escalations, setEscalations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [tab,         setTab]         = useState('all');
  const [expanded,    setExpanded]    = useState(null);
  const [noteText,    setNoteText]    = useState('');
  const [actingOn,    setActingOn]    = useState(null);

  const loadEscalations = useCallback(async () => {
    if (!villageId) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AnchorAPI.getEscalations(villageId);
    if (error) setLoadError('Failed to load escalations. Tap retry.');
    else setEscalations(data ?? []);
    setLoading(false);
  }, [villageId]);

  useEffect(() => { loadEscalations(); }, [loadEscalations]);

  // ── Actions ────────────────────────────────────────────
  const handleResolve = async (id) => {
    setActingOn(id);
    const { error } = await AnchorAPI.resolveEscalation(id, noteText || 'Resolved by anchor');
    if (!error) {
      setEscalations(es => es.map(e =>
        e.id === id
          ? { ...e, status: 'resolved', notes: noteText || 'Resolved by anchor', resolved_at: new Date().toISOString() }
          : e
      ));
      setNoteText('');
      setExpanded(null);
    }
    setActingOn(null);
  };

  // ── Derived ────────────────────────────────────────────
  const filtered = escalations.filter(e =>
    tab === 'all' || e.status === tab
  );

  const counts = {
    open:     escalations.filter(e => e.status === 'open' || e.status === 'acknowledged' || e.status === 'in_progress').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
  };

  return (
    <div className="pb-6">
      <AppHeader title="Escalations" showBack />
      <div className="px-4 py-4 space-y-3">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-red-500">
              {loading ? '…' : escalations.filter(e => e.status === 'open').length}
            </p>
            <p className="text-[10px] text-muted-foreground">Open</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-blue-500">
              {loading ? '…' : escalations.filter(e => e.status === 'in_progress' || e.status === 'acknowledged').length}
            </p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">
              {loading ? '…' : counts.resolved}
            </p>
            <p className="text-[10px] text-muted-foreground">Resolved</p>
          </Card>
        </div>

        {/* Error banner */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadEscalations}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {['all', 'open', 'in_progress', 'resolved'].map(t => (
              <TabsTrigger key={t} value={t} className="text-xs capitalize">
                {t.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No escalations in this category</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(e => {
              const Icon     = StatusIcon[e.status] ?? Clock;
              const isOpen   = e.status !== 'resolved';
              const isActing = actingOn === e.id;

              return (
                <Card key={e.id} className="p-4 border-border">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {e.raiser?.name ?? 'Unknown'} · {relativeTime(e.created_at)}
                        </p>
                      </div>
                      <Badge className={`text-[9px] shrink-0 ml-2 border-0 ${PRIORITY_STYLE[e.priority] ?? ''}`}>
                        {e.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{e.description}</p>
                    <Badge className={`text-[9px] border-0 flex items-center gap-1 w-fit ${STATUS_STYLE[e.status] ?? ''}`}>
                      <Icon className="w-3 h-3" />
                      {e.status.replace('_', ' ')}
                    </Badge>
                  </button>

                  {/* Expanded resolve area */}
                  {expanded === e.id && isOpen && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {e.notes && (
                        <p className="text-xs text-muted-foreground italic">Notes: {e.notes}</p>
                      )}
                      <Textarea
                        placeholder="Add resolution note..."
                        className="h-16 text-sm"
                        value={noteText}
                        onChange={ev => setNoteText(ev.target.value)}
                      />
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        disabled={isActing}
                        onClick={() => handleResolve(e.id)}
                      >
                        {isActing
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><CheckCircle className="w-3 h-3 mr-1" /> Mark Resolved</>
                        }
                      </Button>
                    </div>
                  )}

                  {expanded === e.id && !isOpen && e.notes && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-700">{e.notes}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
