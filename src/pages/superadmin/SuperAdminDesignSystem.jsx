import React, { useState } from 'react';
import { Eye, Loader2, RotateCcw, Save, Send, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DESIGN_SCOPES } from '@/lib/design-system';
import { useDesignSystem } from '@/lib/design-system-provider';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import AccessibilityPanel from './design-system/AccessibilityPanel';
import ColorsPanel from './design-system/ColorsPanel';
import { IconsPanel, LayoutPanel, MotionPanel, ThemesPanel, TypographyPanel } from './design-system/ControlPanels';
import ExportPanel from './design-system/ExportPanel';
import PreviewPane from './design-system/PreviewPane';
import PublishDialog from './design-system/PublishDialog';
import { Notice, Segmented } from './design-system/ui';
import { useDesignStudio } from './design-system/useDesignStudio';
import VersionsPanel from './design-system/VersionsPanel';

const TABS = [
  ['colors', 'Colors'], ['typography', 'Type'], ['layout', 'Layout'], ['motion', 'Motion'], ['icons', 'Icons'],
  ['themes', 'Themes'], ['access', 'Access'], ['versions', 'Versions'], ['export', 'Export'],
];
const PANES = [{ value: 'edit', label: 'Edit' }, { value: 'preview', label: 'Preview' }];

function Chip({ children, tone, onClick, title }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tone === 'bad' ? 'border-destructive/50 text-destructive' : 'border-border text-muted-foreground',
        onClick && 'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {children}
    </Tag>
  );
}

