import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';
import { FraudAPI } from '@/lib/api';

const FRAUD_TYPES = [
  'Fake product delivered',
  'Overcharging / wrong price',
  'Order placed without my consent',
  'Rider demanded extra money',
  'Vendor selling expired goods',
  'My account was accessed without permission',
  'Other',
];

export default function CustomerFraudReport() {
  const [fraudType, setFraudType] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [ticketId, setTicketId]     = useState('');

  const handleSubmit = () => {
    if (!fraudType || !description.trim()) return;
    setSubmitting(true);
    FraudAPI.reportFraud({ fraudType, description, orderId }).then(({ data }) => {
      setSubmitting(false);
      if (data) {
        setTicketId(data.ticketId);
        setSubmitted(true);
      }
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Report Submitted</h2>
        <p className="text-sm text-muted-foreground">Ticket ID: <span className="font-mono font-bold">{ticketId}</span></p>
        <p className="text-sm text-muted-foreground">Our team will investigate within 24 hours. You'll be notified.</p>
        <Button variant="outline" onClick={() => { setSubmitted(false); setFraudType(''); setDescription(''); setOrderId(''); }}>
          Submit Another Report
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <AppHeader title="Report Fraud" showBack />
      <div className="px-4 py-4 space-y-4">

        <Card className="p-3 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            SETU has zero tolerance for fraud. All reports are confidential and investigated within 24 hours.
          </p>
        </Card>

        <Card className="p-4 border-border space-y-4">
          <div>
            <Label className="text-xs mb-2 block font-medium">Type of Issue *</Label>
            <div className="space-y-1.5">
              {FRAUD_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setFraudType(type)}
                  className={`w-full text-left text-sm p-3 rounded-xl border transition-colors ${fraudType === type ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:bg-muted/40'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block font-medium">Order ID (if applicable)</Label>
            <Input
              placeholder="e.g. SETU-2025-1042"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block font-medium">Describe what happened *</Label>
            <Textarea
              placeholder="Please describe the incident in detail. Include dates, amounts, names if known..."
              className="h-28 text-sm"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting || !fraudType || !description.trim()}
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" /> Emergency
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            If you feel unsafe or need immediate help, contact us directly.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs">Call SETU Helpline</Button>
            <Button variant="outline" className="flex-1 text-xs">WhatsApp Support</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
