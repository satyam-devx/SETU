// ═══════════════════════════════════════════════════════════
// SETU — Notification Center (Admin)
//
// Compose, target, schedule and send notifications. Real end-to-end:
//   • create_campaign / dispatch_campaign / cancel_campaign RPCs
//   • audience resolved & counted server-side
//   • in_app delivered via notifications table; push via FCM Edge Fn
//   • gated by notifications.create; every action audit-logged
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, Send, Clock, Loader2, AlertCircle, RefreshCw, Lock, X, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/shared/StatusBadge';
import { NotificationCenterAPI, RBACAPI } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';

const LANGUAGES = [
  { key: 'hi',  label: 'Hindi' },
  { key: 'mai', label: 'Maithili' },
  { key: 'bho', label: 'Bhojpuri' },
  { key: 'en',  label: 'English' },
];
const TYPES = ['system', 'promo', 'scheme', 'credit', 'order'];

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors
        ${active ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
    >
      {children}
    </button>
  );
}

export default function AdminNotifications() {
  const { can } = usePermissions();
  const allowed = can('notifications.create');

  const [roles, setRoles]         = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Compose form
  const [name, setName]       = useState('');
  const [channel, setChannel] = useState('in_app');
  const [notifType, setType]  = useState('promo');
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [selRoles, setSelRoles]     = useState([]);
  const [selLangs, setSelLangs]     = useState([]);
  const [scheduleAt, setScheduleAt] = useState('');
  const [audienceCount, setAudienceCount] = useState(null);
  const [busy, setBusy]       = useState(false);
  const [formError, setFormError] = useState(null);
  const [notice, setNotice]   = useState(null);

  const audience = useMemo(() => {
    const a = {};
    if (selRoles.length) a.roles = selRoles;
    if (selLangs.length) a.languages = selLangs;
    return a;
  }, [selRoles, selLangs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [rolesRes, campRes] = await Promise.all([
      RBACAPI.getRoles(),
      NotificationCenterAPI.listCampaigns({ limit: 50 }),
    ]);
    if (campRes.error) { setError('Could not load campaigns. Tap retry.'); setLoading(false); return; }
    setRoles((rolesRes.data ?? []).filter(r => r.key !== 'super_admin' && r.key !== 'admin'));
    setCampaigns(campRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live audience preview (debounced).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await NotificationCenterAPI.audienceCount(audience);
      if (!cancelled) setAudienceCount(typeof data === 'number' ? data : null);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [audience]);

  const toggle = (list, setList, key) =>
    setList(list.includes(key) ? list.filter(x => x !== key) : [...list, key]);

  const resetForm = () => {
    setName(''); setTitle(''); setBody(''); setSelRoles([]); setSelLangs([]); setScheduleAt('');
  };

  const validate = () => {
    if (!name.trim()) return 'Campaign name is required';
    if (!title.trim()) return 'Title is required';
    if (!body.trim()) return 'Body is required';
    if (scheduleAt && channel !== 'in_app') return 'Only in-app campaigns can be scheduled';
    return null;
  };

  const submit = async (mode /* 'send' | 'schedule' */) => {
    const v = validate();
    if (v) { setFormError(v); return; }
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const scheduledAt = mode === 'schedule' && scheduleAt ? new Date(scheduleAt).toISOString() : null;
    const { data: created, error: e } = await NotificationCenterAPI.create({
      name, channel, title, body, notifType, audience, scheduledAt,
    });
    if (e || !created?.id) { setFormError(e?.message ?? 'Could not create campaign'); setBusy(false); return; }

    if (mode === 'send') {
      const { data: sent, error: de } = await NotificationCenterAPI.dispatch(created.id);
      if (de) { setFormError(de.message ?? 'Dispatch failed'); setBusy(false); await load(); return; }
      setNotice(
        sent?.pushWarning
          ? `Sent in-app to ${sent.targeted} users. Push warning: ${sent.pushWarning}`
          : `Sent to ${sent?.targeted ?? 0} recipients.`
      );
    } else {
      setNotice(`Scheduled for ${new Date(scheduledAt).toLocaleString()} · ${created.targeted_count ?? audienceCount ?? 0} recipients.`);
    }
    resetForm();
    setBusy(false);
    await load();
  };

  const cancel = async (id) => {
    await NotificationCenterAPI.cancel(id);
    await load();
  };

  if (!allowed) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 px-6 text-center" role="alert">
        <Lock className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You don’t have permission to send notifications.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto" role="main">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Notification Center</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Compose, target and send notifications. Actions are audit-logged.</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Compose */}
        <Card className="p-4 border-border space-y-3">
          <p className="text-sm font-semibold">New campaign</p>

          <Input placeholder="Campaign name (internal)" value={name} onChange={e => setName(e.target.value)} className="h-10" />

          <div className="flex gap-2">
            <Chip active={channel === 'in_app'} onClick={() => setChannel('in_app')}>In-app</Chip>
            <Chip active={channel === 'push'}   onClick={() => { setChannel('push'); setScheduleAt(''); }}>Push</Chip>
            <div className="flex gap-1 ml-auto items-center">
              {TYPES.map(t => <Chip key={t} active={notifType === t} onClick={() => setType(t)}>{t}</Chip>)}
            </div>
          </div>

          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="h-10" />
          <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={3} />

          <div>
            <p className="text-xs text-muted-foreground mb-1">Target roles <span className="opacity-60">(none = all roles)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {roles.map(r => (
                <Chip key={r.key} active={selRoles.includes(r.key)} onClick={() => toggle(selRoles, setSelRoles, r.key)}>
                  {r.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Target languages <span className="opacity-60">(none = all)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map(l => (
                <Chip key={l.key} active={selLangs.includes(l.key)} onClick={() => toggle(selLangs, setSelLangs, l.key)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>Estimated audience: <span className="font-semibold text-foreground">{audienceCount ?? '…'}</span> users</span>
          </div>

          {channel === 'in_app' && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} className="h-9" />
              {scheduleAt && <button onClick={() => setScheduleAt('')} className="text-muted-foreground"><X className="w-4 h-4" /></button>}
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{formError}</p>
            </div>
          )}
          {notice && (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700">{notice}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" disabled={busy} onClick={() => submit('send')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send now
            </Button>
            {channel === 'in_app' && (
              <Button variant="outline" className="flex-1 gap-2" disabled={busy || !scheduleAt} onClick={() => submit('schedule')}>
                <Clock className="w-4 h-4" /> Schedule
              </Button>
            )}
          </div>
        </Card>

        {/* History */}
        <div>
          <div className="section-header"><h3 className="section-title">Recent campaigns</h3>
            <button onClick={load} className="text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center" role="alert">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>Retry</Button>
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => (
                <Card key={c.id} className="p-3 border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span className="uppercase">{c.channel}</span>·<span>{c.notif_type}</span>·
                        <span>{c.sent_count}/{c.targeted_count} sent</span>
                        {c.scheduled_at && c.status === 'scheduled' && <span>· {new Date(c.scheduled_at).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={c.status} />
                      {['draft','scheduled'].includes(c.status) && (
                        <button onClick={() => cancel(c.id)} className="text-[10px] text-destructive hover:underline">Cancel</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
