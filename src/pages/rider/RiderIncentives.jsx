/**
 * RiderIncentives — Phase 0 wiring
 *
 * Database schema required (run once):
 * ─────────────────────────────────────────────────────────
 * create table if not exists rider_incentives (
 *   id           uuid primary key default gen_random_uuid(),
 *   rider_id     uuid not null references riders(id) on delete cascade,
 *   title        text not null,
 *   description  text,
 *   type         text not null check (type in ('daily','weekly','monthly','special')),
 *   target_value numeric not null,           -- deliveries, rating, or ₹ amount
 *   current_value numeric not null default 0,
 *   reward_amount numeric not null,
 *   status       text not null default 'active'
 *                  check (status in ('active','completed','expired')),
 *   starts_at    timestamptz not null default now(),
 *   ends_at      timestamptz,
 *   created_at   timestamptz not null default now()
 * );
 *
 * create table if not exists rider_badges (
 *   id         uuid primary key default gen_random_uuid(),
 *   rider_id   uuid not null references riders(id) on delete cascade,
 *   badge_key  text not null,               -- 'fast_delivery', 'top_earner', etc.
 *   earned_at  timestamptz not null default now(),
 *   unique (rider_id, badge_key)
 * );
 * ─────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Target, Zap, Gift, Star, Loader2, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { RiderAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const BADGE_META = {
  fast_delivery:      { label: 'Fast Delivery',      icon: Zap    },
  top_earner:         { label: 'Top Earner',         icon: Trophy },
  customer_favorite:  { label: 'Customer Favourite', icon: Gift   },
  five_star:          { label: 'Five Star',          icon: Star   },
  weekend_warrior:    { label: 'Weekend Warrior',    icon: TrendingUp },
};

export default function RiderIncentives() {
  const { user } = useAuth();

  const [riderId,     setRiderId]     = useState(null);
  const [rider,       setRider]       = useState(null);
  const [incentives,  setIncentives]  = useState([]);
  const [badges,      setBadges]      = useState([]);
  const [orderCount,  setOrderCount]  = useState(0);
  const [loading,     setLoading]     = useState(true);

  // ── Resolve rider + load data ────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    async function load() {
      setLoading(true);

      // 1. Resolve rider.id
      const { data: riderRow } = await RiderAPI.getProfile(user.id);
      if (!riderRow) { setLoading(false); return; }
      setRider(riderRow);
      setRiderId(riderRow.id);

      // 2. Incentives
      const { data: inc } = await supabase
        .from('rider_incentives')
        .select('*')
        .eq('rider_id', riderRow.id)
        .eq('status', 'active')
        .order('ends_at', { ascending: true });

      setIncentives(inc ?? []);

      // 3. Earned badges
      const { data: bdg } = await supabase
        .from('rider_badges')
        .select('badge_key, earned_at')
        .eq('rider_id', riderRow.id);

      setBadges(bdg ?? []);

      // 4. Completed orders this month (fallback metric for derived incentives)
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('rider_id', riderRow.id)
        .eq('status', 'delivered')
        .gte('created_at', monthStart.toISOString());

      setOrderCount(count ?? 0);
      setLoading(false);
    }

    load();
  }, [user?.id]);

  // ── Derived incentives when table is empty ───────────────
  const displayIncentives = useMemo(() => {
    if (incentives.length > 0) return incentives;

    // Fallback: compute from live order count + rider rating
    return [
      {
        id:           'derived-daily',
        title:        'Daily Star',
        description:  'Complete 10 deliveries today',
        type:         'daily',
        target_value: 10,
        current_value: Math.min(orderCount, 10),
        reward_amount: 50,
      },
      {
        id:           'derived-monthly',
        title:        'Monthly Champion',
        description:  'Complete 100 deliveries this month',
        type:         'monthly',
        target_value: 100,
        current_value: orderCount,
        reward_amount: 300,
      },
      {
        id:           'derived-rating',
        title:        'Top Rated',
        description:  'Maintain 4.8+ rating this month',
        type:         'monthly',
        target_value: 4.8,
        current_value: rider?.rating ?? 0,
        reward_amount: 200,
      },
    ];
  }, [incentives, orderCount, rider]);

  // ── Month total (base + incentives) ─────────────────────
  const monthIncentiveTotal = displayIncentives
    .filter(i => i.current_value >= i.target_value)
    .reduce((s, i) => s + Number(i.reward_amount), 0);

  const baseMonthly = rider?.total_earnings ?? 0;

  // ── Badge display (earned + known-not-earned) ────────────
  const earnedKeys   = new Set(badges.map(b => b.badge_key));
  const allBadgeKeys = Object.keys(BADGE_META);
  const badgeDisplay = allBadgeKeys.map(key => ({
    key,
    ...BADGE_META[key],
    earned: earnedKeys.has(key),
  }));

  if (loading) {
    return (
      <div className="pb-6">
        <AppHeader title="Incentives & Rewards" showBack />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <AppHeader title="Incentives & Rewards" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Summary card */}
        <Card className="p-4 border-border bg-primary/5 border-primary/20">
          <p className="text-xs text-muted-foreground">Total Earned This Month</p>
          <p className="text-3xl font-bold text-primary mt-1">
            ₹{(baseMonthly + monthIncentiveTotal).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Base: ₹{baseMonthly.toLocaleString()} + Incentives: ₹{monthIncentiveTotal.toLocaleString()}
          </p>
        </Card>

        {/* Active challenges */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Active Challenges
          </h3>
          <div className="space-y-3">
            {displayIncentives.map(inc => {
              const pct = Math.min(100, Math.round((Number(inc.current_value) / Number(inc.target_value)) * 100));
              const done = pct >= 100;
              return (
                <Card key={inc.id} className="p-4 border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{inc.title}</p>
                      <p className="text-xs text-muted-foreground">{inc.description}</p>
                    </div>
                    <Badge className={`border-0 text-xs shrink-0 ${done ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'}`}>
                      ₹{Number(inc.reward_amount).toLocaleString()} bonus
                    </Badge>
                  </div>
                  <Progress value={pct} className="h-2 mb-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{Number(inc.current_value)} / {Number(inc.target_value)}</span>
                    <span>{done ? '✓ Completed' : `${pct}% complete`}</span>
                  </div>
                  {inc.ends_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ends {new Date(inc.ends_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Badges */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Your Badges
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {badgeDisplay.map(b => (
              <Card
                key={b.key}
                className={`p-3 text-center border ${b.earned ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'}`}
              >
                <b.icon className={`w-6 h-6 mx-auto mb-1 ${b.earned ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-[10px] font-medium">{b.label}</p>
                {b.earned && (
                  <Badge className="text-[8px] mt-1 bg-primary/10 text-primary border-0">Earned</Badge>
                )}
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
