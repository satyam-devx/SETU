import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HEX6_RE } from '@/lib/design/color';
import { DIFF_SECTIONS, SECTION_LABELS, formatValue } from '@/lib/design/diff';

function Value({ value }) {
  if (typeof value === 'string' && HEX6_RE.test(value)) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
        <span className="h-3.5 w-3.5 rounded-sm border border-border" style={{ background: value }} aria-hidden="true" />
        {value}
      </span>
    );
  }
  return <span className="font-mono text-xs">{formatValue(value)}</span>;
}

/** Grouped, human-readable list of config changes. */
export default function DiffList({ changes, limit = 60, emptyLabel = 'No differences.' }) {
  if (!changes.length) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  const shown = changes.slice(0, limit);
  return (
    <div className="space-y-3">
      {DIFF_SECTIONS.map((section) => {
        const rows = shown.filter((c) => c.section === section);
        if (!rows.length) return null;
        return (
          <div key={section}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[section]}</h4>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {rows.map((c) => (
                <li key={c.path} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="min-w-[8rem] flex-1 font-medium">{c.label}</span>
                  <span className="inline-flex flex-wrap items-center gap-2 text-muted-foreground">
                    <Value value={c.before} />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-label="changed to" />
                    <Value value={c.after} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {changes.length > limit && <p className="text-xs text-muted-foreground">Showing {limit} of {changes.length} changes.</p>}
    </div>
  );
}
