import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { autoFixContrast } from '@/lib/design/a11y';
import { COLOR_LABELS } from '@/lib/design/schema';
import { cn } from '@/lib/utils';
import { Notice, Panel } from './ui';

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone === 'bad' && 'text-destructive')}>{value}</p>
    </div>
  );
}

function CheckRow({ check, onFix }) {
  const pass = check.status === 'pass';
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span
        className="inline-flex h-8 w-11 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold"
        style={{ color: check.fg, background: check.bg }}
        aria-hidden="true"
      >
        Aa
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="truncate text-xs text-muted-foreground">{COLOR_LABELS[check.fgKey]} on {COLOR_LABELS[check.bgKey]}</p>
      </div>
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium tabular-nums', pass ? 'text-muted-foreground' : 'text-destructive')}>
        {pass ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        {check.ratio === null ? 'invalid' : `${check.ratio.toFixed(2)}:1`} · {check.level}
        <span className="sr-only">, needs {check.min}:1</span>
      </span>
      {!pass && check.fix && (
        <Button type="button" size="sm" variant="outline" onClick={() => onFix(check)}>
          Set {COLOR_LABELS[check.fix.key]} to {check.fix.color}
        </Button>
      )}
    </li>
  );
}

function CheckGroup({ title, checks, onFix }) {
  if (!checks.length) return null;
  const failing = checks.filter((c) => c.status !== 'pass');
  const passing = checks.filter((c) => c.status === 'pass');
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {failing.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-destructive/40 bg-card">
          {failing.map((c) => <CheckRow key={c.id} check={c} onFix={onFix} />)}
        </ul>
      )}
      {passing.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm">{passing.length} passing</summary>
          <ul className="divide-y divide-border border-t border-border bg-card">
            {passing.map((c) => <CheckRow key={c.id} check={c} onFix={onFix} />)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function AccessibilityPanel({ studio }) {
  const { draft, audit, replaceDraft, setColor } = studio;
  const [lastFix, setLastFix] = useState(null);
  const { summary } = audit;

  const fixAll = () => {
    const result = autoFixContrast(draft);
    replaceDraft(result.config);
    setLastFix(result);
  };
  const fixOne = (check) => { setLastFix(null); setColor(check.mode, check.fix.key, check.fix.color); };

  return (
    <Panel
      title="Accessibility"
      description="WCAG contrast for every text and UI pair, in both palettes, plus touch-target and font-size advisories."
      icon={ShieldCheck}
      actions={
        <Button type="button" onClick={fixAll} disabled={summary.errors === 0} className="gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Fix all text contrast
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Stat label="AA text score" value={`${summary.score}%`} tone={summary.errors ? 'bad' : undefined} />
        <Stat label="Failing text pairs" value={summary.errors} tone={summary.errors ? 'bad' : undefined} />
        <Stat label="Advisories" value={summary.warnings} />
      </div>

      {lastFix && (
        <Notice tone={lastFix.remaining ? 'warning' : 'success'} onDismiss={() => setLastFix(null)}>
          {lastFix.changes.length === 0
            ? 'Nothing could be adjusted automatically.'
            : `Adjusted ${lastFix.changes.length} token${lastFix.changes.length === 1 ? '' : 's'} by the smallest change that passes: ${lastFix.changes.slice(0, 6).map((c) => `${COLOR_LABELS[c.key]} (${c.mode}) ${c.from} to ${c.to}`).join('; ')}${lastFix.changes.length > 6 ? '…' : ''}.`}
          {lastFix.remaining > 0 && ` ${lastFix.remaining} pair${lastFix.remaining === 1 ? '' : 's'} still fail because they need conflicting colors; edit those tokens manually.`}
          {' '}Undo restores the previous colors.
        </Notice>
      )}

      {['light', 'dark'].map((mode) => (
        <div key={mode} className="space-y-4">
          <h3 className="text-sm font-semibold">{mode === 'light' ? 'Light palette' : 'Dark palette'}</h3>
          <CheckGroup title="Text (must reach 4.5:1)" checks={audit.modes[mode].filter((c) => c.kind === 'text')} onFix={fixOne} />
          <CheckGroup title="UI and graphics (3:1 advised)" checks={audit.modes[mode].filter((c) => c.kind === 'ui')} onFix={fixOne} />
        </div>
      ))}

      {audit.modes.size.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sizing</h3>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {audit.modes.size.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                {c.status === 'pass'
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="OK" />
                  : <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Advisory" />}
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This audits token pairs. It cannot see text placed over images or custom one-off colors in individual pages, so keep running the app&apos;s own accessibility tests.
      </p>
    </Panel>
  );
}
