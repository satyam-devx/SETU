import React, { useMemo, useState } from 'react';
import { Star, Reply, ThumbsUp, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getOrdersByVendor, replyToVendorReview } from '@/lib/api';

export default function VendorReviews() {
  const { user } = useAuth();
  const { data: vendor } = useDataFetch(() => getVendorByOwnerId(user?.id), [user?.id], { enabled: !!user?.id, cacheKey:`vendor-profile-${user?.id}` });
  const { data: orders, isLoading, error, refetch } = useDataFetch(
    () => getOrdersByVendor(vendor.id, { limit: 100 }),
    [vendor?.id], { enabled: !!vendor?.id, cacheKey:`vendor-reviews-${vendor?.id}` }
  );
  const reviews = useMemo(() => (orders ?? []).filter(o => o.vendor_rating != null).map(o => ({
    id:o.id, customer:o.customer_name || 'Customer', village:o.village || '—', rating:o.vendor_rating,
    date:o.created_at, order:o.order_number, text:o.rating_comment || 'No written comment.', reply:o.vendor_review_reply || '',
  })), [orders]);
  const [tab,setTab]=useState('all'); const [replyingTo,setReplyingTo]=useState(null); const [replyText,setReplyText]=useState(''); const [saving,setSaving]=useState(false); const [actionError,setActionError]=useState('');
  const filtered=reviews.filter(r=>tab==='all'||(tab==='new'&&!r.reply)||(tab==='replied'&&r.reply));
  const avg=reviews.length?(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1):'—';
  const submit=async id=>{ if(!replyText.trim()) return; setSaving(true);setActionError(''); const {error:e}=await replyToVendorReview(id,replyText.trim()); setSaving(false); if(e){setActionError(e.message);return;} setReplyingTo(null);setReplyText('');refetch(); };
  return <div className="pb-20"><AppHeader title="Customer Reviews" subtitle="Real order ratings & replies" showBack backTo="/vendor/profile"/>
    <div className="p-4 space-y-4">
      {actionError&&<div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2"><AlertCircle className="w-4 h-4"/>{actionError}</div>}
      <div className="grid grid-cols-3 gap-2"><StatCard title="Avg Rating" value={avg} icon={Star}/><StatCard title="Total Reviews" value={String(reviews.length)} icon={ThumbsUp}/><StatCard title="Pending Reply" value={String(reviews.filter(r=>!r.reply).length)} icon={Reply}/></div>
      <Tabs value={tab} onValueChange={setTab}><TabsList className="w-full grid grid-cols-3"><TabsTrigger value="all" className="text-xs">All</TabsTrigger><TabsTrigger value="new" className="text-xs">New</TabsTrigger><TabsTrigger value="replied" className="text-xs">Replied</TabsTrigger></TabsList></Tabs>
      {isLoading&&<div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/>Loading reviews…</div>}
      {!isLoading&&error&&<Card className="p-6 text-center"><p className="text-sm text-destructive">{error.message}</p><Button size="sm" className="mt-3" onClick={refetch}>Retry</Button></Card>}
      {!isLoading&&!error&&filtered.length===0&&<Card className="p-8 text-center"><Star className="w-7 h-7 mx-auto mb-2 text-muted-foreground"/><p className="text-sm font-medium">No reviews yet</p><p className="text-xs text-muted-foreground mt-1">Ratings appear here after customers rate delivered orders.</p></Card>}
      <div className="space-y-3">{filtered.map(r=><Card key={r.id} className="p-4 border-border">
        <div className="flex justify-between gap-3"><div><p className="font-semibold text-sm">{r.customer}</p><p className="text-[10px] text-muted-foreground">{r.village} · {new Date(r.date).toLocaleDateString('en-IN')} · {r.order}</p></div><div className="flex">{[1,2,3,4,5].map(n=><Star key={n} className={`w-3 h-3 ${n<=r.rating?'text-amber-400 fill-amber-400':'text-muted-foreground/30'}`}/>)}</div></div>
        <p className="text-sm mt-3">{r.text}</p>
        {r.reply?<div className="mt-3 p-3 rounded-lg bg-muted/50"><p className="text-[10px] font-semibold">Your reply</p><p className="text-xs mt-1">{r.reply}</p></div>:replyingTo===r.id?<div className="mt-3 space-y-2"><Textarea maxLength={1000} placeholder="Write a helpful reply…" value={replyText} onChange={e=>setReplyText(e.target.value)}/><div className="flex gap-2"><Button size="sm" onClick={()=>submit(r.id)} disabled={saving||!replyText.trim()}>{saving?<Loader2 className="w-3 h-3 animate-spin"/>:'Send reply'}</Button><Button size="sm" variant="outline" onClick={()=>{setReplyingTo(null);setReplyText('')}}>Cancel</Button></div></div>:<Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={()=>{setReplyingTo(r.id);setReplyText('')}}><Reply className="w-3 h-3 mr-1"/>Reply</Button>}
      </Card>)}</div>
    </div></div>;
}
