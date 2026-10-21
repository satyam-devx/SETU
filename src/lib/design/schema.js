/**
 * Design System schema: the single source of truth for token keys, allowed
 * values, defaults, validation and "wiring" status.
 *
 * The Supabase migration (20240101000110_design_system_studio.sql) enforces the
 * same allow-lists server-side. scripts/test-design-engine.mjs parses that SQL
 * and fails if this file and the migration ever drift apart.
 */
import { HEX6_RE, normalizeHex } from './color.js';

/* ------------------------------------------------------------------ scopes */

export const DESIGN_SCOPES = [
  { value: 'global', label: 'Global default' },
  { value: 'customer', label: 'Customer portal' },
  { value: 'vendor', label: 'Vendor portal' },
  { value: 'rider', label: 'Rider portal' },
  { value: 'seva', label: 'Seva portal' },
  { value: 'anchor', label: 'Village Anchor portal' },
  { value: 'admin', label: 'Admin portal' },
  { value: 'superadmin', label: 'Super Admin portal' },
];
export const SCOPE_IDS = DESIGN_SCOPES.map((s) => s.value);

/** Route prefix -> design scope (first match wins). */
export function scopeFromPath(pathname = '/') {
  const hit = SCOPE_IDS.find((id) => id !== 'global' && (pathname === `/${id}` || pathname.startsWith(`/${id}/`)));
  return hit || 'global';
}

/* ------------------------------------------------------------------ colors */

export const COLOR_GROUPS = [
  {
    id: 'surfaces',
    title: 'Core surfaces',
    keys: ['background', 'foreground', 'card', 'cardForeground', 'popover', 'popoverForeground', 'border', 'input', 'muted', 'mutedForeground'],
  },
  {
    id: 'brand',
    title: 'Brand & actions',
    keys: ['primary', 'primaryForeground', 'secondary', 'secondaryForeground', 'accent', 'accentForeground', 'ring'],
  },
  { id: 'status', title: 'Status', keys: ['destructive', 'destructiveForeground', 'setuSuccess', 'setuWarning'] },
  { id: 'identity', title: 'SETU identity', keys: ['setuSaffron', 'setuTeal', 'setuEarth'] },
  { id: 'sidebar', title: 'Admin sidebar', keys: ['sidebar', 'sidebarForeground', 'sidebarBorder', 'sidebarAccent', 'sidebarPrimary'] },
  { id: 'charts', title: 'Chart palette', keys: ['chart1', 'chart2', 'chart3', 'chart4', 'chart5'] },
];
export const COLOR_KEYS = COLOR_GROUPS.flatMap((g) => g.keys);

export const COLOR_LABELS = {
  background: 'Background', foreground: 'Main text', card: 'Card surface', cardForeground: 'Card text',
  popover: 'Popover surface', popoverForeground: 'Popover text', border: 'Borders', input: 'Input border',
  muted: 'Muted surface', mutedForeground: 'Muted text',
  primary: 'Primary', primaryForeground: 'Primary text', secondary: 'Secondary', secondaryForeground: 'Secondary text',
  accent: 'Accent', accentForeground: 'Accent text', ring: 'Focus ring',
  destructive: 'Destructive', destructiveForeground: 'Destructive text', setuSuccess: 'Success', setuWarning: 'Warning',
  setuSaffron: 'SETU saffron', setuTeal: 'SETU teal', setuEarth: 'SETU earth',
  sidebar: 'Sidebar background', sidebarForeground: 'Sidebar text', sidebarBorder: 'Sidebar border',
  sidebarAccent: 'Sidebar accent', sidebarPrimary: 'Sidebar primary',
  chart1: 'Chart 1', chart2: 'Chart 2', chart3: 'Chart 3', chart4: 'Chart 4', chart5: 'Chart 5',
};

const kebab = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase();
/** colors key -> CSS custom property, e.g. cardForeground -> --card-foreground, setuSaffron -> --setu-saffron, chart1 -> --chart-1 */
export const COLOR_CSS_VARS = Object.fromEntries(COLOR_KEYS.map((key) => [key, `--${kebab(key)}`]));

/* ------------------------------------------------------------------ options */

const opt = (value, label, css) => ({ value, label, css: css === undefined ? value : css });

