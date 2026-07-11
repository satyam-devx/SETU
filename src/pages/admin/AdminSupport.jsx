import React, { useState, useEffect, useCallback } from 'react';
import { Search, MessageSquare, CheckCircle, ChevronDown, ChevronUp, Send, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const PRIORITY_STYLE = {
  critical: 'bg-red-100   text-red-800',
  high:     'bg-red-100   text-red-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-green-100 text-green-700',
};

function relDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function AdminSupport() {
  const [tickets,   setTickets]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab,       setTab]       = useState('open');
  const [query,     setQuery]     = useState('');
  const [expanded,  setExpanded]  = useState(null);
  const [replies,   setReplies]   = useState({});   // ticketId → draft text
  const [acting,    setActing]    = useState(null);

  const [adminName, setAdminName] = useState('Admin');
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.name) setAdminName(data.name); });
    });
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AdminAPI.getSupportTickets();
    if (error) setLoadError('Failed to load tickets. Tap retry.');
    else setTickets(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Realtime: new tickets
  useEffect(() => {
    if (!isSupabaseConfigured) return; // demo mode has no real Supabase project — see CHANGELOG.md
    const channel = supabase
      .channel('admin-support-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, (payload) => {
        setTickets(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Actions ────────────────────────────────────────────
  const handleReply = async (ticketId) => {
    const text = (replies[ticketId] ?? '').trim();
    if (!text) return;
    setActing(ticketId);
    const { data, error } = await AdminAPI.replyToTicket(ticketId, adminName, text);
    if (!error && data) {
      setTickets(ts => ts.map(t => t.id === ticketId ? data : t));
      setReplies(r => ({ ...r, [ticketId]: '' }));
    }
    setActing(null);
  };

  const handleResolve = async (ticketId) => {
    setActing(ticketId);
    const { data, error } = await AdminAPI.resolveTicket(ticketId);
    if (!error && data) {
      setTickets(ts => ts.map(t => t.id === ticketId ? data : t));
      setExpanded(null);
    }
    setActing(null);
  };

  // ── Derived ────────────────────────────────────────────
  const openCount     = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  const filtered = tickets.filter(t => {
    const matchQ = !query || t.subject.toLowerCase().includes(query.toLowerCase());
    if (tab === 'open')     return matchQ && (t.status === 'open' || t.status === 'in_progress');
    if (tab === 'resolved') return matchQ && (t.status === 'resolved' || t.status === 'closed');
    return matchQ;
  });

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader
        title="Support Tickets"
        subtitle={`${openCount} open`}
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={loadTickets}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{loading ? '…' : openCount}</p>
            <p className="text-[10px] text-muted-foreground">Open</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">{loading ? '…' : resolvedCount}</p>
            <p className="text-[10px] text-muted-foreground">Resolved</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">{loading ? '…' : tickets.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </Card>
        </div>

        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadTickets}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"      className="text-xs">All</TabsTrigger>
            <TabsTrigger value="open"     className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-6 border-border text-center">
            <MessageSquare className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tickets found</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(ticket => {
              const isExpanded = expanded === ticket.id;
              const isActing   = acting   === ticket.id;
              const isOpen     = ticket.status === 'open' || ticket.status === 'in_progress';
              const messages   = Array.isArray(ticket.messages) ? ticket.messages : [];
              const reporter   = ticket.profiles;

              return (
                <Card key={ticket.id} className="border-border overflow-hidden">
                  <button
                    className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {reporter?.name ?? 'Customer'} · {relDate(ticket.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Badge className={`text-[9px] border-0 ${PRIORITY_STYLE[ticket.priority] ?? PRIORITY_STYLE.medium}`}>
                          {ticket.priority}
                        </Badge>
                        <Badge className={`text-[9px] border-0 ${isOpen ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {ticket.status}
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
                      {/* Message thread */}
                      {messages.length > 0 && (
                        <div className="space-y-2 pt-3">
                          {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] p-2 rounded-xl text-xs
                                ${msg.from === 'admin' ? 'bg-primary text-white' : 'bg-muted'}`}>
                                <p className="font-medium mb-0.5 opacity-70">
                                  {msg.from === 'admin' ? (msg.name ?? 'Support') : (reporter?.name ?? 'Customer')}
                                </p>
                                <p>{msg.text}</p>
                                <p className={`text-[9px] mt-0.5 ${msg.from === 'admin' ? 'text-white/60' : 'text-muted-foreground'}`}>
                                  {msg.time}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {isOpen && (
                        <>
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Type reply..."
                              className="flex-1 h-16 text-sm"
                              value={replies[ticket.id] ?? ''}
                              onChange={e => setReplies(r => ({ ...r, [ticket.id]: e.target.value }))}
                            />
                            <Button
                              size="icon"
                              className="h-16 w-10 shrink-0"
                              disabled={isActing || !(replies[ticket.id] ?? '').trim()}
                              onClick={() => handleReply(ticket.id)}
                            >
                              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                          </div>
                          <Button
                            className="w-full h-8 text-xs gap-1"
                            variant="outline"
                            disabled={isActing}
                            onClick={() => handleResolve(ticket.id)}
                          >
                            {isActing
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><CheckCircle className="w-3 h-3" /> Mark as Resolved</>
                            }
                          </Button>
                        </>
                      )}
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
