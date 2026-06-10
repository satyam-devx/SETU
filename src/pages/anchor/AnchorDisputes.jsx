import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, Clock, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { useVillage } from '@/lib/village';
import { AnchorAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

function relativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Build a human-readable parties string from dispute_parties join
function partiesLabel(dispute) {
  const parties = dispute.dispute_parties ?? [];
  const names   = parties.map(p => {
    const name = p.profiles?.name ?? 'Unknown';
    const role = p.profiles?.role ?? p.role;
    return `${name} (${role})`;
  });
  if (names.length >= 2) return `${names[0]} vs ${names[1]}`;
  if (names.length === 1) return names[0];
  return dispute.reporter?.name ? `${dispute.reporter.name} (reporter)` : 'Unknown parties';
}

export default function AnchorDisputes() {
  const { villageId } = useVillage();

  const [disputes,   setDisputes]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);
  const [tab,        setTab]        = useState('all');
  const [expanded,   setExpanded]   = useState(null);
  const [reply,      setReply]      = useState('');
  const [actingOn,   setActingOn]   = useState(null);

  const [anchorUserId, setAnchorUserId] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAnchorUserId(user.id);
    });
  }, []);

  const loadDisputes = useCallback(async () => {
    if (!villageId) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AnchorAPI.getDisputes(villageId);
    if (error) setLoadError('Failed to load disputes. Tap retry.');
    else setDisputes(data ?? []);
    setLoading(false);
  }, [villageId]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  // ── Actions ────────────────────────────────────────────
  const handleResolve = async (id) => {
    if (!reply.trim()) return;
    setActingOn(id);
    const { error } = await AnchorAPI.resolveDispute(id, reply, anchorUserId);
    if (!error) {
      setDisputes(ds => ds.map(d =>
        d.id === id ? { ...d, status: 'resolved', resolution: reply } : d
      ));
      setReply('');
      setExpanded(null);
    }
    setActingOn(null);
  };

  const handleEscalate = async (id) => {
    setActingOn(id);
    const dispute = disputes.find(d => d.id === id);
    // Create escalation record, then mark dispute as escalated
    if (anchorUserId && villageId) {
      await AnchorAPI.createEscalation({
        disputeId:   id,
        escalatedBy: anchorUserId,
        villageId,
        title:       dispute?.title ?? 'Dispute escalation',
        description: dispute?.description ?? '',
        priority:    'medium',
      });
    }
    const { error } = await AnchorAPI.escalateDispute(id);
    if (!error) {
      setDisputes(ds => ds.map(d =>
        d.id === id ? { ...d, status: 'escalated' } : d
      ));
    }
    setActingOn(null);
  };

  // ── Derived ────────────────────────────────────────────
  const filtered = disputes.filter(d =>
    tab === 'all' || d.status === tab
  );

  const openCount     = disputes.filter(d => d.status === 'open').length;
  const resolvedCount = disputes.filter(d => d.status === 'resolved').length;

  return (
    <div className="pb-6">
      <AppHeader
        title="Disputes"
        subtitle={`${openCount} open`}
      />
      <div className="px-4 py-3 space-y-3">

        {/* Error banner */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadDisputes}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"      className="text-xs">All ({disputes.length})</TabsTrigger>
            <TabsTrigger value="open"     className="text-xs">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs">Resolved ({resolvedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No disputes in this category</p>
          </Card>
        ) : (
          filtered.map(d => {
            const isExpanded = expanded === d.id;
            const isActing   = actingOn === d.id;
            const isOpen     = d.status === 'open';
            const parties    = partiesLabel(d);

            const statusColor =
              d.status === 'resolved'  ? 'bg-green-100 text-green-700' :
              d.status === 'escalated' ? 'bg-blue-100  text-blue-700'  :
              'bg-amber-100 text-amber-700';

            return (
              <Card key={d.id} className="border-border overflow-hidden">
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{parties}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(d.created_at)}
                        {d.amount ? ` · ₹${Number(d.amount).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge className={`text-[9px] border-0 ${statusColor}`}>
                        {d.status}
                      </Badge>
                      {isExpanded
                        ? <ChevronUp   className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 space-y-3">
                    <p className="text-sm text-muted-foreground pt-3">{d.description}</p>

                    {/* Party statements */}
                    {(d.dispute_parties ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Statements</p>
                        {d.dispute_parties.map((p, i) => p.statement && (
                          <div key={i} className="p-2 bg-muted/40 rounded-lg">
                            <p className="text-xs font-medium">
                              {p.profiles?.name ?? 'Unknown'}{' '}
                              <span className="font-normal text-muted-foreground capitalize">
                                ({p.profiles?.role ?? p.role})
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">{p.statement}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Resolution */}
                    {d.status === 'resolved' && d.resolution && (
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Resolution
                        </p>
                        <p className="text-xs text-green-600">{d.resolution}</p>
                      </div>
                    )}

                    {/* Actions for open disputes */}
                    {isOpen && (
                      <>
                        <Textarea
                          placeholder="Add your resolution note..."
                          className="h-20 text-sm"
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            disabled={isActing || !reply.trim()}
                            onClick={() => handleResolve(d.id)}
                          >
                            {isActing
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><CheckCircle className="w-3 h-3 mr-1" /> Mark Resolved</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            disabled={isActing}
                            onClick={() => handleEscalate(d.id)}
                          >
                            {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Escalate to Admin'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
