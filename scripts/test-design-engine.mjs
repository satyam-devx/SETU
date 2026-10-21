#!/usr/bin/env node
/**
 * Design System engine tests. Uses only Node built-ins, so it runs without
 * `npm ci`:   node --test scripts/test-design-engine.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  contrastRatio, deriveBrandTokens, ensureContrast, hexToHslTriplet, hslToRgb, normalizeHex, parseColor,
  readableOn, rgbToHsl, suggestFix, toHex,
} from '../src/lib/design/color.js';
import {
  COLOR_CSS_VARS, COLOR_KEYS, DEFAULT_DESIGN, ICON_NAMES, OPTIONS, RANGES, SEMANTIC_ICON_KEYS, mergeDesign,
  sanitizeConfig, scopeFromPath, validateConfig, wiringFor, WIRING,
} from '../src/lib/design/schema.js';
import { compileDesign, computeCssVars, datasetToAttributes } from '../src/lib/design/css.js';
import { auditDesign, autoFixContrast } from '../src/lib/design/a11y.js';
import { diffConfigs, extractOverrides, summarizeDiff } from '../src/lib/design/diff.js';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from '../src/lib/design/history.js';
import { parseImport, toCssVariables, toDtcg, toSetuJson } from '../src/lib/design/exporters.js';
import { PRESETS } from '../src/lib/design/presets.js';
import {
  BOOT_KEY, buildBootPayload, clearCache, clearPreview, readCachedConfig, readPreview, writeCache, writePreview,
} from '../src/lib/design/cache.js';
import { buildBlock, sync } from './sync-design-defaults.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomHex = (rnd) => toHex({ r: Math.floor(rnd() * 256), g: Math.floor(rnd() * 256), b: Math.floor(rnd() * 256) });

/* ------------------------------------------------------------------ color */

test('parseColor accepts hex, rgb and hsl syntaxes and rejects junk', () => {
  assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204 });
  assert.deepEqual(parseColor('#C2410C'), { r: 194, g: 65, b: 12 });
  assert.deepEqual(parseColor('rgb(194, 65, 12)'), { r: 194, g: 65, b: 12 });
  assert.deepEqual(parseColor('rgb(194 65 12 / 0.5)'), { r: 194, g: 65, b: 12 });
  assert.deepEqual(parseColor('hsl(0 0% 100%)'), { r: 255, g: 255, b: 255 });
  assert.equal(normalizeHex('hsl(20, 90%, 40%)'), '#C2470A');
  for (const bad of ['', 'red', '#12', '#GGGGGG', 'rgb(300 0 0)', 'hsl(10 120% 50%)', null, undefined, 42]) {
    assert.equal(parseColor(bad), null, `should reject ${String(bad)}`);
  }
});

test('hex -> hsl triplet -> rgb round-trips within one channel step', () => {
  const rnd = mulberry32(7);
  for (let i = 0; i < 3000; i += 1) {
    const hex = randomHex(rnd);
    const [h, s, l] = hexToHslTriplet(hex).replace(/%/g, '').split(' ').map(Number);
    const back = hslToRgb({ h, s, l });
    const orig = parseColor(hex);
    const diff = Math.max(Math.abs(back.r - orig.r), Math.abs(back.g - orig.g), Math.abs(back.b - orig.b));
    assert.ok(diff <= 1, `${hex} drifted by ${diff}`);
  }
});

test('contrast ratios match WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF').toFixed(2), '1.00');
  assert.equal(contrastRatio('#767676', '#FFFFFF').toFixed(2), '4.54'); // canonical AA boundary grey
  assert.equal(contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.equal(contrastRatio('nope', '#FFFFFF'), null);
});

test('readableOn always yields at least 4.5:1 for any background', () => {
  const rnd = mulberry32(11);
  for (let i = 0; i < 1000; i += 1) {
    const bg = randomHex(rnd);
    assert.ok(contrastRatio(readableOn(bg), bg) >= 4.5, `readableOn failed for ${bg}`);
  }
});

test('ensureContrast reaches the target while keeping the hue family', () => {
  const rnd = mulberry32(23);
  for (let i = 0; i < 500; i += 1) {
    const fg = randomHex(rnd);
    const bg = randomHex(rnd);
    const fix = ensureContrast(fg, bg, 4.5);
    if (fix) assert.ok(fix.ratio >= 4.5 && contrastRatio(fix.color, bg) >= 4.5);
    const s = suggestFix(fg, bg, 4.5);
    assert.ok(s, `suggestFix must always find a fix for ${fg} on ${bg}`);
  }
  assert.equal(ensureContrast('#000000', '#FFFFFF', 4.5).changed, false);
});

