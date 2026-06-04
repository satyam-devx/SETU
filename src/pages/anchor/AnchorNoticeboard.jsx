import React, { useState } from 'react';
import { Newspaper, Plus, Trash2, Megaphone, Calendar, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';

const INITIAL_NOTICES = [
  { id: 'n1', title: 'Urea subsidy available', body: 'Kisan credit card holders can collect urea at 30% subsidy from the gram panchayat office until June 30.', type: 'scheme', pinned: true, date: 'Jun 1', author: 'Anchor Ramkali' },
  { id: 'n2', title: 'SETU vendor fair — June 15', body: 'New vendors can register at Madhepur market on June 15. Bring Aadhaar and 2 passport photos.', type: 'event', pinned: false, date: 'May 30', author: 'Anchor Ramkali' },
  { id: 'n3', title: 'Water pump repair notice', body: 'Ward 3 hand pump will be under repair June 5-6. Please use the alternate pump near the temple.', type: 'alert', pinned: false, date: 'May 28', author: 'Anchor Ramkali' },
];

const TYPE_STYLE = {
  scheme: 'bg-blue-100 text-blue-700',
  event:  'bg-purple-100 text-purple-700',
  alert:  'bg-amber-100 text-amber-700',
  general:'bg-gray-100 text-gray-700',
};

export default function AnchorNoticeboard() {
  const [notices, setNotices]   = useState(INITIAL_NOTICES);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ title: '', body: '', type: 'general', pinned: false });
  const [posting, setPosting]   = useState(false);
  const [posted, setPosted]     = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePost = () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
    setTimeout(() => {
      const newNotice = {
        id: `n${Date.now()}`,
        ...form,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        author: 'Anchor Ramkali',
      };
      setNotices(ns => form.pinned ? [newNotice, ...ns] : [...ns, newNotice]);
      setPosting(false);
      setPosted(true);
      setShowAdd(false);
      setForm({ title: '', body: '', type: 'general', pinned: false });
      setTimeout(() => setPosted(false), 3000);
    }, 600);
  };

  const handleDelete = (id) => setNotices(ns => ns.filter(n => n.id !== id));

  const pinned   = notices.filter(n => n.pinned);
  const unpinned = notices.filter(n => !n.pinned);

  return (
    <div className="pb-6">
      <AppHeader
        title="Noticeboard"
        subtitle="Madhepur Village"
        rightAction={
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(s => !s)}>
            <Plus className="w-3 h-3" /> Post
          </Button>
        }
      />
      <div className="px-4 py-3 space-y-3">

        {posted && (
          <Card className="p-3 border-green-200 bg-green-50 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">Notice posted successfully!</p>
          </Card>
        )}

        {/* Post form */}
        {showAdd && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">New Notice</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Title *</Label>
                <Input placeholder="Notice title..." value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Body *</Label>
                <Textarea placeholder="Notice details in Hindi or local language..." className="h-20 text-sm" value={form.body} onChange={e => set('body', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {['general', 'scheme', 'event', 'alert'].map(t => (
                    <button key={t} onClick={() => set('type', t)}
                      className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${form.type === t ? 'bg-primary text-white border-primary' : 'border-border'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pinned" checked={form.pinned} onChange={e => set('pinned', e.target.checked)} className="rounded" />
                <Label htmlFor="pinned" className="text-xs">Pin to top</Label>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handlePost} disabled={posting || !form.title || !form.body}>
                  {posting ? 'Posting...' : 'Post Notice'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Megaphone className="w-3.5 h-3.5" /> PINNED
            </p>
            {pinned.map(n => (
              <NoticeCard key={n.id} notice={n} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* All notices */}
        {unpinned.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">RECENT NOTICES</p>
            {unpinned.map(n => (
              <NoticeCard key={n.id} notice={n} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {notices.length === 0 && (
          <Card className="p-8 border-border text-center">
            <Newspaper className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notices yet. Post the first one!</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function NoticeCard({ notice, onDelete }) {
  return (
    <Card className={`p-4 border mb-2 ${notice.pinned ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{notice.title}</p>
            <Badge className={`text-[9px] border-0 ${TYPE_STYLE[notice.type] || TYPE_STYLE.general}`}>
              {notice.type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{notice.author} · {notice.date}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(notice.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{notice.body}</p>
    </Card>
  );
}
