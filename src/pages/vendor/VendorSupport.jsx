import React, { useEffect, useState } from 'react';
import { HelpCircle, MessageSquare, Phone, Mail, Plus, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { getSupportTickets, createSupportTicket } from '@/lib/api';

const faqs=[
 ['How do I add a new product?','Go to Products and use Add Product. You can upload a photo or provide a direct image URL.'],
 ['When do I get my payouts?','Your actual settlement schedule depends on your SETU account and payment configuration.'],
 ['How is commission calculated?','Commission is applied according to your active commercial terms; contact SETU support if you need the current rate.'],
 ['How do I pause my store?','Open Settings and turn Store Open off.']
];
const statusClass={open:'bg-amber-100 text-amber-700',in_progress:'bg-blue-100 text-blue-700',resolved:'bg-green-100 text-green-700',closed:'bg-muted text-muted-foreground'};
export default function VendorSupport(){
 const {user}=useAuth(); const [tickets,setTickets]=useState([]); const [loading,setLoading]=useState(true); const [showForm,setShowForm]=useState(false); const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
 const load=async()=>{setLoading(true);const {data,error:e}=await getSupportTickets(user?.id);if(e)setError(e.message);else setTickets(data??[]);setLoading(false);};
 useEffect(()=>{if(user?.id)load()},[user?.id]);
 const submit=async()=>{if(!subject.trim()||!message.trim())return setError('Subject and message are required.');setSaving(true);setError('');const {error:e}=await createSupportTicket({user_id:user.id,subject:subject.trim(),status:'open',priority:'medium',messages:[{from:'vendor',text:message.trim(),time:new Date().toISOString()}]});setSaving(false);if(e){setError(e.message);return;}setSubject('');setMessage('');setShowForm(false);load();};
 return <div className="pb-20"><AppHeader title="Support" subtitle="Get help with your store"/><div className="p-4 space-y-4">
  {error&&<div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
  <div className="grid grid-cols-3 gap-2"><a href="tel:18001234567" className="block"><Card className="p-3 text-center"><Phone className="w-5 h-5 text-primary mx-auto mb-1"/><p className="text-[10px] font-medium">Call Us</p></Card></a><a href="mailto:vendor@setu.app" className="block"><Card className="p-3 text-center"><Mail className="w-5 h-5 text-primary mx-auto mb-1"/><p className="text-[10px] font-medium">Email</p></Card></a><Card className="p-3 text-center"><MessageSquare className="w-5 h-5 text-primary mx-auto mb-1"/><p className="text-[10px] font-medium">Tickets</p></Card></div>
  <Button className="w-full" onClick={()=>setShowForm(v=>!v)}><Plus className="w-4 h-4 mr-2"/>{showForm?'Cancel':'Raise New Ticket'}</Button>
  {showForm&&<Card className="p-4 space-y-3"><Label className="text-xs">Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Brief description of issue"/><Label className="text-xs">Message</Label><Textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={2000} placeholder="Describe the problem…"/><Button className="w-full" onClick={submit} disabled={saving}>{saving?<Loader2 className="w-4 h-4 animate-spin"/>:'Submit Ticket'}</Button></Card>}
  <Card className="p-4"><h3 className="font-semibold text-sm mb-3">Your Tickets</h3>{loading?<p className="text-xs text-muted-foreground">Loading…</p>:tickets.length===0?<p className="text-xs text-muted-foreground">No support tickets yet.</p>:<div className="space-y-2">{tickets.map(t=><div key={t.id} className="p-3 rounded-lg bg-muted/40"><div className="flex justify-between gap-2"><p className="text-xs font-semibold">{t.subject}</p><Badge className={`text-[9px] border-0 ${statusClass[t.status]||''}`}>{t.status}</Badge></div><p className="text-[10px] text-muted-foreground mt-1">{new Date(t.created_at).toLocaleDateString('en-IN')} · {t.priority}</p></div>)}</div>}</Card>
  <Card className="p-4"><h3 className="font-semibold text-sm mb-3">FAQs</h3><div className="space-y-3">{faqs.map(([q,a])=><details key={q} className="border-b border-border pb-3"><summary className="text-xs font-medium cursor-pointer">{q}</summary><p className="text-xs text-muted-foreground mt-2">{a}</p></details>)}</div></Card>
 </div></div>;
}