test('deriveBrandTokens produces accessible brand tokens in both modes', () => {
  for (const brand of ['#4F46E5', '#F97316', '#22C55E', '#FACC15', '#0EA5E9', '#FFFFFF', '#000000']) {
    const t = deriveBrandTokens(brand);
    assert.ok(contrastRatio(t.colors.primaryForeground, t.colors.primary) >= 4.5, `light primary label for ${brand}`);
    assert.ok(contrastRatio(t.colors.primary, '#FFFFFF') >= 4.5, `light primary on white for ${brand}`);
    assert.ok(contrastRatio(t.darkColors.primaryForeground, t.darkColors.primary) >= 4.5, `dark primary label for ${brand}`);
    assert.ok(contrastRatio(t.darkColors.primary, '#14110F') >= 4.5, `dark primary on dark bg for ${brand}`);
  }
  assert.equal(deriveBrandTokens('not a color'), null);
});

/* ------------------------------------------------------------------ schema */

test('defaults define every color token in both palettes and validate cleanly', () => {
  assert.deepEqual(Object.keys(DEFAULT_DESIGN.colors).sort(), [...COLOR_KEYS].sort());
  assert.deepEqual(Object.keys(DEFAULT_DESIGN.darkColors).sort(), [...COLOR_KEYS].sort());
  assert.deepEqual(validateConfig(DEFAULT_DESIGN), { valid: true, errors: [] });
});

test('CSS variable names are unchanged from the shipped mapping', () => {
  const expected = {
    background: '--background', foreground: '--foreground', card: '--card', cardForeground: '--card-foreground',
    popover: '--popover', popoverForeground: '--popover-foreground', primary: '--primary', primaryForeground: '--primary-foreground',
    secondary: '--secondary', secondaryForeground: '--secondary-foreground', accent: '--accent', accentForeground: '--accent-foreground',
    muted: '--muted', mutedForeground: '--muted-foreground', border: '--border', input: '--input', ring: '--ring',
    destructive: '--destructive', destructiveForeground: '--destructive-foreground',
    setuSaffron: '--setu-saffron', setuTeal: '--setu-teal', setuEarth: '--setu-earth', setuSuccess: '--setu-success', setuWarning: '--setu-warning',
    sidebar: '--sidebar', sidebarForeground: '--sidebar-foreground', sidebarBorder: '--sidebar-border',
    sidebarAccent: '--sidebar-accent', sidebarPrimary: '--sidebar-primary',
    chart1: '--chart-1', chart2: '--chart-2', chart3: '--chart-3', chart4: '--chart-4', chart5: '--chart-5',
  };
  assert.deepEqual(COLOR_CSS_VARS, expected);
});

test('validateConfig rejects what the server would reject', () => {
  const bad = [
    [{ colors: { primary: 'red' } }, 'colors.primary'],
    [{ colors: { primary: '#FFF' } }, 'colors.primary'],
    [{ colors: { nope: '#FFFFFF' } }, 'colors.nope'],
    [{ darkColors: { background: 12 } }, 'darkColors.background'],
    [{ typography: { bodyFont: 'comic-sans' } }, 'typography.bodyFont'],
    [{ typography: { baseFontSize: 99 } }, 'typography.baseFontSize'],
    [{ layout: { radius: '3px' } }, 'layout.radius'],
    [{ motion: { enabled: 'yes' } }, 'motion.enabled'],
    [{ icons: { size: 5 } }, 'icons.size'],
    [{ icons: { mappings: { home: 'Skull' } } }, 'icons.mappings.home'],
    [{ icons: { mappings: { teleport: 'House' } } }, 'icons.mappings.teleport'],
    [{ theme: { defaultMode: 'sepia' } }, 'theme.defaultMode'],
  ];
  for (const [config, path] of bad) {
    const result = validateConfig(config);
    assert.equal(result.valid, false, `${JSON.stringify(config)} should be invalid`);
    assert.ok(result.errors.some((e) => e.path === path), `expected an error at ${path}`);
  }
  assert.equal(validateConfig([]).valid, false);
  assert.equal(validateConfig({}).valid, true);
});

