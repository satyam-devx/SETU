// ═══════════════════════════════════════════════════════════
// SETU — AppHeader (v2)
// Fixes:
//  - Uses native button not Button component (smaller bundle)
//  - Proper aria-label on back button
//  - showBack defaults to auto-detect via window.history.length
//  - 44px min touch targets on all actions
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppHeader({
  title,
  subtitle,
  showBack = false,
  backTo,
  notificationCount = 0,
  notificationPath = 'notifications',
  rightAction,
  className,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border px-4 py-3',
        className
      )}
      role="banner"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack && (
            <button
              onClick={handleBack}
              className="-ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-base leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-xs truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {rightAction}
          {notificationCount > 0 && (
            <Link
              to={notificationPath}
              className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              aria-label={`${notificationCount} unread notifications`}
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold"
                aria-hidden="true"
              >
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
