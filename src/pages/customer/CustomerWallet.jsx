import React from 'react';
import { CreditCard, ArrowUpRight, ArrowDownLeft, Gift, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { WALLET } from '@/lib/mockData';

export default function CustomerWallet() {
  return (
    <div className="pb-20">
      <AppHeader title="Wallet & Credit" />

      {/* Balance card */}
      <div className="px-4 py-4">
        <Card className="bg-gradient-to-br from-foreground to-foreground/80 text-background p-5 rounded-2xl border-0">
          <p className="text-xs opacity-70 uppercase tracking-wide">SETU Wallet Balance</p>
          <h2 className="text-3xl font-bold mt-1">₹{WALLET.balance.toLocaleString()}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Gift className="w-3 h-3 opacity-70" />
            <span className="text-xs opacity-70">{WALLET.setuCredits} SETU Credits</span>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
              <ArrowDownLeft className="w-3 h-3 mr-1" /> Add Money
            </Button>
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
              <ArrowUpRight className="w-3 h-3 mr-1" /> Send
            </Button>
          </div>
        </Card>
      </div>

      {/* SETU Credit */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">SETU Credit</h3>
              <p className="text-xs text-muted-foreground">Buy now, pay later</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Used ₹{WALLET.creditUsed} of ₹{WALLET.creditLimit}</span>
            <span className="text-xs font-medium">Score: {WALLET.creditScore}</span>
          </div>
          <Progress value={(WALLET.creditUsed / WALLET.creditLimit) * 100} className="h-2" />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">Available: ₹{WALLET.creditLimit - WALLET.creditUsed}</span>
            <Button variant="outline" size="sm" className="text-xs h-7">Repay</Button>
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <div className="px-4">
        <h3 className="font-semibold text-foreground mb-3">Recent Transactions</h3>
        <div className="space-y-2">
          {WALLET.transactions.map(txn => (
            <Card key={txn.id} className="p-3 border-border">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${txn.type === 'credit' ? 'bg-green-100' : 'bg-red-50'}`}>
                  {txn.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{txn.description}</p>
                  <p className="text-[10px] text-muted-foreground">{txn.date}</p>
                </div>
                <span className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-foreground'}`}>
                  {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}