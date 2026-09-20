// ═══════════════════════════════════════════════════════════
// SETU — CategoryMultiSelect
//
// Shared multi-category picker for the vendor portal — backs shop
// category selection (onboarding + Settings) and product category
// selection (Add/Edit Product). One component instead of four
// hand-rolled pickers, all reading the same live `categories` table
// via getCategories() rather than a hardcoded local list.
//
// Controlled: pass `selectedIds` + `onChange`, same shape everywhere
// it's used (an array of categories.id strings).
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Check } from 'lucide-react';

export default function CategoryMultiSelect({
  categories,
  selectedIds,
  onChange,
  loading = false,
  emptyLabel = 'No categories available yet.',
}) {
  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  const selectAll = () => onChange(categories.map(c => c.id));
  const clearAll  = () => onChange([]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!categories.length) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const active = selectedIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input text-foreground hover:border-primary/50'
              }`}
            >
              {active
                ? <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                : <span className="shrink-0" aria-hidden="true">{cat.icon || '🛒'}</span>}
              {cat.name}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={selectAll} className="text-xs font-medium text-primary underline underline-offset-2">
          Select all
        </button>
        {selectedIds.length > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-muted-foreground underline underline-offset-2">
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {selectedIds.length} selected
        </span>
      </div>
    </div>
  );
}