export const FONT_STACKS = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  inter: 'Inter, system-ui, sans-serif',
  roboto: 'Roboto, system-ui, sans-serif',
  nunito: '"Nunito Sans", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const OPTIONS = {
  fontFamily: [
    opt('system', 'System UI (recommended)', FONT_STACKS.system),
    opt('inter', 'Inter', FONT_STACKS.inter),
    opt('roboto', 'Roboto', FONT_STACKS.roboto),
    opt('nunito', 'Nunito Sans', FONT_STACKS.nunito),
    opt('mono', 'System Monospace', FONT_STACKS.mono),
  ],
  headingScale: [opt('compact', 'Compact', '0.92'), opt('standard', 'Standard', '1'), opt('expressive', 'Expressive', '1.12')],
  bodyWeight: [opt('400', 'Regular'), opt('500', 'Medium')],
  headingWeight: [opt('500', 'Medium'), opt('600', 'Semibold'), opt('700', 'Bold'), opt('800', 'Extra bold')],
  lineHeight: [opt('tight', 'Tight', '1.35'), opt('normal', 'Normal', '1.5'), opt('relaxed', 'Relaxed', '1.7')],
  letterSpacing: [opt('tight', 'Tight', '-0.015em'), opt('normal', 'Normal', '0'), opt('wide', 'Wide', '0.025em')],
  radius: ['8px', '10px', '12px', '16px', '20px'].map((v) => opt(v, v)),
  shadow: [
    opt('none', 'None', 'none'),
    opt('soft', 'Soft', '0 2px 8px 0 rgb(0 0 0 / 0.08)'),
    opt('elevated', 'Elevated', '0 8px 24px 0 rgb(0 0 0 / 0.12)'),
  ],
  contentWidth: [opt('compact', 'Compact', '48rem'), opt('standard', 'Standard', '64rem'), opt('wide', 'Wide', '80rem')],
  spacingScale: [opt('compact', 'Compact', '0.85'), opt('standard', 'Standard', '1'), opt('spacious', 'Spacious', '1.15')],
  // standard === the pre-token size of <Button>/<Input>, so defaults render identically.
  buttonHeight: [opt('compact', 'Compact', '2.25rem'), opt('standard', 'Standard', '2.75rem'), opt('large', 'Large', '3.25rem')],
  inputHeight: [opt('compact', 'Compact', '2.25rem'), opt('standard', 'Standard', '2.5rem'), opt('large', 'Large', '3rem')],
  cardPadding: [opt('compact', 'Compact', '0.75rem'), opt('standard', 'Standard', '1rem'), opt('spacious', 'Spacious', '1.5rem')],
  gridGap: [opt('compact', 'Compact', '0.75rem'), opt('standard', 'Standard', '1rem'), opt('spacious', 'Spacious', '1.5rem')],
  breakpoint: [opt('compact', '640 px', '640px'), opt('standard', '768 px', '768px'), opt('wide', '900 px', '900px')],
  navDensity: [opt('compact', 'Compact', '0.75rem'), opt('comfortable', 'Comfortable', '1rem'), opt('spacious', 'Spacious', '1.25rem')],
  // normal === Tailwind's default transition duration, so defaults feel identical.
  motionDuration: [opt('fast', 'Fast', '100ms'), opt('normal', 'Normal', '150ms'), opt('slow', 'Slow', '350ms')],
  themeMode: [opt('system', 'System default'), opt('light', 'Light'), opt('dark', 'Dark')],
};

export const RANGES = {
  baseFontSize: { min: 14, max: 20, step: 1 },
  iconSize: { min: 14, max: 32, step: 1 },
  iconStroke: { min: 1, max: 3, step: 0.5 },
};

export const SEMANTIC_ICON_KEYS = ['home', 'search', 'orders', 'profile', 'cart', 'location', 'settings', 'help'];
export const ICON_NAMES = [
  'House', 'Search', 'Package', 'UserRound', 'ShoppingCart', 'MapPin', 'Settings', 'CircleHelp',
  'LayoutDashboard', 'Heart', 'Bell', 'Store', 'Bike', 'Map', 'ShieldCheck',
];

/** Look up the CSS value of an option, falling back to the first match of `fallbackValue`. */
export function optionCss(list, value, fallbackValue) {
  const hit = list.find((o) => o.value === String(value)) || list.find((o) => o.value === fallbackValue);
  return hit ? hit.css : undefined;
}
const values = (list) => list.map((o) => o.value);

/* ------------------------------------------------------------------ defaults */

