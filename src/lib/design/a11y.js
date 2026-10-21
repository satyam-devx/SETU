/**
 * Accessibility audit for a design config. Pure and DOM-free.
 *
 * Text pairs must reach WCAG AA 4.5:1 (these block a clean publish).
 * UI/graphics pairs target 3:1 (WCAG 1.4.11) and are advisory warnings.
 * This audits token pairs; it is not a substitute for scanning rendered pages.
 */
import { HEX6_RE, contrastRatio, suggestFix } from './color.js';
import { COLOR_LABELS, OPTIONS } from './schema.js';

const TEXT_MIN = 4.5;
const UI_MIN = 3;

/** [foregroundKey, backgroundKey, label] */
const TEXT_PAIRS = [
  ['foreground', 'background', 'Body text on page'],
  ['cardForeground', 'card', 'Text on cards'],
  ['popoverForeground', 'popover', 'Text in popovers'],
  ['primaryForeground', 'primary', 'Primary button label'],
  ['secondaryForeground', 'secondary', 'Secondary button label'],
  ['accentForeground', 'accent', 'Accent label'],
  ['destructiveForeground', 'destructive', 'Destructive button label'],
  ['mutedForeground', 'muted', 'Muted text on muted surface'],
  ['mutedForeground', 'background', 'Muted text on page'],
  ['mutedForeground', 'card', 'Muted text on cards'],
  ['sidebarForeground', 'sidebar', 'Sidebar text'],
  ['primary', 'background', 'Primary-colored text and links'],
];

const UI_PAIRS = [
  ['ring', 'background', 'Focus ring'],
  ['input', 'background', 'Input border'],
  ['sidebarAccent', 'sidebar', 'Sidebar active item'],
  ['chart1', 'card', 'Chart series 1'],
  ['chart2', 'card', 'Chart series 2'],
  ['chart3', 'card', 'Chart series 3'],
  ['chart4', 'card', 'Chart series 4'],
  ['chart5', 'card', 'Chart series 5'],
];

export function wcagLevel(ratio) {
  if (ratio === null || ratio === undefined) return 'invalid';
  if (ratio >= 7) return 'AAA';
  if (ratio >= TEXT_MIN) return 'AA';
  if (ratio >= UI_MIN) return 'AA large';
  return 'fail';
}

function evaluatePair(palette, mode, [fgKey, bgKey, label], kind) {
  const min = kind === 'text' ? TEXT_MIN : UI_MIN;
  const fg = palette?.[fgKey];
  const bg = palette?.[bgKey];
  const valid = HEX6_RE.test(fg || '') && HEX6_RE.test(bg || '');
  const ratio = valid ? contrastRatio(fg, bg) : null;
  const pass = ratio !== null && ratio >= min;
  let fix = null;
  if (valid && !pass) {
    const s = suggestFix(fg, bg, min);
    if (s) fix = { key: s.side === 'fg' ? fgKey : bgKey, color: s.color, ratio: s.ratio };
  }
  return {
    id: `${mode}:${fgKey}/${bgKey}`,
    mode, kind, label, fgKey, bgKey, fg, bg, ratio, min,
    level: wcagLevel(ratio),
    status: ratio === null ? 'invalid' : pass ? 'pass' : 'fail',
    severity: kind === 'text' ? 'error' : 'warning',
    fix,
  };
}

const REM_PX = 16;
const remToPx = (css) => (typeof css === 'string' && css.endsWith('rem') ? parseFloat(css) * REM_PX : null);

function sizeChecks(config) {
  const checks = [];
  const add = (id, label, detail, fail) =>
    checks.push({ id, mode: 'all', kind: 'size', label, detail, status: fail ? 'fail' : 'pass', severity: 'warning', ratio: null, fix: null });

  const button = OPTIONS.buttonHeight.find((o) => o.value === config?.layout?.buttonHeight);
  const input = OPTIONS.inputHeight.find((o) => o.value === config?.layout?.inputHeight);
  const bPx = remToPx(button?.css);
  const iPx = remToPx(input?.css);
  if (bPx !== null) add('size:button', 'Button touch target', `${bPx}px (recommended: 44px or more on mobile portals)`, bPx < 44);
  if (iPx !== null) add('size:input', 'Input touch target', `${iPx}px (recommended: 40px or more)`, iPx < 40);
  const base = Number(config?.typography?.baseFontSize);
  if (Number.isFinite(base)) add('size:font', 'Base font size', `${base}px (recommended: 16px or more)`, base < 16);
  return checks;
}

export function auditDesign(config) {
  const light = [
    ...TEXT_PAIRS.map((p) => evaluatePair(config?.colors, 'light', p, 'text')),
    ...UI_PAIRS.map((p) => evaluatePair(config?.colors, 'light', p, 'ui')),
  ];
  const dark = [
    ...TEXT_PAIRS.map((p) => evaluatePair(config?.darkColors, 'dark', p, 'text')),
    ...UI_PAIRS.map((p) => evaluatePair(config?.darkColors, 'dark', p, 'ui')),
  ];
  const size = sizeChecks(config);
  const checks = [...light, ...dark, ...size];

  const text = checks.filter((c) => c.kind === 'text');
  const errors = text.filter((c) => c.status !== 'pass');
  const warnings = checks.filter((c) => c.kind !== 'text' && c.status !== 'pass');
  return {
    modes: { light, dark, size },
    checks,
    errors,
    warnings,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      textTotal: text.length,
      textPassed: text.length - errors.length,
      score: text.length ? Math.round(((text.length - errors.length) / text.length) * 100) : 100,
      passed: errors.length === 0,
    },
  };
}

/**
 * Apply the smallest passing edit to every failing text pair (both palettes).
 * Runs a few passes because tokens are shared between pairs.
 * @returns {{ config, changes: Array<{mode,key,label,from,to}>, remaining: number }}
 */
export function autoFixContrast(config) {
  const next = { ...config, colors: { ...config.colors }, darkColors: { ...config.darkColors } };
  const changes = [];
  const pairOf = (check) => [check.fgKey, check.bgKey, check.label];
  for (let pass = 0; pass < 4; pass += 1) {
    const failing = auditDesign(next).errors.filter((c) => c.fix);
    if (!failing.length) break;
    let touched = false;
    for (const snapshot of failing) {
      const paletteKey = snapshot.mode === 'dark' ? 'darkColors' : 'colors';
      // Re-evaluate against the *current* palette: an earlier fix in this pass may
      // already have repaired this pair (tokens are shared between pairs).
      const fresh = evaluatePair(next[paletteKey], snapshot.mode, pairOf(snapshot), 'text');
      if (fresh.status === 'pass' || !fresh.fix) continue;
      const from = next[paletteKey][fresh.fix.key];
      if (from === fresh.fix.color) continue;
      next[paletteKey] = { ...next[paletteKey], [fresh.fix.key]: fresh.fix.color };
      changes.push({ mode: snapshot.mode, key: fresh.fix.key, label: COLOR_LABELS[fresh.fix.key], from, to: fresh.fix.color });
      touched = true;
    }
    if (!touched) break;
  }
  return { config: next, changes, remaining: auditDesign(next).summary.errors };
}
