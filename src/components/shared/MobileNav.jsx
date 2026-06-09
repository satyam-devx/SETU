// ═══════════════════════════════════════════════════════════
// SETU — MobileNav (v2)
// Fixes:
//  - Badge positioning was using absolute but parent had no relative
//  - Added proper active state logic (exact vs prefix)
//  - Touch target minimum 44px
//  - Proper ARIA roles: nav, aria-label, aria-current
//  - Safe area bottom padding for notched phones
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function MobileNav({ items }) {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border pb-safe max-w-lg mx-auto"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around px-1">
        {items.map((item) => {
          // Exact match for root portal paths, prefix match for sub-pages
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname === item.path ||
              (item.path.length > 1 && location.pathname.startsWith(item.path + '/'));

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors min-w-0 min-h-[44px] justify-center',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {/* Badge */}
              {item.badge != null && item.badge > 0 && (
                <span
                  className="absolute top-1.5 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold z-10"
                  aria-label={`${item.badge} new`}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
              <item.icon
                className={cn('w-5 h-5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden="true"
              />
              <span className={cn(
                'text-[10px] font-medium truncate transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
