// SETU — Premium app header
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
  eyebrow,
  tone = 'default',
}) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const isAccent = tone === 'accent';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 px-3 pt-2.5 pb-2.5',
        'bg-background/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/65',
        className
      )}
      role="banner"
    >
      <div className={cn(
        'relative overflow-hidden rounded-[22px] border shadow-[0_8px_30px_rgba(30,20,10,0.08)]',
        'px-2.5 py-2.5',
        isAccent
          ? 'border-primary/20 bg-gradient-to-br from-primary/[0.10] via-card to-card'
          : 'border-border/70 bg-card/90'
      )}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex items-center gap-2">
          {showBack ? (
            <button
              onClick={handleBack}
              className="touch-target w-10 h-10 rounded-[14px] border border-border/70 bg-background/75 flex items-center justify-center text-foreground shadow-sm transition-all active:scale-95 hover:border-primary/30 hover:bg-primary/5 shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          ) : (
            <div className="w-1 h-8 rounded-full bg-primary/80 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1 py-0.5">
            {eyebrow && <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/80 truncate">{eyebrow}</p>}
            <h1 className="font-bold text-[16px] leading-tight truncate tracking-tight">{title}</h1>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {rightAction}
            {notificationCount > 0 && (
              <Link
                to={notificationPath}
                className="relative w-10 h-10 rounded-[14px] border border-border/70 bg-background/75 flex items-center justify-center text-muted-foreground shadow-sm transition-all active:scale-95 hover:text-primary hover:border-primary/30"
                aria-label={`${notificationCount} unread notifications`}
              >
                <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center font-bold border-2 border-card">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
