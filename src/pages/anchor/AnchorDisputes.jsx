import React, { useState } from 'react';
import { MessageSquare, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';

const disputes = [
  {
    id: 'D-004', orderId: 'SETU-2025-0002', status: 'open', priority: 'high',
    complainant: 'Raj Kumar', respondent: 'Lakshmi Makhana Traders',
    issue: 'Stale makhana delivered. Quality not as described.',
    amount: 650, raised: '2025-05-31T08:00:00',
    timeline: [
      { from: 'Raj Kumar', text: 'I received stale makhana. It smells bad and looks old.', time: '8:00 AM' },
      { from: 'Vendor', text: 'Quality was fine when packed. We checked stock today.', time: '8:30 AM' },
    ],
  },
  {
    id: 'D-003', orderId: 'SETU-2025-0001', status: 'mediation', priority: 'medium',
    complainant: 'Anita Devi', respondent: 'Suraj Kumar (Rider)',
    issue: 'Rider demanded extra ₹50 for delivery. Refused to give receipt.',
    amount: 50, raised: '2025-05-30T14:00:00',
    timeline: [
      { from: 'Anita Devi', text: 'Rider asked for ₹50 extra saying road was bad.', time: '2:00 PM' },
      { from: 'Rider', text: 'The road was flooded, took extra time and fuel.', time: '2:15 PM' },
      { from: 'Anchor', text: 'Reviewing both sides. Will decide by tomorrow.', time: '3:00 PM' },
    ],
  },
  {
    id: 'D-002', orderId: 'SETU-2025-0007', status: 'resolved', priority: 'low',
    complainant: 'Mohan Lal', respondent: 'Ramesh Kirana Store',
    issue: 'Wrong item sent. Ordered Basmati, got Sona Masoori.',
    amount: 450, raised: '2025-05-29T10:00:00', resolution: 'Vendor agreed to replace item. Replacement delivered on 30 May.',
    timeline: [
      { from: 'Mohan Lal', text: 'Wrong rice brand sent.', time: '10:00 AM' },
      { from: 'Vendor', text: 'Our apologies. Will replace immediately.', time: '10:20 AM' },
      { from: 'Anchor', text: 'Resolved. Replacement confirmed by customer.', time: '2:00 PM' },
    ],
  },
];

const statusConfig = {
  open: { label: 'Open', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  mediation: { label: 'In Mediation', color: 'bg-amber-100 text-amber-800', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

function DisputeCard({ dispute }) {
  const [expanded, setExpanded] = useState(dispute.status !== 'resolved');
  const [reply, setReply] = useState('');
  const cfg = statusConfig[dispute.status];
  const CfgIcon = cfg.icon;

  return (
    <Card className={`border ${dispute.status === 'open' ? 'border-destructive/30' : dispute.status === 'mediation' ? 'border-amber-300' : 'border-border'}`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-mono text-muted-foreground">{dispute.id} · {dispute.orderId}</p>
            <h4 className="font-semibold text-sm mt-0.5">{dispute.issue}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>
              <CfgIcon className="w-2.5 h-2.5 mr-1" />{cfg.label}
            </Badge>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>👤 {dispute.complainant}</span>
          <span>🏪 {dispute.respondent}</span>
          <span className="font-medium text-foreground">₹{dispute.amount}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <div className="bg-muted/40 rounded-xl p-3 space-y-2 mb-3">
            {dispute.timeline.map((msg, i) => (
              <div key={i} className={`text-xs ${msg.from === 'Anchor' ? 'text-primary font-medium' : ''}`}>
                <span className="font-semibold">{msg.from} ({msg.time}): </span>{msg.text}
              </div>
            ))}
          </div>
          {dispute.resolution && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
              <p className="text-xs font-medium text-green-800">Resolution: {dispute.resolution}</p>
            </div>
          )}
          {dispute.status !== 'resolved' && (
            <>
              <Textarea placeholder="Add your mediation note..." rows={2} value={reply} onChange={e => setReply(e.target.value)} className="mb-2 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs">Add Note</Button>
                <Button size="sm" className="flex-1 h-8 text-xs bg-accent hover:bg-accent/90">Mark Resolved</Button>
                <Button size="sm" variant="outline" className="h-8 w-8 shrink-0"><Phone className="w-3 h-3" /></Button>
              </div>
              {dispute.status === 'open' && (
                <Button size="sm" variant="outline" className="w-full mt-2 h-8 text-xs text-chart-3 border-chart-3/30">
                  Escalate to Admin
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AnchorDisputes() {
  return (
    <div className="pb-24">
      <AppHeader title="Dispute Mediation" subtitle={`${disputes.filter(d => d.status !== 'resolved').length} active`} showBack backTo="/anchor" />

      <div className="px-4 py-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium">🤝 As Village Anchor, your role is to mediate fairly. Your resolution decisions directly affect your trust score and monthly earnings.</p>
        </div>

        <div className="flex gap-2 mb-4 text-xs">
          {[
            { label: 'Open', count: disputes.filter(d => d.status === 'open').length, color: 'text-destructive' },
            { label: 'Mediation', count: disputes.filter(d => d.status === 'mediation').length, color: 'text-amber-600' },
            { label: 'Resolved', count: disputes.filter(d => d.status === 'resolved').length, color: 'text-accent' },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center bg-muted rounded-xl p-2">
              <p className={`font-bold text-base ${s.color}`}>{s.count}</p>
              <p className="text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {disputes.map(d => <DisputeCard key={d.id} dispute={d} />)}
        </div>
      </div>
    </div>
  );
}