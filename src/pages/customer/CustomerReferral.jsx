import React from 'react';
import { Gift, Clock3, Users, Sparkles, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AppHeader from '@/components/shared/AppHeader';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function CustomerReferral() {
  useFeatureFlag('referral');

  return (
    <div className="pb-8 min-h-screen">
      <AppHeader title="Refer & Earn" subtitle="Invite your friends to SETU" showBack />

      <div className="px-4 pt-4 space-y-4">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary via-orange-600 to-amber-500 text-white p-6 shadow-lg">
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-5">
              <Gift className="w-7 h-7" aria-hidden="true" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-white/70">Coming to SETU</p>
            <h1 className="text-2xl font-bold mt-1">Share SETU with your circle</h1>
            <p className="text-sm text-white/80 mt-2 max-w-[30rem]">
              Invite friends and family once referrals launch. Rewards, referral history and your invite link will appear here automatically.
            </p>
          </div>
        </div>

        <Card className="rounded-2xl border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What you'll get</p>
          </div>
          <div className="divide-y divide-border/70">
            {[
              [Users, 'Personal invite link', 'A shareable link for friends and family'],
              [Sparkles, 'Referral rewards', 'Rewards will be shown only after the programme is live'],
              [Gift, 'Referral history', 'Track successful invites and earned rewards'],
            ].map(([Icon, title, desc]) => (
              <div key={title} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0" aria-hidden="true" />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
          <Clock3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>No referral code or reward balance is active yet.</span>
        </div>
      </div>
    </div>
  );
}