export const DEFAULT_DESIGN = {
  colors: {
    background: '#FCFCFC', foreground: '#1D1917', card: '#FFFFFF', cardForeground: '#1D1917', popover: '#FFFFFF', popoverForeground: '#1D1917',
    primary: '#C2410C', primaryForeground: '#FFFFFF', secondary: '#287D7D', secondaryForeground: '#FFFFFF',
    accent: '#3B9A63', accentForeground: '#FFFFFF', muted: '#F3F0ED', mutedForeground: '#655D57',
    border: '#E4DDD6', input: '#E4DDD6', ring: '#F97316', destructive: '#CC2936', destructiveForeground: '#FFFFFF',
    setuSaffron: '#F97316', setuTeal: '#287D7D', setuEarth: '#A8894B', setuSuccess: '#168A4A', setuWarning: '#F2B632',
    sidebar: '#0F172A', sidebarForeground: '#F1F5F9', sidebarBorder: '#263449', sidebarAccent: '#C2410C', sidebarPrimary: '#C2410C',
    chart1: '#C2410C', chart2: '#287D7D', chart3: '#3B9A63', chart4: '#A8894B', chart5: '#64748B',
  },
  darkColors: {
    background: '#14110F', foreground: '#EBE8E5', card: '#191614', cardForeground: '#EBE8E5', popover: '#191614', popoverForeground: '#EBE8E5',
    primary: '#F97316', primaryForeground: '#0D0D0D', secondary: '#3FA3A3', secondaryForeground: '#FFFFFF',
    accent: '#4BAF76', accentForeground: '#FFFFFF', muted: '#2B2521', mutedForeground: '#9C9188',
    border: '#332C27', input: '#332C27', ring: '#FB923C', destructive: '#E85C68', destructiveForeground: '#FFFFFF',
    setuSaffron: '#FB923C', setuTeal: '#3FA3A3', setuEarth: '#B99A5B', setuSuccess: '#35A86A', setuWarning: '#F2C14E',
    sidebar: '#0C1019', sidebarForeground: '#F1F5F9', sidebarBorder: '#273142', sidebarAccent: '#FB923C', sidebarPrimary: '#FB923C',
    chart1: '#FB923C', chart2: '#3FA3A3', chart3: '#4BAF76', chart4: '#B99A5B', chart5: '#94A3B8',
  },
  typography: {
    bodyFont: 'system', headingFont: 'system', monoFont: 'mono', baseFontSize: 16, headingScale: 'standard',
    bodyWeight: '400', headingWeight: '600', lineHeight: 'normal', letterSpacing: 'normal',
  },
  layout: {
    radius: '12px', shadow: 'soft', contentWidth: 'standard', spacingScale: 'standard', buttonHeight: 'standard',
    inputHeight: 'standard', cardPadding: 'standard', gridGap: 'standard', breakpoint: 'standard', navDensity: 'comfortable',
  },
  motion: { enabled: true, duration: 'normal', hoverEffects: true, pageAnimations: true, loadingShimmer: true, cardInteractions: true },
  icons: {
    strokeWidth: 2, size: 20,
    mappings: { home: 'House', search: 'Search', orders: 'Package', profile: 'UserRound', cart: 'ShoppingCart', location: 'MapPin', settings: 'Settings', help: 'CircleHelp' },
  },
  theme: { defaultMode: 'system', allowUserSelection: true },
};

export const clone = (value) => JSON.parse(JSON.stringify(value));

/** Shallow-per-section merge of `incoming` over `base`. Never mutates either. */
export function mergeDesign(base, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return clone(base);
  const section = (key) => ({ ...(base[key] || {}), ...(incoming[key] && typeof incoming[key] === 'object' ? incoming[key] : {}) });
  return {
    ...clone(base),
    ...clone(incoming),
    colors: section('colors'),
    darkColors: section('darkColors'),
    typography: section('typography'),
    layout: section('layout'),
    motion: section('motion'),
    icons: {
      ...section('icons'),
      mappings: { ...(base.icons?.mappings || {}), ...(incoming.icons?.mappings && typeof incoming.icons.mappings === 'object' ? incoming.icons.mappings : {}) },
    },
    theme: section('theme'),
  };
}

