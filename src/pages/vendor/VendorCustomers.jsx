import React, { useMemo, useState } from 'react';
import { Search, Users, Loader2, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getOrdersByVendor } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function VendorCustomers() {
  const {user}=useAuth();
  const {data:vendor}=useDataFetch(()=>getVendorByOwnerId(user?.id),[user?.id],{enabled:!!user?.id,cacheKey:`vendor-profile-${user?.id}`});
  const {data:orders,isLoading,error}=useDataFetch(()=>getOrdersByVendor(vendor.id,{limit:100}),[vendor?.id],{enabled:!!vendor?.id,cacheKey:`vendor-customers-${vendor?.id}`});
  const [query,setQuery]=useState('');
  const customers=useMemo(()=>{
    const map=new Map();
    (orders??[]).filter(o=>o.status!=='cancelled').forEach(o=>{
      const id=o.customer_id||o.customerId||o.customer_name||o.customerName;
      if(!id)return;
      const cur=map.get(id)||{id,name:o.customer_name||o.customerName||'Customer',village:o.village||'—',orders:0,totalSpent:0,lastOrder:o.created_at||o.createdAt,phone:o.customer_phone||''};
      cur.orders+=1; cur.totalSpent+=Number(o.total||0);
      if(new Date(o.created_at||o.createdAt)>new Date(cur.lastOrder))cur.lastOrder=o.created_at||o.createdAt;
      map.set(id,cur);
    });
    return [...map.values()].sort((a,b)=>b.totalSpent-a.totalSpent);
  },[orders]);
  const filtered=customers.filter(c=>c.name.toLowerCase().includes(query.toLowerCase())||c.village.toLowerCase().includes(query.toLowerCase()));
  return <div className="pb-20"><AppHeader title="Customers" subtitle={`${customers.length} customers from your orders`} showBack backTo="/vendor/profile"/><div className="p-4 space-y-3">
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search customers…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {isLoading&&<div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/>Loading customers…</div>}
    {!isLoading&&error&&<Card className="p-6 text-center text-sm text-destructive">{error.message}</Card>}
    {!isLoading&&!error&&filtered.length===0&&<Card className="p-8 text-center"><Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground"/><p className="text-sm">No customers found</p></Card>}
    <div className="space-y-2">{filtered.map(c=><Card key={c.id} className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary/10 grid place-items-center text-sm font-bold text-primary">{c.name[0]}</div><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{c.name}</p><p className="text-xs text-muted-foreground">{c.village} · {c.orders} order{c.orders===1?'':'s'}</p></div><div className="text-right"><p className="font-semibold text-sm">{formatCurrency(c.totalSpent)}</p><p className="text-[10px] text-muted-foreground">spent</p></div>{c.phone&&<a className="w-9 h-9 grid place-items-center rounded-lg bg-muted" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}><Phone className="w-4 h-4"/></a>}</div></Card>)}</div>
  </div></div>;
}
