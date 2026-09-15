// ═══════════════════════════════════════════════════════════
// SETU — AdminCategories
// Full CRUD: sortable list, add/edit modal with image upload
// (device upload or URL), Hindi name field, is_active toggle.
// Route: /admin/categories
// ═══════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import {
  Plus, Pencil, Trash2, GripVertical,
  RefreshCw, Loader2, Tag, Upload, Link2, X, AlertCircle, ImageOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import Img from '@/components/shared/Img';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { deleteStorageObject } from '@/lib/img';

const MAX_IMAGE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const EMPTY_FORM = { name: '', name_hindi: '', icon: '🛒', image_url: '', sort_order: 0, is_active: true };

// ── Upload to Supabase Storage (category-images bucket) ────
// Same pattern VendorAddProduct.jsx already established for
// product-images — same bucket-per-entity, upload-then-getPublicUrl
// shape, just a different (admin-only-write) bucket.
async function uploadCategoryImage(file, onProgress) {
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // supabase-js v2's storage upload doesn't expose real byte progress
  // over XHR; a short deterministic ramp gives honest "something is
  // happening" feedback for what's usually a sub-second request rather
  // than nothing changing on screen until it either finishes or errors.
  onProgress?.(15);
  const { data, error } = await supabase.storage
    .from('category-images')
    .upload(filePath, file, { upsert: false, contentType: file.type });
  onProgress?.(90);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('category-images')
    .getPublicUrl(data.path);

  onProgress?.(100);
  return publicUrl;
}

