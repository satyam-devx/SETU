import React from 'react';
import { CreditCard, Smartphone, Wallet, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentSheet({
  onSelect,
  selectedId,
  walletBalance = 0,
  creditAvailable = 0,
  totalAmount = 0
}) {
  const methods = [
    { id: 'cod',    label: 'Cash on Delivery', sub: 'Pay when order arrives', icon: CreditCard },
    { id: 'upi',    label: 'UPI Payment',      sub: 'Google Pay, PhonePe, BHIM', icon: Smartphone },
    {
      id: 'wallet',
      label: 'SETU Wallet',
      sub: `Balance: ₹${walletBalance.toLocaleString()}`,
      icon: Wallet,
      disabled: walletBalance < totalAmount
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">Payment Method</h3>
        <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
          <ShieldCheck className="w-3 h-3" /> Secure
        </div>
      </div>

      <div className="space-y-2">
        {methods.map(pm => (
          <button
            key={pm.id}
            onClick={() => !pm.disabled && onSelect(pm.id)}
            disabled={pm.disabled}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              selectedId === pm.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:bg-muted/40'
            } ${pm.disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              selectedId === pm.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <pm.icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{pm.label}</p>
              <p className="text-[11px] text-muted-foreground">{pm.sub}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
              selectedId === pm.id ? 'border-primary bg-primary' : 'border-border'
            }`}>
              {selectedId === pm.id && <div className="w-1.5 h-1.5 rounded-full bg-white mx-auto mt-0.5" />}
            </div>
          </button>
        ))}
      </div>

      {creditAvailable > 0 && (
        <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-accent">SETU Credit Available</p>
            <p className="text-sm font-bold">₹{creditAvailable.toLocaleString()}</p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[10px] border-accent/30 text-accent hover:bg-accent/10">
            Apply Credit
          </Button>
        </div>
      )}
    </div>
  );
}
