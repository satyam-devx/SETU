import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Star, TrendingUp, CheckCircle, Lock, Gift, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';

const SCORE_TIERS = [
  { min: 0,   max: 399, label: 'Starter',  color: 'text-gray-500',   bg: 'bg-gray-100' },
  { min: 400, max: 599, label: 'Bronze',   color: 'text-amber-700',  bg: 'bg-amber-100' },
  { min: 600, max: 749, label: 'Silver',   color: 'text-slate-500',  bg: 'bg-slate-100' },
  { min: 750, max: 849, label: 'Gold',     color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { min: 850, max: 999, label: 'Platinum', color: 'text-purple-600', bg: 'bg-purple-100' },
];

const SCORE_FACTORS = [
  { label: 'Order History',          contribution: 35, score: 90, description: '12 orders, 0 cancellations' },
  { label: 'Payment Behaviour',      contribution: 25, score: 95, description: 'All payments on time' },
  { label: 'Platform Engagement',    contribution: 20, score: 75, description: 'Moderate activity' },
  { label: 'Community Standing',     contribution: 10, score: 80, description: 'No disputes raised' },
  { label: 'KYC Completeness',       contribution: 10, score: 100,description: 'Aadhaar verified' },
];

const PERKS = [
  { tier: 'Bronze',   perks: ['Access to SETU Credit', 'Priority delivery'] },
  { tier: 'Silver',   perks: ['Higher credit limit', 'Festival discounts', 'Early scheme access'] },
  { tier: 'Gold',     perks: ['Premium vendor access', '2x referral bonus', 'Credit interest waiver'] },
  { tier: 'Platinum', perks: ['All benefits', 'Dedicated support', 'Beta features first'] },
];

export default function CustomerTrust() {
  const { state }  = useStore();
  const score      = state.currentUser.setuScore;
  const tier       = SCORE_TIERS.find(t => score >= t.min && score <= t.max) || SCORE_TIERS[0];
  const nextTier   = SCORE_TIERS[SCORE_TIERS.findIndex(t => t.label === tier.label) + 1];
  const pctToNext  = nextTier ? Math.round(((score - tier.min) / (nextTier.min - tier.min)) * 100) : 100;

  return (
    <div className="pb-6">
      <AppHeader title="SETU Trust Score" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Score hero */}
        <Card className="p-6 border-border text-center bg-gradient-to-b from-primary/5 to-background">
          <div className="w-24 h-24 rounded-full border-4 border-primary mx-auto flex items-center justify-center mb-3">
            <div>
              <p className="text-3xl font-bold text-primary">{score}</p>
              <p className="text-[10px] text-muted-foreground">/ 999</p>
            </div>
          </div>
          <Badge className={`text-sm px-4 py-1 border-0 ${tier.bg} ${tier.color}`}>
            {tier.label} Member
          </Badge>
          {nextTier && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{tier.label}</span>
                <span>{nextTier.label} at {nextTier.min}</span>
              </div>
              <Progress value={pctToNext} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{nextTier.min - score} points to {nextTier.label}</p>
            </div>
          )}
        </Card>

        {/* Score factors */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Score Breakdown
          </h3>
          <div className="space-y-3">
            {SCORE_FACTORS.map(f => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <span className="text-xs font-medium">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({f.contribution}% weight)</span>
                  </div>
                  <span className="text-xs font-bold text-green-600">{f.score}/100</span>
                </div>
                <Progress value={f.score} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Current perks */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" /> Your {tier.label} Perks
          </h3>
          <div className="space-y-1.5">
            {(PERKS.find(p => p.tier === tier.label)?.perks || []).map(perk => (
              <div key={perk} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* How to improve */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" /> Improve Your Score
          </h3>
          <div className="space-y-2">
            {[
              { action: 'Complete more orders',       points: '+5 pts/order',  path: '/customer' },
              { action: 'Repay SETU Credit on time',  points: '+10 pts',       path: '/customer/credit' },
              { action: 'Refer a friend',             points: '+15 pts',       path: '/customer/referral' },
              { action: 'Complete profile',           points: '+20 pts',       path: '/customer/profile' },
            ].map(item => (
              <Link key={item.action} to={item.path}>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <span className="text-sm">{item.action}</span>
                  <div className="flex items-center gap-1">
                    <Badge className="text-[9px] bg-green-100 text-green-700 border-0">{item.points}</Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
