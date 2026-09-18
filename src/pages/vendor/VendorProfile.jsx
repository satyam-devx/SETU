import React from 'react';
import { Link } from 'react-router-dom';
import { Store, IndianRupee, BarChart3, CreditCard, Settings, HelpCircle, Star, Award, FileText, Users, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getOrdersByVendor } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const menuItems=[
 {label:'Earnings & Payouts',icon:IndianRupee,path:'/vendor/earnings',desc:'Revenue, settlements & history'},
 {label:'Analytics',icon:BarChart3,path:'/vendor/analytics',desc:'Performance & insights'},
 {label:'Customers',icon:Users,path:'/vendor/customers',desc:'Everyone who has ordered from you'},
 {label:'Customer Reviews',icon:Star,path:'/vendor/reviews',desc:'View & respond to reviews'},
 {label:'SETU Vendor Credit',icon:CreditCard,path:'/vendor/credit',desc:'Working capital'},
 {label:'Subscription',icon:Award,path:'/vendor/subscription',desc:'Manage your plan'},
 {label:'Business Documents',icon:FileText,path:'/vendor/documents',desc:'KYC, GST & bank details'},
 {label:'Support',icon:HelpCircle,path:'/vendor/support',desc:'Get help with your store'},
 {label:'Settings',icon:Settings,path:'/vendor/settings',desc:'Hours, radius & preferences'},
];
export default function VendorProfile(){
 const {user}=useAuth();
 const {data:vendor,isLoading}=useDataFetch(()=>getVendorByOwnerId(user?.id),[user?.id],{enabled:!!user?.id,cacheKey:`vendor-profile-${user?.id}`});
 const {data:orders}=useDataFetch(()=>getOrdersByVendor(vendor.id,{limit:100}),[vendor?.id],{enabled:!!vendor?.id,cacheKey:`vendor-profile-orders-${vendor?.id}`});
 const orderCount=(orders??[]).filter(o=>o.status!=='cancelled').length;
 const revenue=(orders??[]).filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total||0),0);
 const reviews=(orders??[]).filter(o=>o.vendor_rating!=null).length;
 return <div className="pb-20"><AppHeader title="Profile"/><div className="px-4 py-4 space-y-4">
  <Card className="p-4 border-border"><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center"><Store className="w-8 h-8 text-accent"/></div><div className="min-w-0"><h2 className="font-bold text-lg truncate">{isLoading?'Loading…':vendor?.name||'Your Store'}</h2><p className="text-sm text-muted-foreground">{vendor?.category||'Business'}</p><div className="flex items-center gap-2 mt-1">{vendor?.is_verified&&<Badge className="bg-accent/10 text-accent text-[9px] border-0">✓ Verified</Badge>}<Badge className="text-[9px] border-0">{String(vendor?.subscription_tier||'free').toUpperCase()}</Badge>{vendor?.rating!=null&&<span className="flex items-center gap-1 text-xs"><Star className="w-3 h-3 text-amber-400 fill-amber-400"/>{Number(vendor.rating).toFixed(1)}</span>}</div></div></div></Card>
  <div className="grid grid-cols-3 gap-2"><Card className="p-3 text-center"><p className="text-xl font-bold text-primary">{orderCount}</p><p className="text-[10px] text-muted-foreground">Orders</p></Card><Card className="p-3 text-center"><p className="text-xl font-bold text-accent">{formatCurrency(revenue)}</p><p className="text-[10px] text-muted-foreground">Revenue</p></Card><Card className="p-3 text-center"><p className="text-xl font-bold">{reviews}</p><p className="text-[10px] text-muted-foreground">Reviews</p></Card></div>
  <div>{menuItems.map(item=>{const Icon=item.icon;return <Link key={item.path} to={item.path} className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg"><div className="w-9 h-9 rounded-xl bg-muted grid place-items-center shrink-0"><Icon className="w-4 h-4"/></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.label}</p><p className="text-[10px] text-muted-foreground">{item.desc}</p></div><ChevronRight className="w-4 h-4 text-muted-foreground"/></Link>})}</div>
 </div></div>;
}
