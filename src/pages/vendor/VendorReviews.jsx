import React, { useState } from 'react';
import { Star, Reply, ThumbsUp, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const reviews = [
  { id: 'r1', customer: 'Anita Devi', village: 'Rampur', rating: 5, date: '2 days ago', order: 'ORD-1024', text: 'Fresh vegetables, delivered fast. Will order again!', status: 'new', helpful: 3 },
  { id: 'r2', customer: 'Ravi Kumar', village: 'Bhojpur', rating: 4, date: '5 days ago', order: 'ORD-1018', text: 'Good quality but packaging could be better.', status: 'replied', helpful: 1, reply: 'Thank you Ravi! We are improving our packaging.' },
  { id: 'r3', customer: 'Sunita Kumari', village: 'Laxmipur', rating: 2, date: '1 week ago', order: 'ORD-1005', text: 'Tomatoes were overripe. Disappointed.', status: 'new', helpful: 0 },
  { id: 'r4', customer: 'Mohan Kumar', village: 'Madhepur', rating: 5, date: '2 weeks ago', order: 'ORD-0991', text: 'Best kirana store in the village. Always reliable.', status: 'replied', helpful: 8, reply: 'Thank you for your trust, Mohan!' },
];

export default function VendorReviews() {
  const [tab, setTab] = useState('all');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const filtered = reviews.filter(r => tab === 'all' || r.status === tab);
  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  const submitReply = (id) => {
    setReplyingTo(null);
    setReplyText('');
  };

  return (
    <div className="pb-20">
      <AppHeader title="Customer Reviews" subtitle="View & respond to reviews" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard title="Avg Rating" value={avgRating} icon={Star} />
          <StatCard title="Total Reviews" value={reviews.length.toString()} icon={ThumbsUp} />
          <StatCard title="Pending Reply" value={reviews.filter(r => r.status === 'new').length.toString()} icon={Reply} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="new" className="text-xs">New</TabsTrigger>
            <TabsTrigger value="replied" className="text-xs">Replied</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="p-4 border-border">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{r.customer}</p>
                  <p className="text-[10px] text-muted-foreground">{r.village} · {r.date} · {r.order}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-foreground mb-2">{r.text}</p>
              {r.reply && (
                <div className="bg-muted/50 rounded-lg p-3 mb-2 border-l-2 border-primary">
                  <p className="text-[10px] font-medium text-primary mb-0.5">Your reply</p>
                  <p className="text-xs text-muted-foreground">{r.reply}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {r.helpful} found helpful</span>
                {r.status === 'new' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReplyingTo(replyingTo === r.id ? null : r.id)}>
                    <Reply className="w-3 h-3 mr-1" /> {replyingTo === r.id ? 'Cancel' : 'Reply'}
                  </Button>
                )}
              </div>
              {replyingTo === r.id && (
                <div className="mt-3 space-y-2">
                  <Textarea placeholder="Write your reply..." rows={2} value={replyText} onChange={e => setReplyText(e.target.value)} className="text-xs" />
                  <Button size="sm" className="w-full h-8 text-xs" onClick={() => submitReply(r.id)}>Post Reply</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
