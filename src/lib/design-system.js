import { supabase } from '@/lib/supabase';

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
  typography: { bodyFont: 'system', headingFont: 'system', monoFont: 'mono', baseFontSize: 16, headingScale: 'standard', bodyWeight: '400', headingWeight: '600', lineHeight: 'normal', letterSpacing: 'normal' },
  layout: { radius: '12px', shadow: 'soft', contentWidth: 'standard', spacingScale: 'standard', buttonHeight: 'standard', inputHeight: 'standard', cardPadding: 'standard', gridGap: 'standard', breakpoint: 'standard', navDensity: 'comfortable' },
  motion: { enabled: true, duration: 'normal', hoverEffects: true, pageAnimations: true, loadingShimmer: true, cardInteractions: true },
  icons: { strokeWidth: 2, size: 20, mappings: { home: 'House', search: 'Search', orders: 'Package', profile: 'UserRound', cart: 'ShoppingCart', location: 'MapPin', settings: 'Settings', help: 'CircleHelp' } },
  theme: { defaultMode: 'system', allowUserSelection: true },
};

export const FONT_OPTIONS = [
  { value: 'system', label: 'System UI (recommended)' },
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'nunito', label: 'Nunito Sans' },
  { value: 'mono', label: 'System Monospace' },
];

export const DESIGN_TABS = [
  { value: 'colors', label: 'Colors' }, { value: 'typography', label: 'Typography' },
  { value: 'layout', label: 'Layout' }, { value: 'motion', label: 'Motion' },
  { value: 'icons', label: 'Icons' }, { value: 'versions', label: 'Versions' },
];

export function mergeDesign(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return structuredClone(base);
  return {
    ...base, ...incoming,
    colors: { ...base.colors, ...(incoming.colors || {}) },
    darkColors: { ...base.darkColors, ...(incoming.darkColors || {}) },
    typography: { ...base.typography, ...(incoming.typography || {}) },
    layout: { ...base.layout, ...(incoming.layout || {}) },
    motion: { ...base.motion, ...(incoming.motion || {}) },
    icons: { ...base.icons, ...(incoming.icons || {}), mappings: { ...(base.icons?.mappings || {}), ...(incoming.icons?.mappings || {}) } },
    theme: { ...(base.theme || {}), ...(incoming.theme || {}) },
  };
}

export const DesignSystemAPI = {
  getPublished: async (scope = 'global') => {
    const { data, error } = await supabase.rpc('get_published_design_system', { p_scope: scope });
    return { data: data && typeof data === 'object' ? data : null, error };
  },
  listVersions: async (scope = 'global') => {
    const { data, error } = await supabase.rpc('list_design_system_versions', { p_scope: scope });
    return { data: Array.isArray(data) ? data : [], error };
  },
  saveDraft: async (scope, config, note = '') => {
    const { data, error } = await supabase.rpc('save_design_system_draft', {
      p_scope: scope, p_config: config, p_note: note,
    });
    return { data, error };
  },
  publish: async (versionId) => {
    const { data, error } = await supabase.rpc('publish_design_system_version', { p_version_id: versionId });
    return { data, error };
  },
};
