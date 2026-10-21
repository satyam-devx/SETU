import React, { useMemo, useState } from 'react';
import { Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deriveBrandTokens, normalizeHex } from '@/lib/design/color';
import { COLOR_GROUPS, COLOR_LABELS } from '@/lib/design/schema';
import { ColorField, Field, Notice, Panel, Segmented } from './ui';

const MODES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function ColorsPanel({ studio, mode, onModeChange }) {
  const { draft, audit, setColor, replaceDraft } = studio;
  const palette = mode === 'dark' ? draft.darkColors : draft.colors;
  const [brand, setBrand] = useState(draft.colors.primary);
  const [brandError, setBrandError] = useState('');

  // For each token, the worst-contrast check it takes part in (text pairs first).
  const worstByKey = useMemo(() => {
    const map = {};
    for (const check of audit.modes[mode]) {
      if (check.ratio === null) continue;
      for (const key of [check.fgKey, check.bgKey]) {
        const prev = map[key];
        const rank = (c) => (c.status === 'pass' ? 1 : 0) * 10 + (c.kind === 'text' ? 0 : 5) + c.ratio / 100;
        if (!prev || rank(check) < rank(prev)) map[key] = check;
      }
    }
    return map;
  }, [audit, mode]);

  const applyFix = (check) => setColor(mode, check.fix.key, check.fix.color);

  const generate = () => {
    const hex = normalizeHex(brand);
    if (!hex) { setBrandError('Enter a valid color, e.g. #4F46E5.'); return; }
    setBrandError('');
    const t = deriveBrandTokens(hex, {
      background: draft.colors.background, darkBackground: draft.darkColors.background,
      sidebar: draft.colors.sidebar, darkSidebar: draft.darkColors.sidebar,
    });
    replaceDraft({ ...draft, colors: { ...draft.colors, ...t.colors }, darkColors: { ...draft.darkColors, ...t.darkColors } });
  };

  const failing = audit.summary.errors;

  return (
    <Panel
      title="Colors"
      description="Every token is stored as HEX and compiled to the HSL variables the app reads. Contrast is checked against its partner token as you edit."
      icon={Palette}
      actions={<Segmented label="Color mode" value={mode} onChange={onModeChange} options={MODES} />}
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Generate from a brand color</h3>
              <p className="text-xs text-muted-foreground">
                Sets primary, its label color, focus ring, sidebar accents and chart 1 for both light and dark. Each is nudged just enough to pass contrast. Neutrals are left alone.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field id="ds-brand" label="Brand color" className="min-w-[12rem] flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick brand color"
                    value={normalizeHex(brand)?.toLowerCase() || '#000000'}
                    onChange={(e) => { setBrand(e.target.value.toUpperCase()); setBrandError(''); }}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <input
                    id="ds-brand"
                    value={brand}
                    onChange={(e) => { setBrand(e.target.value); setBrandError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
                    spellCheck={false}
                    aria-invalid={Boolean(brandError)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </Field>
              <Button type="button" onClick={generate} className="shrink-0">Generate</Button>
            </div>
            {brandError && <p className="text-xs text-destructive">{brandError}</p>}
          </div>
        </div>
      </div>

      {failing > 0 && (
        <Notice tone="warning">
          {failing} text pair{failing === 1 ? '' : 's'} below WCAG AA across light and dark. Use the Fix buttons below, or open the Access tab to repair all at once.
        </Notice>
      )}

      <div className="space-y-6">
        {COLOR_GROUPS.map((group) => (
          <fieldset key={group.id} className="space-y-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.keys.map((key) => (
                <ColorField
                  key={`${mode}-${key}`}
                  id={`ds-color-${mode}-${key}`}
                  label={COLOR_LABELS[key]}
                  value={palette[key]}
                  onChange={(value) => setColor(mode, key, value)}
                  check={worstByKey[key]}
                  onFix={applyFix}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Panel>
  );
}
