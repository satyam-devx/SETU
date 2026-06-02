import React, { useState } from 'react';
import { Plus, Mic, Globe, Newspaper, Calendar, Eye, ThumbsUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';

const posts = [
  {
    id: 'p1', type: 'scheme', title: 'PM Kisan 19th Installment Released!',
    body: 'PM Kisan Samman Nidhi ₹2,000 for eligible farmers has been credited. Check your bank account. Contact Ramkali Devi to verify eligibility.',
    lang: 'Hindi', views: 142, likes: 38, time: '2 hours ago', pinned: true,
  },
  {
    id: 'p2', type: 'alert', title: 'Water Shortage — Ward 3 & 4',
    body: 'Jal Jeevan Mission pipeline work is ongoing on Main Road. Water supply will be disrupted 8am–4pm for the next 3 days.',
    lang: 'Hindi+Maithili', views: 98, likes: 12, time: '5 hours ago', pinned: false,
  },
  {
    id: 'p3', type: 'market', title: 'Makhana Fair Price: ₹680/kg today',
    body: 'Today\'s wholesale makhana price at Darbhanga Mandi is ₹680/kg. SETU vendor Lakshmi Makhana Traders is offering ₹650/kg. Contact before 2pm.',
    lang: 'Hindi', views: 67, likes: 24, time: '1 day ago', pinned: false,
  },
  {
    id: 'p4', type: 'health', title: 'Free Health Camp — 3 June at Panchayat Bhavan',
    body: 'A free health camp organized by Madhubani District Hospital will be held on 3 June. BP, sugar, eye checkup available. Bring Aadhaar.',
    lang: 'Maithili', views: 203, likes: 55, time: '2 days ago', pinned: false,
  },
];

const typeColors = {
  scheme: 'bg-green-100 text-green-800',
  alert: 'bg-red-100 text-red-800',
  market: 'bg-amber-100 text-amber-800',
  health: 'bg-blue-100 text-blue-800',
  general: 'bg-gray-100 text-gray-700',
};

export default function AnchorNoticeboard() {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="pb-24">
      <AppHeader title="Village Noticeboard" subtitle="Madhepur" showBack backTo="/anchor" rightAction={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs h-8"><Plus className="w-3 h-3 mr-1" /> Post</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Village Notice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheme">Government Scheme</SelectItem>
                    <SelectItem value="market">Market Prices</SelectItem>
                    <SelectItem value="health">Health Alert</SelectItem>
                    <SelectItem value="alert">Civic Alert</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Language</label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hindi">Hindi</SelectItem>
                    <SelectItem value="maithili">Maithili</SelectItem>
                    <SelectItem value="both">Hindi + Maithili</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Notice title" />
              <Textarea placeholder="Write the notice content here..." rows={4} />
              <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                <div>
                  <p className="text-xs font-medium">Voice Input</p>
                  <p className="text-[10px] text-muted-foreground">Speak in Hindi or Maithili</p>
                </div>
                <Button size="sm" variant={isRecording ? 'destructive' : 'outline'} onClick={() => setIsRecording(!isRecording)} className="text-xs">
                  <Mic className="w-3 h-3 mr-1" /> {isRecording ? 'Stop' : 'Record'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium flex items-center gap-2">
                  <input type="checkbox" className="rounded" /> Pin this notice
                </label>
                <label className="text-xs font-medium flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked /> Send SMS alert
                </label>
              </div>
              <Button className="w-full" onClick={() => setOpen(false)}>Publish Notice</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      {/* Language filter */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto pb-1">
        {['All', 'Hindi', 'Maithili', 'Schemes', 'Market', 'Health', 'Alerts'].map(f => (
          <button key={f} className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${f === 'All' ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}>{f}</button>
        ))}
      </div>

      <div className="px-4 py-2 space-y-3">
        {posts.map(post => (
          <Card key={post.id} className={`p-4 border ${post.pinned ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            {post.pinned && <p className="text-[10px] text-primary font-semibold mb-2">📌 PINNED</p>}
            <div className="flex items-start justify-between mb-2">
              <Badge variant="outline" className={`text-[9px] ${typeColors[post.type]}`}>{post.type}</Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Globe className="w-3 h-3" /> {post.lang}
              </div>
            </div>
            <h4 className="font-semibold text-sm mb-1">{post.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{post.body}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views}</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {post.likes}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.time}</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary">
                <Mic className="w-3 h-3 mr-1" /> Listen
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
