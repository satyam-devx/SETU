import React from 'react';
import { Check, Crown, Sparkles, Building2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId } from '@/lib/api';

const plans=[
 {name:'Free',icon:Sparkles,price:0,features:['Up to 20 products','Basic analytics','Standard support']},
 {name:'Pro',icon:Crown,price:499,features:['Unlimited products','Advanced analytics','Priority support','SETU Credit access']},
 {name:'Enterprise',icon:Building2,price:1499,features:['Everything in Pro','Dedicated manager','API access','Custom operations']},
];
export default function VendorSubscription(){
 const {user}=useAuth(); const {data:vendor,isLoading}=useDataFetch(()=>getVendorByOwnerId(user?.id),[user?.id],{enabled:!!user?.id,cacheKey:`vendor-profile-${user?.id}`});
 const current=String(vendor?.subscription_tier||'free').toLowerCase();
 return <div className="pb-20"><AppHeader title="Subscription" subtitle="Manage your plan"/><div className="p-4 space-y-4">
  <Card className="p-4 border-primary/20 bg-primary/5"><div className="flex items-center gap-2"><Crown className="w-5 h-5 text-primary"/><h3 className="font-bold">Current plan</h3><Badge className="ml-auto">{isLoading?'…':current.toUpperCase()}</Badge></div><p className="text-xs text-muted-foreground mt-2">Plan and billing status are read from your vendor account. SETU will confirm any commercial change before charging you.</p></Card>
  <div className="space-y-3">{plans.map(plan=>{const active=current===plan.name.toLowerCase();const Icon=plan.icon;return <Card key={plan.name} className={`p-4 ${active?'border-primary ring-1 ring-primary/20':''}`}><div className="flex items-start justify-between"><div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-muted grid place-items-center"><Icon className="w-5 h-5"/></div><div><div className="flex items-center gap-2"><p className="font-semibold">{plan.name}</p>{active&&<Badge className="text-[9px]">Current</Badge>}</div><p className="text-xs text-muted-foreground">₹{plan.price.toLocaleString('en-IN')}{plan.price?'/month':''}</p></div></div></div><div className="mt-3 space-y-1.5">{plan.features.map(f=><p key={f} className="text-xs flex gap-2"><Check className="w-3.5 h-3.5 shrink-0"/>{f}</p>)}</div>{!active&&<Link to="/vendor/support" className="block mt-4"><Button variant="outline" className="w-full h-9 text-xs">Contact SETU about this plan <ArrowRight className="w-3 h-3 ml-1"/></Button></Link>}</Card>})}</div>
 </div></div>;
}
