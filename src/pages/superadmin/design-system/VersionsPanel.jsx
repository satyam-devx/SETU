import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { diffConfigs } from '@/lib/design/diff';
import { cn } from '@/lib/utils';
import DiffList from './DiffList';
import { Notice, Panel } from './ui';

const STATUS = {
  published: { label: 'Live', dot: 'bg-setu-success' },
  draft: { label: 'Draft', dot: 'bg-setu-warning' },
  superseded: { label: 'Replaced', dot: 'bg-muted-foreground' },
};
const PAGE = 10;

export default function VersionsPanel({ studio }) {
  const { versions, draft, versionConfig, restoreVersion, rollbackTo, busy, dirty, scope } = studio;
  const [compareId, setCompareId] = useState(null);
  const [visible, setVisible] = useState(PAGE);
  const compared = versions.find((v) => v.id === compareId) || null;
  const diff = useMemo(() => (compared ? diffConfigs(versionConfig(compared), draft) : []), [compared, versionConfig, draft]);

  const confirmRollback = (v) => {
    const warning = dirty ? '\n\nYou have unsaved editor changes. They will be discarded.' : '';
    if (window.confirm(`Make v${v.version} live again for the ${scope} design?${warning}`)) rollbackTo(v);
  };

  return (
    <Panel title="Versions" description="Every save is kept. Compare any version with your editor, load it, or roll back in one step." icon={History}>
      {versions.length === 0 && <Notice tone="info">Nothing has been saved for this scope yet. The app is using the built-in default tokens.</Notice>}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {versions.slice(0, visible).map((v) => {
          const s = STATUS[v.status] || STATUS.superseded;
          return (
            <li key={v.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold tabular-nums">v{v.version}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', s.dot)} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
              </div>
              {v.note && <p className="text-sm text-muted-foreground">{v.note}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={compareId === v.id ? 'secondary' : 'outline'} onClick={() => setCompareId(compareId === v.id ? null : v.id)}>
                  {compareId === v.id ? 'Hide comparison' : 'Compare with editor'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => restoreVersion(v)}>Load into editor</Button>
                {v.status === 'superseded' && (
                  <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => confirmRollback(v)}>Roll back to this</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {versions.length > visible && (
        <Button type="button" variant="ghost" onClick={() => setVisible((n) => n + PAGE)}>Show older versions ({versions.length - visible} more)</Button>
      )}

      {compared && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">v{compared.version} compared with your editor</h3>
          <p className="text-xs text-muted-foreground">Left is the stored version, right is what your editor holds now.</p>
          <DiffList changes={diff} emptyLabel="Identical to your editor." />
        </div>
      )}
    </Panel>
  );
}