test('sanitizeConfig drops unknowns, repairs invalid values and normalizes colors', () => {
  const clean = sanitizeConfig({
    colors: { primary: 'rgb(79 70 229)', background: 'banana', rogue: '#000000' },
    typography: { baseFontSize: 99, bodyFont: 'inter', lineHeight: 'diagonal' },
    layout: { radius: '999px' },
    icons: { strokeWidth: 2.3, mappings: { home: 'Heart', cart: 'Nope' } },
    __proto__x: 1,
  });
  assert.equal(clean.colors.primary, '#4F46E5');
  assert.equal(clean.colors.background, DEFAULT_DESIGN.colors.background);
  assert.equal('rogue' in clean.colors, false);
  assert.equal(clean.typography.baseFontSize, 20);
  assert.equal(clean.typography.bodyFont, 'inter');
  assert.equal(clean.typography.lineHeight, DEFAULT_DESIGN.typography.lineHeight);
  assert.equal(clean.layout.radius, DEFAULT_DESIGN.layout.radius);
  assert.equal(clean.icons.strokeWidth, 2.5);
  assert.equal(clean.icons.mappings.home, 'Heart');
  assert.equal(clean.icons.mappings.cart, DEFAULT_DESIGN.icons.mappings.cart);
  assert.deepEqual(validateConfig(clean), { valid: true, errors: [] });
  assert.deepEqual(sanitizeConfig(undefined), DEFAULT_DESIGN);
});

test('mergeDesign layers sections without mutating inputs', () => {
  const base = structuredClone(DEFAULT_DESIGN);
  const incoming = { colors: { primary: '#111111' }, icons: { mappings: { home: 'Heart' } } };
  const snapshot = structuredClone(incoming);
  const merged = mergeDesign(base, incoming);
  assert.equal(merged.colors.primary, '#111111');
  assert.equal(merged.colors.background, base.colors.background);
  assert.equal(merged.icons.mappings.home, 'Heart');
  assert.equal(merged.icons.mappings.cart, base.icons.mappings.cart);
  assert.deepEqual(base, DEFAULT_DESIGN);
  assert.deepEqual(incoming, snapshot);
});

test('scopeFromPath maps portals and is not fooled by prefixes', () => {
  assert.equal(scopeFromPath('/customer/orders'), 'customer');
  assert.equal(scopeFromPath('/superadmin/design-system'), 'superadmin');
  assert.equal(scopeFromPath('/admin'), 'admin');
  assert.equal(scopeFromPath('/administrator'), 'global');
  assert.equal(scopeFromPath('/'), 'global');
  assert.equal(scopeFromPath('/login'), 'global');
});

test('every non-color control has a wiring entry', () => {
  for (const section of ['typography', 'layout', 'motion', 'icons', 'theme']) {
    for (const key of Object.keys(DEFAULT_DESIGN[section])) {
      if (section === 'icons' && key === 'mappings') continue;
      const entry = wiringFor(section, key);
      assert.ok(['live', 'limited', 'experimental'].includes(entry.status), `${section}.${key}`);
    }
  }
  assert.ok(WIRING['icons.mappings']);
});

/* ---------------------------------------------------- SQL <-> JS parity */

const sql = read('supabase/migrations/20240101000110_design_system_studio.sql');

/** Allow-list that guards `raise exception '<message>...'` in the migration. */
function sqlAllowList(message) {
  const at = sql.indexOf(`raise exception '${message}`);
  assert.notEqual(at, -1, `migration is missing check: ${message}`);
  const before = sql.slice(0, at);
  const start = Math.max(before.lastIndexOf('end if;'), before.lastIndexOf('loop'), before.lastIndexOf('begin'));
  const match = before.slice(start).match(/not in \(([^)]*)\)/);
  assert.ok(match, `no allow-list found for: ${message}`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}
const sameSet = (a, b, label) => assert.deepEqual([...a].sort(), [...b].sort(), `${label}: SQL and schema.js disagree`);
const opts = (set) => OPTIONS[set].map((o) => o.value);

