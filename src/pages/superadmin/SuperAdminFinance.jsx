// ═══════════════════════════════════════════════════════════
// SETU — Super Admin · Finance Center
//
// Consolidated, real financial state + audited manual adjustments.
// Overview aggregates live tables (get_finance_overview); Escrow/Refunds
// read the real ledgers; Adjustments apply real money movements through
// record_financial_adjustment (finance.manage, audited). No mock data.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { IndianRupee, Wallet, Store, RotateCcw, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { FinanceAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { formatCurrency, timeAgo } from '@/lib/utils';

const rupee = (n) => formatCurrency(Number(n ?? 0));

export default function SuperAdminFinance() {
  const { can } = usePermissions();
  const canManage = can('finance.manage');

  const [tab, setTab]           = useState('escrow');
  const [overview, setOverview] = useState(null);
  const [escrow, setEscrow]     = useState([]);
  const [refunds, setRefunds]   = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Adjustment form
  const [form, setForm] = useState({ type: 'credit', targetKind: 'wallet', targetId: '', amount: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, es, rf, adj] = await Promise.all([
      FinanceAPI.overview(), FinanceAPI.escrow(), FinanceAPI.refunds(), FinanceAPI.adjustments(),
    ]);
    if (ov.error && es.error) { setError('Could not load finance data. Tap retry.'); setLoading(false); return; }
    setOverview(ov.data ?? null);
    setEscrow(es.data ?? []);
    setRefunds(rf.data ?? []);
    setAdjustments(adj.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitAdjustment = async () => {
    setFormMsg(null);
    if (!form.targetId.trim() || !form.amount || !form.reason.trim()) {
      setFormMsg({ ok: false, text: 'Target ID, amount and reason are required.' });
      return;
    }
    setBusy(true);
    const { data, error: e } = await FinanceAPI.recordAdjustment(form);
    if (e || !data?.success) {
      setFormMsg({ ok: false, text: e?.message ?? 'Adjustment failed' });
    } else {
      setFormMsg({ ok: true, text: `${form.type} of ${rupee(form.amount)} applied to ${form.targetKind}.` });
      setForm(f => ({ ...f, targetId: '', amount: '', reason: '' }));
      await load();
    }
    setBusy(false);
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto" role="main">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Finance Center</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Live platform finances. Adjustments move real money and are audit-logged.</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="GMV (30d)"          value={loading ? '…' : rupee(overview?.gmv_30d)}            icon={IndianRupee} accent />
          <StatCard title="Platform Earnings"  value={loading ? '…' : rupee(overview?.platform_earnings)}  icon={IndianRupee} />
          <StatCard title="Vendor Escrow"      value={loading ? '…' : rupee(overview?.escrow_balance)}     icon={Store} />
          <StatCard title="Wallet Float"       value={loading ? '…' : rupee(overview?.wallet_float)}       icon={Wallet} />
          <StatCard title="Credit Outstanding" value={loading ? '…' : rupee(overview?.credit_outstanding)} icon={IndianRupee} />
          <StatCard title="Refunds Paid"       value={loading ? '…' : rupee(overview?.refunds_completed)}  icon={RotateCcw} />
        </div>
        {overview?.pending_payouts_count > 0 && (
          <Card className="p-3 border-amber-300 bg-amber-50/60">
            <p className="text-xs text-amber-800">
              {overview.pending_payouts_count} payout(s) pending — {rupee(overview.pending_payouts_amount)}
            </p>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="escrow"  className="text-xs">Escrow</TabsTrigger>
            <TabsTrigger value="refunds" className="text-xs">Refunds</TabsTrigger>
            <TabsTrigger value="adjust"  className="text-xs">Adjustments</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" /> Retry</Button>
          </div>
        ) : tab === 'escrow' ? (
          escrow.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No vendor escrow yet.</p> : (
            <div className="space-y-2">
              {escrow.map(e => (
                <Card key={e.vendor_id} className="p-3 border-border flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.vendors?.name ?? e.vendor_id}</p>
                    <p className="text-[10px] text-muted-foreground">Credited {rupee(e.total_credited)} · Paid {rupee(e.total_paid_out)}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{rupee(e.balance)}</p>
                </Card>
              ))}
            </div>
          )
        ) : tab === 'refunds' ? (
          refunds.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No refunds.</p> : (
            <div className="space-y-2">
              {refunds.map(r => (
                <Card key={r.id} className="p-3 border-border flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{rupee(r.refund_amount)} · {r.refund_method}</p>
                    {r.cancel_reason && <p className="text-[10px] text-muted-foreground truncate">{r.cancel_reason}</p>}
                    <p className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Record adjustment */}
            {canManage ? (
              <Card className="p-4 border-border space-y-3">
                <p className="text-sm font-semibold">Record adjustment</p>
                <div className="flex gap-2">
                  {['credit','debit'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`flex-1 h-9 rounded-lg text-xs border ${form.type===t ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <select
                  value={form.targetKind}
                  onChange={e => setForm(f => ({ ...f, targetKind: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="wallet">Customer Wallet (user id)</option>
                  <option value="vendor_escrow">Vendor Escrow (vendor id)</option>
                  <option value="credit_account">Credit Account (user id)</option>
                </select>
                <Input placeholder="Target ID (UUID)" value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} className="h-9" />
                <Input type="number" placeholder="Amount (₹)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="h-9" />
                <Input placeholder="Reason (required, audited)" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="h-9" />
                {formMsg && (
                  <p className={`text-xs ${formMsg.ok ? 'text-green-700' : 'text-destructive'}`}>{formMsg.text}</p>
                )}
                <Button className="w-full" disabled={busy} onClick={submitAdjustment}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply adjustment'}
                </Button>
              </Card>
            ) : (
              <Card className="p-3 border-border flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">You don’t have permission to record adjustments (finance.manage).</p>
              </Card>
            )}

            {/* History */}
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No adjustments recorded.</p>
            ) : (
              <div className="space-y-2">
                {adjustments.map(a => (
                  <Card key={a.id} className="p-3 border-border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {a.adj_type} {rupee(a.amount)} · {a.target_kind.replace('_',' ')}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.reason}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{a.target_id}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(a.created_at)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