/* --------------------------------------------------------------- validation */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const ENUM_RULES = [
  ['typography', 'bodyFont', 'fontFamily'], ['typography', 'headingFont', 'fontFamily'], ['typography', 'monoFont', 'fontFamily'],
  ['typography', 'headingScale', 'headingScale'], ['typography', 'bodyWeight', 'bodyWeight'], ['typography', 'headingWeight', 'headingWeight'],
  ['typography', 'lineHeight', 'lineHeight'], ['typography', 'letterSpacing', 'letterSpacing'],
  ['layout', 'radius', 'radius'], ['layout', 'shadow', 'shadow'], ['layout', 'contentWidth', 'contentWidth'],
  ['layout', 'spacingScale', 'spacingScale'], ['layout', 'buttonHeight', 'buttonHeight'], ['layout', 'inputHeight', 'inputHeight'],
  ['layout', 'cardPadding', 'cardPadding'], ['layout', 'gridGap', 'gridGap'], ['layout', 'breakpoint', 'breakpoint'],
  ['layout', 'navDensity', 'navDensity'], ['motion', 'duration', 'motionDuration'], ['theme', 'defaultMode', 'themeMode'],
];
const NUMBER_RULES = [
  ['typography', 'baseFontSize', RANGES.baseFontSize],
  ['icons', 'size', RANGES.iconSize],
  ['icons', 'strokeWidth', RANGES.iconStroke],
];
const BOOLEAN_RULES = [
  ['motion', 'enabled'], ['motion', 'hoverEffects'], ['motion', 'pageAnimations'], ['motion', 'loadingShimmer'],
  ['motion', 'cardInteractions'], ['theme', 'allowUserSelection'],
];

/**
 * Validate a (possibly partial) config the way the server does. Missing keys are
 * fine; present keys must be valid. Returns { valid, errors: [{ path, message }] }.
 */
