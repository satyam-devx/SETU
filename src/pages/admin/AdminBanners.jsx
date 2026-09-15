// ═══════════════════════════════════════════════════════════
// SETU — AdminBanners
// Homepage CMS: structured banner builder (content, visual,
// background, layout, behavior) with a live preview that shares
// its rendering logic with the real customer carousel.
// Route: /admin/banners
// ═══════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Loader2, Image as ImageIcon,
  RefreshCw, Link2, MapPin, Calendar, Upload, X, AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import BannerCard from '@/components/shared/BannerCard';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { deleteStorageObject } from '@/lib/img';

const MAX_IMAGE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const COLOR_PRESETS = [
  '#F97316', '#16A34A', '#2563EB', '#7C3AED', '#DC2626', '#0D9488', '#78716C',
];

const LAYOUTS = [
  { value: 'text-only',      label: 'Text only',       hint: 'Headline + subtitle, no image' },
  { value: 'image-right',    label: 'Image right',     hint: 'Text with a small image on the right' },
  { value: 'image-left',     label: 'Image left',      hint: 'Text with a small image on the left' },
  { value: 'image-dominant', label: 'Image-dominant',  hint: 'Full image with text overlaid at the bottom' },
];

const EMPTY = {
  title: '', subtitle: '', badge_text: '', cta_text: '', link: '',
  bg_type: 'solid', bg_color: '#F97316', gradient_to: '#C2410C',
  image_url: '', overlay_opacity: 30,
  layout: 'text-only', foreground_image_url: '',
  village_id: null, sort_order: 1,
  is_active: true, active_from: '', active_to: '',
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Upload to Supabase Storage (banner-images bucket) ───────
async function uploadBannerImage(file, onProgress) {
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  onProgress?.(15);
  const { data, error } = await supabase.storage
    .from('banner-images')
    .upload(filePath, file, { upsert: false, contentType: file.type });
  onProgress?.(90);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('banner-images').getPublicUrl(data.path);
  onProgress?.(100);
  return publicUrl;
}

// ── Reusable image field: upload from device OR paste a URL ─
function BannerImageField({ label, value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [err, setErr]             = useState(null);
  const [broken, setBroken]       = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErr('Unsupported format — use JPG, PNG, WEBP, or GIF.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setErr(`Image too large — max ${MAX_IMAGE_MB}MB.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const previousUrl = value;
      const url = await uploadBannerImage(file, setProgress);
      onChange(url);
      setBroken(false);
      // Best-effort cleanup of the file this replaces (no-op for an
      // externally-pasted URL, since it won't match our bucket path).
      if (previousUrl) deleteStorageObject(supabase, 'banner-images', previousUrl);
    } catch (e2) {
      setErr(e2.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const busy = uploading || disabled;

  return (
    <div>
      <Label className="text-xs mb-1.5 block">{label}</Label>
      <div className="flex items-start gap-2.5">
        <div className="w-14 h-14 rounded-lg border border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
          {value && !broken ? (
            <img src={value} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFile} disabled={busy} className="hidden" id={`banner-img-${label}`}
            />
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
            <Input
              className="h-7 text-[11px] flex-1 min-w-[120px]"
              placeholder="or paste an image URL…"
              defaultValue={value?.startsWith('http') ? value : ''}
              disabled={busy}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== value && value) {
                  deleteStorageObject(supabase, 'banner-images', value);
                }
                setBroken(false);
                onChange(v);
              }}
            />
            {value && (
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" disabled={busy} onClick={() => {
                deleteStorageObject(supabase, 'banner-images', value);
                onChange('');
              }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          {uploading && <Progress value={progress} className="h-1" />}
          {broken && value && (
            <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> This link doesn't look like a working image.</p>
          )}
          {err && <p className="text-[10px] text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}

// ── A small labeled section wrapper, used to organize the editor
// into Content / Visual / Background / Layout / Behavior instead of
// one long undifferentiated form.
function Section({ title, children }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export default function AdminBanners() {
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [saveErr,  setSaveErr]  = useState(null);

  const { data: banners, isLoading, error, refetch } = useDataFetch(
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
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaveErr(null); };

  const openAdd = () => {
    const maxSort = rows.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    setForm({ ...EMPTY, sort_order: maxSort + 1 });
    setEditing(null);
    setSaveErr(null);
    setModal(true);
  };

  const openEdit = (b) => {
    setForm({
      id:          b.id,
      title:       b.title,
      subtitle:    b.subtitle ?? '',
      badge_text:  b.badge_text ?? '',
      cta_text:    b.cta_text ?? '',
      link:        b.link ?? '',
      bg_type:     b.bg_type ?? 'solid',
      bg_color:    b.bg_color ?? '#F97316',
      gradient_to: b.gradient_to ?? '#C2410C',
      image_url:   b.image_url ?? '',
      overlay_opacity: b.overlay_opacity ?? 30,
      layout:      b.layout ?? 'text-only',
      foreground_image_url: b.foreground_image_url ?? '',
      village_id:  b.village_id ?? null,
      sort_order:  b.sort_order ?? 1,
      is_active:   b.is_active,
      active_from: b.active_from ? b.active_from.split('T')[0] : '',
      active_to:   b.active_to   ? b.active_to.split('T')[0]   : '',
    });
    setEditing(b);
    setSaveErr(null);
    setModal(true);
  };

  const closeModal = () => { if (!saving) { setModal(false); setEditing(null); setSaveErr(null); } };

  const handleSave = async () => {
    if (saving) return; // re-entry guard
    if (!form.title.trim()) { setSaveErr('Title is required'); return; }
    if (form.layout !== 'text-only' && !form.foreground_image_url && !(form.layout === 'image-dominant' && form.bg_type === 'image')) {
      setSaveErr(`The "${LAYOUTS.find(l => l.value === form.layout)?.label}" layout needs an image — add one in Visual, or switch to Text only.`);
      return;
    }
    setSaving(true);
    setSaveErr(null);
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      title:        form.title.trim(),
      subtitle:     form.subtitle.trim() || null,
      badge_text:   form.badge_text.trim() || null,
      cta_text:     form.cta_text.trim() || null,
      link:         form.link.trim() || null,
      bg_type:      form.bg_type,
      bg_color:     form.bg_color,
      gradient_to:  form.bg_type === 'gradient' ? form.gradient_to : null,
      image_url:    form.bg_type === 'image' ? (form.image_url.trim() || null) : (form.image_url.trim() || null),
      overlay_opacity: form.bg_type === 'image' ? Number(form.overlay_opacity) || 0 : 0,
      layout:       form.layout,
      foreground_image_url: form.foreground_image_url.trim() || null,
      village_id:   form.village_id || null,
      sort_order:   Number(form.sort_order) || 1,
      is_active:    form.is_active,
      active_from:  form.active_from || null,
      active_to:    form.active_to   || null,
    };
    const { error: saveError } = await AdminAPI.upsertBanner(payload);
    if (saveError) { setSaveErr(saveError.message ?? 'Save failed'); setSaving(false); return; }
    refetch();
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    setDeleting(id);
    const { error: delError } = await AdminAPI.deleteBanner(id);
    if (delError) {
      alert(delError.message || 'Failed to delete banner.');
    }
    refetch();
    setDeleting(null);
  };

  const handleToggle = async (b) => {
    setToggling(b.id);
    const { error: toggleError } = await AdminAPI.toggleBanner(b.id, !b.is_active);
    if (toggleError) {
      alert(toggleError.message || 'Failed to update banner.');
    }
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
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch} aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" /> Add Banner
            </Button>
          </div>
        }
      />

      <div className="p-5 space-y-3 max-w-3xl">

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load banners.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <Card className="p-8 border-dashed text-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No banners yet. Add one to appear on the customer home screen.</p>
          </Card>
        ) : (
          rows.map(b => (
            <Card key={b.id} className={`border-border overflow-hidden ${!b.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-stretch gap-0">
                {/* Live thumbnail — same renderer as the real carousel */}
                <div className="w-28 shrink-0">
                  <BannerCard banner={b} className="h-full min-h-[96px] rounded-none" />
                </div>

                {/* Info */}
                <div className="flex-1 p-3 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{b.title}</p>
                    <Badge className={`text-[9px] border-0 ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {b.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">#{b.sort_order}</Badge>
                    <Badge variant="outline" className="text-[9px] capitalize">{b.layout?.replace('-', ' ') ?? 'text-only'}</Badge>
                  </div>
                  {b.subtitle && <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {b.link && <span className="flex items-center gap-1 truncate max-w-[160px]"><Link2 className="w-3 h-3 shrink-0" />{b.link}</span>}
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
                    aria-label={b.is_active ? `Deactivate ${b.title}` : `Activate ${b.title}`}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)} aria-label={`Edit ${b.title}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    disabled={deleting === b.id} onClick={() => handleDelete(b.id)} aria-label={`Delete ${b.title}`}
                  >
                    {deleting === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
          <div className="space-y-5 pt-2">
            {saveErr && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {saveErr}
              </p>
            )}

            {/* ── Preview — same BannerCard the customer app renders ── */}
            <Section title="Preview">
              <BannerCard banner={form} className="min-h-[130px]" />
            </Section>

            {/* ── Content ── */}
            <Section title="Content">
              <div className="space-y-2.5">
                <div>
                  <Label className="text-xs mb-1 block">Badge / eyebrow text (optional)</Label>
                  <Input placeholder="Limited Offer" value={form.badge_text} maxLength={30}
                    onChange={e => setF('badge_text', e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Headline *</Label>
                  <Input placeholder="Chhath Puja Special 🪔" value={form.title} maxLength={60}
                    onChange={e => setF('title', e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Subtitle</Label>
                  <Input placeholder="Up to 30% off on selected items" value={form.subtitle} maxLength={100}
                    onChange={e => setF('subtitle', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs mb-1 block">Button text</Label>
                    <Input placeholder="Shop Now" value={form.cta_text} maxLength={20}
                      onChange={e => setF('cta_text', e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Tap destination</Label>
                    <Input placeholder="/customer/vendors or https://…" value={form.link}
                      onChange={e => setF('link', e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Background ── */}
            <Section title="Background">
              <div className="flex gap-1.5">
                {[
                  { value: 'solid',    label: 'Solid' },
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'image',    label: 'Image' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setF('bg_type', opt.value)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      form.bg_type === opt.value ? 'border-primary bg-primary/5 font-medium' : 'border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setF('bg_color', c)}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${form.bg_color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                    aria-label={`Use color ${c}`}
                  />
                ))}
                <input
                  type="color" value={form.bg_color}
                  onChange={e => setF('bg_color', e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-border"
                  aria-label="Custom background color"
                />
                {form.bg_type === 'gradient' && (
                  <>
                    <span className="text-xs text-muted-foreground">→</span>
                    <input
                      type="color" value={form.gradient_to}
                      onChange={e => setF('gradient_to', e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer border border-border"
                      aria-label="Gradient end color"
                    />
                  </>
                )}
              </div>

              {form.bg_type === 'image' && (
                <>
                  <BannerImageField label="Background image" value={form.image_url} disabled={saving}
                    onChange={v => setF('image_url', v)} />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Dark overlay (for text readability)</Label>
                      <span className="text-xs text-muted-foreground">{form.overlay_opacity}%</span>
                    </div>
                    <input
                      type="range" min={0} max={80} value={form.overlay_opacity}
                      onChange={e => setF('overlay_opacity', e.target.value)}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </Section>

            {/* ── Layout ── */}
            <Section title="Layout">
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUTS.map(l => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setF('layout', l.value)}
                    className={`text-left p-2 rounded-lg border transition-colors ${
                      form.layout === l.value ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <p className="text-xs font-medium">{l.label}</p>
                    <p className="text-[10px] text-muted-foreground">{l.hint}</p>
                  </button>
                ))}
              </div>
              {(form.layout === 'image-left' || form.layout === 'image-right') && (
                <BannerImageField label="Foreground / product image" value={form.foreground_image_url} disabled={saving}
                  onChange={v => setF('foreground_image_url', v)} />
              )}
              {form.layout === 'image-dominant' && form.bg_type !== 'image' && (
                <BannerImageField label="Dominant image" value={form.foreground_image_url} disabled={saving}
                  onChange={v => setF('foreground_image_url', v)} />
              )}
            </Section>

            {/* ── Behavior ── */}
            <Section title="Behavior">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs mb-1 block">Target village (blank = all)</Label>
                  <Select
                    value={form.village_id ?? 'all'}
                    onValueChange={v => setF('village_id', v === 'all' ? null : v)}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All villages" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Villages</SelectItem>
                      {(villages ?? []).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Sort order</Label>
                  <Input type="number" min={1} value={form.sort_order} className="h-9 text-sm"
                    onChange={e => setF('sort_order', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Active from (optional)</Label>
                  <Input type="date" value={form.active_from} className="h-9 text-xs"
                    onChange={e => setF('active_from', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Active until (optional)</Label>
                  <Input type="date" value={form.active_to} className="h-9 text-xs"
                    onChange={e => setF('active_to', e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Show this banner on the customer home screen</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setF('is_active', v)} />
              </div>
            </Section>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={saving} onClick={closeModal}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save Banner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
