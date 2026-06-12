// ═══════════════════════════════════════════════════════════
// SETU — AdminBanners
// Homepage CMS: add/edit/delete promotional banners.
// Fields: title, subtitle, image_url, link, bg_color,
// village targeting, active dates, sort_order, is_active.
// Route: /admin/banners
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Image,
  RefreshCw, ToggleLeft, Link2, MapPin, Calendar
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

const COLOR_PRESETS = [
  { label: 'Orange',  value: '#f97316' },
  { label: 'Green',   value: '#16a34a' },
  { label: 'Blue',    value: '#2563eb' },
  { label: 'Purple',  value: '#7c3aed' },
  { label: 'Red',     value: '#dc2626' },
  { label: 'Teal',    value: '#0d9488' },
  { label: 'Custom',  value: 'custom'  },
];

const EMPTY = {
  title: '', subtitle: '', image_url: '', link: '',
  village_id: null, sort_order: 1, bg_color: '#f97316',
  is_active: true, active_from: '', active_to: '',
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminBanners() {
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [saveErr,  setSaveErr]  = useState(null);
  const [colorMode, setColorMode] = useState('preset'); // 'preset' | 'custom'

  const { data: banners, isLoading, refetch } = useDataFetch(
    () => AdminAPI.getBanners(),
    [],
    { cacheKey: 'admin-banners' }
  );

  const { data: villages } = useDataFetch(
    () => AdminAPI.getVillages(),
    [],
    { cacheKey: 'admin-villages-list' }
  );

  const rows = banners ?? [];

  const openAdd = () => {
    const maxSort = rows.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    setForm({ ...EMPTY, sort_order: maxSort + 1 });
    setEditing(null);
    setSaveErr(null);
    setColorMode('preset');
    setModal(true);
  };

  const openEdit = (b) => {
    setForm({
      id:          b.id,
      title:       b.title,
      subtitle:    b.subtitle ?? '',
      image_url:   b.image_url ?? '',
      link:        b.link ?? '',
      village_id:  b.village_id ?? null,
      sort_order:  b.sort_order ?? 1,
      bg_color:    b.bg_color ?? '#f97316',
      is_active:   b.is_active,
      active_from: b.active_from ? b.active_from.split('T')[0] : '',
      active_to:   b.active_to   ? b.active_to.split('T')[0]   : '',
    });
    setEditing(b);
    setSaveErr(null);
    setColorMode(COLOR_PRESETS.some(p => p.value === b.bg_color) ? 'preset' : 'custom');
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditing(null); setSaveErr(null); };

  const handleSave = async () => {
    if (!form.title.trim()) { setSaveErr('Title is required'); return; }
    setSaving(true);
    setSaveErr(null);
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      title:       form.title.trim(),
      subtitle:    form.subtitle.trim() || null,
      image_url:   form.image_url.trim() || null,
      link:        form.link.trim() || null,
      village_id:  form.village_id || null,
      sort_order:  Number(form.sort_order) || 1,
      bg_color:    form.bg_color,
      is_active:   form.is_active,
      active_from: form.active_from || null,
      active_to:   form.active_to   || null,
    };
    const { error } = await AdminAPI.upsertBanner(payload);
    if (error) { setSaveErr(error.message ?? 'Save failed'); setSaving(false); return; }
    refetch();
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    setDeleting(id);
    await AdminAPI.deleteBanner(id);
    refetch();
    setDeleting(null);
  };

  const handleToggle = async (b) => {
    setToggling(b.id);
    await AdminAPI.toggleBanner(b.id, !b.is_active);
    refetch();
    setToggling(null);
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Banners"
        subtitle="Homepage promotional banners shown to customers"
        rightAction={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" /> Add Banner
            </Button>
          </div>
        }
      />

      <div className="p-5 space-y-3 max-w-3xl">

        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-8 border-dashed text-center">
            <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No banners yet. Add one to appear on the customer home screen.</p>
          </Card>
        ) : (
          rows.map(b => (
            <Card key={b.id} className={`border-border overflow-hidden ${!b.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-stretch gap-0">
                {/* Color swatch / image */}
                <div
                  className="w-24 shrink-0 flex flex-col items-center justify-center gap-1 p-3"
                  style={{ backgroundColor: b.bg_color ?? '#f97316' }}
                >
                  {b.image_url ? (
                    <img src={b.image_url} alt="" className="w-full h-14 object-cover rounded-md" />
                  ) : (
                    <>
                      <p className="text-white font-bold text-xs text-center leading-tight">{b.title}</p>
                      {b.subtitle && (
                        <p className="text-white/80 text-[9px] text-center leading-tight">{b.subtitle}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <Badge className={`text-[9px] border-0 ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {b.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">#{b.sort_order}</Badge>
                  </div>
                  {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {b.link && <span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{b.link}</span>}
                    {b.village_id && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Village targeted</span>}
                    {(b.active_from || b.active_to) && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(b.active_from) ?? '∞'} — {fmtDate(b.active_to) ?? '∞'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center justify-center gap-1 px-3 border-l border-border">
                  <Switch
                    checked={b.is_active}
                    disabled={toggling === b.id}
                    onCheckedChange={() => handleToggle(b)}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    disabled={deleting === b.id}
                    onClick={() => handleDelete(b.id)}
                  >
                    {deleting === b.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────── */}
      <Dialog open={modal} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Banner' : 'Add Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {saveErr && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{saveErr}</p>
            )}

            {/* Live preview */}
            <div
              className="w-full h-20 rounded-xl flex items-center justify-center text-center p-4 transition-colors"
              style={{ backgroundColor: form.bg_color }}
            >
              <div>
                <p className="text-white font-bold text-sm">{form.title || 'Banner Title'}</p>
                {form.subtitle && <p className="text-white/80 text-xs mt-0.5">{form.subtitle}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs mb-1 block">Title *</Label>
                <Input placeholder="Chhath Puja Special 🪔" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1 block">Subtitle</Label>
                <Input placeholder="Up to 30% off on selected items" value={form.subtitle}
                  onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1 block">Image URL (optional)</Label>
                <Input placeholder="https://…" value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1 block">Link (tap action)</Label>
                <Input placeholder="/customer/vendors or https://…" value={form.link}
                  onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
              </div>
            </div>

            {/* Color */}
            <div>
              <Label className="text-xs mb-1.5 block">Background Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.filter(p => p.value !== 'custom').map(p => (
                  <button
                    key={p.value}
                    onClick={() => { setForm(f => ({ ...f, bg_color: p.value })); setColorMode('preset'); }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      form.bg_color === p.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: p.value }}
                    title={p.label}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.bg_color}
                    onChange={e => { setForm(f => ({ ...f, bg_color: e.target.value })); setColorMode('custom'); }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-xs text-muted-foreground">{form.bg_color}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Village targeting */}
              <div>
                <Label className="text-xs mb-1 block">Target Village (blank = all)</Label>
                <Select
                  value={form.village_id ?? 'all'}
                  onValueChange={v => setForm(f => ({ ...f, village_id: v === 'all' ? null : v }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All villages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Villages</SelectItem>
                    {(villages ?? []).map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort order */}
              <div>
                <Label className="text-xs mb-1 block">Sort Order</Label>
                <Input type="number" min={1} value={form.sort_order} className="h-9"
                  onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
              </div>

              {/* Active dates */}
              <div>
                <Label className="text-xs mb-1 block">Active From (optional)</Label>
                <Input type="date" value={form.active_from} className="h-9 text-xs"
                  onChange={e => setForm(f => ({ ...f, active_from: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Active Until (optional)</Label>
                <Input type="date" value={form.active_to} className="h-9 text-xs"
                  onChange={e => setForm(f => ({ ...f, active_to: e.target.value }))} />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Show this banner on the customer home screen</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Banner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
