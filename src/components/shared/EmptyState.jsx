// ═══════════════════════════════════════════════════════════
// SETU — EmptyState (production version)
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  actionLabel,
  className,
  size = 'md',
}) {
  const sizes = {
    sm: { wrapper: 'py-8', iconWrap: 'w-10 h-10', emoji: 'text-2xl', title: 'text-sm', desc: 'text-xs' },
    md: { wrapper: 'py-12', iconWrap: 'w-14 h-14', emoji: 'text-3xl', title: 'text-base', desc: 'text-sm' },
    lg: { wrapper: 'py-16', iconWrap: 'w-16 h-16', emoji: 'text-4xl', title: 'text-lg', desc: 'text-sm' },
  }[size];

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center px-4', sizes.wrapper, className)}>
      <div className={cn('rounded-2xl bg-muted flex items-center justify-center', sizes.iconWrap)}>
        {emoji
          ? <span className={sizes.emoji}>{emoji}</span>
          : Icon
          ? <Icon className="w-6 h-6 text-muted-foreground" />
          : <span className={sizes.emoji}>📭</span>
        }
      </div>
      {title       && <p className={cn('font-semibold text-foreground', sizes.title)}>{title}</p>}
      {description && <p className={cn('text-muted-foreground max-w-xs', sizes.desc)}>{description}</p>}
      {action && actionLabel && (
        <button
          onClick={action}
          className="mt-1 text-sm text-primary font-medium underline underline-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
