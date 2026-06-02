import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AppHeader({ title, subtitle, showBack = false, backTo, notificationCount = 0, rightAction, className = '' }) {
  const navigate = useNavigate();
  return (
    <header className={`sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => backTo ? navigate(backTo) : navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-lg truncate">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-xs truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {rightAction}
          {notificationCount > 0 && (
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="notifications">
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] bg-destructive text-destructive-foreground">{notificationCount}</Badge>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}