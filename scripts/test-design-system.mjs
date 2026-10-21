#!/usr/bin/env node
/**
 * Static contract tests for the Design System: wiring between files that cannot
 * be checked by unit tests (routes, SQL security, provider/page structure).
 * Token/engine behaviour lives in scripts/test-design-engine.mjs and the Studio
 * state machine in scripts/test-design-studio.mjs. Needs no installed dependencies.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8');
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};

const schema = read('src/lib/design/schema.js');
const provider = read('src/lib/design-system-provider.jsx');
const page = read('src/pages/superadmin/SuperAdminDesignSystem.jsx');
const css = read('src/index.css');
const tailwind = read('tailwind.config.js');
const migration = read('supabase/migrations/20240101000110_design_system_studio.sql');
const app = read('src/App.jsx');
const sidebar = read('src/components/admin/SuperAdminSidebar.jsx');

// Engine layout
for (const f of ['color', 'schema', 'css', 'a11y', 'diff', 'exporters', 'presets', 'history', 'cache']) {
  assert(fs.existsSync(`src/lib/design/${f}.js`), `Engine module missing: src/lib/design/${f}.js`);
}
for (const token of ['popover', 'popoverForeground', 'primary', 'secondary', 'setuSaffron', 'sidebarPrimary', 'chart1', 'chart5']) {
  assert(schema.includes(`'${token}'`), `Token missing from schema: ${token}`);
  assert(migration.includes(`'${token}'`), `Database allow-list missing: ${token}`);
}
for (const section of ['colors', 'darkColors', 'typography', 'layout', 'motion', 'icons', 'theme']) {
  assert(schema.includes(`${section}:`), `Config section missing: ${section}`);
}

// Database surface and security
for (const rpc of ['get_published_design_system', 'list_design_system_versions', 'save_design_system_draft', 'publish_design_system_version']) {
  assert(migration.includes(`function public.${rpc}`), `RPC missing: ${rpc}`);
}
assert(migration.includes("has_permission('settings.update')"), 'Server-side settings permission checks missing');
assert(migration.includes('design_system_published'), 'Publish audit log missing');
assert(migration.includes('v_config := coalesce(v_global.config'), 'Portal config must inherit global config');
assert(migration.includes('revoke all on function public.save_design_system_draft'), 'Draft RPC must revoke default PUBLIC execute');

// Routing
assert(app.includes('SuperAdminDesignSystem'), 'Design System route import missing');
assert(app.includes('path="design-system"'), 'Design System route missing');
assert(sidebar.includes('/superadmin/design-system'), 'Sidebar entry missing');

// Provider: offline-first, no hidden globals, safe fallbacks
assert(provider.includes('readCachedConfig') && provider.includes('writeCache'), 'Provider must use the offline-first cache');
assert(provider.includes('setPublished(DEFAULT_DESIGN)') && provider.includes('clearCache'), 'Provider must reset to defaults (and drop stale cache) when a scope has no published config');
assert(provider.includes('startPreview') && provider.includes('stopPreview'), 'Provider must expose preview controls');
assert(provider.includes('sanitizeConfig'), 'Server config must be sanitized before it is applied');
assert(provider.includes('MutationObserver'), 'Provider must re-apply tokens when the light/dark class changes');
for (const file of walk('src')) {
  assert(!read(file).includes('__SETU_DESIGN_PREVIEW__'), `Hidden preview global still referenced in ${file}`);
}

// Studio structure
for (const panel of ['ColorsPanel', 'ControlPanels', 'PreviewPane', 'AccessibilityPanel', 'VersionsPanel', 'ExportPanel', 'PublishDialog', 'useDesignStudio']) {
  assert(page.includes(`design-system/${panel}`), `Studio page does not use ${panel}`);
}
assert(page.includes("can('settings.update')"), 'Studio must be gated by settings.update');
assert(page.includes('startPreview'), 'Studio must offer in-app preview');
assert(read('src/pages/superadmin/design-system/ControlPanels.jsx').includes('Semantic icon mapping'), 'Semantic icon mapping UI missing');
assert(read('src/pages/superadmin/design-system/PublishDialog.jsx').includes('WCAG AA'), 'Publish dialog must surface accessibility failures');
assert(read('src/pages/superadmin/design-system/useDesignStudio.js').includes('extractOverrides'), 'Scoped saves must store overrides only');

// App-wide consumption of the tokens
assert(tailwind.includes('var(--setu-font-body'), 'Tailwind sans font must consume centralized token');
assert(tailwind.includes('var(--setu-motion-duration'), 'Tailwind transitions must consume the motion token');
assert(css.includes('--setu-motion-duration'), 'Motion token missing');
assert(css.includes('.setu-design-icon'), 'Shared icon utility missing');
assert(css.includes('--setu-button-height'), 'Shared button-height token missing');
assert(css.includes('--chart-1'), 'Chart color token defaults missing');
assert(read('src/components/ui/button.jsx').includes('--setu-button-height'), 'Button must consume the button-height token');
assert(read('src/components/ui/input.jsx').includes('--setu-input-height'), 'Input must consume the input-height token');
assert(read('src/pages/admin/AdminAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Admin analytics must consume chart tokens');
assert(read('src/pages/superadmin/SuperAdminAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Super Admin analytics must consume chart tokens');
assert(read('src/pages/vendor/VendorAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Vendor analytics must consume chart tokens');

console.log('Design System static contract tests: PASS');