function Studio() {
  const { reload: reloadRuntime, preview, startPreview, stopPreview } = useDesignSystem();
  const studio = useDesignStudio({ onPublished: reloadRuntime });
  const [tab, setTab] = useState('colors');
  const [viewMode, setViewMode] = useState('light'); // 'light' | 'dark' | 'both'
  const [pane, setPane] = useState('edit'); // small screens only
  const [publishOpen, setPublishOpen] = useState(false);

  const { scope, draft, audit, dirty, changes, busy, loading, loadFailed } = studio;
  const scopeLabel = DESIGN_SCOPES.find((s) => s.value === scope)?.label || scope;
  const failures = audit.summary.errors;

  const requestScope = (next) => {
    if (next === scope) return;
    if (dirty && !window.confirm('You have unsaved changes. Discard them and switch scope?')) return;
    studio.setScope(next);
  };
  const discard = () => {
    if (window.confirm('Discard all unsaved changes and go back to the live design?')) studio.resetToPublished();
  };

  const scopeSelect = (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">Scope</span>
      <Select value={scope} onValueChange={requestScope}>
        <SelectTrigger className="w-44" aria-label="Design scope"><SelectValue /></SelectTrigger>
        <SelectContent>{DESIGN_SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto pb-24" role="main">
      <AppHeader title="Design System Studio" subtitle="Tokens · live preview · accessibility · versions" rightAction={scopeSelect} />

      <div className="mx-auto max-w-[1440px] space-y-4 p-3 sm:p-5">
        {studio.error && <Notice tone="error" onDismiss={() => studio.setError('')} actions={loadFailed ? <Button size="sm" variant="outline" onClick={studio.reload}>Retry</Button> : null}>{studio.error}</Notice>}
        {studio.notice && <Notice tone="success" onDismiss={() => studio.setNotice('')}>{studio.notice}</Notice>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the {scopeLabel} design
          </div>
        ) : loadFailed ? null : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2" aria-label="Status">
                <Chip>{studio.publishedRow ? `Live v${studio.publishedRow.version}` : 'Using built-in defaults'}</Chip>
                {scope !== 'global' && (
                  <Chip title="Tokens this portal overrides. Everything else follows the Global design.">
                    {studio.overrideCount === 0 ? 'Inherits Global' : `${studio.overrideCount} override${studio.overrideCount === 1 ? '' : 's'} on Global`}
                  </Chip>
                )}
                {dirty ? <Chip tone="bad">Unsaved · {changes.length} change{changes.length === 1 ? '' : 's'}</Chip> : studio.savedDraftCurrent ? <Chip>Draft v{studio.pending.version} saved, not live</Chip> : <Chip>No pending changes</Chip>}
                <Chip tone={failures ? 'bad' : undefined} onClick={() => setTab('access')} title="Open the accessibility audit">
                  {failures ? `${failures} AA contrast issue${failures === 1 ? '' : 's'}` : 'AA contrast OK'}
                </Chip>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={studio.undo} disabled={!studio.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><RotateCcw className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={studio.redo} disabled={!studio.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><RotateCcw className="h-4 w-4 -scale-x-100" /></Button>
                {dirty && <Button type="button" variant="ghost" onClick={discard}>Discard</Button>}
                {scope !== 'global' && studio.overrideCount > 0 && <Button type="button" variant="ghost" onClick={studio.resetToInherited}>Reset to Global</Button>}
                <Button type="button" variant="outline" className="gap-2" onClick={() => startPreview(draft)} title="Apply this draft across the real portals in this browser only">
                  <Eye className="h-4 w-4" aria-hidden="true" /> Preview in app
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={studio.saveDraft} disabled={!dirty || Boolean(busy)} title="Save draft (Ctrl+S)">
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Save draft
                </Button>
                <Button type="button" className="gap-2" onClick={() => setPublishOpen(true)} disabled={!dirty || Boolean(busy)}>
                  <Send className="h-4 w-4" aria-hidden="true" /> Publish…
                </Button>
              </div>
            </div>

            {preview && (
              <Notice
                tone="info"
                actions={
                  <span className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => startPreview(draft)}>Update with current draft</Button>
                    <Button size="sm" variant="outline" onClick={stopPreview}>Exit preview</Button>
                  </span>
                }
              >
                The whole app in this browser is showing an unpublished design. Open any portal to inspect it, then come back here.
              </Notice>
            )}

            <div className="lg:hidden"><Segmented label="Studio view" value={pane} onChange={setPane} options={PANES} /></div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
              <div className={cn('min-w-0', pane === 'preview' && 'hidden lg:block')}>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
                    {TABS.map(([value, label]) => (
                      <TabsTrigger key={value} value={value} className="shrink-0">
                        {label}
                        {value === 'access' && failures > 0 && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive" aria-label={`${failures} issues`} />}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="colors" className="mt-4"><ColorsPanel studio={studio} mode={viewMode === 'dark' ? 'dark' : 'light'} onModeChange={setViewMode} /></TabsContent>
                  <TabsContent value="typography" className="mt-4"><TypographyPanel studio={studio} /></TabsContent>
                  <TabsContent value="layout" className="mt-4"><LayoutPanel studio={studio} /></TabsContent>
                  <TabsContent value="motion" className="mt-4"><MotionPanel studio={studio} /></TabsContent>
                  <TabsContent value="icons" className="mt-4"><IconsPanel studio={studio} /></TabsContent>
                  <TabsContent value="themes" className="mt-4"><ThemesPanel studio={studio} /></TabsContent>
                  <TabsContent value="access" className="mt-4"><AccessibilityPanel studio={studio} /></TabsContent>
                  <TabsContent value="versions" className="mt-4"><VersionsPanel studio={studio} /></TabsContent>
                  <TabsContent value="export" className="mt-4"><ExportPanel studio={studio} /></TabsContent>
                </Tabs>
              </div>

              <div className={cn('min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto', pane === 'edit' && 'hidden lg:block')}>
                <PreviewPane config={draft} mode={viewMode} onModeChange={setViewMode} />
              </div>
            </div>
          </>
        )}
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} studio={studio} scopeLabel={scopeLabel} />
    </div>
  );
}

export default function SuperAdminDesignSystem() {
  const { can } = usePermissions();
  if (!can('settings.update')) {
    return (
      <div className="flex-1 p-6">
        <AppHeader title="Design System Studio" subtitle="Centralized appearance controls" />
        <Card className="mx-auto mt-8 max-w-xl p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-semibold">Permission required</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your account needs the settings.update permission to manage the design system.</p>
        </Card>
      </div>
    );
  }
  return <Studio />;
}
