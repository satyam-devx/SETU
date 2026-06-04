import React, { useState } from 'react';
import { MessageSquare, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';

const DISPUTES = [
  { id: 'd1', title: 'Wrong product delivered', parties: ['Meena Devi (customer)', 'Ramesh Kirana Store (vendor)'], status: 'open', date: '2 days ago', amount: 250, description: 'Customer says she ordered rice but received dal. Vendor claims she ordered dal.', messages: [{ from: 'Meena Devi', text: 'Maine chawal manga tha, dal diya', time: '2 days ago' }, { from: 'Ramesh Store', text: 'Order mein dal tha, dekh lo screenshot', time: '2 days ago' }] },
  { id: 'd2', title: 'Rider demanded extra money', parties: ['Rakesh Kumar (rider)', 'Sunita Devi (customer)'], status: 'open', date: '1 day ago', amount: 50, description: 'Customer claims rider asked for ₹50 extra for delivery.', messages: [{ from: 'Sunita Devi', text: 'Rider ne extra 50 rupee maanga', time: '1 day ago' }] },
  { id: 'd3', title: 'Vendor overcharged', parties: ['Ram Lal (customer)', 'Bihar Fish Market (vendor)'], status: 'resolved', date: '5 days ago', amount: 120, description: 'Vendor charged more than listed price for mustard oil.', messages: [], resolution: 'Vendor refunded ₹120. Warning issued.' },
];

export default function AnchorDisputes() {
  const [disputes, setDisputes] = useState(DISPUTES);
  const [tab, setTab]           = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [reply, setReply]       = useState('');
  const [resolving, setResolving] = useState(null);

  const filtered = disputes.filter(d => tab === 'all' || d.status === tab);

  const handleResolve = (id, resolution) => {
    setResolving(id);
    setTimeout(() => {
      setDisputes(ds => ds.map(d => d.id === id ? { ...d, status: 'resolved', resolution: resolution || 'Resolved by anchor' } : d));
      setResolving(null);
    }, 600);
  };

  return (
    <div className="pb-6">
      <AppHeader title="Disputes" subtitle={`${disputes.filter(d => d.status === 'open').length} open`} />
      <div className="px-4 py-3 space-y-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all"      className="text-xs">All ({disputes.length})</TabsTrigger>
            <TabsTrigger value="open"     className="text-xs">Open</TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.map(d => (
          <Card key={d.id} className="border-border overflow-hidden">
            <button
              className="w-full p-4 text-left"
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.parties.join(' vs ')}</p>
                  <p className="text-xs text-muted-foreground">{d.date} · ₹{d.amount}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge className={`text-[9px] border-0 ${d.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {d.status}
                  </Badge>
                  {expanded === d.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </button>

            {expanded === d.id && (
              <div className="border-t border-border px-4 pb-4 space-y-3">
                <p className="text-sm text-muted-foreground pt-3">{d.description}</p>

                {d.messages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Statements</p>
                    {d.messages.map((msg, i) => (
                      <div key={i} className="p-2 bg-muted/40 rounded-lg">
                        <p className="text-xs font-medium">{msg.from}</p>
                        <p className="text-xs text-muted-foreground">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {d.status === 'resolved' && d.resolution && (
                  <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Resolution
                    </p>
                    <p className="text-xs text-green-600">{d.resolution}</p>
                  </div>
                )}

                {d.status === 'open' && (
                  <>
                    <Textarea
                      placeholder="Add your resolution note..."
                      className="h-20 text-sm"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8 text-xs"
                        disabled={resolving === d.id}
                        onClick={() => handleResolve(d.id, reply)}>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {resolving === d.id ? 'Resolving...' : 'Mark Resolved'}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                        Escalate to Admin
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