test('schema.js and the SQL migration enforce identical allow-lists', () => {
  sameSet(sqlAllowList('Unknown color token'), COLOR_KEYS, 'light color tokens');
  sameSet(sqlAllowList('Unknown dark color token'), COLOR_KEYS, 'dark color tokens');
  sameSet(sqlAllowList('Unsupported font family'), opts('fontFamily'), 'font families');
  sameSet(sqlAllowList('Unsupported heading scale'), opts('headingScale'), 'heading scale');
  sameSet(sqlAllowList('Unsupported body weight'), opts('bodyWeight'), 'body weight');
  sameSet(sqlAllowList('Unsupported heading weight'), opts('headingWeight'), 'heading weight');
  sameSet(sqlAllowList('Unsupported line height'), opts('lineHeight'), 'line height');
  sameSet(sqlAllowList('Unsupported letter spacing'), opts('letterSpacing'), 'letter spacing');
  sameSet(sqlAllowList('Unsupported radius'), opts('radius'), 'radius');
  sameSet(sqlAllowList('Unsupported shadow preset'), opts('shadow'), 'shadow');
  sameSet(sqlAllowList('Unsupported content width'), opts('contentWidth'), 'content width');
  sameSet(sqlAllowList('Unsupported spacing scale'), opts('spacingScale'), 'spacing scale');
  sameSet(sqlAllowList('Unsupported button height'), opts('buttonHeight'), 'button height');
  sameSet(sqlAllowList('Unsupported input height'), opts('inputHeight'), 'input height');
  sameSet(sqlAllowList('Unsupported card padding'), opts('cardPadding'), 'card padding');
  sameSet(sqlAllowList('Unsupported grid gap'), opts('gridGap'), 'grid gap');
  sameSet(sqlAllowList('Unsupported breakpoint'), opts('breakpoint'), 'breakpoint');
  sameSet(sqlAllowList('Unsupported navigation density'), opts('navDensity'), 'nav density');
  sameSet(sqlAllowList('Unsupported motion duration'), opts('motionDuration'), 'motion duration');
  sameSet(sqlAllowList('Unsupported default theme'), opts('themeMode'), 'theme mode');
  sameSet(sqlAllowList('Unknown semantic icon key'), SEMANTIC_ICON_KEYS, 'semantic icon keys');
  sameSet(sqlAllowList('Unsupported icon mapping'), ICON_NAMES, 'icon names');
  assert.ok(sql.includes(`not between ${RANGES.baseFontSize.min} and ${RANGES.baseFontSize.max}`), 'base font size range');
  assert.ok(sql.includes(`not between ${RANGES.iconSize.min} and ${RANGES.iconSize.max}`), 'icon size range');
  assert.ok(sql.includes(`not between ${RANGES.iconStroke.min} and ${RANGES.iconStroke.max}`), 'icon stroke range');
});

/* ------------------------------------------------------------------- css */

test('compileDesign emits every token in the expected format', () => {
  const { common, light, dark, dataset } = compileDesign(DEFAULT_DESIGN);
  assert.equal(Object.keys(light).length, COLOR_KEYS.length);
  assert.equal(Object.keys(dark).length, COLOR_KEYS.length);
  for (const value of [...Object.values(light), ...Object.values(dark)]) assert.match(value, /^-?[\d.]+ [\d.]+% [\d.]+%$/);
  for (const name of [
    '--setu-font-body', '--setu-base-font-size', '--radius', '--setu-button-height', '--setu-input-height',
    '--setu-motion-duration', '--setu-icon-size', '--setu-icon-stroke', '--setu-shadow-card',
  ]) assert.ok(common[name], `missing ${name}`);
  assert.deepEqual(dataset, {
    setuMotion: 'on', setuHoverEffects: 'on', setuPageAnimations: 'on', setuLoadingShimmer: 'on', setuCardInteractions: 'on',
  });
});

test('defaults compile to the pre-token primitive sizes (no visual change for existing screens)', () => {
  const { common } = compileDesign(DEFAULT_DESIGN);
  assert.equal(common['--setu-button-height'], '2.75rem'); // Button was h-11
  assert.equal(common['--setu-input-height'], '2.5rem'); //  Input was h-10
  assert.equal(common['--setu-motion-duration'], '150ms'); // Tailwind default
  assert.equal(common['--radius'], '12px');
});

