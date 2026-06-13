// ═══════════════════════════════════════════════════════════
// SETU — AdminNotifications  (v3 — production-grade)
// Broadcast + targeted notifications with:
//   - Persistent broadcast history from DB
//   - Village targeting
//   - Role targeting
//   - Preview before send
//   - Delivery count
// Route: /admin/notifications
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback, useEffect } from 'react';
import {
  Bell, Send, Loader2, RefreshCw, Clock,
  Users, Store, Bike, Globe, MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const ROLE_OPTIONS = [
  { value: '',             label: '📣  Everyone',      icon: Globe },
  { value: 'customer',     label: '👤  Customers',     icon: Users },
  { value: 'vendor',       label: '🏪  Vendors',       icon: Store },
  { value: 'rider',        label: '🛵  Riders',        icon: Bike  },
  { value: 'seva_provider',label: '🔧  Seva Providers',icon: Users },
  { value: 'anchor',       label: '⚓  Anchors',       icon: Users },
];

const TYPE_OPTIONS = [
  { value: 'system',        label: 'System' },
  { value: 'promotional',   label: 'Promotional' },
  { value: 'alert',         label: 'Alert' },
  { value: 'order_update',  label: 'Order Update' },
  { value: 'payment',       label: 'Payment' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminNotifications() {
  const [tab,       setTab]       = useState('send');
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [type,      setType]      = useState('system');
  const [targetRole,setTargetRole]= useState('');
  const [villageId, setVillageId] = useState('');
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(null); // { count, error }

  const [history,   setHistory]   = useState([]);
  const [histLoad,  setHistLoad]  = useState(true);
  const [villages,  setVillages]  = useState([]);

  const loadHistory = useCallback(async () => {
    setHistLoad(true);
    const { data } = await supabase
      .from('notification_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data ?? []);
    setHistLoad(false);
  }, []);

  useEffect(() => {
    loadHistory();
    AdminAPI.getVillages().then(r => setVillages(r.data ?? []));
  }, [loadHistory]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSent(null);

    // 1. Broadcast notification to users
    const { data, error } = await AdminAPI.broadcastNotification({
      title,
      body,
      type,
      targetRole: targetRole || null,
      villageId:  villageId  || null,
    });

    // 2. Persist to broadcast log
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('notification_broadcasts').insert({
        actor_id:    userData?.user?.id ?? null,
        title,
        body,
        type,
        target_role: targetRole || null,
        village_id:  villageId  || null,
        sent_count:  data?.count ?? 0,
      });
      loadHistory();
    }

    setSent({ count: data?.count ?? 0, error });
    if (!error) {
      setTitle('');
      setBody('');
      setType('system');
      setTargetRole('');
      setVillageId('');
    }
    setSending(false);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Notifications"
        subtitle="Broadcast to users, vendors, riders, or everyone"
      />

      <div className="p-4 max-w-xl">
        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="send"    className="text-xs">Send New</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History ({history.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'send' && (
          <div className="space-y-4">
            <Card className="p-4 border-border space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Compose Notification
              </h3>

              <div>
                <Label className="text-xs mb-1 block">Title *</Label>
                <Input
                  placeholder="e.g. New feature available!"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="text-sm"
                  maxLength={100}
                />
                <p className="text-right text-[10px] text-muted-foreground mt-0.5">{title.length}/100</p>
              </div>

              <div>
                <Label className="text-xs mb-1 block">Message *</Label>
                <Textarea
                  placeholder="Write your message here…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="h-24 text-sm resize-none"
                  maxLength={500}
                />
                <p className="text-right text-[10px] text-muted-foreground mt-0.5">{body.length}/500</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Target Audience</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Everyone" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {villages.length > 0 && (
                <div>
                  <Label className="text-xs mb-1 block">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Limit to Village (optional)
                    </span>
                  </Label>
                  <Select value={villageId} onValueChange={setVillageId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All villages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All villages</SelectItem>
                      {villages.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview */}
              {(title || body) && (
                <div className="p-3 bg-muted/60 rounded-xl border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Preview</p>
                  <p className="text-sm font-semibold">{title || '(no title)'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{body || '(no message)'}</p>
                </div>
              )}

              {/* Sent result */}
              {sent && (
                <div className={`p-3 rounded-xl text-sm ${
                  sent.error
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {sent.error
                    ? `Failed to send: ${sent.error.message}`
                    : `✓ Notification sent to ${sent.count ?? 'all'} users`}
                </div>
              )}

              <Button
                className="w-full gap-2 h-10"
                disabled={!title.trim() || !body.trim() || sending}
                onClick={handleSend}
              >
                {sending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                {sending ? 'Sending…' : 'Send Notification'}
              </Button>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              {targetRole
                ? `Will be sent to all ${ROLE_OPTIONS.find(r => r.value === targetRole)?.label ?? targetRole}`
                : 'Will be sent to all platform users'}
              {villageId ? ` in ${villages.find(v => v.id === villageId)?.name ?? 'selected village'}` : ''}
              .
            </p>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={loadHistory}>
                <RefreshCw className={`w-3 h-3 ${histLoad ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {histLoad && (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
              </div>
            )}

            {!histLoad && history.length === 0 && (
              <Card className="p-6 border-dashed text-center">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No broadcasts yet</p>
              </Card>
            )}

            {history.map(n => (
              <Card key={n.id} className="p-3 border-border">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[9px]">{n.type}</Badge>
                    {n.target_role && (
                      <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">{n.target_role}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{n.body}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />{fmtDate(n.created_at)}
                  </span>
                  <span>{n.sent_count ?? 0} recipients</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
