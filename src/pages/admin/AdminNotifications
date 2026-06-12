// ═══════════════════════════════════════════════════════════
// SETU — AdminNotifications
// Broadcast notifications to all users, by role, or by village.
// Writes to notifications table → FCM trigger picks it up.
// Route: /admin/notifications
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  Bell, Send, RefreshCw, Loader2, CheckCircle2,
  Users, MapPin, Tag, AlertCircle, Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const NOTIFICATION_TYPES = [
  { value: 'system',  label: 'System',      desc: 'Platform updates and announcements', icon: '🔔' },
  { value: 'promo',   label: 'Promotion',   desc: 'Offers, discounts, campaigns',       icon: '🎉' },
  { value: 'scheme',  label: 'Scheme',      desc: 'Government or platform schemes',     icon: '📋' },
  { value: 'alert',   label: 'Alert',       desc: 'Urgent service alerts',              icon: '⚠️' },
  { value: 'order',   label: 'Order',       desc: 'Order-related updates',              icon: '📦' },
];

const ROLE_OPTIONS = [
  { value: '',               label: 'All Users'       },
  { value: 'customer',       label: 'Customers only'  },
  { value: 'vendor',         label: 'Vendors only'    },
  { value: 'rider',          label: 'Riders only'     },
  { value: 'seva_provider',  label: 'Seva Providers'  },
  { value: 'anchor',         label: 'Village Anchors' },
];

const EMPTY = { title: '', body: '', type: 'system', targetRole: '', villageId: '' };

// Recent broadcasts — simple in-memory log for this session
let broadcastLog = [];

export default function AdminNotifications() {
  const [form,    setForm]    = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState(null);  // { sent: N } | null
  const [sendErr, setSendErr] = useState(null);
  const [log,     setLog]     = useState(broadcastLog);

  const { data: villages } = useDataFetch(
    () => AdminAPI.getVillages(),
    [],
    { cacheKey: 'admin-villages-list' }
  );

  const setF = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setResult(null);
    setSendErr(null);
  };

  const selectedType = NOTIFICATION_TYPES.find(t => t.value === form.type);

  const handleSend = async () => {
    if (!form.title.trim()) { setSendErr('Title is required'); return; }
    if (!form.body.trim())  { setSendErr('Message body is required'); return; }

    setSending(true);
    setSendErr(null);

    const payload = {
      title:      form.title.trim(),
      body:       form.body.trim(),
      type:       form.type,
      targetRole: form.targetRole || null,
      villageId:  form.villageId  || null,
    };

    const { data, error } = await AdminAPI.broadcastNotification(payload);

    if (error) {
      setSendErr(error.message ?? 'Failed to send notification');
      setSending(false);
      return;
    }

    const logEntry = {
      id:          Date.now(),
      title:       form.title,
      body:        form.body,
      type:        form.type,
      targetRole:  form.targetRole || 'all',
      villageName: villages?.find(v => v.id === form.villageId)?.name ?? 'all villages',
      sent:        data?.sent ?? 0,
      sentAt:      new Date().toLocaleTimeString('en-IN'),
    };
    broadcastLog = [logEntry, ...broadcastLog.slice(0, 19)];
    setLog([...broadcastLog]);
    setResult(data);
    setForm(EMPTY);
    setSending(false);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Notifications"
        subtitle="Send push notifications to users"
      />

      <div className="p-5 space-y-5 max-w-2xl">

        {/* ── Compose form ──────────────────────────────── */}
        <Card className="p-5 border-border space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Compose Notification
          </h3>

          {sendErr && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {sendErr}
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Notification sent to <span className="font-semibold">{result.sent}</span> user{result.sent !== 1 ? 's' : ''}
            </div>
          )}

          {/* Notification type */}
          <div>
            <Label className="text-xs mb-1.5 block">Type</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {NOTIFICATION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setF('type', t.value)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    form.type === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-xl mb-1">{t.icon}</div>
                  <div className="text-[10px] font-medium">{t.label}</div>
                </button>
              ))}
            </div>
            {selectedType && (
              <p className="text-xs text-muted-foreground mt-1.5">{selectedType.desc}</p>
            )}
          </div>

          <Separator />

          {/* Title */}
          <div>
            <Label className="text-xs mb-1 block">Title *</Label>
            <Input
              placeholder="e.g. Diwali Special Offer 🎁"
              value={form.title}
              maxLength={60}
              onChange={e => setF('title', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{form.title.length}/60</p>
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs mb-1 block">Message *</Label>
            <Textarea
              placeholder="e.g. Get 20% off on all orders above ₹200 today only. Tap to explore."
              value={form.body}
              maxLength={160}
              className="h-20 text-sm resize-none"
              onChange={e => setF('body', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{form.body.length}/160</p>
          </div>

          <Separator />

          {/* Audience */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Target Audience</Label>
              <Select value={form.targetRole} onValueChange={v => setF('targetRole', v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Target Village (optional)</Label>
              <Select value={form.villageId} onValueChange={v => setF('villageId', v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Villages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Villages</SelectItem>
                  {(villages ?? []).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Audience summary */}
          <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              This will notify{' '}
              <span className="font-semibold text-foreground">
                {form.targetRole
                  ? ROLE_OPTIONS.find(r => r.value === form.targetRole)?.label
                  : 'all users'}
              </span>
              {form.villageId
                ? ` in ${villages?.find(v => v.id === form.villageId)?.name ?? 'selected village'}`
                : ' across all villages'}.
              {' '}Notifications are delivered via in-app feed and FCM push (if FCM token is registered).
            </div>
          </div>

          <Button
            className="w-full gap-2"
            disabled={sending || !form.title.trim() || !form.body.trim()}
            onClick={handleSend}
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
              : <><Send className="w-4 h-4" />Send Notification</>}
          </Button>
        </Card>

        {/* ── Broadcast Log ─────────────────────────────── */}
        {log.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              Recent Broadcasts (this session)
            </h3>
            <div className="space-y-2">
              {log.map(entry => (
                <Card key={entry.id} className="p-3 border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.body}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{entry.type}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />{entry.targetRole}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{entry.villageName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">{entry.sent}</p>
                      <p className="text-[10px] text-muted-foreground">sent</p>
                      <p className="text-[10px] text-muted-foreground">{entry.sentAt}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