test('computeCssVars follows the requested mode and tolerates garbage input', () => {
  const light = computeCssVars(DEFAULT_DESIGN, 'light').vars['--background'];
  const dark = computeCssVars(DEFAULT_DESIGN, 'dark').vars['--background'];
  assert.notEqual(light, dark);
  const hostile = computeCssVars({ colors: { primary: 'red; background:url(x)' }, typography: { baseFontSize: 9999 }, icons: { size: -5 } });
  assert.equal(hostile.vars['--primary'], undefined);
  assert.equal(hostile.vars['--setu-base-font-size'], '20px');
  assert.equal(hostile.vars['--setu-icon-size'], '14px');
  assert.doesNotThrow(() => compileDesign(undefined));
  assert.deepEqual(datasetToAttributes({ setuMotion: 'off' }), { 'data-setu-motion': 'off' });
});

test('index.css baseline is generated from DEFAULT_DESIGN (no colour jump after mount)', () => {
  const css = read('src/index.css');
  assert.equal(sync(css), css, 'src/index.css is stale: run node scripts/sync-design-defaults.mjs');
  assert.ok(css.includes(buildBlock()));
  assert.ok(css.indexOf(':root {', css.indexOf('design-defaults:begin')) < css.indexOf('.dark {', css.indexOf('design-defaults:begin')), ':root must precede .dark');
});

/* ------------------------------------------------------------------ a11y */

test('audit reports structure and flags a deliberately bad palette', () => {
  const bad = structuredClone(DEFAULT_DESIGN);
  bad.colors.foreground = '#EEEEEE';
  const audit = auditDesign(bad);
  assert.equal(audit.summary.passed, false);
  const hit = audit.errors.find((c) => c.id === 'light:foreground/background');
  assert.ok(hit && hit.ratio < 4.5 && hit.fix, 'should flag and propose a fix');
  assert.ok(audit.summary.score < 100);
});

/** Random colour with lightness in [lMin, lMax], so palettes can be made plausible. */
const randomHexL = (rnd, lMin, lMax) => toHex(hslToRgb({ h: rnd() * 360, s: rnd() * 100, l: lMin + rnd() * (lMax - lMin) }));

test('autoFixContrast repairs the shipped defaults and any plausible random palette', () => {
  assert.equal(autoFixContrast(DEFAULT_DESIGN).remaining, 0);
  const rnd = mulberry32(99);
  const surfaces = ['background', 'card', 'popover', 'muted'];
  for (let n = 0; n < 60; n += 1) {
    const cfg = structuredClone(DEFAULT_DESIGN);
    for (const [palette, lo, hi] of [['colors', 86, 100], ['darkColors', 0, 14]]) {
      for (const key of COLOR_KEYS) cfg[palette][key] = randomHex(rnd);
      for (const key of surfaces) cfg[palette][key] = randomHexL(rnd, lo, hi);
      for (const key of ['sidebar']) cfg[palette][key] = randomHexL(rnd, 0, 16);
    }
    const fixed = autoFixContrast(cfg);
    assert.equal(fixed.remaining, 0, `plausible palette ${n} still failing`);
    assert.deepEqual(validateConfig(fixed.config), { valid: true, errors: [] });
  }
});

test('autoFixContrast terminates and reports honestly on contradictory palettes', () => {
  // mutedForeground must contrast with a white page AND a black card at once: impossible.
  const cfg = structuredClone(DEFAULT_DESIGN);
  cfg.colors.background = '#FFFFFF';
  cfg.colors.card = '#000000';
  cfg.colors.muted = '#FFFFFF';
  const fixed = autoFixContrast(cfg);
  assert.equal(typeof fixed.remaining, 'number');
  assert.ok(fixed.remaining >= 0);
  assert.deepEqual(validateConfig(fixed.config), { valid: true, errors: [] });
});

test('autoFixContrast does not touch a config that already passes', () => {
  const preset = PRESETS.find((p) => p.id === 'midnight-indigo').config;
  const result = autoFixContrast(preset);
  assert.equal(result.changes.length, 0);
  assert.deepEqual(result.config.colors, preset.colors);
});

test('known shipped-default AA failures are surfaced (regression guard for the audit itself)', () => {
  const failing = auditDesign(DEFAULT_DESIGN).errors.map((c) => c.id).sort();
  assert.ok(failing.includes('light:accentForeground/accent'), 'light accent label should be flagged (3.5:1)');
  assert.ok(failing.includes('dark:accentForeground/accent'), 'dark accent label should be flagged');
});

/* --------------------------------------------------------------- presets */

