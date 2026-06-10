import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, Plus, Trash2, Megaphone, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import { useVillage } from '@/lib/village';
import { AnchorAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const TYPE_STYLE = {
  scheme:  'bg-blue-100   text-blue-700',
  event:   'bg-purple-100 text-purple-700',
  alert:   'bg-amber-100  text-amber-700',
  general: 'bg-gray-100   text-gray-700',
};

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function AnchorNoticeboard() {
  const { village, villageId } = useVillage();

  const [notices,   setNotices]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState({ title: '', body: '', type: 'general', isPinned: false });
  const [posting,   setPosting]   = useState(false);
  const [posted,    setPosted]    = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [anchorUserId, setAnchorUserId] = useState(null);
  const [anchorName,   setAnchorName]   = useState('Anchor');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setAnchorUserId(user.id);
      supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => { if (data?.name) setAnchorName(data.name); });
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadNotices = useCallback(async () => {
    if (!villageId) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await AnchorAPI.getNotices(villageId);
    if (error) setLoadError('Failed to load notices. Tap retry.');
    else setNotices(data ?? []);
    setLoading(false);
  }, [villageId]);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  // ── Post notice ────────────────────────────────────────
  const handlePost = async () => {
    if (!form.title.trim() || !form.body.trim() || !anchorUserId || !villageId) return;
    setPosting(true);
    const { data, error } = await AnchorAPI.createNotice({
      villageId,
      title:     form.title.trim(),
      body:      form.body.trim(),
      type:      form.type,
      isPinned:  form.isPinned,
      createdBy: anchorUserId,
    });
    if (!error && data) {
      // Optimistically prepend with author name
      const newNotice = { ...data, profiles: { name: anchorName } };
      setNotices(ns =>
        form.isPinned ? [newNotice, ...ns] : [...ns, newNotice]
      );
      setPosted(true);
      setShowAdd(false);
      setForm({ title: '', body: '', type: 'general', isPinned: false });
      setTimeout(() => setPosted(false), 3000);
    }
    setPosting(false);
  };

  // ── Delete notice ──────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await AnchorAPI.deleteNotice(id);
    if (!error) setNotices(ns => ns.filter(n => n.id !== id));
    setDeletingId(null);
  };

  const pinned   = notices.filter(n => n.is_pinned);
  const unpinned = notices.filter(n => !n.is_pinned);

  return (
    <div className="pb-6">
      <AppHeader
        title="Noticeboard"
        subtitle={village?.name ?? 'Village'}
        rightAction={
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(s => !s)}>
            <Plus className="w-3 h-3" /> Post
          </Button>
        }
      />
      <div className="px-4 py-3 space-y-3">

        {/* Success toast */}
        {posted && (
          <Card className="p-3 border-green-200 bg-green-50 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">Notice posted successfully!</p>
          </Card>
        )}

        {/* Error banner */}
        {loadError && (
          <Card className="p-3 border-destructive/20 bg-destructive/5 flex items-center justify-between">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={loadNotices}>
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </Card>
        )}

        {/* Post form */}
        {showAdd && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">New Notice</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Title *</Label>
                <Input
                  placeholder="Notice title..."
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Body *</Label>
                <Textarea
                  placeholder="Notice details in Hindi or local language..."
                  className="h-20 text-sm"
                  value={form.body}
                  onChange={e => set('body', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Type</Label>
                <div className="flex gap-2 flex-wrap">
                  {['general', 'scheme', 'event', 'alert'].map(t => (
                    <button
                      key={t}
                      onClick={() => set('type', t)}
                      className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors
                        ${form.type === t ? 'bg-primary text-white border-primary' : 'border-border'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={form.isPinned}
                  onChange={e => set('isPinned', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="pinned" className="text-xs">Pin to top</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handlePost}
                  disabled={posting || !form.title.trim() || !form.body.trim()}
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Notice'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Megaphone className="w-3.5 h-3.5" /> PINNED
                </p>
                {pinned.map(n => (
                  <NoticeCard
                    key={n.id}
                    notice={n}
                    onDelete={handleDelete}
                    isDeleting={deletingId === n.id}
                  />
                ))}
              </div>
            )}

            {/* Unpinned */}
            {unpinned.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">RECENT NOTICES</p>
                {unpinned.map(n => (
                  <NoticeCard
                    key={n.id}
                    notice={n}
                    onDelete={handleDelete}
                    isDeleting={deletingId === n.id}
                  />
                ))}
              </div>
            )}

            {notices.length === 0 && (
              <Card className="p-8 border-border text-center">
                <Newspaper className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notices yet. Post the first one!</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NoticeCard({ notice, onDelete, isDeleting }) {
  const authorName = notice.profiles?.name ?? 'Anchor';
  return (
    <Card className={`p-4 border mb-2 ${notice.is_pinned ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{notice.title}</p>
            <Badge className={`text-[9px] border-0 ${TYPE_STYLE[notice.type] ?? TYPE_STYLE.general}`}>
              {notice.type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {authorName} · {formatDate(notice.created_at)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={isDeleting}
          onClick={() => onDelete(notice.id)}
        >
          {isDeleting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2   className="w-3.5 h-3.5" />
          }
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{notice.body}</p>
    </Card>
  );
}
