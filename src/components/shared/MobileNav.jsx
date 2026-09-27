import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function MobileNav({ items }) {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-safe pointer-events-none max-w-lg mx-auto"
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto mb-2 rounded-[24px] border border-border/80 bg-card/90 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {items.map((item) => {
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
                  'relative min-h-[56px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-all duration-300 ease-out active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isActive && (
                  <span
                    className="absolute inset-x-2 inset-y-1 rounded-[16px] bg-primary/10 ring-1 ring-primary/10 animate-scale-in"
                    aria-hidden="true"
                  />
                )}

                <span className="relative z-10 w-9 h-7 flex items-center justify-center">
                  <item.icon
                    className={cn(
                      'w-[21px] h-[21px] transition-all duration-300',
                      isActive ? 'scale-110 stroke-[2.4]' : 'scale-100 stroke-[1.8]'
                    )}
                    aria-hidden="true"
                  />
                  {item.badge != null && item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold border-2 border-card shadow-sm"
                      aria-label={`${item.badge} new`}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>

                <span className={cn(
                  'relative z-10 text-[10px] leading-none transition-all duration-300',
                  isActive ? 'font-bold opacity-100 translate-y-0' : 'font-medium opacity-75 translate-y-0.5'
                )}>
                  {item.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
