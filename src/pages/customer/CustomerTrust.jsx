import React from 'react';
import { Shield, Star, Award, TrendingUp, CheckCircle, Users, Package, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { WALLET } from '@/lib/mockData';

const trustProfile = {
  name: 'Anita Devi',
  village: 'Madhepur',
  setuScore: 720,
  tier: 'Silver',
  memberSince: 'December 2024',
  ordersPlaced: 24,
  ordersDelivered: 23,
  disputesRaised: 1,
  disputesWon: 1,
  creditRepaymentRate: 100,
  onTimePayments: 8,
  referrals: 3,
  communityVotes: 12,
  anchorEndorsement: true,
};

const TIERS = [
  { name: 'Bronze', min: 0, max: 499, color: 'text-amber-700', bg: 'bg-amber-100', perks: ['Basic credit ₹1,000', 'Standard support'] },
  { name: 'Silver', min: 500, max: 699, color: 'text-gray-500', bg: 'bg-gray-100', perks: ['Credit ₹5,000', 'Priority support', 'Festival offers'] },
  { name: 'Gold', min: 700, max: 849, color: 'text-yellow-600', bg: 'bg-yellow-100', perks: ['Credit ₹15,000', 'Dedicated support', 'Early access'] },
  { name: 'Platinum', min: 850, max: 900, color: 'text-purple-600', bg: 'bg-purple-100', perks: ['Credit ₹30,000', 'VIP support', 'Referral bonuses'] },
];

const currentTier = TIERS.find(t => trustProfile.setuScore >= t.min && trustProfile.setuScore <= t.max);
const nextTier = TIERS[TIERS.indexOf(currentTier) + 1];

const scoreFactors = [
  { label: 'Order History (24 orders)', contribution: 250, max: 300, icon: Package },
  { label: 'Credit Repayment (100%)', contribution: 200, max: 200, icon: CheckCircle },
  { label: 'Community Standing', contribution: 150, max: 200, icon: Users },
  { label: 'Anchor Endorsement', contribution: 80, max: 100, icon: Shield },
  { label: 'Platform Activity', contribution: 40, max: 100, icon: TrendingUp },
];

const badgeEarned = [
  { icon: '🏆', name: 'First Order', desc: 'Placed your first order on SETU' },
  { icon: '💰', name: 'On-Time Payer', desc: '100% credit repayment rate' },
  { icon: '⭐', name: 'Trusted Customer', desc: '20+ orders without disputes' },
  { icon: '🤝', name: 'Community Builder', desc: 'Referred 3 new customers' },
];

export default function CustomerTrust() {
  const progressToNext = nextTier ? ((trustProfile.setuScore - currentTier.min) / (nextTier.min - currentTier.min)) * 100 : 100;

  return (
    <div className="pb-24">
      <AppHeader title="Trust & Reputation" subtitle="Your SETU standing" showBack />

      <div className="px-4 py-4 space-y-4">
        {/* Score card */}
        <Card className="bg-gradient-to-br from-foreground to-foreground/80 text-background p-5 rounded-2xl border-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs opacity-60 uppercase tracking-wide">SETU Trust Score</p>
              <h2 className="text-4xl font-bold mt-1">{trustProfile.setuScore}</h2>
              <p className="text-sm opacity-70 mt-1">out of 900</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full ${currentTier.bg}`}>
              <span className={`text-sm font-bold ${currentTier.color}`}>🏅 {currentTier.name}</span>
            </div>
          </div>
          {nextTier && (
            <div>
              <div className="flex justify-between text-xs opacity-60 mb-1">
                <span>{currentTier.name}</span>
                <span>{nextTier.min - trustProfile.setuScore} points to {nextTier.name}</span>
              </div>
              <Progress value={progressToNext} className="h-2 bg-white/20" />
            </div>
          )}
        </Card>

        {/* Score breakdown */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Score Breakdown</h3>
          <div className="space-y-3">
            {scoreFactors.map((factor, i) => {
              const Icon = factor.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate">{factor.label}</span>
                      <span className="font-bold shrink-0 ml-2">{factor.contribution}/{factor.max}</span>
                    </div>
                    <Progress value={(factor.contribution / factor.max) * 100} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Badges */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Earned Badges</h3>
          <div className="grid grid-cols-2 gap-2">
            {badgeEarned.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-xl">
                <span className="text-2xl">{badge.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{badge.name}</p>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tier benefits */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Tier Benefits</h3>
          <div className="space-y-3">
            {TIERS.map(tier => (
              <div key={tier.name} className={`p-3 rounded-xl border ${tier.name === currentTier.name ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${tier.color}`}>🏅 {tier.name}</span>
                  <span className="text-xs text-muted-foreground">{tier.min}–{tier.max} pts</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tier.perks.map(perk => (
                    <Badge key={perk} variant="outline" className="text-[9px]">{perk}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* How to improve */}
        <Card className="p-4 bg-accent/5 border-accent/20">
          <h3 className="font-semibold text-sm mb-2 text-accent">How to Improve Your Score</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>📦 Place more orders — each completed order adds 10-15 points</p>
            <p>💰 Always repay credit on time — late payments reduce 50 points</p>
            <p>🤝 Refer friends — each successful referral adds 25 points</p>
            <p>⭐ Leave honest reviews — active reviewers earn 5 pts/review</p>
            <p>🌱 Help your community — participate in village schemes</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
