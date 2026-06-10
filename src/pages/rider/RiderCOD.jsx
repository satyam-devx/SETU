import React, { useState, useEffect } from 'react';
import {
  IndianRupee, CheckCircle, Clock, AlertCircle,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { RiderAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const STATUS_CONFIG = {
  pending_confirmation: { label: 'Pending',   color: 'bg-amber-100 text-amber-700' },
  confirmed:            { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  rejected:             { label: 'Rejected',  color: 'bg-red-100 text-red-700'     },
};

const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10];

export default function RiderCOD() {
  const { user } = useAuth();

  // ── Resolve riders.id ────────────────────────────────────
  const [riderId,  setRiderId]  = useState(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    RiderAPI.getProfile(user.id).then(({ data }) => {
      if (data?.id) setRiderId(data.id);
      setResolving(false);
    });
  }, [user?.id]);

  // ── Data state ───────────────────────────────────────────
  const [deposits,       setDeposits]       = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);
  const [codBalance,     setCodBalance]     = useState(0);

  const [showForm,       setShowForm]       = useState(false);
  const [amount,         setAmount]         = useState('');
  const [denomMap,       setDenomMap]       = useState({});
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState(null);
  const [submitSuccess,  setSubmitSuccess]  = useState(false);

  // ── Load COD balance + deposit history ───────────────────
  useEffect(() => {
    if (!riderId) return;

    async function loadData() {
      setLoadingDeposits(true);

      // COD balance from riders table — keyed by riders.id (PK)
      const { data: riderRow } = await supabase
        .from('riders')
        .select('cod_balance')
        .eq('id', riderId)
        .single();

      if (riderRow) setCodBalance(riderRow.cod_balance ?? 0);

      // Deposit history — rider_id FK is riders.id
      const { data: deps } = await supabase
        .from('cod_deposits')
        .select('*')
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false })
        .limit(20);

      setDeposits(deps ?? []);
      setLoadingDeposits(false);
    }

    loadData();

    // Realtime: update when admin confirms/rejects
    const channel = supabase
      .channel(`cod-deposits-${riderId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'cod_deposits',
        filter: `rider_id=eq.${riderId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDeposits(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setDeposits(prev =>
            prev.map(d => d.id === payload.new.id ? payload.new : d)
          );
          if (payload.new.status === 'confirmed') {
            setCodBalance(0);
          }
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [riderId]);

  // ── Denomination helpers ─────────────────────────────────
  const computedDenomTotal = Object.entries(denomMap).reduce(
    (sum, [denom, count]) => sum + Number(denom) * Number(count || 0),
    0
  );

  const handleDenomChange = (denom, value) => {
    const count = parseInt(value, 10);
    const safeCount = isNaN(count) || count < 0 ? 0 : count;
    const newMap = { ...denomMap, [denom]: safeCount };
    setDenomMap(newMap);
    const newTotal = Object.entries(newMap).reduce(
      (s, [d, c]) => s + Number(d) * Number(c || 0), 0
    );
    if (newTotal > 0) setAmount(String(newTotal));
  };

  // ── Submit deposit ────────────────────────────────────────
  const handleSubmit = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setSubmitError('Please enter a valid deposit amount.');
      return;
    }
    if (n > codBalance) {
      setSubmitError(`Deposit amount (₹${n}) cannot exceed COD balance (₹${codBalance}).`);
      return;
    }
    if (!riderId) {
      setSubmitError('Rider profile not loaded. Please try again.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      rider_id:   riderId,
      amount:     n,
      status:     'pending_confirmation',
      created_at: new Date().toISOString(),
      ...(computedDenomTotal > 0 ? { denomination_breakdown: denomMap } : {}),
    };

    const { error } = await supabase.from('cod_deposits').insert(payload);

    if (error) {
      setSubmitError(error.message ?? 'Submission failed. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitSuccess(true);
    setShowForm(false);
    setAmount('');
    setDenomMap({});
    setTimeout(() => setSubmitSuccess(false), 4000);
    setSubmitting(false);
  };

  if (resolving) {
    return (
      <div className="pb-20">
        <AppHeader title="COD Deposit" subtitle="Cash on Delivery Management" showBack />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <AppHeader title="COD Deposit" subtitle="Cash on Delivery Management" showBack />

      <div className="px-4 py-4 space-y-4">

        {/* Balance card */}
        <Card className="p-5 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Current COD Balance
          </p>
          <div className="flex items-baseline gap-1">
            <IndianRupee className="w-6 h-6 text-primary" />
            <p className="text-4xl font-bold text-primary">{codBalance.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Collected from cash-on-delivery orders. Deposit before end of shift.
          </p>
          {submitSuccess && (
            <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Deposit submitted. Pending admin confirmation.
            </p>
          )}
        </Card>

        {/* Submit deposit form */}
        <Card className="p-4 border-border">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowForm(v => !v)}
          >
            <p className="font-semibold text-sm">Submit Cash Deposit</p>
            {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showForm && (
            <div className="mt-4 space-y-4">
              {submitError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{submitError}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Deposit Amount (₹)
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="text-lg font-bold"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Denomination Breakdown (optional)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DENOMINATIONS.map(denom => (
                    <div key={denom} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-12 shrink-0">₹{denom}</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denomMap[denom] || ''}
                        onChange={e => handleDenomChange(denom, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
                {computedDenomTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Denomination total: ₹{computedDenomTotal.toLocaleString()}
                    {computedDenomTotal !== parseFloat(amount) && amount && (
                      <span className="text-amber-600 ml-2">⚠ Doesn't match amount</span>
                    )}
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || !amount || parseFloat(amount) <= 0}
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                  : `Submit ₹${parseFloat(amount) || 0} Deposit`}
              </Button>
            </div>
          )}
        </Card>

        {/* Deposit history */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Deposit History</h3>

          {loadingDeposits ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
            </div>
          ) : deposits.length === 0 ? (
            <Card className="p-4 text-center border-border">
              <p className="text-sm text-muted-foreground">No deposits yet</p>
            </Card>
          ) : (
            deposits.map(dep => {
              const cfg  = STATUS_CONFIG[dep.status] ?? STATUS_CONFIG.pending_confirmation;
              const date = new Date(dep.created_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              });
              return (
                <Card key={dep.id} className="p-3 border-border mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">₹{Number(dep.amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {date}
                      </p>
                    </div>
                    <Badge className={`text-[9px] border-0 ${cfg.color}`}>{cfg.label}</Badge>
                  </div>
                  {dep.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">{dep.rejection_reason}</p>
                  )}
                  {dep.admin_confirmed_at && (
                    <p className="text-xs text-green-600 mt-1">
                      Confirmed {new Date(dep.admin_confirmed_at).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
