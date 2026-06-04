import React, { useState } from 'react';
import { Search, MessageSquare, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { SUPPORT_TICKETS } from '@/lib/mockData';

const PRIORITY_STYLE = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-green-100 text-green-700',
};

export default function AdminSupport() {
  const [tickets, setTickets] = useState(
    SUPPORT_TICKETS.map(t => ({ ...t, messages: t.messages || [] }))
  );
  const [tab, setTab]         = useState('open');
  const [query, setQuery]     = useState('');
  const [expanded, setExpanded] = useState(null);
  const [reply, setReply]     = useState('');
  const [resolving, setResolving] = useState(null);

  const filtered = tickets.filter(t => {
    const matchQ = !query || t.subject.toLowerCase().includes(query.toLowerCase());
    if (tab === 'open')     return matchQ && t.status === 'open';
    if (tab === 'resolved') return matchQ && t.status === 'resolved';
    return matchQ;
  });

  const handleReply = (ticketId) => {
    if (!reply.trim()) return;
    setTickets(ts => ts.map(t =>
      t.id === ticketId
        ? { ...t, messages: [...t.messages, { from: 'admin', text: reply, time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }) }] }
        : t
    ));
    setReply('');
  };

  const handleResolve = (ticketId) => {
    setResolving(ticketId);
    setTimeout(() => {
      setTickets(ts => ts.map(t => t.id === ticketId ? { ...t, status: 'resolved' } : t));
      setResolving(null);
      setExpanded(null);
    }, 500);
  };

  const openCount     = tickets.filter(t => t.status === 'open').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Support Tickets" subtitle={`${openCount} open`} />
      <div className="p-4 space-y-4">

        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-amber-500">{openCount}</p>
            <p className="text-[10px] text-muted-foreground">Open</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold text-green-500">{resolvedCount}</p>
            <p className="text-[10px] text-muted-foreground">Resolved</p>
          </Card>
          <Card className="p-2 border-border">
            <p className="text-xl font-bold">2.4h</p>
            <p className="text-[10px] text-muted-foreground">Avg Response</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"      className="text-xs">All</TabsTrigger>
            <TabsTrigger value="open"     className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <MessageSquare className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tickets found</p>
            </Card>
          ) : (
            filtered.map(ticket => (
              <Card key={ticket.id} className="border-border overflow-hidden">
                <button
                  className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.orderId || 'General'} · {new Date(ticket.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Badge className={`text-[9px] border-0 ${PRIORITY_STYLE[ticket.priority]}`}>{ticket.priority}</Badge>
                      <Badge className={`text-[9px] border-0 ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ticket.status}
                      </Badge>
                      {expanded === ticket.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {expanded === ticket.id && (
                  <div className="border-t border-border px-4 pb-4 space-y-3">
                    {/* Message thread */}
                    {ticket.messages.length > 0 && (
                      <div className="space-y-2 pt-3">
                        {ticket.messages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-2 rounded-xl text-xs ${msg.from === 'admin' ? 'bg-primary text-white' : 'bg-muted'}`}>
                              <p className="font-medium mb-0.5 opacity-70">{msg.from === 'admin' ? 'Support' : 'Customer'}</p>
                              <p>{msg.text}</p>
                              <p className={`text-[9px] mt-0.5 ${msg.from === 'admin' ? 'text-white/60' : 'text-muted-foreground'}`}>{msg.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {ticket.status === 'open' && (
                      <>
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Type reply..."
                            className="flex-1 h-16 text-sm"
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                          />
                          <Button size="icon" className="h-16 w-10 shrink-0" onClick={() => handleReply(ticket.id)}>
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          className="w-full h-8 text-xs gap-1"
                          variant="outline"
                          disabled={resolving === ticket.id}
                          onClick={() => handleResolve(ticket.id)}
                        >
                          <CheckCircle className="w-3 h-3" />
                          {resolving === ticket.id ? 'Resolving...' : 'Mark as Resolved'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
