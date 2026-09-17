import React, { useState } from 'react';
import { HelpCircle, MessageSquare, Phone, Mail, ChevronRight, Plus, Clock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';

const faqs = [
  { q: 'How do I add a new product?', a: 'Go to Products tab and tap the + button to add new items with photos and pricing.' },
  { q: 'When do I get my payouts?', a: 'Payouts are processed every Monday and Thursday to your verified bank account.' },
  { q: 'How is commission calculated?', a: 'Commission is automatically deducted from each order based on your subscription plan.' },
  { q: 'How do I pause my store temporarily?', a: 'Go to Settings and toggle "Store Open" to pause without losing your listing.' },
];

const tickets = [
  { id: 'T-001', subject: 'Payout not received', status: 'open', date: '2 days ago', priority: 'high' },
  { id: 'T-002', subject: 'Product listing issue', status: 'resolved', date: '1 week ago', priority: 'medium' },
];

const statusColor = { open: 'bg-amber-100 text-amber-700', resolved: 'bg-green-100 text-green-700', investigating: 'bg-blue-100 text-blue-700' };

export default function VendorSupport() {
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submitTicket = () => {
    setShowForm(false);
    setSubject('');
    setMessage('');
  };

  return (
    <div className="pb-20">
      <AppHeader title="Support" subtitle="Get help with your store" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <a href="tel:18001234567" className="block">
            <Card className="p-3 border-border text-center hover:border-primary transition-colors">
              <Phone className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-[10px] font-medium">Call Us</p>
              <p className="text-[9px] text-muted-foreground">1800 123 4567</p>
            </Card>
          </a>
          <a href="mailto:vendor@setu.app" className="block">
            <Card className="p-3 border-border text-center hover:border-primary transition-colors">
              <Mail className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-[10px] font-medium">Email</p>
              <p className="text-[9px] text-muted-foreground">vendor@setu.app</p>
            </Card>
          </a>
          <Card className="p-3 border-border text-center">
            <MessageSquare className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-[10px] font-medium">Live Chat</p>
            <p className="text-[9px] text-green-500">Online now</p>
          </Card>
        </div>

        <Button className="w-full" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> {showForm ? 'Cancel' : 'Raise New Ticket'}
        </Button>

        {showForm && (
          <Card className="p-4 border-border space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Subject</Label>
              <Input placeholder="Brief description of issue" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Describe your issue</Label>
              <Textarea placeholder="Provide details..." rows={4} value={message} onChange={e => setMessage(e.target.value)} />
            </div>
            <Button className="w-full" onClick={submitTicket}>Submit Ticket</Button>
          </Card>
        )}

        <div>
          <h3 className="font-semibold text-sm mb-2">Your Tickets</h3>
          <div className="space-y-2">
            {tickets.map(t => (
              <Card key={t.id} className="p-3 border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-[10px] text-muted-foreground">{t.id} · {t.date}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`text-[9px] ${statusColor[t.status]} border-0`}>{t.status}</Badge>
                    <span className="text-[9px] text-muted-foreground">{t.priority} priority</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-2">Frequently Asked</h3>
          <div className="space-y-1">
            {faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between cursor-pointer py-3 px-1 list-none">
                  <span className="text-sm font-medium">{faq.q}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-xs text-muted-foreground pb-3 px-1">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
