import React, { useState } from 'react';
import { MessageSquare, Phone, Send, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { SUPPORT_TICKETS } from '@/lib/mockData';

export default function CustomerSupport() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pb-20">
      <AppHeader title="Help & Support" showBack rightAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs h-8"><Plus className="w-3 h-3 mr-1" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Subject" />
              <Input placeholder="Order Number (optional)" />
              <Textarea placeholder="Describe your issue..." rows={4} />
              <Button className="w-full" onClick={() => setOpen(false)}>Submit Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      {/* Quick actions */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <Card className="p-4 border-border text-center cursor-pointer hover:bg-muted/50 transition-colors">
          <Phone className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">Call Support</p>
          <p className="text-[10px] text-muted-foreground">9am - 6pm</p>
        </Card>
        <Card className="p-4 border-border text-center cursor-pointer hover:bg-muted/50 transition-colors">
          <MessageSquare className="w-6 h-6 text-accent mx-auto mb-2" />
          <p className="text-sm font-medium">WhatsApp</p>
          <p className="text-[10px] text-muted-foreground">24/7 support</p>
        </Card>
      </div>

      {/* Tickets */}
      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Your Tickets</h3>
        <div className="space-y-2">
          {SUPPORT_TICKETS.map(ticket => (
            <Card key={ticket.id} className="p-4 border-border">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-semibold">{ticket.subject}</h4>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">Order: {ticket.orderId}</p>
              <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                {ticket.messages.map((msg, i) => (
                  <div key={i} className={`text-xs ${msg.from === 'support' ? 'text-primary font-medium' : 'text-foreground'}`}>
                    <span className="font-semibold capitalize">{msg.from}: </span>
                    {msg.text}
                  </div>
                ))}
              </div>
              {ticket.status === 'open' && (
                <div className="flex gap-2 mt-3">
                  <Input placeholder="Reply..." className="text-xs h-8" />
                  <Button size="icon" className="h-8 w-8 shrink-0"><Send className="w-3 h-3" /></Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
