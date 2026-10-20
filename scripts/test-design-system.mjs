#!/usr/bin/env node
/** Lightweight static contract tests; does not require installed frontend dependencies. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const tokens = read('src/lib/design-system.js');
const provider = read('src/lib/design-system-provider.jsx');
const page = read('src/pages/superadmin/SuperAdminDesignSystem.jsx');
const css = read('src/index.css');
const tailwind = read('tailwind.config.js');
const migration = read('supabase/migrations/20240101000110_design_system_studio.sql');
const app = read('src/App.jsx');
const sidebar = read('src/components/admin/SuperAdminSidebar.jsx');
for (const token of ['popover', 'popoverForeground', 'primary', 'secondary', 'setuSaffron', 'sidebarPrimary', 'chart1', 'chart5']) {
  assert(tokens.includes(`${token}:`), `Default design token missing: ${token}`);
  assert(provider.includes(`${token}:`), `CSS token mapping missing: ${token}`);
  assert(migration.includes(`'${token}'`), `Database allow-list missing: ${token}`);
}
for (const section of ['colors', 'darkColors', 'typography', 'layout', 'motion', 'icons', 'theme']) assert(tokens.includes(`${section}:`), `Config section missing: ${section}`);
for (const rpc of ['get_published_design_system', 'list_design_system_versions', 'save_design_system_draft', 'publish_design_system_version']) {
  assert(migration.includes(`function public.${rpc}`), `RPC missing: ${rpc}`);
}
assert(app.includes('SuperAdminDesignSystem'), 'Design System route import missing');
assert(app.includes('path="design-system"'), 'Design System route missing');
assert(sidebar.includes('/superadmin/design-system'), 'Sidebar entry missing');
assert(page.includes('ContrastCheck'), 'Contrast checks missing from UI');
assert(page.includes('window.__SETU_DESIGN_PREVIEW__'), 'Preview state missing');
assert(provider.includes('setDesign(mergeDesign(DEFAULT_DESIGN, data?.config || {}))'), 'Provider must reset to defaults when a scope has no published config');
assert(tailwind.includes('var(--setu-font-body'), 'Tailwind sans font must consume centralized token');
assert(css.includes('--setu-motion-duration'), 'Motion token missing');
assert(css.includes('.setu-design-icon'), 'Shared icon utility missing');
assert(migration.includes("has_permission('settings.update')"), 'Server-side settings permission checks missing');
assert(migration.includes('design_system_published'), 'Publish audit log missing');
assert(migration.includes('v_config := coalesce(v_global.config'), 'Portal config must inherit global config');
assert(migration.includes('revoke all on function public.save_design_system_draft'), 'Draft RPC must revoke default PUBLIC execute');
assert(page.includes('Semantic icon mappings'), 'Semantic icon mappings UI missing');
assert(page.includes('headingScale'), 'Heading scale UI missing');
assert(page.includes('spacingScale'), 'Spacing scale UI missing');
assert(page.includes('value="themes"'), 'Theme policy controls missing');
assert(css.includes('--setu-button-height'), 'Shared button-height token missing');
assert(css.includes('--chart-1'), 'Chart color token defaults missing');
assert(read('src/pages/admin/AdminAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Admin analytics must consume chart tokens');
assert(read('src/pages/superadmin/SuperAdminAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Super Admin analytics must consume chart tokens');
assert(read('src/pages/vendor/VendorAnalytics.jsx').includes('hsl(var(--chart-1))'), 'Vendor analytics must consume chart tokens');
console.log('Design System static contract tests: PASS');
