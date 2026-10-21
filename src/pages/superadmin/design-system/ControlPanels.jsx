import React, { useMemo } from 'react';
import { Check, Heart, Pencil, Settings, Sparkles, Zap } from 'lucide-react';
import { resolveDesignIcon } from '@/components/shared/designIconResolver';
import { auditDesign } from '@/lib/design/a11y';
import { ICON_NAMES, SEMANTIC_ICON_KEYS, wiringFor } from '@/lib/design/schema';
import { PRESETS } from '@/lib/design/presets';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ControlList, Field, Notice, Panel } from './ui';

const typeSelect = (key, label, options) => ({ section: 'typography', key, label, type: 'select', options });
const layoutSelect = (key, label, options) => ({ section: 'layout', key, label, type: 'select', options });

const TYPOGRAPHY = [
  typeSelect('bodyFont', 'Body font', 'fontFamily'),
  typeSelect('headingFont', 'Heading font', 'fontFamily'),
  typeSelect('monoFont', 'Monospace font', 'fontFamily'),
  { section: 'typography', key: 'baseFontSize', label: 'Base font size', type: 'range', range: 'baseFontSize', unit: 'px' },
  typeSelect('bodyWeight', 'Body weight', 'bodyWeight'),
  typeSelect('headingWeight', 'Heading weight', 'headingWeight'),
  typeSelect('lineHeight', 'Line height', 'lineHeight'),
  typeSelect('letterSpacing', 'Letter spacing', 'letterSpacing'),
  typeSelect('headingScale', 'Heading scale', 'headingScale'),
];

const LAYOUT = [
  layoutSelect('radius', 'Corner radius', 'radius'),
  layoutSelect('buttonHeight', 'Button height', 'buttonHeight'),
  layoutSelect('inputHeight', 'Input height', 'inputHeight'),
  layoutSelect('shadow', 'Card shadow', 'shadow'),
  layoutSelect('contentWidth', 'Content width', 'contentWidth'),
  layoutSelect('spacingScale', 'Spacing scale', 'spacingScale'),
  layoutSelect('cardPadding', 'Card padding', 'cardPadding'),
  layoutSelect('gridGap', 'Grid gap', 'gridGap'),
  layoutSelect('breakpoint', 'Tablet breakpoint', 'breakpoint'),
  layoutSelect('navDensity', 'Navigation density', 'navDensity'),
];

const MOTION = [
  { section: 'motion', key: 'enabled', label: 'Animations', type: 'switch', hint: 'Off disables all animation and transitions. While on, each user\'s own reduced-motion setting is still respected.' },
  { section: 'motion', key: 'duration', label: 'Transition speed', type: 'select', options: 'motionDuration' },
  { section: 'motion', key: 'loadingShimmer', label: 'Loading shimmer', type: 'switch' },
  { section: 'motion', key: 'hoverEffects', label: 'Hover effects', type: 'switch' },
  { section: 'motion', key: 'pageAnimations', label: 'Page entrance animations', type: 'switch' },
  { section: 'motion', key: 'cardInteractions', label: 'Card interactions', type: 'switch' },
];

const ICON_SETTINGS = [
  { section: 'icons', key: 'size', label: 'Default icon size', type: 'range', range: 'iconSize', unit: 'px' },
  { section: 'icons', key: 'strokeWidth', label: 'Icon stroke width', type: 'range', range: 'iconStroke' },
];

const THEME = [
  { section: 'theme', key: 'defaultMode', label: 'Default theme', type: 'select', options: 'themeMode' },
  { section: 'theme', key: 'allowUserSelection', label: 'Let users choose a theme', type: 'switch' },
];

export function TypographyPanel({ studio }) {
  return (
    <Panel title="Typography" description="Fonts, sizes and rhythm for text across the portals." icon={Pencil}>
      <Notice tone="info">
        System UI needs no download, which keeps pages light on slow rural networks. Inter, Roboto and Nunito Sans load from Google Fonts.
      </Notice>
      <ControlList controls={TYPOGRAPHY} draft={studio.draft} onChange={studio.setSection} />
    </Panel>
  );
}

export function LayoutPanel({ studio }) {
  return (
    <Panel title="Shape & layout" description="Corner radius and control sizes. Button and input height drive the shared components everywhere." icon={Settings}>
      <ControlList controls={LAYOUT} draft={studio.draft} onChange={studio.setSection} />
    </Panel>
  );
}

export function MotionPanel({ studio }) {
  return (
    <Panel title="Motion" description="How fast and how much the interface moves." icon={Zap}>
      <ControlList controls={MOTION} draft={studio.draft} onChange={studio.setSection} />
    </Panel>
  );
}

function IconPreview({ name }) {
  const Icon = resolveDesignIcon(name);
  return Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : <span className="h-5 w-5" aria-hidden="true" />;
}

export function IconsPanel({ studio }) {
  const { draft, setSection, setMapping } = studio;
  return (
    <Panel title="Icons" description="Size and stroke apply to Lucide icons that do not set their own size." icon={Heart}>
      <ControlList controls={ICON_SETTINGS} draft={draft} onChange={setSection} />
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Semantic icon mapping</h3>
          <p className="text-xs text-muted-foreground">{wiringFor('icons', 'mappings').note} Only a vetted allow-list of bundled icons can be chosen; custom SVG is deliberately not supported.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEMANTIC_ICON_KEYS.map((key) => (
            <Field key={key} id={`ds-icon-${key}`} label={key.charAt(0).toUpperCase() + key.slice(1)}>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <IconPreview name={draft.icons.mappings[key]} />
                </span>
                <Select value={draft.icons.mappings[key]} onValueChange={(value) => setMapping(key, value)}>
                  <SelectTrigger id={`ds-icon-${key}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_NAMES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Field>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Presets replace colors, typography and shape; motion, icons and theme policy are kept. */
function applyPreset(draft, preset) {
  return {
    ...draft,
    colors: preset.config.colors,
    darkColors: preset.config.darkColors,
    typography: preset.config.typography,
    layout: preset.config.layout,
  };
}

export function ThemesPanel({ studio }) {
  const { draft, replaceDraft, setSection } = studio;
  const scores = useMemo(() => Object.fromEntries(PRESETS.map((p) => [p.id, auditDesign(p.config).summary])), []);
  const current = useMemo(
    () => PRESETS.find((p) => JSON.stringify([p.config.colors, p.config.darkColors, p.config.typography, p.config.layout])
      === JSON.stringify([draft.colors, draft.darkColors, draft.typography, draft.layout]))?.id,
    [draft],
  );
  return (
    <Panel title="Themes" description="Start from a curated preset, then refine. Applying a preset is one undo step." icon={Sparkles}>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((preset) => {
          const active = current === preset.id;
          const s = scores[preset.id];
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => replaceDraft(applyPreset(draft, preset))}
              aria-pressed={active}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary ring-1 ring-primary' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{preset.name}</span>
                {active && <Check className="h-4 w-4 text-primary" aria-label="Applied" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{preset.tagline}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="flex">
                  {preset.swatch.map((c) => (
                    <span key={c} className="-ml-1 h-6 w-6 rounded-full border-2 border-card first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {s.passed ? 'AA text: all pass' : `AA text: ${s.score}% pass`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold">Theme policy</h3>
        <ControlList controls={THEME} draft={draft} onChange={setSection} />
      </div>
    </Panel>
  );
}
