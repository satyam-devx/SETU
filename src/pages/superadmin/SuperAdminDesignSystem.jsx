import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, History, Loader2, Palette, RotateCcw, Save, Send, Type, LayoutTemplate, Sparkles, Shapes, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/lib/permissions';
import { DESIGN_SCOPES, DEFAULT_DESIGN, FONT_OPTIONS, DesignSystemAPI, mergeDesign } from '@/lib/design-system';
import { applyDesignTokens, useDesignSystem } from '@/lib/design-system-provider';
import DesignIcon from '@/components/shared/DesignIcon';

const COLOR_GROUPS = [
  { title: 'Core surfaces', keys: ['background','foreground','card','cardForeground','popover','popoverForeground','border','input','muted','mutedForeground'] },
  { title: 'Brand & actions', keys: ['primary','primaryForeground','secondary','secondaryForeground','accent','accentForeground','ring'] },
  { title: 'Status colors', keys: ['destructive','destructiveForeground','setuSuccess','setuWarning'] },
  { title: 'SETU brand tokens', keys: ['setuSaffron','setuTeal','setuEarth'] },
  { title: 'Admin sidebar', keys: ['sidebar','sidebarForeground','sidebarBorder','sidebarAccent','sidebarPrimary'] },
  { title: 'Analytics charts', keys: ['chart1','chart2','chart3','chart4','chart5'] },
];
const COLOR_LABELS = {
  background:'Background', foreground:'Main text', card:'Card surface', cardForeground:'Card text', popover:'Popover surface', popoverForeground:'Popover text', border:'Borders', input:'Input border', muted:'Muted surface', mutedForeground:'Muted text',
  primary:'Primary', primaryForeground:'Primary text', secondary:'Secondary', secondaryForeground:'Secondary text', accent:'Accent', accentForeground:'Accent text', ring:'Focus ring',
  destructive:'Error / destructive', destructiveForeground:'Error text', setuSaffron:'SETU saffron', setuTeal:'SETU teal', setuEarth:'SETU earth', setuSuccess:'Success', setuWarning:'Warning',
  sidebar:'Sidebar background', sidebarForeground:'Sidebar text', sidebarBorder:'Sidebar border', sidebarAccent:'Sidebar accent', sidebarPrimary:'Sidebar primary', chart1:'Chart palette 1', chart2:'Chart palette 2', chart3:'Chart palette 3', chart4:'Chart palette 4', chart5:'Chart palette 5',
};
const FONT_FAMILY_OPTIONS = FONT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>);

function SectionHeading({ icon: Icon, title, description }) {
  return <div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}
