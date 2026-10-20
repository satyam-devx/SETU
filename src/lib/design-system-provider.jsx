import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_DESIGN, mergeDesign, DesignSystemAPI } from '@/lib/design-system';

const DesignSystemContext = createContext({ design: DEFAULT_DESIGN, loading: true, reload: async () => {} });
const CSS_COLOR_MAP = {
  background: '--background', foreground: '--foreground', card: '--card', cardForeground: '--card-foreground', popover: '--popover', popoverForeground: '--popover-foreground',
  primary: '--primary', primaryForeground: '--primary-foreground', secondary: '--secondary', secondaryForeground: '--secondary-foreground',
  accent: '--accent', accentForeground: '--accent-foreground', muted: '--muted', mutedForeground: '--muted-foreground',
  border: '--border', input: '--input', ring: '--ring', destructive: '--destructive', destructiveForeground: '--destructive-foreground',
  setuSaffron: '--setu-saffron', setuTeal: '--setu-teal', setuEarth: '--setu-earth', setuSuccess: '--setu-success', setuWarning: '--setu-warning',
  sidebar: '--sidebar', sidebarForeground: '--sidebar-foreground', sidebarBorder: '--sidebar-border', sidebarAccent: '--sidebar-accent', sidebarPrimary: '--sidebar-primary',
  chart1: '--chart-1', chart2: '--chart-2', chart3: '--chart-3', chart4: '--chart-4', chart5: '--chart-5',
};
const HEX_RE = /^#[0-9a-f]{6}$/i;
function hexToHsl(hex) {
  const n = hex.slice(1);
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyDesignTokens(config, options = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const mode = options.colorMode === 'dark' || options.colorMode === 'light'
    ? options.colorMode
    : (root.classList.contains('dark') ? 'dark' : 'light');
  const activeColors = mode === 'dark' ? (config?.darkColors || config?.colors) : config?.colors;
  Object.entries(activeColors || {}).forEach(([key, value]) => {
    const variable = CSS_COLOR_MAP[key];
    if (variable && typeof value === 'string' && HEX_RE.test(value)) root.style.setProperty(variable, hexToHsl(value));
  });
  const fonts = { system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', inter: 'Inter, system-ui, sans-serif', roboto: 'Roboto, system-ui, sans-serif', nunito: '"Nunito Sans", system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
  const typography = config?.typography || {};
  root.style.setProperty('--setu-font-body', fonts[typography.bodyFont] || fonts.system);
  root.style.setProperty('--setu-font-heading', fonts[typography.headingFont] || fonts.system);
  root.style.setProperty('--setu-font-mono', fonts[typography.monoFont] || fonts.mono);
  root.style.setProperty('--setu-base-font-size', `${Math.min(20, Math.max(14, Number(typography.baseFontSize) || 16))}px`);
  const headingScale = { compact: 0.92, standard: 1, expressive: 1.12 }[typography.headingScale] || 1;
  root.style.setProperty('--setu-heading-scale', String(headingScale));
  root.style.setProperty('--setu-body-weight', ['400','500'].includes(String(typography.bodyWeight)) ? String(typography.bodyWeight) : '400');
  root.style.setProperty('--setu-heading-weight', ['500','600','700','800'].includes(String(typography.headingWeight)) ? String(typography.headingWeight) : '600');
  root.style.setProperty('--setu-line-height', ({ tight: '1.35', normal: '1.5', relaxed: '1.7' })[typography.lineHeight] || '1.5');
  root.style.setProperty('--setu-letter-spacing', ({ tight: '-0.015em', normal: '0', wide: '0.025em' })[typography.letterSpacing] || '0');
  const radius = ['8px', '10px', '12px', '16px', '20px'].includes(config?.layout?.radius) ? config.layout.radius : '12px';
  root.style.setProperty('--radius', radius);
  const shadows = { none: 'none', soft: '0 2px 8px 0 rgb(0 0 0 / 0.08)', elevated: '0 8px 24px 0 rgb(0 0 0 / 0.12)' };
  root.style.setProperty('--setu-shadow-card', shadows[config?.layout?.shadow] || shadows.soft);
  root.style.setProperty('--setu-content-width', config?.layout?.contentWidth === 'wide' ? '80rem' : config?.layout?.contentWidth === 'compact' ? '48rem' : '64rem');
  const layout = config?.layout || {};
  const scales = { compact: '0.85', standard: '1', spacious: '1.15' };
  root.style.setProperty('--setu-spacing-scale', scales[layout.spacingScale] || '1');
  root.style.setProperty('--setu-button-height', ({ compact: '2.25rem', standard: '2.75rem', large: '3.25rem' })[layout.buttonHeight] || '2.75rem');
  root.style.setProperty('--setu-input-height', ({ compact: '2.5rem', standard: '3rem', large: '3.5rem' })[layout.inputHeight] || '3rem');
  root.style.setProperty('--setu-card-padding', ({ compact: '0.75rem', standard: '1rem', spacious: '1.5rem' })[layout.cardPadding] || '1rem');
  root.style.setProperty('--setu-grid-gap', ({ compact: '0.75rem', standard: '1rem', spacious: '1.5rem' })[layout.gridGap] || '1rem');
  root.style.setProperty('--setu-nav-density', layout.navDensity === 'compact' ? '0.75rem' : layout.navDensity === 'spacious' ? '1.25rem' : '1rem');
  root.style.setProperty('--setu-breakpoint-md', ({ compact: '640px', standard: '768px', wide: '900px' })[layout.breakpoint] || '768px');
  const motion = config?.motion || {};
  root.dataset.setuMotion = motion.enabled === false ? 'off' : 'on';
  root.dataset.setuHoverEffects = motion.hoverEffects === false ? 'off' : 'on';
  root.dataset.setuPageAnimations = motion.pageAnimations === false ? 'off' : 'on';
  root.dataset.setuLoadingShimmer = motion.loadingShimmer === false ? 'off' : 'on';
  root.dataset.setuCardInteractions = motion.cardInteractions === false ? 'off' : 'on';
  root.style.setProperty('--setu-motion-duration', motion.duration === 'fast' ? '100ms' : motion.duration === 'slow' ? '350ms' : '180ms');
  root.style.setProperty('--setu-shadow-card', shadows[config?.layout?.shadow] || shadows.soft);
  root.style.setProperty('--setu-icon-size', `${Math.min(32, Math.max(14, Number(config?.icons?.size) || 20))}px`);
  root.style.setProperty('--setu-icon-stroke', `${Math.min(3, Math.max(1, Number(config?.icons?.strokeWidth) || 2))}`);
  root.style.setProperty('--setu-font-heading-size-factor', String(headingScale));
  const themeMode = config?.theme?.defaultMode;
  if (options.applyDefaultTheme && ['light','dark'].includes(themeMode)) root.classList.toggle('dark', themeMode === 'dark');
}

export function DesignSystemProvider({ children }) {
  const location = useLocation();
  const activeScope = location.pathname.startsWith('/customer') ? 'customer' : location.pathname.startsWith('/vendor') ? 'vendor' : location.pathname.startsWith('/rider') ? 'rider' : location.pathname.startsWith('/seva') ? 'seva' : location.pathname.startsWith('/anchor') ? 'anchor' : location.pathname.startsWith('/superadmin') ? 'superadmin' : location.pathname.startsWith('/admin') ? 'admin' : 'global';
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    const { data } = await DesignSystemAPI.getPublished(activeScope);
    if (currentRequest !== requestId.current) return;
    setDesign(mergeDesign(DEFAULT_DESIGN, data?.config || {}));
    setLoading(false);
  }, [activeScope]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const root = document.documentElement;
    const applyCurrent = () => {
      const preview = typeof window !== 'undefined' ? window.__SETU_DESIGN_PREVIEW__ : null;
      applyDesignTokens(preview?.config || design, preview ? { colorMode: preview.colorMode } : {});
    };
    applyCurrent();
    const observer = new MutationObserver(applyCurrent);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [design]);
  const value = useMemo(() => ({ design, loading, reload }), [design, loading, reload]);
  return <DesignSystemContext.Provider value={value}>{children}</DesignSystemContext.Provider>;
}
export const useDesignSystem = () => useContext(DesignSystemContext);
export { DEFAULT_DESIGN, mergeDesign };
