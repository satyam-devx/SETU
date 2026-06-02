import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function MobileNav({ items }) {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className={cn('flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors min-w-0', isActive ? 'text-primary' : 'text-muted-foreground')}>
              <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}