function Field({ label, help, children }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{label}</p>{help && <p className="text-xs text-muted-foreground">{help}</p>}</div><div className="sm:min-w-56">{children}</div></div>;
}
function contrastRatio(hexA, hexB) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(hexA), b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function ContrastCheck({ colors }) {
  const pairs = [
    ['Main text / background', colors.foreground, colors.background],
    ['Card text / card', colors.cardForeground, colors.card],
    ['Primary text / primary', colors.primaryForeground, colors.primary],
    ['Secondary text / secondary', colors.secondaryForeground, colors.secondary],
    ['Muted text / muted surface', colors.mutedForeground, colors.muted],
  ];
  return <section className="rounded-xl border border-border p-4"><div className="mb-3"><h3 className="font-semibold">Contrast checks</h3><p className="mt-1 text-xs text-muted-foreground">WCAG AA normal-text target: 4.5:1. This is a token-pair estimate, not a full page accessibility audit.</p></div><div className="grid gap-2 sm:grid-cols-2">{pairs.map(([label, fg, bg]) => { const valid = /^#[0-9A-F]{6}$/i.test(fg || '') && /^#[0-9A-F]{6}$/i.test(bg || ''); const ratio = valid ? contrastRatio(fg, bg) : null; const pass = ratio !== null && ratio >= 4.5; return <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"><div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{fg} on {bg}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${pass ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>{ratio === null ? 'Enter valid HEX · Review' : `${ratio.toFixed(2)}:1 · ${pass ? 'Pass' : 'Review'}`}</span></div>; })}</div></section>;
}

export default function SuperAdminDesignSystem() {
  const { can } = usePermissions();
  const { design: publishedDesign, reload: reloadPublished } = useDesignSystem();
  const allowed = can('settings.update');
  const [scope, setScope] = useState('global');
  const [tab, setTab] = useState('colors');
  const [colorMode, setColorMode] = useState('light');
  const [draft, setDraft] = useState(() => mergeDesign(DEFAULT_DESIGN, publishedDesign));
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [pendingVersion, setPendingVersion] = useState(null);
  const previousDarkMode = useRef(null);
  const restorePreviewTheme = useCallback(() => {
    if (typeof document === 'undefined') return;
    delete window.__SETU_DESIGN_PREVIEW__;
    if (previousDarkMode.current !== null) {
      document.documentElement.classList.toggle('dark', previousDarkMode.current);
      previousDarkMode.current = null;
    }
    applyDesignTokens(publishedDesign);
  }, [publishedDesign]);
  useEffect(() => () => {
    if (typeof window !== 'undefined') delete window.__SETU_DESIGN_PREVIEW__;
    if (typeof document !== 'undefined' && previousDarkMode.current !== null) document.documentElement.classList.toggle('dark', previousDarkMode.current);
  }, []);

  useEffect(() => {
    let active = true;
    DesignSystemAPI.getPublished(scope).then(({ data }) => { if (active) setDraft(mergeDesign(DEFAULT_DESIGN, data?.config || (scope === 'global' ? publishedDesign : null))); });
    return () => { active = false; };
  }, [scope, publishedDesign]);
  const loadVersions = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: e } = await DesignSystemAPI.listVersions(scope);
    if (e) setError(e.message || 'Could not load design versions. Apply migration 110 and retry.');
    else setVersions(data);
    setLoading(false);
  }, [scope]);
  useEffect(() => { if (allowed) loadVersions(); }, [allowed, loadVersions]);

  const update = (section, key, value) => setDraft((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const applyPreview = () => {
    const root = document.documentElement;
    if (previousDarkMode.current === null) previousDarkMode.current = root.classList.contains('dark');
    root.classList.toggle('dark', colorMode === 'dark');
    window.__SETU_DESIGN_PREVIEW__ = { config: draft, colorMode };
    applyDesignTokens(draft, { colorMode });
    setPreviewing(true);
    setNotice(`Local ${colorMode} preview is active. Publish to make the design live.`);
  };
  const resetPreview = async () => {
    const { data } = await DesignSystemAPI.getPublished(scope);
    const restored = mergeDesign(DEFAULT_DESIGN, data?.config || (scope === 'global' ? publishedDesign : null));
    restorePreviewTheme(); applyDesignTokens(restored); setDraft(restored); setPreviewing(false);
    setNotice('Preview cleared; published design restored.');
  };
  const saveDraft = async () => {
    setBusy(true); setError(''); setNotice('');
    const { data, error: e } = await DesignSystemAPI.saveDraft(scope, draft, note.trim());
    if (e) { setError(e.message || 'Draft save failed.'); setBusy(false); return; }
    setPendingVersion(data?.id || null);
    setNotice(`Version ${data?.version ?? ''} saved as draft. Review it, then publish when ready.`);
    setNote('');
    await loadVersions();
    setBusy(false);
  };
  const publish = async (versionId) => {
    if (!versionId) return;
    setBusy(true); setError(''); setNotice('');
    const { data, error: e } = await DesignSystemAPI.publish(versionId);
    if (e) { setError(e.message || 'Publish failed.'); setBusy(false); return; }
    setPendingVersion(null); setPreviewing(false); restorePreviewTheme();
    await reloadPublished(); await loadVersions();
    setNotice(`Published ${data?.scope || scope} design version ${data?.version}.`);
    setBusy(false);
  };
  const publishedVersion = useMemo(() => versions.find((v) => v.status === 'published'), [versions]);

  if (!allowed) return <div className="flex-1 p-6"><AppHeader title="Design System Studio" subtitle="Centralized appearance controls" /><Card className="mx-auto mt-8 max-w-xl p-8 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><h2 className="font-semibold">Permission required</h2><p className="mt-2 text-sm text-muted-foreground">Your account needs the settings.update permission to manage the design system.</p></Card></div>;

  return <div className="flex-1 overflow-auto pb-24" role="main">
    <AppHeader title="Design System Studio" subtitle="Centralized visual tokens · drafts · publish · rollback" rightAction={<div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">Scope</span><Select value={scope} onValueChange={(value) => { restorePreviewTheme(); setScope(value); setPendingVersion(null); setPreviewing(false); applyDesignTokens(publishedDesign); }}><SelectTrigger className="w-44" aria-label="Design scope"><SelectValue /></SelectTrigger><SelectContent>{DESIGN_SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>} />
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Editing scope</p><p className="mt-1 font-semibold">{DESIGN_SCOPES.find((s) => s.value === scope)?.label}</p><p className="mt-1 text-xs text-muted-foreground">Portal-specific settings fall back to Global default.</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Published version</p><p className="mt-1 font-semibold">{publishedVersion ? `v${publishedVersion.version}` : 'Default tokens'}</p><p className="mt-1 text-xs text-muted-foreground">{publishedVersion ? new Date(publishedVersion.published_at).toLocaleString() : 'No database version published yet'}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Draft state</p><p className="mt-1 font-semibold">{previewing ? 'Preview active' : pendingVersion ? 'Draft ready to publish' : 'Not previewing'}</p><p className="mt-1 text-xs text-muted-foreground">Edits do not go live until published.</p></Card>
      </div>
      {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div>}
      {notice && <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span>{notice}</span></div>}
      <Card className="overflow-hidden">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-border px-3 pt-3"><TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">{[
            ['colors','Colors',Palette],['typography','Typography',Type],['layout','Layout',LayoutTemplate],['motion','Motion',Sparkles],['icons','Icons',Shapes],['themes','Themes',Eye],['versions','Versions',History],
          ].map(([value,label,Icon]) => <TabsTrigger key={value} value={value} className="gap-2 rounded-b-none px-3 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"><Icon className="h-4 w-4"/>{label}</TabsTrigger>)}</TabsList></div>
          <div className="p-4 sm:p-6">
            <TabsContent value="colors" className="mt-0 space-y-6">
              <SectionHeading icon={Palette} title="Global color tokens" description="Edit the semantic colors consumed by shared components. Use contrast-safe foreground/background combinations."/>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"><div><p className="text-sm font-medium">Theme palette</p><p className="text-xs text-muted-foreground">Light and dark colors publish together.</p></div><Select value={colorMode} onValueChange={setColorMode}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="light">Light theme</SelectItem><SelectItem value="dark">Dark theme</SelectItem></SelectContent></Select></div>
              {COLOR_GROUPS.map((group) => <section key={group.title}><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3><div className="grid gap-3 md:grid-cols-2">{group.keys.map((key) => { const paletteKey = colorMode === 'dark' ? 'darkColors' : 'colors'; return <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{COLOR_LABELS[key]}</span><input aria-label={`${COLOR_LABELS[key]} HEX value`} inputMode="text" maxLength={7} value={draft[paletteKey][key]} onChange={(e) => { const value=e.target.value.toUpperCase(); if (/^#[0-9A-F]{0,6}$/.test(value)) update(paletteKey,key,value); }} onBlur={() => { if (!/^#[0-9A-F]{6}$/.test(draft[paletteKey][key])) update(paletteKey,key,DEFAULT_DESIGN[paletteKey][key]); }} className="mt-1 w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" /></span><input aria-label={`${COLOR_LABELS[key]} color picker`} type="color" value={/^#[0-9A-F]{6}$/i.test(draft[paletteKey][key]) ? draft[paletteKey][key] : DEFAULT_DESIGN[paletteKey][key]} onChange={(e) => update(paletteKey, key, e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"/></label>; })}</div></section>)}
              <ContrastCheck colors={draft[colorMode === 'dark' ? 'darkColors' : 'colors']} />
            </TabsContent>
            <TabsContent value="typography" className="mt-0 space-y-5"><SectionHeading icon={Type} title="Typography" description="Font families are allow-listed to avoid arbitrary CSS and keep the interface readable."/>
              <div className="space-y-4"><Field label="Body font" help="Default text across the app"><Select value={draft.typography.bodyFont} onValueChange={(v) => update('typography','bodyFont',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_FAMILY_OPTIONS}</SelectContent></Select></Field><Field label="Heading font"><Select value={draft.typography.headingFont} onValueChange={(v) => update('typography','headingFont',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_FAMILY_OPTIONS}</SelectContent></Select></Field><Field label="Monospace font"><Select value={draft.typography.monoFont} onValueChange={(v) => update('typography','monoFont',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FONT_FAMILY_OPTIONS}</SelectContent></Select></Field><Field label="Base font size" help="14–20 px; accessibility-friendly range"><div className="flex items-center gap-3"><input type="range" min="14" max="20" value={draft.typography.baseFontSize} onChange={(e) => update('typography','baseFontSize',Number(e.target.value))} className="w-full"/><span className="w-12 text-right text-sm">{draft.typography.baseFontSize}px</span></div></Field></div>
              <div className="space-y-4 rounded-xl border border-border p-4"><Field label="Heading scale"><Select value={draft.typography.headingScale} onValueChange={(v)=>update('typography','headingScale',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="expressive">Expressive</SelectItem></SelectContent></Select></Field><Field label="Body weight"><Select value={draft.typography.bodyWeight} onValueChange={(v)=>update('typography','bodyWeight',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="400">Regular</SelectItem><SelectItem value="500">Medium</SelectItem></SelectContent></Select></Field><Field label="Heading weight"><Select value={draft.typography.headingWeight} onValueChange={(v)=>update('typography','headingWeight',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="500">Medium</SelectItem><SelectItem value="600">Semibold</SelectItem><SelectItem value="700">Bold</SelectItem><SelectItem value="800">Extra bold</SelectItem></SelectContent></Select></Field><Field label="Line height"><Select value={draft.typography.lineHeight} onValueChange={(v)=>update('typography','lineHeight',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="tight">Tight</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="relaxed">Relaxed</SelectItem></SelectContent></Select></Field><Field label="Letter spacing"><Select value={draft.typography.letterSpacing} onValueChange={(v)=>update('typography','letterSpacing',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="tight">Tight</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="wide">Wide</SelectItem></SelectContent></Select></Field></div>
              <div className="rounded-xl border border-border p-5" style={{fontFamily: draft.typography.bodyFont === 'inter' ? 'Inter, system-ui' : draft.typography.bodyFont === 'roboto' ? 'Roboto, system-ui' : draft.typography.bodyFont === 'nunito' ? 'Nunito Sans, system-ui' : draft.typography.bodyFont === 'mono' ? 'monospace' : 'system-ui', fontSize: `${draft.typography.baseFontSize}px`}}><p className="text-xs uppercase tracking-widest text-muted-foreground">Live type specimen</p><h3 className="mt-2 font-bold setu-design-heading-1">SETU connects local Bharat</h3><p className="mt-2 text-sm">Readable interfaces for customers, vendors, riders and village services.</p></div>
            </TabsContent>
            <TabsContent value="layout" className="mt-0 space-y-5"><SectionHeading icon={LayoutTemplate} title="Layout & surfaces" description="Control shared component radius, shadow presets and content width."/>
              <Field label="Corner radius"><Select value={draft.layout.radius} onValueChange={(v) => update('layout','radius',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['8px','10px','12px','16px','20px'].map((v)=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Card shadow"><Select value={draft.layout.shadow} onValueChange={(v) => update('layout','shadow',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="soft">Soft</SelectItem><SelectItem value="elevated">Elevated</SelectItem></SelectContent></Select></Field>
              <Field label="Content width"><Select value={draft.layout.contentWidth} onValueChange={(v) => update('layout','contentWidth',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="wide">Wide</SelectItem></SelectContent></Select></Field>
              <div className="space-y-4 rounded-xl border border-border p-4"><Field label="Spacing scale"><Select value={draft.layout.spacingScale} onValueChange={(v)=>update('layout','spacingScale',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></Field><Field label="Button height"><Select value={draft.layout.buttonHeight} onValueChange={(v)=>update('layout','buttonHeight',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select></Field><Field label="Input height"><Select value={draft.layout.inputHeight} onValueChange={(v)=>update('layout','inputHeight',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select></Field><Field label="Card padding"><Select value={draft.layout.cardPadding} onValueChange={(v)=>update('layout','cardPadding',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></Field><Field label="Grid gap"><Select value={draft.layout.gridGap} onValueChange={(v)=>update('layout','gridGap',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></Field><Field label="Navigation density"><Select value={draft.layout.navDensity} onValueChange={(v)=>update('layout','navDensity',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></Field><Field label="Custom utility breakpoint"><Select value={draft.layout.breakpoint} onValueChange={(v)=>update('layout','breakpoint',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="compact">640 px</SelectItem><SelectItem value="standard">768 px</SelectItem><SelectItem value="wide">900 px</SelectItem></SelectContent></Select></Field><p className="text-xs text-muted-foreground">These settings affect components that opt into the shared SETU design utilities; existing Tailwind breakpoint classes remain unchanged.</p></div>
              <div className="grid gap-3 sm:grid-cols-3">{['compact','standard','wide'].map((v)=><button key={v} onClick={() => update('layout','contentWidth',v)} className={`rounded-xl border p-4 text-left ${draft.layout.contentWidth===v?'border-primary bg-primary/5':'border-border'}`}><div className="mx-auto mb-3 h-12 rounded border border-dashed border-muted-foreground/50" style={{width:v==='compact'?'45%':v==='standard'?'65%':'90%'}}/><p className="text-sm font-medium capitalize">{v}</p></button>)}</div>
            </TabsContent>
            <TabsContent value="motion" className="mt-0 space-y-5"><SectionHeading icon={Sparkles} title="Motion & transitions" description="Reduce decorative movement for performance and accessibility."/><Field label="Enable decorative motion" help="Users' OS reduced-motion preference remains respected"><Switch checked={draft.motion.enabled} onCheckedChange={(v) => update('motion','enabled',v)}/></Field><Field label="Transition speed"><Select value={draft.motion.duration} onValueChange={(v) => update('motion','duration',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="fast">Fast</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="slow">Slow</SelectItem></SelectContent></Select></Field><p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">This setting controls the shared motion token and opt-in utility classes. Component-specific animations need to consume these tokens to be affected.</p></TabsContent>
            <TabsContent value="themes" className="mt-0 space-y-5"><SectionHeading icon={Eye} title="Theme policy" description="Set the default appearance policy for supported portals. User theme preference controls require the application theme switcher to consume this policy."/><Field label="Default theme"><Select value={draft.theme.defaultMode} onValueChange={(v)=>update('theme','defaultMode',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="system">System default</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent></Select></Field><Field label="Allow users to choose theme" help="Policy token; existing theme controls must read this setting to enforce it everywhere"><Switch checked={draft.theme.allowUserSelection} onCheckedChange={(v)=>update('theme','allowUserSelection',v)}/></Field><div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">Light and dark token palettes are managed in Colors. Theme policy is stored per scope; automatic enforcement across every portal is not claimed until each portal's theme preference UI consumes it.</div></TabsContent>
            <TabsContent value="icons" className="mt-0 space-y-5"><SectionHeading icon={Shapes} title="Icon defaults" description="SETU uses lucide-react. These controls establish shared size/stroke defaults; semantic icon replacement requires components to use the shared icon wrapper."/><Field label="Default icon size" help="14–32 px"><div className="flex items-center gap-3"><input type="range" min="14" max="32" value={draft.icons.size} onChange={(e) => update('icons','size',Number(e.target.value))} className="w-full"/><span className="w-12 text-right text-sm">{draft.icons.size}px</span></div></Field><Field label="Default stroke width" help="1–3"><div className="flex items-center gap-3"><input type="range" min="1" max="3" step="0.5" value={draft.icons.strokeWidth} onChange={(e) => update('icons','strokeWidth',Number(e.target.value))} className="w-full"/><span className="w-12 text-right text-sm">{draft.icons.strokeWidth}</span></div></Field><div className="flex items-center gap-4 rounded-xl border border-border p-4"><DesignIcon icon={Palette} size={draft.icons.size} strokeWidth={draft.icons.strokeWidth}/><DesignIcon icon={History} size={draft.icons.size} strokeWidth={draft.icons.strokeWidth}/><DesignIcon icon={ShieldCheck} size={draft.icons.size} strokeWidth={draft.icons.strokeWidth}/><span className="text-xs text-muted-foreground">Icon preview</span></div><div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">{['home','search','orders','profile','cart','location','settings','help'].map((key)=><div key={key} className="flex min-w-16 flex-col items-center gap-1 text-muted-foreground"><DesignIcon icon={key} size={draft.icons.size} strokeWidth={draft.icons.strokeWidth}/><span className="text-[10px] capitalize">{key}</span></div>)}</div>
              <div className="space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">Semantic icon mappings</h3>{Object.entries(draft.icons.mappings || {}).map(([key,value])=><Field key={key} label={key.charAt(0).toUpperCase()+key.slice(1)}><Select value={value} onValueChange={(v)=>setDraft((current)=>({...current,icons:{...current.icons,mappings:{...current.icons.mappings,[key]:v}}}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['House','Search','Package','UserRound','ShoppingCart','MapPin','Settings','CircleHelp','LayoutDashboard','Heart','Bell','Store','Bike','Map','ShieldCheck'].map((name)=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></Field>)}</div><p className="text-xs text-muted-foreground">Custom SVG upload is intentionally disabled: safely enabling it requires a server-side SVG sanitizer and controlled storage policy. Semantic mappings only select allow-listed bundled Lucide icons.</p></TabsContent>
            <TabsContent value="versions" className="mt-0 space-y-4"><SectionHeading icon={History} title="Versions & rollback" description="Published versions are retained. Publishing a previous version rolls back that scope without deleting history."/>{loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading versions…</div> : versions.length===0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><History className="mx-auto mb-2 h-6 w-6 text-muted-foreground"/><p className="font-medium">No saved versions yet</p><p className="mt-1 text-sm text-muted-foreground">Save a draft, then publish it to create the first version.</p></div> : <div className="space-y-3">{versions.map((v)=><div key={v.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Version {v.version}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${v.status==='published'?'bg-emerald-500/10 text-emerald-700':v.status==='draft'?'bg-amber-500/10 text-amber-700':'bg-muted text-muted-foreground'}`}>{v.status}</span></div><p className="mt-1 text-xs text-muted-foreground">Created {new Date(v.created_at).toLocaleString()}</p>{v.note && <p className="mt-1 text-sm">{v.note}</p>}</div><div className="flex gap-2">{v.status==='draft' && <Button size="sm" onClick={() => publish(v.id)} disabled={busy} className="gap-2"><Send className="h-3.5 w-3.5"/>Publish</Button>}{v.status!=='draft' && <Button size="sm" variant="outline" onClick={() => { setDraft(mergeDesign(DEFAULT_DESIGN,v.config)); setPendingVersion(null); setTab('colors'); setNotice(`Version ${v.version} loaded into editor. Save as a new draft to roll it back safely.`); }} className="gap-2"><RotateCcw className="h-3.5 w-3.5"/>Load into editor</Button>}</div></div>)}</div>}</TabsContent>
          </div>
        </Tabs>
      </Card>
      <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 flex-1"><p className="font-semibold">Draft & publish</p><p className="mt-1 text-sm text-muted-foreground">Changes are not live until published. Save a draft first, preview it, then publish the reviewed version.</p><Input className="mt-3 max-w-xl" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Version note (optional, e.g. Diwali palette update)" maxLength={500}/></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={applyPreview} className="gap-2"><Eye className="h-4 w-4"/>Preview {colorMode}</Button><Button variant="outline" onClick={resetPreview} className="gap-2"><RotateCcw className="h-4 w-4"/>Reset preview</Button><Button variant="outline" onClick={() => { setDraft(mergeDesign(DEFAULT_DESIGN, {})); setPendingVersion(null); setNotice("Editor reset to built-in defaults. Save as a draft to persist this configuration."); }} className="gap-2"><RotateCcw className="h-4 w-4"/>Restore defaults</Button><Button onClick={saveDraft} disabled={busy} className="gap-2"><Save className="h-4 w-4"/>{busy?'Working…':'Save draft'}</Button>{pendingVersion && <Button onClick={()=>publish(pendingVersion)} disabled={busy} className="gap-2"><Send className="h-4 w-4"/>Publish draft</Button>}</div></div><p className="mt-3 text-[11px] text-muted-foreground">Security: draft/publish RPCs require settings.update, validate supported token values server-side, and record actions in audit_log. Database migration 110 must be applied before using persistence.</p></Card>
    </div>
  </div>;
}
