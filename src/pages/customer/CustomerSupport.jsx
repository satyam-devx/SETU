import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { getSupportTickets, createSupportTicket } from '@/lib/api';

const FAQ_ITEMS = [
  {
    q: 'How do I cancel my order?',
    a: 'You can cancel your order from the order detail page before the vendor starts preparing it. Once the vendor is preparing, cancellation is not possible.',
  },
  {
    q: 'When will I get my refund?',
    a: 'For UPI payments, refunds are processed within 3-5 business days. For wallet payments, the amount is credited immediately.',
  },
  {
    q: 'My delivery is late — what should I do?',
    a: 'You can call your rider directly from the order tracking page. If the rider is unreachable, contact us via this support page.',
  },
  {
    q: 'How does SETU Credit work?',
    a: 'SETU Credit is a buy-now-pay-later facility. Use it at checkout and repay within 15 days. Your credit limit depends on your SETU score.',
  },
];

export default function CustomerSupport() {
  const { user } = useAuth();
  const [tickets,     setTickets]     = useState([]);
  const [loadingTkts, setLoadingTkts] = useState(true);
  const [ticketsErr,  setTicketsErr]  = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [expandedTkt, setExpandedTkt] = useState(null);
  const [subject,     setSubject]     = useState('');
  const [message,     setMessage]     = useState('');
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sendError,   setSendError]   = useState(null);

  // ── Load existing tickets ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getSupportTickets(user.id).then(({ data, error }) => {
      if (error) setTicketsErr(error.message);
      else       setTickets(data ?? []);
      setLoadingTkts(false);
    });
  }, [user]);

  // ── Submit new ticket ─────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || !user) return;
    setSending(true);
    setSendError(null);

    const { data: newTicket, error } = await createSupportTicket({
      user_id:  user.id,
      subject:  subject.trim(),
      message:  message.trim(),
      status:   'open',
      priority: 'medium',
    });

    setSending(false);

    if (error) {
      setSendError(error.message ?? 'Failed to submit ticket. Please try again.');
      return;
    }

    // Optimistically prepend if insert returned a row; otherwise build a temp row
    const row = newTicket ?? {
      id:         `temp-${Date.now()}`,
      subject:    subject.trim(),
      status:     'open',
      priority:   'medium',
      created_at: new Date().toISOString(),
    };
    setTickets(t => [row, ...t]);
    setSent(true);
    setSubject('');
    setMessage('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="pb-6">
      <AppHeader title="Help & Support" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* New ticket */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> New Support Request
          </h3>

          {sent && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg mb-3">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-700 font-medium">
                Ticket submitted! We'll respond in 2–4 hours.
              </p>
            </div>
          )}

          {sendError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg mb-3 text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{sendError}</p>
            </div>
          )}

          <div className="space-y-2">
            <Input
              placeholder="Subject (e.g. Wrong item delivered)"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="Describe your issue in detail..."
              className="h-24 text-sm"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <Button
              className="w-full gap-2"
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
            >
              {sending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4" /> Submit Ticket</>
              }
            </Button>
          </div>
        </Card>

        {/* Existing tickets */}
        {loadingTkts && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingTkts && ticketsErr && (
          <p className="text-xs text-muted-foreground text-center">Could not load past tickets.</p>
        )}

        {!loadingTkts && !ticketsErr && tickets.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">My Tickets</h3>
            <div className="space-y-2">
              {tickets.map(t => {
                const subject_   = t.subject;
                const status_    = t.status;
                const orderId_   = t.order_id ?? t.orderId ?? null;
                const createdAt_ = t.created_at ?? t.createdAt;
                const msgs       = t.messages ?? [];

                return (
                  <Card key={t.id} className="border-border overflow-hidden">
                    <button
                      className="w-full p-3 flex items-start justify-between text-left"
                      onClick={() => setExpandedTkt(expandedTkt === t.id ? null : t.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{subject_}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            className={`text-[9px] border-0 ${
                              status_ === 'resolved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {status_}
                          </Badge>
                          {orderId_ && (
                            <span className="text-[10px] text-muted-foreground">{orderId_}</span>
                          )}
                          {createdAt_ && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(createdAt_).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      {expandedTkt === t.id
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />}
                    </button>

                    {expandedTkt === t.id && (
                      <div className="px-3 pb-3 border-t border-border space-y-2 pt-2">
                        {msgs.length === 0 && (
                          <p className="text-xs text-muted-foreground">No messages yet.</p>
                        )}
                        {msgs.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] p-2 rounded-xl text-xs ${
                                msg.from === 'customer'
                                  ? 'bg-primary text-white'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              <p>{msg.text}</p>
                              {msg.time && (
                                <p
                                  className={`text-[9px] mt-0.5 ${
                                    msg.from === 'customer' ? 'text-white/70' : 'text-muted-foreground'
                                  }`}
                                >
                                  {msg.time}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Frequently Asked Questions</h3>
          <div className="space-y-1">
            {FAQ_ITEMS.map((item, i) => (
              <Card key={i} className="border-border overflow-hidden">
                <button
                  className="w-full p-3 flex items-center justify-between text-left"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <p className="text-sm font-medium flex-1 pr-2">{item.q}</p>
                  {expanded === i
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
                {expanded === i && (
                  <div className="px-3 pb-3 border-t border-border">
                    <p className="text-sm text-muted-foreground pt-2">{item.a}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
