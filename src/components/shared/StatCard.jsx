// ═══════════════════════════════════════════════════════════
// SETU — StatCard (production version)
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, className, accent }) {
  const trendPositive = trend === 'up';
  const trendNeutral  = trend === 'neutral' || !trend;

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 flex flex-col gap-1',
      accent && 'border-primary/20 bg-primary/5',
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</span>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', accent ? 'bg-primary/10' : 'bg-muted')}>
            <Icon className={cn('w-4 h-4', accent ? 'text-primary' : 'text-muted-foreground')} />
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-foreground">{value ?? '—'}</div>
      {(subtitle || trendValue) && (
        <div className="flex items-center gap-1 mt-0.5">
          {trend && !trendNeutral && (
            trendPositive
              ? <TrendingUp className="w-3 h-3 text-green-500" />
              : <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          {trendNeutral && trendValue && <Minus className="w-3 h-3 text-muted-foreground" />}
          {(trendValue || subtitle) && (
            <span className={cn(
              'text-xs',
              trendNeutral ? 'text-muted-foreground' : trendPositive ? 'text-green-600' : 'text-red-500'
            )}>
              {trendValue || subtitle}
            </span>
          )}
          {subtitle && trendValue && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
