import React from 'react';
import { Bell, ShoppingBag, Wallet, Tag, Info, CheckCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';

const typeIcon = { order: ShoppingBag, credit: Wallet, promo: Tag, scheme: Info, system: Bell };
const typeColor = {
  order:  'bg-primary/10 text-primary',
  credit: 'bg-green-100 text-green-700',
  promo:  'bg-amber-100 text-amber-700',
  scheme: 'bg-blue-100 text-blue-700',
  system: 'bg-muted text-muted-foreground',
};

export default function CustomerNotifications() {
  const { state, dispatch } = useStore();
  const { notifications, unreadCount } = { notifications: state.notifications, unreadCount: state.unreadCount };

  const markRead = (id) => dispatch({ type: 'NOTIFICATION_READ', payload: { id } });
  const markAll  = () => dispatch({ type: 'NOTIFICATIONS_READ_ALL' });

  return (
    <div className="pb-6">
      <AppHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        showBack
        rightAction={
          unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={markAll}>
              <CheckCheck className="w-3 h-3" /> Mark all read
            </Button>
          )
        }
      />
      <div className="px-4 py-3 space-y-2">
        {notifications.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </Card>
        ) : (
          notifications.map(n => {
            const Icon = typeIcon[n.type] || Bell;
            return (
              <Card
                key={n.id}
                className={`p-3 border cursor-pointer transition-colors ${n.isRead ? 'border-border' : 'border-primary/30 bg-primary/5'}`}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${typeColor[n.type] || typeColor.system}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
