// ═══════════════════════════════════════════════════════════
// SETU — AdminCategories
// Full CRUD: sortable list, add/edit modal, emoji picker,
// Hindi name field, is_active toggle.
// Route: /admin/categories
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, GripVertical,
  RefreshCw, Loader2, Tag
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { AdminAPI } from '@/lib/api';

// Common emojis for category icons
const EMOJI_PRESETS = [
  '🛒','🥜','🥬','🥛','🐟','🍬','👕','📱','🌾','💊',
  '🍚','🫙','🥩','🧴','🧹','🪔','🎓','🔧','⚡','🚿',
  '🌸','🍎','🥦','🧀','🐔','🍰','👗','💻','🌻','🩺',
  '🏠','🚗','✂️','🎨','📚','🌿','🐄','🥚','🧈','🫚',
];

const EMPTY_FORM = { name: '', name_hindi: '', icon: '🛒', sort_order: 0, is_active: true };

export default function AdminCategories() {
  const [modal,    setModal]    = useState(null);   // null | 'add' | 'edit'
  const [editing,  setEditing]  = useState(null);   // category object
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);   // id being deleted
  const [toggling, setToggling] = useState(null);   // id being toggled
  const [saveErr,  setSaveErr]  = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);

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
    setShowEmoji(false);
    setModal('add');
  };

  // ── Open edit modal ─────────────────────────────────────
  const openEdit = (cat) => {
    setForm({
      id:          cat.id,
      name:        cat.name,
      name_hindi:  cat.name_hindi ?? '',
      icon:        cat.icon ?? '🛒',
      sort_order:  cat.sort_order ?? 0,
      is_active:   cat.is_active ?? true,
    });
    setEditing(cat);
    setSaveErr(null);
    setShowEmoji(false);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setSaveErr(null);
    setShowEmoji(false);
  };

  // ── Save (add or edit) ──────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setSaveErr('Category name is required'); return; }
    setSaving(true);
    setSaveErr(null);
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name:        form.name.trim(),
      name_hindi:  form.name_hindi.trim() || null,
      icon:        form.icon,
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

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                  {cat.icon}
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

            {/* Icon picker */}
            <div>
              <Label className="text-xs mb-1.5 block">Icon</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowEmoji(v => !v)}
                  className="w-12 h-12 rounded-xl border-2 border-border hover:border-primary text-2xl flex items-center justify-center transition-colors"
                >
                  {form.icon}
                </button>
                <div className="text-xs text-muted-foreground">
                  Click to {showEmoji ? 'close' : 'open'} emoji picker
                </div>
              </div>

              {showEmoji && (
                <div className="mt-2 p-3 border border-border rounded-xl grid grid-cols-8 gap-1.5">
                  {EMOJI_PRESETS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { setForm(f => ({ ...f, icon: emoji })); setShowEmoji(false); }}
                      className={`w-8 h-8 text-lg rounded-lg hover:bg-muted flex items-center justify-center transition-colors ${
                        form.icon === emoji ? 'bg-primary/10 ring-1 ring-primary' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  {/* Custom input */}
                  <Input
                    className="col-span-2 h-8 text-center text-sm"
                    placeholder="Custom"
                    maxLength={2}
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        setForm(f => ({ ...f, icon: e.target.value }));
                        setShowEmoji(false);
                      }
                    }}
                  />
                </div>
              )}
            </div>

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
