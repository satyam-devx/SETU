import React from 'react';
import { Package, Gift, CreditCard, Bell, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AppHeader from '@/components/shared/AppHeader';
import { NOTIFICATIONS } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const typeIcons = { order: Package, promo: Gift, credit: CreditCard, system: Bell, scheme: FileText };

export default function CustomerNotifications() {
  return (
    <div className="pb-20">
      <AppHeader title="Notifications" showBack />
      <div className="px-4 py-3 space-y-2">
        {NOTIFICATIONS.map(n => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <Card key={n.id} className={cn('p-3 border-border', !n.isRead && 'bg-primary/5 border-primary/20')}>
              <div className="flex items-start gap-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', !n.isRead ? 'bg-primary/10' : 'bg-muted')}>
                  <Icon className={cn('w-4 h-4', !n.isRead ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate">{n.title}</h4>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}