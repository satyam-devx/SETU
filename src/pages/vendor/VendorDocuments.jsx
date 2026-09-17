import React from 'react';
import { FileText, CreditCard, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getVendorPaymentInfo } from '@/lib/api';

export default function VendorDocuments(){
 const {user}=useAuth();
 const {data:vendor,isLoading,error}=useDataFetch(()=>getVendorByOwnerId(user?.id),[user?.id],{enabled:!!user?.id,cacheKey:`vendor-profile-${user?.id}`});
 const {data:payment}=useDataFetch(()=>getVendorPaymentInfo(vendor.id),[vendor?.id],{enabled:!!vendor?.id,cacheKey:`vendor-payment-${vendor?.id}`});
 const mask=v=>v?`•••• ${String(v).slice(-4)}`:'Not provided';
 const docs=[
  ['KYC verification',vendor?.kyc_status||'not_submitted'],
  ['GSTIN','Managed through submitted business documents'],
  ['FSSAI','Managed through submitted business documents'],
  ['Bank account',mask(payment?.account_number)],
  ['IFSC',payment?.ifsc||'Not provided'],
  ['UPI',payment?.upi_id||'Not provided'],
 ];
 return <div className="pb-20"><AppHeader title="Business Documents" subtitle="KYC, tax & payout information"/><div className="p-4 space-y-4">
  {error&&<Card className="p-4 text-sm text-destructive flex gap-2"><AlertCircle className="w-4 h-4"/>{error.message}</Card>}
  {isLoading?<div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto"/></div>:<><Card className="p-4"><div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-primary"/><div><p className="font-semibold text-sm">Verification status</p><p className="text-xs text-muted-foreground">Your submitted KYC status is controlled by SETU verification.</p></div><Badge className="ml-auto text-[9px]">{vendor?.kyc_status||'not submitted'}</Badge></div></Card>
  <Card className="divide-y divide-border">{docs.map(([name,value])=><div key={name} className="p-4 flex items-center gap-3"><FileText className="w-4 h-4 text-muted-foreground"/><div className="flex-1"><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground break-all">{value}</p></div></div>)}</Card>
  <Card className="p-4 bg-muted/40"><div className="flex gap-3"><CreditCard className="w-5 h-5 text-muted-foreground shrink-0"/><div><p className="text-sm font-semibold">Need to change a document?</p><p className="text-xs text-muted-foreground mt-1">Use Support so changes are reviewed rather than silently overwriting verified KYC records.</p></div></div></Card></>}
 </div></div>;
}