test('every preset is valid, complete and passes the WCAG AA text audit in both modes', () => {
  assert.ok(PRESETS.length >= 5);
  const ids = new Set();
  for (const preset of PRESETS) {
    assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
    assert.deepEqual(validateConfig(preset.config), { valid: true, errors: [] }, preset.id);
    assert.deepEqual(Object.keys(preset.config.colors).sort(), [...COLOR_KEYS].sort(), preset.id);
    if (preset.id === 'setu-default') continue; // the shipped default is audited (and fixable) separately
    const audit = auditDesign(preset.config);
    assert.equal(audit.summary.errors, 0, `${preset.id}: ${audit.errors.map((e) => `${e.id}=${e.ratio?.toFixed(2)}`).join(', ')}`);
  }
});

/* ------------------------------------------------------------------ diff */

test('diffConfigs finds nested changes and nothing when equal', () => {
  const a = structuredClone(DEFAULT_DESIGN);
  const b = structuredClone(DEFAULT_DESIGN);
  assert.deepEqual(diffConfigs(a, b), []);
  b.colors.primary = '#000000';
  b.darkColors.primary = '#FFFFFF';
  b.layout.radius = '8px';
  b.icons.mappings.home = 'Heart';
  b.motion.enabled = false;
  const changes = diffConfigs(a, b);
  assert.deepEqual(changes.map((c) => c.path), [
    'colors.primary', 'darkColors.primary', 'layout.radius', 'motion.enabled', 'icons.mappings.home',
  ]);
  assert.equal(changes[0].label, 'Primary');
  assert.deepEqual(summarizeDiff(changes), {
    total: 5, bySection: { colors: 1, darkColors: 1, layout: 1, motion: 1, icons: 1 },
  });
});

test('extractOverrides yields minimal partials that reproduce the config when merged over the base', () => {
  const base = sanitizeConfig({ colors: { primary: '#4F46E5' }, layout: { radius: '8px' } });
  assert.deepEqual(extractOverrides(base, base), {}, 'no changes means pure inheritance');

  const next = structuredClone(base);
  next.colors.accent = '#112233';
  next.darkColors.primary = '#ABCDEF';
  next.typography.bodyFont = 'inter';
  next.motion.enabled = false;
  next.icons.size = 24;
  next.icons.mappings.home = 'Heart';
  const overrides = extractOverrides(base, next);
  assert.deepEqual(Object.keys(overrides).sort(), ['colors', 'darkColors', 'icons', 'motion', 'typography']);
  assert.deepEqual(overrides.colors, { accent: '#112233' });
  assert.equal(Object.keys(overrides.icons.mappings).length, 8, 'mappings ship whole (the server merge is shallow)');
  assert.deepEqual(sanitizeConfig(mergeDesign(base, overrides)), next);
  assert.deepEqual(validateConfig(overrides), { valid: true, errors: [] });

  // Property: round-trips for arbitrary random edits.
  const rnd = mulberry32(5);
  for (let n = 0; n < 50; n += 1) {
    const variant = structuredClone(base);
    for (const key of COLOR_KEYS) if (rnd() < 0.3) variant.colors[key] = randomHex(rnd);
    if (rnd() < 0.5) variant.layout.radius = OPTIONS.radius[Math.floor(rnd() * 5)].value;
    if (rnd() < 0.5) variant.icons.mappings.cart = ICON_NAMES[Math.floor(rnd() * ICON_NAMES.length)];
    assert.deepEqual(sanitizeConfig(mergeDesign(base, extractOverrides(base, variant))), variant);
  }
});

/* --------------------------------------------------------------- history */

test('history supports undo/redo and coalesces rapid edits', () => {
  let h = createHistory(0);
  h = pushHistory(h, 1, { key: 'slider', at: 1000 });
  h = pushHistory(h, 2, { key: 'slider', at: 1100 });
  h = pushHistory(h, 3, { key: 'slider', at: 1200 });
  assert.equal(h.past.length, 1, 'a slider drag is one undo step');
  h = pushHistory(h, 4, { key: 'other', at: 1300 });
  assert.equal(h.past.length, 2);
  h = undo(h);
  assert.equal(h.present, 3);
  assert.ok(canRedo(h));
  h = redo(h);
  assert.equal(h.present, 4);
  h = undo(undo(h));
  assert.equal(h.present, 0);
  assert.equal(canUndo(h), false);
  h = pushHistory(h, 9, { at: 5000 });
  assert.equal(canRedo(h), false, 'a new edit clears redo');
  assert.equal(pushHistory(h, 9), h, 'identical value is a no-op');
});