// ── Category image field: upload from device OR paste a URL ────
function CategoryImageField({ value, fallbackIcon, onChange, disabled }) {
  const [mode, setMode]         = useState('upload'); // 'upload' | 'url'
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr]           = useState(null);
  const [urlBroken, setUrlBroken] = useState(false);
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
      const url = await uploadCategoryImage(file, setProgress);
      onChange(url);
      // Best-effort: clean up the file this one replaces, if it was
      // one of ours (never touches an externally-pasted URL).
      if (previousUrl) deleteStorageObject(supabase, 'category-images', previousUrl);
    } catch (e2) {
      setErr(e2.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = () => {
    if (value) deleteStorageObject(supabase, 'category-images', value);
    onChange('');
    setErr(null);
    setUrlBroken(false);
  };

  const busy = uploading || disabled;

  return (
    <div>
      <Label className="text-xs mb-1.5 block">Category Image</Label>

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="w-16 h-16 rounded-xl border border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
          {value && !urlBroken ? (
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setUrlBroken(true)}
              onLoad={() => setUrlBroken(false)}
            />
          ) : value && urlBroken ? (
            <ImageOff className="w-5 h-5 text-muted-foreground" aria-label="Image failed to load" />
          ) : (
            <span className="text-2xl" aria-hidden="true">{fallbackIcon || '🛒'}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="h-8">
              <TabsTrigger value="upload" className="text-xs h-6 gap-1" disabled={busy}>
                <Upload className="w-3 h-3" /> Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs h-6 gap-1" disabled={busy}>
                <Link2 className="w-3 h-3" /> Image URL
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'upload' ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFile}
                disabled={busy}
                className="hidden"
                id="category-image-file"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
                </Button>
                {value && !uploading && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={handleRemove}>
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>
              {uploading && <Progress value={progress} className="h-1 mt-2" />}
              <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WEBP or GIF · up to {MAX_IMAGE_MB}MB</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="https://…"
                  defaultValue={value?.startsWith('http') ? value : ''}
                  disabled={busy}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== value && value) {
                      // Switching to a different URL — clean up the
                      // old one if it was ours (no-ops otherwise).
                      deleteStorageObject(supabase, 'category-images', value);
                    }
                    setUrlBroken(false);
                    onChange(v);
                  }}
                />
                {value && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive shrink-0" onClick={handleRemove}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              {urlBroken && (
                <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> This link doesn't look like a working image.
                </p>
              )}
            </div>
          )}

          {err && <p className="text-[11px] text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const [modal,    setModal]    = useState(null);   // null | 'add' | 'edit'
  const [editing,  setEditing]  = useState(null);   // category object
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);   // id being deleted
  const [toggling, setToggling] = useState(null);   // id being toggled
  const [saveErr,  setSaveErr]  = useState(null);

  const { data: cats, isLoading, error, refetch } = useDataFetch(
    () => AdminAPI.getAllCategories(),
    [],
    { cacheKey: 'admin-categories' }
  );

  const categories = cats ?? [];

  // ── Open add modal ──────────────────────────────────────
  const openAdd = () => {
    const maxSort = categories.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
    setForm({ ...EMPTY_FORM, sort_order: maxSort + 1 });
    setEditing(null);
    setSaveErr(null);
    setModal('add');
  };

  // ── Open edit modal ─────────────────────────────────────
  const openEdit = (cat) => {
    setForm({
      id:          cat.id,
      name:        cat.name,
      name_hindi:  cat.name_hindi ?? '',
      icon:        cat.icon ?? '🛒',
      image_url:   cat.image_url ?? '',
      sort_order:  cat.sort_order ?? 0,
      is_active:   cat.is_active ?? true,
    });
    setEditing(cat);
    setSaveErr(null);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setSaveErr(null);
  };

  // ── Save (add or edit) ──────────────────────────────────
  const handleSave = async () => {
    if (saving) return; // re-entry guard
    if (!form.name.trim()) { setSaveErr('Category name is required'); return; }
    setSaving(true);
    setSaveErr(null);
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name:        form.name.trim(),
      name_hindi:  form.name_hindi.trim() || null,
      icon:        form.icon,
      image_url:   form.image_url?.trim() || null,
      sort_order:  Number(form.sort_order) || 0,
      is_active:   form.is_active,
    };
    const { error } = await AdminAPI.upsertCategory(payload);
    if (error) {
      setSaveErr(error.message ?? 'Save failed');
      setSaving(false);
      return;
    }
    refetch();
    setSaving(false);
    closeModal();
  };

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Products linked to it will lose their category.')) return;
    setDeleting(id);
    await AdminAPI.deleteCategory(id);
    refetch();
    setDeleting(null);
  };

  // ── Toggle active ───────────────────────────────────────
  const handleToggle = async (cat) => {
    setToggling(cat.id);
    await AdminAPI.upsertCategory({ id: cat.id, name: cat.name, is_active: !cat.is_active });
    refetch();
    setToggling(null);
  };

  // ── Move sort order ─────────────────────────────────────
  const moveUp = async (idx) => {
    if (idx === 0) return;
    const reordered = [...categories];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await AdminAPI.reorderCategories(reordered.map(c => c.id));
    refetch();
  };

  const moveDown = async (idx) => {
    if (idx === categories.length - 1) return;
    const reordered = [...categories];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    await AdminAPI.reorderCategories(reordered.map(c => c.id));
    refetch();
  };

  return (
    <div className="flex-1 overflow-auto pb-10">
      <AppHeader
        title="Categories"
        subtitle={`${categories.length} total`}
        rightAction={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetch}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5" /> Add Category
            </Button>
          </div>
        }
      />

      <div className="p-5 space-y-3 max-w-3xl">
        {/* Stats bar */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{categories.filter(c => c.is_active).length}</span> active ·
          <span className="font-medium text-foreground">{categories.filter(c => !c.is_active).length}</span> inactive
        </div>

        {error && (
          <Card className="p-3 border-destructive/20 bg-destructive/5">
            <p className="text-xs text-destructive">{error.message ?? 'Failed to load categories.'}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>Retry</Button>
          </Card>
        )}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <Card className="p-8 border-dashed border-border text-center">
            <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No categories yet. Add one to get started.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {categories.map((cat, idx) => (
              <Card
                key={cat.id}
                className={`p-3 border-border flex items-center gap-3 transition-opacity ${
                  !cat.is_active ? 'opacity-50' : ''
                }`}
              >
                {/* Drag handle / order controls */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
                  >▲</button>
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === categories.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
                  >▼</button>
                </div>

                {/* Image (falls back to the legacy emoji icon, then a generic tag) */}
                <div className="w-9 h-9 rounded-lg bg-primary/10 overflow-hidden shrink-0">
                  <Img
                    src={cat.image_url}
                    alt=""
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-9 h-9 flex items-center justify-center text-lg" aria-hidden="true">
                        {cat.icon || '🛒'}
                      </div>
                    }
                  />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{cat.name}</p>
                  {cat.name_hindi && (
                    <p className="text-xs text-muted-foreground truncate">{cat.name_hindi}</p>
                  )}
                </div>

                {/* Sort badge */}
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  #{cat.sort_order}
                </span>

                {/* Active toggle */}
                <Switch
                  checked={cat.is_active}
                  disabled={toggling === cat.id}
                  onCheckedChange={() => handleToggle(cat)}
                  className="shrink-0"
                />

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEdit(cat)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    disabled={deleting === cat.id}
                    onClick={() => handleDelete(cat.id)}
                  >
                    {deleting === cat.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────── */}
      <Dialog open={!!modal} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modal === 'edit' ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {saveErr && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{saveErr}</p>
            )}

            <CategoryImageField
              value={form.image_url}
              fallbackIcon={form.icon}
              disabled={saving}
              onChange={url => setForm(f => ({ ...f, image_url: url }))}
            />

            {/* English name */}
            <div>
              <Label className="text-xs mb-1 block">Name (English) *</Label>
              <Input
                placeholder="e.g. Grocery & Essentials"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Hindi name */}
            <div>
              <Label className="text-xs mb-1 block">Name (Hindi)</Label>
              <Input
                placeholder="e.g. किराना एवं आवश्यक वस्तुएं"
                value={form.name_hindi}
                onChange={e => setForm(f => ({ ...f, name_hindi: e.target.value }))}
              />
            </div>

            {/* Sort order */}
            <div>
              <Label className="text-xs mb-1 block">Sort Order</Label>
              <Input
                type="number"
                min={1}
                className="w-28"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Lower number = appears first</p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Visible to vendors and customers</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
