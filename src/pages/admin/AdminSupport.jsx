import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, Phone, Send, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatCard from '@/components/shared/StatCard';

const tickets = [
  { id: 'T-001', subject: 'Wrong item delivered — Basmati vs Sona Masoori', customer: 'Anita Devi', order: 'SETU-2025-0001', priority: 'high', status: 'resolved', category: 'product_quality', assigned: 'Admin Priya', raised: '2025-05-30T12:00:00', messages: [
    { from: 'Customer', text: 'I ordered Basmati rice but received Sona Masoori. Not acceptable.', time: '12:00' },
    { from: 'Admin', text: 'We have verified the issue with the vendor. Replacement arranged for tomorrow.', time: '12:15' },
    { from: 'Customer', text: 'Thank you! Replacement received. Quality was good.', time: '2025-05-31 10:30' },
  ]},
  { id: 'T-002', subject: 'Rider demanded ₹50 extra — no receipt given', customer: 'Mohan Lal', order: 'SETU-2025-0004', priority: 'high', status: 'investigating', category: 'rider_misconduct', assigned: 'Admin Rahul', raised: '2025-05-31T08:00:00', messages: [
    { from: 'Customer', text: 'Suraj Kumar asked for ₹50 extra saying road was bad. Gave no receipt.', time: '08:00' },
    { from: 'Admin', text: 'We are investigating. Rider\'s COD account is under review. Do not pay any extra amounts.', time: '08:30' },
  ]},
  { id: 'T-003', subject: 'Milk delivery 30 minutes late — milk was warm', customer: 'Rekha Kumari', order: 'SETU-2025-0006', priority: 'medium', status: 'open', category: 'delivery_delay', assigned: null, raised: '2025-05-30T08:00:00', messages: [
    { from: 'Customer', text: 'Milk was supposed to come by 7am. It came at 7:30am and was slightly warm.', time: '08:00' },
  ]},
  { id: 'T-004', subject: 'Cannot access SETU Wallet — OTP not received', customer: 'Raj Kumar', order: null, priority: 'medium', status: 'open', category: 'technical', assigned: null, raised: '2025-05-31T09:00:00', messages: [
    { from: 'Customer', text: 'I am trying to add money to my wallet but not receiving the OTP.', time: '09:00' },
  ]},
  { id: 'T-005', subject: 'Fraud report — stale makhana sold as premium', customer: 'Priya Singh', order: 'SETU-2025-0002', priority: 'urgent', status: 'escalated', category: 'fraud', assigned: 'Admin Priya', raised: '2025-05-31T07:30:00', messages: [
    { from: 'Customer', text: 'Lakshmi Makhana sold me stale product claiming it was premium fresh. I have photos.', time: '07:30' },
    { from: 'Admin', text: 'URGENT: Vendor account temporarily suspended pending investigation. Photos requested.', time: '07:45' },
  ]},
];

const priorityConfig = { urgent: 'bg-red-200 text-red-900', high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-gray-100 text-gray-700' };
const statusConfig = { open: 'bg-blue-100 text-blue-800', resolved: 'bg-green-100 text-green-800', investigating: 'bg-amber-100 text-amber-800', escalated: 'bg-red-100 text-red-800' };

function TicketCard({ ticket }) {
  const [expanded, setExpanded] = useState(ticket.status !== 'resolved');
  const [reply, setReply] = useState('');

  return (
    <Card className={`border ${ticket.status === 'escalated' ? 'border-destructive/40 bg-destructive/5' : ticket.priority === 'urgent' ? 'border-red-300' : 'border-border'}`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-muted-foreground">{ticket.id}</p>
            <h4 className="font-semibold text-sm mt-0.5 truncate">{ticket.subject}</h4>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className={`text-[9px] ${priorityConfig[ticket.priority]}`}>{ticket.priority}</Badge>
            <Badge variant="outline" className={`text-[9px] ${statusConfig[ticket.status]}`}>{ticket.status}</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>👤 {ticket.customer}{ticket.order ? ` · ${ticket.order}` : ''}</span>
          <div className="flex items-center gap-2">
            {ticket.assigned && <span className="text-accent">→ {ticket.assigned}</span>}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div className="bg-muted/40 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
            {ticket.messages.map((msg, i) => (
              <div key={i} className={`text-xs p-2 rounded-lg ${msg.from === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-card'}`}>
                <span className="font-semibold">{msg.from} ({msg.time}):</span> {msg.text}
              </div>
            ))}
          </div>

          {ticket.status !== 'resolved' && (
            <>
              <div className="flex gap-2">
                <Textarea placeholder="Type your response..." rows={2} value={reply} onChange={e => setReply(e.target.value)} className="text-xs" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {!ticket.assigned && <Button size="sm" className="text-xs h-7">Assign to Me</Button>}
                <Button size="sm" variant="outline" className="text-xs h-7"><Send className="w-3 h-3 mr-1" /> Send Reply</Button>
                <Button size="sm" className="text-xs h-7 bg-accent hover:bg-accent/90">Mark Resolved</Button>
                {ticket.status !== 'escalated' && <Button size="sm" variant="outline" className="text-xs h-7 text-destructive border-destructive/30">Escalate</Button>}
                <Button size="sm" variant="outline" className="text-xs h-7"><Phone className="w-3 h-3 mr-1" /> Call</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminSupport() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter || t.priority === filter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Customer Support</h1>
          <p className="text-sm text-muted-foreground">Ticket management and resolution center</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Open Tickets" value={tickets.filter(t => t.status === 'open').length.toString()} icon={MessageSquare} />
        <StatCard title="Escalated" value={tickets.filter(t => t.status === 'escalated').length.toString()} icon={AlertTriangle} className="border-destructive/30" />
        <StatCard title="Resolved Today" value="12" icon={CheckCircle} />
        <StatCard title="Avg Resolution" value="3.2h" icon={Clock} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All Tickets' },
          { key: 'open', label: 'Open' },
          { key: 'escalated', label: 'Escalated' },
          { key: 'investigating', label: 'Investigating' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'urgent', label: '🚨 Urgent' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f.key ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}
      </div>
    </div>
  );
}