test('history respects its size limit', () => {
  let h = createHistory(0, { limit: 3 });
  for (let i = 1; i <= 10; i += 1) h = pushHistory(h, i, { at: i * 10_000 });
  assert.equal(h.past.length, 3);
  assert.deepEqual(h.past, [7, 8, 9]);
});

/* ------------------------------------------------------------- exporters */

test('CSS export contains :root and .dark with all colour tokens', () => {
  const css = toCssVariables(DEFAULT_DESIGN);
  assert.ok(css.includes(':root {') && css.includes('.dark {'));
  for (const name of Object.values(COLOR_CSS_VARS)) assert.ok(css.includes(`${name}:`), name);
});

test('DTCG export is well-formed', () => {
  const tokens = toDtcg(DEFAULT_DESIGN);
  assert.equal(tokens.color.$type, 'color');
  assert.equal(tokens.color.light.brand.primary.$value, DEFAULT_DESIGN.colors.primary);
  assert.equal(tokens.color.dark.brand.primary.$value, DEFAULT_DESIGN.darkColors.primary);
  assert.deepEqual(tokens.font.family.body.$value.slice(-1), ['sans-serif']);
  assert.equal(tokens.dimension.radius.$value, '12px');
  assert.equal(tokens.duration.base.$value, '150ms');
  JSON.stringify(tokens); // must be serializable
});