export function validateConfig(config) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  if (!isObject(config)) return { valid: false, errors: [{ path: '', message: 'Design config must be a JSON object.' }] };

  for (const section of ['colors', 'darkColors']) {
    const palette = config[section];
    if (palette === undefined) continue;
    if (!isObject(palette)) { add(section, 'Must be an object.'); continue; }
    for (const [key, value] of Object.entries(palette)) {
      if (!COLOR_KEYS.includes(key)) add(`${section}.${key}`, 'Unknown color token.');
      else if (typeof value !== 'string' || !HEX6_RE.test(value)) add(`${section}.${key}`, 'Must be a 6-digit HEX color like #C2410C.');
    }
  }
  for (const [section, key, optionSet] of ENUM_RULES) {
    const value = config[section]?.[key];
    if (value === undefined) continue;
    if (!values(OPTIONS[optionSet]).includes(String(value))) add(`${section}.${key}`, `Unsupported value "${value}".`);
  }
  for (const [section, key, range] of NUMBER_RULES) {
    const value = config[section]?.[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max) {
      add(`${section}.${key}`, `Must be a number from ${range.min} to ${range.max}.`);
    }
  }
  for (const [section, key] of BOOLEAN_RULES) {
    const value = config[section]?.[key];
    if (value !== undefined && typeof value !== 'boolean') add(`${section}.${key}`, 'Must be true or false.');
  }
  const mappings = config.icons?.mappings;
  if (mappings !== undefined) {
    if (!isObject(mappings)) add('icons.mappings', 'Must be an object.');
    else {
      for (const [key, value] of Object.entries(mappings)) {
        if (!SEMANTIC_ICON_KEYS.includes(key)) add(`icons.mappings.${key}`, 'Unknown semantic icon key.');
        else if (!ICON_NAMES.includes(value)) add(`icons.mappings.${key}`, `Icon "${value}" is not in the allow-list.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Coerce any input into a complete, valid config: unknown keys are dropped,
 * invalid values fall back to the defaults, colors are normalized to #RRGGBB
 * (so rgb()/hsl()/#abc input is accepted), numbers are clamped.
 */
export function sanitizeConfig(input, base = DEFAULT_DESIGN) {
  const src = isObject(input) ? input : {};
  const out = clone(base);

  for (const section of ['colors', 'darkColors']) {
    for (const key of COLOR_KEYS) {
      const hex = normalizeHex(src[section]?.[key]);
      if (hex) out[section][key] = hex;
    }
  }
  for (const [section, key, optionSet] of ENUM_RULES) {
    const value = src[section]?.[key];
    if (value !== undefined && values(OPTIONS[optionSet]).includes(String(value))) {
      out[section][key] = String(value);
    }
  }
  for (const [section, key, range] of NUMBER_RULES) {
    const n = Number(src[section]?.[key]);
    if (src[section]?.[key] !== undefined && Number.isFinite(n)) {
      const stepped = Math.round(n / range.step) * range.step;
      out[section][key] = Math.min(range.max, Math.max(range.min, stepped));
    }
  }
  for (const [section, key] of BOOLEAN_RULES) {
    if (typeof src[section]?.[key] === 'boolean') out[section][key] = src[section][key];
  }
  if (isObject(src.icons?.mappings)) {
    for (const key of SEMANTIC_ICON_KEYS) {
      if (ICON_NAMES.includes(src.icons.mappings[key])) out.icons.mappings[key] = src.icons.mappings[key];
    }
  }
  return out;
}

/* ----------------------------------------------------------- wiring status */

/**
 * How much of the real app a control actually changes today.
 *   live         - drives shared components / global CSS across the whole app
 *   limited      - works, but only where components do not hard-code their own value
 *   experimental - stored and validated, but no shared component consumes it yet
 * The Studio surfaces this next to every control so admins are never misled.
 */
export const WIRING = {
  'colors.*': { status: 'live', note: 'Consumed through Tailwind color tokens across the app.' },
  'typography.bodyFont': { status: 'live', note: 'Drives the body font and Tailwind font-sans.' },
  'typography.headingFont': { status: 'live', note: 'Drives h1-h6 and font-heading.' },
  'typography.monoFont': { status: 'live', note: 'Drives Tailwind font-mono.' },
  'typography.baseFontSize': { status: 'limited', note: 'Sets the body size; elements with explicit text-sm/text-lg classes keep their own size.' },
  'typography.headingScale': { status: 'experimental', note: 'Only affects components using the .setu-design-heading-* utilities.' },
  'typography.bodyWeight': { status: 'live', note: 'Default weight for body text.' },
  'typography.headingWeight': { status: 'limited', note: 'Applies to headings without an explicit font-weight class.' },
  'typography.lineHeight': { status: 'limited', note: 'Applies to text without an explicit leading/text-size class.' },
  'typography.letterSpacing': { status: 'live', note: 'Inherited by body text.' },
  'layout.radius': { status: 'live', note: 'Drives every rounded-* utility.' },
  'layout.buttonHeight': { status: 'live', note: 'Drives the shared <Button> (default, sm, lg, icon).' },
  'layout.inputHeight': { status: 'live', note: 'Drives the shared <Input>.' },
  'layout.shadow': { status: 'experimental', note: 'Only affects the .setu-design-shadow/.setu-design-card utilities.' },
  'layout.contentWidth': { status: 'experimental', note: 'Only affects the .setu-design-container utility.' },
  'layout.spacingScale': { status: 'experimental', note: 'No shared component consumes this yet.' },
  'layout.cardPadding': { status: 'experimental', note: 'Only affects the .setu-design-card utility.' },
  'layout.gridGap': { status: 'experimental', note: 'Only affects the .setu-design-grid utility.' },
  'layout.breakpoint': { status: 'experimental', note: 'Does not rewrite Tailwind responsive breakpoints.' },
  'layout.navDensity': { status: 'experimental', note: 'Only affects the .setu-design-nav-item utility.' },
  'motion.enabled': { status: 'live', note: 'Global kill-switch for animations and transitions.' },
  'motion.duration': { status: 'live', note: 'Default duration of every Tailwind transition utility.' },
  'motion.loadingShimmer': { status: 'live', note: 'Controls the shared .shimmer skeleton animation.' },
  'motion.hoverEffects': { status: 'experimental', note: 'Only affects .setu-hover-effect elements.' },
  'motion.pageAnimations': { status: 'experimental', note: 'Only affects .setu-page-animation elements.' },
  'motion.cardInteractions': { status: 'experimental', note: 'Only affects .setu-card-interactive elements.' },
  'icons.size': { status: 'limited', note: 'Applies to Lucide icons that do not set their own w-/h- classes.' },
  'icons.strokeWidth': { status: 'limited', note: 'Applies to Lucide icons that do not set their own w-/h- classes.' },
  'icons.mappings': { status: 'experimental', note: 'Only components rendered through <DesignIcon> follow these.' },
  'theme.defaultMode': { status: 'experimental', note: 'Stored policy; portal theme switchers do not read it yet.' },
  'theme.allowUserSelection': { status: 'experimental', note: 'Stored policy; portal theme switchers do not read it yet.' },
};

export function wiringFor(section, key) {
  if (section === 'colors' || section === 'darkColors') return WIRING['colors.*'];
  return WIRING[`${section}.${key}`] || { status: 'experimental', note: 'Not wired to shared components yet.' };
}
