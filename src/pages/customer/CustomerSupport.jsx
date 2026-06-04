import React, { useState } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { SUPPORT_TICKETS } from '@/lib/mockData';

const FAQ_ITEMS = [
  { q: 'How do I cancel my order?', a: 'You can cancel your order from the order detail page before the vendor starts preparing it. Once the vendor is preparing, cancellation is not possible.' },
  { q: 'When will I get my refund?', a: 'For UPI payments, refunds are processed within 3-5 business days. For wallet payments, the amount is credited immediately.' },
  { q: 'My delivery is late — what should I do?', a: 'You can call your rider directly from the order tracking page. If the rider is unreachable, contact us via this support page.' },
  { q: 'How does SETU Credit work?', a: 'SETU Credit is a buy-now-pay-later facility. Use it at checkout and repay within 15 days. Your credit limit depends on your SETU score.' },
];

export default function CustomerSupport() {
  const [tickets, setTickets]     = useState(SUPPORT_TICKETS);
  const [expanded, setExpanded]   = useState(null);
  const [expandedTkt, setExpandedTkt] = useState(null);
  const [subject, setSubject]     = useState('');
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setTimeout(() => {
      const newTicket = {
        id: `st${Date.now()}`,
        subject,
        orderId: null,
        status: 'open',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        messages: [{ from: 'customer', text: message, time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' }) }],
      };
      setTickets(t => [newTicket, ...t]);
      setSending(false);
      setSent(true);
      setSubject('');
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    }, 800);
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
              <p className="text-xs text-green-700 font-medium">Ticket submitted! We'll respond in 2-4 hours.</p>
            </div>
          )}
          <div className="space-y-2">
            <Input placeholder="Subject (e.g. Wrong item delivered)" value={subject} onChange={e => setSubject(e.target.value)} />
            <Textarea placeholder="Describe your issue in detail..." className="h-24 text-sm" value={message} onChange={e => setMessage(e.target.value)} />
            <Button className="w-full gap-2" onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Submit Ticket'}
            </Button>
          </div>
        </Card>

        {/* My tickets */}
        {tickets.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm mb-2">My Tickets</h3>
            <div className="space-y-2">
              {tickets.map(t => (
                <Card key={t.id} className="border-border overflow-hidden">
                  <button
                    className="w-full p-3 flex items-start justify-between text-left"
                    onClick={() => setExpandedTkt(expandedTkt === t.id ? null : t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-[9px] border-0 ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {t.status}
                        </Badge>
                        {t.orderId && <span className="text-[10px] text-muted-foreground">{t.orderId}</span>}
                      </div>
                    </div>
                    {expandedTkt === t.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {expandedTkt === t.id && (
                    <div className="px-3 pb-3 border-t border-border space-y-2">
                      {t.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-2 rounded-xl text-xs ${msg.from === 'customer' ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}>
                            <p>{msg.text}</p>
                            <p className={`text-[9px] mt-0.5 ${msg.from === 'customer' ? 'text-white/70' : 'text-muted-foreground'}`}>{msg.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
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
                  {expanded === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
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