test('JSON export/import round-trips and import is strict', () => {
  const config = sanitizeConfig({ colors: { primary: '#4F46E5' }, layout: { radius: '8px' } });
  const parsed = parseImport(toSetuJson(config, { scope: 'vendor' }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.config, config);
  assert.equal(parseImport(JSON.stringify({ colors: { primary: '#111111' } })).ok, true, 'bare config accepted');

  assert.equal(parseImport('').ok, false);
  assert.equal(parseImport('{not json').ok, false);
  assert.equal(parseImport('[]').ok, false);
  assert.equal(parseImport(JSON.stringify({ format: 'other', config: {} })).ok, false);
  const badColor = parseImport(JSON.stringify({ colors: { primary: 'javascript:alert(1)' } }));
  assert.equal(badColor.ok, false);
  assert.match(badColor.errors[0], /colors\.primary/);
  assert.equal(parseImport(JSON.stringify({ pad: 'x'.repeat(70_000) })).ok, false, 'size cap');
  const future = parseImport(JSON.stringify({ format: 'setu-design-system', schemaVersion: 99, config: {} }));
  assert.equal(future.ok, true);
  assert.equal(future.warnings.length, 1);
});

/* ------------------------------------------------------------ cache/boot */

function fakeStorage({ failWrites = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('cache stores sanitized config and a boot payload, and clears both', () => {
  const storage = fakeStorage();
  const config = sanitizeConfig({ colors: { primary: '#4F46E5' } });
  writeCache(storage, 'vendor', config, { version: 3 });
  assert.deepEqual(readCachedConfig(storage, 'vendor'), config);
  assert.equal(readCachedConfig(storage, 'rider'), null);
  assert.ok(storage.map.has(BOOT_KEY));
  clearCache(storage, 'vendor');
  assert.equal(readCachedConfig(storage, 'vendor'), null);
  assert.equal(storage.map.has(BOOT_KEY), false);
});

test('cache is best-effort: bad JSON, wrong version, quota errors and tampering are harmless', () => {
  const storage = fakeStorage();
  storage.setItem('setu:design:v1:cfg:global', '{broken');
  assert.equal(readCachedConfig(storage, 'global'), null);
  storage.setItem('setu:design:v1:cfg:global', JSON.stringify({ v: 99, config: {} }));
  assert.equal(readCachedConfig(storage, 'global'), null);
  assert.doesNotThrow(() => writeCache(fakeStorage({ failWrites: true }), 'global', DEFAULT_DESIGN));
  assert.equal(readCachedConfig(null, 'global'), null);
  storage.setItem('setu:design:v1:cfg:global', JSON.stringify({ v: 1, config: { colors: { primary: 'red; x:y' }, typography: { bodyFont: 'evil' } } }));
  const tampered = readCachedConfig(storage, 'global');
  assert.deepEqual(validateConfig(tampered), { valid: true, errors: [] }, 'tampered cache is sanitized on read');
  assert.equal(tampered.colors.primary, DEFAULT_DESIGN.colors.primary);
});

test('preview session round-trips and sanitizes', () => {
  const storage = fakeStorage();
  writePreview(storage, { colors: { primary: '#4F46E5' }, layout: { radius: 'huge' } });
  const preview = readPreview(storage);
  assert.equal(preview.config.colors.primary, '#4F46E5');
  assert.equal(preview.config.layout.radius, DEFAULT_DESIGN.layout.radius);
  clearPreview(storage);
  assert.equal(readPreview(storage), null);
});

const bootSource = read('public/design-boot.js');
function runBoot(stored, { dark = false } = {}) {
  const style = {};
  const dataset = {};
  const root = {
    style: { setProperty: (k, v) => { style[k] = v; } },
    classList: { contains: (c) => dark && c === 'dark' },
    dataset,
  };
  const window = { localStorage: { getItem: (k) => (k === BOOT_KEY ? stored : null) } };
  vm.runInNewContext(bootSource, { window, document: { documentElement: root } });
  return { style, dataset };
}

test('boot script applies the cached design before paint, by mode', () => {
  const config = sanitizeConfig({ colors: { primary: '#4F46E5' }, darkColors: { primary: '#8B93FF' }, motion: { enabled: false } });
  const payload = JSON.stringify(buildBootPayload(config));
  const light = runBoot(payload);
  const dark = runBoot(payload, { dark: true });
  assert.equal(light.style['--primary'], hexToHslTriplet('#4F46E5'));
  assert.equal(dark.style['--primary'], hexToHslTriplet('#8B93FF'));
  assert.equal(light.style['--radius'], '12px');
  assert.equal(light.dataset.setuMotion, 'off');
  assert.equal(Object.keys(light.style).length, Object.keys(compileDesign(config).common).length + COLOR_KEYS.length);
});

test('boot script ignores corrupt, foreign or hostile cache entries and never throws', () => {
  assert.deepEqual(runBoot(null).style, {});
  assert.deepEqual(runBoot('{oops').style, {});
  assert.deepEqual(runBoot(JSON.stringify({ v: 2, common: { '--x': '1' } })).style, {});
  assert.deepEqual(runBoot('x'.repeat(30_000)).style, {});
  const hostile = runBoot(JSON.stringify({
    v: 1,
    common: {
      '--ok': '12px', 'color': 'red', '--bad name': '1', '--inject': 'red; background: url(//evil)', '--tag': '<script>',
      '--long': 'x'.repeat(400), '--n': 5, '--import': '@import url(x)',
    },
    light: null, dark: 'nope',
    dataset: { setuMotion: 'on', setuEvil: '<img>', polluted: 'on', 'setu-x': 'on', setuFlag: 'maybe' },
  }));
  assert.deepEqual(hostile.style, { '--ok': '12px' });
  assert.deepEqual(hostile.dataset, { setuMotion: 'on' });
});

test('boot script and cache module agree on the storage key and index.html loads the script', () => {
  assert.ok(bootSource.includes(`'${BOOT_KEY}'`), 'public/design-boot.js must read the same key cache.js writes');
  const html = read('index.html');
  assert.match(html, /<script src="%BASE_URL%design-boot\.js"><\/script>/);
  assert.ok(html.indexOf('design-boot.js') < html.indexOf('/src/main.jsx'), 'boot script must load before the app');
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(html), 'CSP must keep forbidding inline scripts');
});

/* ------------------------------------------------- primitive wiring (static) */

test('shared primitives and Tailwind consume the design tokens with default-preserving fallbacks', () => {
  const button = read('src/components/ui/button.jsx');
  assert.ok(button.includes('var(--setu-button-height,2.75rem)'));
  assert.ok(!/\bh-11\b|\bh-12\b/.test(button.slice(button.indexOf('sizeVariants'))), 'Button must not hard-code heights');
  assert.ok(read('src/components/ui/input.jsx').includes('var(--setu-input-height,2.5rem)'));
  assert.ok(read('src/components/ui/select.jsx').includes('var(--setu-input-height,2.5rem)'));
  const tw = read('tailwind.config.js');
  assert.ok(tw.includes("DEFAULT: 'var(--setu-motion-duration, 150ms)'"));
  assert.ok(tw.includes('var(--setu-font-body'));
});
