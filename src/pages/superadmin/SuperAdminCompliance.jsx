// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminCompliance  (v2 — Live DB)
// Real, computable compliance signals derived from actual data:
//   • Vendor verification rate (vendors.is_verified)
//   • KYC review completion   (kyc_records.status)
//   • Account integrity        (profiles.is_banned)
// No fabricated regulatory figures — only what the platform tracks.
// ═══════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { Shield, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { supabase } from '@/lib/supabase';

async function fetchComplianceData() {
  const head = { count: 'exact', head: true };
  const [vTotal, vVerified, kTotal, kPending, uTotal, uBanned] = await Promise.all([
    supabase.from('vendors').select('id', head),
    supabase.from('vendors').select('id', head).eq('is_verified', true),
    supabase.from('kyc_records').select('id', head),
    supabase.from('kyc_records').select('id', head).eq('status', 'submitted'),
    supabase.from('profiles').select('id', head),
    supabase.from('profiles').select('id', head).eq('is_banned', true),
  ]);

  const firstError =
    vTotal.error || vVerified.error || kTotal.error ||
    kPending.error || uTotal.error || uBanned.error || null;
  if (firstError) return { error: firstError };

  return {
    data: {
      vendorsTotal:    vTotal.count    ?? 0,
      vendorsVerified: vVerified.count ?? 0,
      kycTotal:        kTotal.count    ?? 0,
      kycPending:      kPending.count  ?? 0,
      usersTotal:      uTotal.count    ?? 0,
      usersBanned:     uBanned.count   ?? 0,
    },
  };
}

const statusColor = { good: 'text-green-600', warning: 'text-amber-600', critical: 'text-red-600' };
const barColor    = { good: 'bg-green-500',   warning: 'bg-amber-500',   critical: 'bg-red-500'   };

function rate(part, total) {
  if (!total) return 100; // nothing to verify ⇒ compliant
  return Math.round((part / total) * 100);
}
function statusFor(value, target) {
  if (value >= target)      return 'good';
  if (value >= target - 15) return 'warning';
  return 'critical';
}

export default function SuperAdminCompliance() {
  const { data, isLoading, error, refetch } = useDataFetch(
    fetchComplianceData,
    [],
    { cacheKey: 'superadmin-compliance', staleTime: 60_000 }
  );

  const d = data ?? {};

  const metrics = useMemo(() => {
    const vendorRate = rate(d.vendorsVerified, d.vendorsTotal);
    const kycRate    = rate((d.kycTotal ?? 0) - (d.kycPending ?? 0), d.kycTotal);
    const integrity  = rate((d.usersTotal ?? 0) - (d.usersBanned ?? 0), d.usersTotal);
    return [
      { name: 'Vendor Verification Rate', value: vendorRate, target: 90, status: statusFor(vendorRate, 90),
        detail: `${d.vendorsVerified ?? 0}/${d.vendorsTotal ?? 0} vendors verified` },
      { name: 'KYC Review Completion',    value: kycRate,    target: 95, status: statusFor(kycRate, 95),
        detail: `${(d.kycTotal ?? 0) - (d.kycPending ?? 0)}/${d.kycTotal ?? 0} records reviewed` },
      { name: 'Account Integrity',        value: integrity,  target: 99, status: statusFor(integrity, 99),
        detail: `${d.usersBanned ?? 0} of ${d.usersTotal ?? 0} accounts banned` },
    ];
  }, [d]);

  const issues = metrics.filter(m => m.status !== 'good').length;
  const overall = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + m.value, 0) / metrics.length)
    : 0;

  const actions = useMemo(() => {
    const out = [];
    const vendorsPending = (d.vendorsTotal ?? 0) - (d.vendorsVerified ?? 0);
    if (vendorsPending > 0) out.push(`${vendorsPending} vendors pending verification`);
    if ((d.kycPending ?? 0) > 0) out.push(`${d.kycPending} KYC submissions awaiting review`);
    if ((d.usersBanned ?? 0) > 0) out.push(`${d.usersBanned} accounts currently banned`);
    return out;
  }, [d]);

  return (
    <div className="pb-6">
      <AppHeader
        title="Compliance"
        subtitle="Live verification & integrity signals"
        rightAction={
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refetch} aria-label="Refresh compliance data">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-4 max-w-2xl">

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load compliance data.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 border-border text-center">
            {isLoading
              ? <div className="h-8 bg-muted rounded animate-pulse mb-1" />
              : <p className="text-2xl font-bold text-primary">{overall}%</p>}
            <p className="text-xs text-muted-foreground">Overall Score</p>
          </Card>
          <Card className="p-3 border-border text-center">
            {isLoading
              ? <div className="h-8 bg-muted rounded animate-pulse mb-1" />
              : <p className="text-2xl font-bold text-amber-600">{issues}</p>}
            <p className="text-xs text-muted-foreground">Below Target</p>
          </Card>
        </div>

        {/* Metrics */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Compliance Metrics
          </h3>
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${statusColor[item.status]}`}>{item.value}%</span>
                      <span className="text-[10px] text-muted-foreground">/ {item.target}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor[item.status]}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions required — derived from real pending counts */}
        {!isLoading && (
          actions.length > 0 ? (
            <Card className="p-4 border-amber-200 bg-amber-50/40">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Action Required
              </h3>
              <ul className="space-y-1.5 text-xs text-amber-700">
                {actions.map(a => <li key={a}>• {a}</li>)}
              </ul>
            </Card>
          ) : (
            <Card className="p-4 border-green-200 bg-green-50/40 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800">No outstanding compliance actions.</p>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
