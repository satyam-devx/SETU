/**
 * Compiles a design config into CSS custom properties.
 * Pure and DOM-free so the runtime provider, the isolated Studio preview, the
 * no-flash boot cache and the exporters all produce exactly the same output.
 */
import { HEX6_RE, hexToHslTriplet } from './color.js';
import { COLOR_CSS_VARS, OPTIONS, RANGES, optionCss } from './schema.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function paletteVars(palette) {
  const vars = {};
  for (const [key, cssVar] of Object.entries(COLOR_CSS_VARS)) {
    const value = palette?.[key];
    if (typeof value === 'string' && HEX6_RE.test(value)) vars[cssVar] = hexToHslTriplet(value);
  }
  return vars;
}

/**
 * @returns {{ common: Record<string,string>, light: Record<string,string>, dark: Record<string,string>, dataset: Record<string,string> }}
 *   `common` holds mode-independent variables; `light`/`dark` the color palettes.
 */
export function compileDesign(config) {
  const cfg = config || {};
  const t = cfg.typography || {};
  const l = cfg.layout || {};
  const m = cfg.motion || {};
  const i = cfg.icons || {};

  const font = (value, fallback) => optionCss(OPTIONS.fontFamily, value, fallback);
  const headingScale = optionCss(OPTIONS.headingScale, t.headingScale, 'standard');

  const common = {
    '--setu-font-body': font(t.bodyFont, 'system'),
    '--setu-font-heading': font(t.headingFont, 'system'),
    '--setu-font-mono': font(t.monoFont, 'mono'),
    '--setu-base-font-size': `${clamp(Number(t.baseFontSize) || 16, RANGES.baseFontSize.min, RANGES.baseFontSize.max)}px`,
    '--setu-heading-scale': headingScale,
    '--setu-font-heading-size-factor': headingScale,
    '--setu-body-weight': optionCss(OPTIONS.bodyWeight, t.bodyWeight, '400'),
    '--setu-heading-weight': optionCss(OPTIONS.headingWeight, t.headingWeight, '600'),
    '--setu-line-height': optionCss(OPTIONS.lineHeight, t.lineHeight, 'normal'),
    '--setu-letter-spacing': optionCss(OPTIONS.letterSpacing, t.letterSpacing, 'normal'),
    '--radius': optionCss(OPTIONS.radius, l.radius, '12px'),
    '--setu-shadow-card': optionCss(OPTIONS.shadow, l.shadow, 'soft'),
    '--setu-content-width': optionCss(OPTIONS.contentWidth, l.contentWidth, 'standard'),
    '--setu-spacing-scale': optionCss(OPTIONS.spacingScale, l.spacingScale, 'standard'),
    '--setu-button-height': optionCss(OPTIONS.buttonHeight, l.buttonHeight, 'standard'),
    '--setu-input-height': optionCss(OPTIONS.inputHeight, l.inputHeight, 'standard'),
    '--setu-card-padding': optionCss(OPTIONS.cardPadding, l.cardPadding, 'standard'),
    '--setu-grid-gap': optionCss(OPTIONS.gridGap, l.gridGap, 'standard'),
    '--setu-nav-density': optionCss(OPTIONS.navDensity, l.navDensity, 'comfortable'),
    '--setu-breakpoint-md': optionCss(OPTIONS.breakpoint, l.breakpoint, 'standard'),
    '--setu-motion-duration': optionCss(OPTIONS.motionDuration, m.duration, 'normal'),
    '--setu-icon-size': `${clamp(Number(i.size) || 20, RANGES.iconSize.min, RANGES.iconSize.max)}px`,
    '--setu-icon-stroke': String(clamp(Number(i.strokeWidth) || 2, RANGES.iconStroke.min, RANGES.iconStroke.max)),
  };

  const flag = (value) => (value === false ? 'off' : 'on');
  const dataset = {
    setuMotion: flag(m.enabled),
    setuHoverEffects: flag(m.hoverEffects),
    setuPageAnimations: flag(m.pageAnimations),
    setuLoadingShimmer: flag(m.loadingShimmer),
    setuCardInteractions: flag(m.cardInteractions),
  };

  return {
    common,
    light: paletteVars(cfg.colors),
    dark: paletteVars(cfg.darkColors || cfg.colors),
    dataset,
  };
}

/** Flat variable map for one color mode. */
export function computeCssVars(config, mode = 'light') {
  const { common, light, dark, dataset } = compileDesign(config);
  return { vars: { ...common, ...(mode === 'dark' ? dark : light) }, dataset };
}

/** `data-setu-*` attribute names for a dataset map (setuMotion -> data-setu-motion). */
export const datasetToAttributes = (dataset) =>
  Object.fromEntries(Object.entries(dataset).map(([k, v]) => [`data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, v]));

export function varsToDeclarations(vars, indent = '  ') {
  return Object.entries(vars).map(([k, v]) => `${indent}${k}: ${v};`).join('\n');
}
