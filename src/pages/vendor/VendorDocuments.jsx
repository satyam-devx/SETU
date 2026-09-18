// ═══════════════════════════════════════════════════════════
// SETU — VendorDocuments (v2)
// Changes:
//  - Redesigned from a single cramped line per row to match the
//    rest of the vendor portal's card-based visual language
//    (VendorCredit / VendorEarnings): hero status card, icon-led
//    detail rows, proper loading/error states.
//  - Added missing showBack (this page had no way back except the
//    hardware/browser back button).
//  - Same data as before (vendor.kyc_status + vendor_payment_info) —
//    no new fetches, just a real layout.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Clock, FileText, Landmark,
  Smartphone, Hash, Building2, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getVendorPaymentInfo } from '@/lib/api';

// Mirrors the KYC_STYLE pattern already used in the admin KYC/vendor
// pages — kept local since vendors.kyc_status ('pending' | 'submitted'
// | 'approved' | 'rejected') doesn't match the order-status map in
// lib/utils.js (STATUS_COLORS has no 'approved'/'submitted'/'rejected').
const KYC_META = {
  approved:  { label: 'Verified',        badge: 'bg-green-100 text-green-700', icon: ShieldCheck, tone: 'border-green-200 bg-green-50/60',   iconTone: 'bg-green-100 text-green-600',
    helper: 'Your shop is verified. Customers can see your verified badge.' },
  submitted: { label: 'Under Review',    badge: 'bg-blue-100 text-blue-700',   icon: Clock,       tone: 'border-blue-200 bg-blue-50/60',      iconTone: 'bg-blue-100 text-blue-600',
    helper: 'SETU is reviewing your documents. This usually takes 24–48 hours.' },
  pending:   { label: 'Action Needed',   badge: 'bg-amber-100 text-amber-700', icon: ShieldAlert, tone: 'border-amber-200 bg-amber-50/60',    iconTone: 'bg-amber-100 text-amber-600',
    helper: 'Complete KYC during onboarding to get your verified badge.' },
  rejected:  { label: 'Rejected',        badge: 'bg-red-100 text-red-700',     icon: ShieldAlert, tone: 'border-destructive/30 bg-destructive/5', iconTone: 'bg-red-100 text-red-600',
    helper: 'Your last submission was rejected. Contact support to resubmit.' },
};

function mask(v) {
  return v ? `•••• ${String(v).slice(-4)}` : 'Not provided';
}

function DetailRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

export default function VendorDocuments() {
  const { user } = useAuth();
  const { data: vendor, isLoading: vendorLoading, error } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );
  const { data: payment, isLoading: paymentLoading } = useDataFetch(
    () => getVendorPaymentInfo(vendor?.id),
    [vendor?.id],
    { cacheKey: `vendor-payment-${vendor?.id}`, enabled: !!vendor?.id }
  );

  const isLoading = vendorLoading || (!!vendor?.id && paymentLoading);
  const kyc = KYC_META[vendor?.kyc_status] ?? KYC_META.pending;
  const KycIcon = kyc.icon;

  return (
    <div className="pb-20">
      <AppHeader title="Business Documents" subtitle="KYC, tax & payout details" showBack backTo="/vendor/profile" />
      <div className="p-4 space-y-4">

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error.message}
          </div>
        )}

        {isLoading ? (
          <>
            <div className="h-24 bg-muted rounded-2xl animate-pulse" />
            <div className="h-40 bg-muted rounded-2xl animate-pulse" />
            <div className="h-32 bg-muted rounded-2xl animate-pulse" />
          </>
        ) : (
          <>
            {/* ── KYC status hero ─────────────────────────── */}
            <Card className={`p-4 border ${kyc.tone}`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${kyc.iconTone}`}>
                  <KycIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">KYC Verification</p>
                    <Badge className={`text-[9px] border-0 ${kyc.badge}`}>{kyc.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{kyc.helper}</p>
                </div>
              </div>
            </Card>

            {/* ── Tax & business ───────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Tax &amp; Business
              </p>
              <Card className="border-border divide-y divide-border overflow-hidden">
                <DetailRow icon={Building2} label="GSTIN" value="Managed through submitted business documents" />
                <DetailRow icon={FileText}  label="FSSAI"  value="Managed through submitted business documents" />
              </Card>
            </div>

            {/* ── Payout details ───────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Payout Details
              </p>
              <Card className="border-border divide-y divide-border overflow-hidden">
                <DetailRow icon={Landmark}   label="Bank account" value={mask(payment?.account_number)} mono />
                <DetailRow icon={Hash}       label="IFSC"         value={payment?.ifsc || 'Not provided'} mono />
                <DetailRow icon={Smartphone} label="UPI ID"       value={payment?.upi_id || 'Not provided'} mono />
              </Card>
            </div>

            {/* ── Need a change? ───────────────────────────── */}
            <Link to="/vendor/support">
              <Card className="p-4 bg-muted/40 border-border flex items-center gap-3 hover:bg-muted/60 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Need to change a document?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Raise a request so changes are reviewed, not silently overwritten.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Card>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
