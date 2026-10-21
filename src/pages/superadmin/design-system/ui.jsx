import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeHex } from '@/lib/design/color';
import { COLOR_LABELS, OPTIONS, RANGES, wiringFor } from '@/lib/design/schema';

/* ----------------------------------------------------------------- layout */

export function Panel({ title, description, icon: Icon, actions, children, className }) {
  return (
    <section className={cn('space-y-4', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

const NOTICE_TONES = {
  error: { icon: AlertCircle, box: 'border-destructive/40 bg-destructive/5', role: 'alert' },
  warning: { icon: AlertTriangle, box: 'border-setu-warning/50 bg-setu-warning/10', role: 'status' },
  success: { icon: CheckCircle2, box: 'border-setu-success/40 bg-setu-success/5', role: 'status' },
  info: { icon: Info, box: 'border-border bg-muted/50', role: 'status' },
};

export function Notice({ tone = 'info', children, onDismiss, actions }) {
  const { icon: Icon, box, role } = NOTICE_TONES[tone];
  return (
    <div role={role} className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-sm', box)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {actions}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Segmented({ value, onChange, options, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg bg-muted p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- wiring */

const WIRING_STYLE = {
  live: { dot: 'bg-setu-success', text: 'Live' },
  limited: { dot: 'bg-setu-warning', text: 'Limited' },
  experimental: { dot: 'bg-muted-foreground', text: 'Experimental' },
};

export function WiringBadge({ wiring }) {
  const style = WIRING_STYLE[wiring.status];
  return (
    <span title={wiring.note} className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {style.text}
      <span className="sr-only">: {wiring.note}</span>
    </span>
  );
}

export function Field({ id, label, hint, wiring, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {wiring && <WiringBadge wiring={wiring} />}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------- declarative UI */

function Control({ control, value, onChange }) {
  const id = `ds-${control.section}-${control.key}`;
  const wiring = wiringFor(control.section, control.key);

  if (control.type === 'select') {
    return (
      <Field id={id} label={control.label} hint={control.hint} wiring={wiring}>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {OPTIONS[control.options].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  if (control.type === 'range') {
    const range = RANGES[control.range];
    return (
      <Field id={id} label={control.label} hint={control.hint} wiring={wiring}>
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-primary"
          />
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{value}{control.unit || ''}</span>
        </div>
      </Field>
    );
  }
  return (
    <Field id={id} label={control.label} hint={control.hint} wiring={wiring}>
      <div className="flex h-10 items-center">
        <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
        <span className="ml-3 text-sm text-muted-foreground">{value ? 'On' : 'Off'}</span>
      </div>
    </Field>
  );
}

/** Renders controls from a declarative list; experimental ones are tucked away. */
export function ControlList({ controls, draft, onChange }) {
  const isExperimental = (c) => wiringFor(c.section, c.key).status === 'experimental';
  const main = controls.filter((c) => !isExperimental(c));
  const experimental = controls.filter(isExperimental);
  const render = (c) => (
    <Control key={`${c.section}.${c.key}`} control={c} value={draft[c.section][c.key]} onChange={(v) => onChange(c.section, c.key, v)} />
  );
  return (
    <div className="space-y-5">
      {main.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{main.map(render)}</div>}
      {experimental.length > 0 && (
        <details className="rounded-lg border border-dashed border-border p-3">
          <summary className="cursor-pointer select-none text-sm font-medium">Experimental controls ({experimental.length})</summary>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Stored and validated, but no shared component reads these yet, so changing them will not visibly change the app.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">{experimental.map(render)}</div>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ colors */

export function ContrastChip({ check, onFix }) {
  const pass = check.status === 'pass';
  const ratio = check.ratio === null ? '?' : `${check.ratio.toFixed(1)}:1`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        title={`${check.label}: ${ratio} (needs ${check.min}:1)`}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
          pass ? 'border-border text-muted-foreground' : 'border-destructive/50 text-destructive',
        )}
      >
        {pass ? <Check className="h-3 w-3" aria-hidden="true" /> : <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
        {ratio}
        <span className="sr-only">{pass ? ' passes' : ' fails'} for {check.label}</span>
      </span>
      {!pass && check.fix && onFix && (
        <button
          type="button"
          onClick={() => onFix(check)}
          title={`Set ${COLOR_LABELS[check.fix.key] || check.fix.key} to ${check.fix.color} (${check.fix.ratio.toFixed(1)}:1)`}
          className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Fix
        </button>
      )}
    </span>
  );
}

export function ColorField({ id, label, value, onChange, check, onFix }) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(value); setInvalid(false); }, [value]);

  const commit = () => {
    const hex = normalizeHex(text);
    if (!hex) { setInvalid(true); return; }
    setInvalid(false);
    setText(hex);
    if (hex !== value) onChange(hex);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-2.5">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border" style={{ background: value }}>
        <span className="sr-only">Pick a color for {label}</span>
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1 basis-36">
        <label htmlFor={id} className="block truncate text-sm font-medium">{label}</label>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          placeholder="#RRGGBB, rgb() or hsl()"
          className={cn(
            'mt-0.5 w-full rounded border bg-background px-1.5 py-0.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            invalid ? 'border-destructive' : 'border-input',
          )}
        />
        {invalid && <p className="mt-0.5 text-[11px] text-destructive">Not a valid color. Try #C2410C, rgb(194 65 12) or hsl(17 88% 40%).</p>}
      </div>
      {check && <ContrastChip check={check} onFix={onFix} />}
    </div>
  );
}
