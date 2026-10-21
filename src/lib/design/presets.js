/**
 * Curated presets. Each preset is a partial config layered over the defaults.
 * Foreground tokens for colored surfaces are derived with readableOn(), so a
 * preset can never ship an unreadable button label. scripts/test-design-engine.mjs
 * asserts every preset passes the WCAG AA text audit in both light and dark.
 */
import { ensureContrast, readableOn } from './color.js';
import { mergeDesign, DEFAULT_DESIGN, sanitizeConfig } from './schema.js';

function buildPalette(s) {
  const sidebarAccent = ensureContrast(s.primary, s.sidebar, 3)?.color ?? s.primary;
  return {
    background: s.bg, foreground: s.fg,
    card: s.card, cardForeground: s.fg, popover: s.card, popoverForeground: s.fg,
    primary: s.primary, primaryForeground: readableOn(s.primary),
    secondary: s.secondary, secondaryForeground: readableOn(s.secondary),
    accent: s.accent, accentForeground: readableOn(s.accent),
    muted: s.muted, mutedForeground: s.mutedFg,
    border: s.border, input: s.input ?? s.border, ring: s.ring ?? s.primary,
    destructive: s.destructive, destructiveForeground: readableOn(s.destructive),
    setuSaffron: s.saffron, setuTeal: s.teal, setuEarth: s.earth, setuSuccess: s.success, setuWarning: s.warning,
    sidebar: s.sidebar, sidebarForeground: s.sidebarFg, sidebarBorder: s.sidebarBorder,
    sidebarAccent, sidebarPrimary: sidebarAccent,
    chart1: s.charts[0], chart2: s.charts[1], chart3: s.charts[2], chart4: s.charts[3], chart5: s.charts[4],
  };
}

const RAW_PRESETS = [
  {
    id: 'setu-default',
    name: 'SETU Default',
    tagline: 'Saffron and teal, the original identity.',
    swatch: ['#C2410C', '#287D7D', '#3B9A63'],
    config: {},
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    tagline: 'Cool, crisp and product-focused.',
    swatch: ['#4F46E5', '#0E7490', '#0B0C10'],
    config: {
      colors: buildPalette({
        bg: '#FAFAFC', fg: '#14151A', card: '#FFFFFF', muted: '#F1F2F6', mutedFg: '#565B6B', border: '#E3E5EC', input: '#C9CDD8',
        primary: '#4F46E5', secondary: '#0E7490', accent: '#047857', destructive: '#DC2626', ring: '#4F46E5',
        success: '#15803D', warning: '#D97706', saffron: '#F97316', teal: '#0E7490', earth: '#A8894B',
        sidebar: '#0B1020', sidebarFg: '#E8EAF2', sidebarBorder: '#1E2540',
        charts: ['#4F46E5', '#0E7490', '#047857', '#B45309', '#64748B'],
      }),
      darkColors: buildPalette({
        bg: '#0B0C10', fg: '#ECEDEF', card: '#12141A', muted: '#1A1D26', mutedFg: '#9AA0AE', border: '#262A36',
        primary: '#8B93FF', secondary: '#22A6C4', accent: '#34D399', destructive: '#F87171', ring: '#A5ABFF',
        success: '#34D399', warning: '#FBBF24', saffron: '#FB923C', teal: '#22A6C4', earth: '#B99A5B',
        sidebar: '#07080C', sidebarFg: '#E8EAF2', sidebarBorder: '#1A1E2E',
        charts: ['#8B93FF', '#22A6C4', '#34D399', '#FBBF24', '#94A3B8'],
      }),
      typography: { bodyFont: 'inter', headingFont: 'inter', headingWeight: '700', letterSpacing: 'normal' },
      layout: { radius: '10px' },
    },
  },
  {
    id: 'kharif-green',
    name: 'Kharif Green',
    tagline: 'Fields, harvest and trust.',
    swatch: ['#15803D', '#B45309', '#0F766E'],
    config: {
      colors: buildPalette({
        bg: '#FBFCF9', fg: '#18211A', card: '#FFFFFF', muted: '#F0F4EC', mutedFg: '#55604F', border: '#DDE5D6', input: '#C5D0BC',
        primary: '#15803D', secondary: '#B45309', accent: '#0F766E', destructive: '#C62828', ring: '#15803D',
        success: '#15803D', warning: '#C27803', saffron: '#F97316', teal: '#0F766E', earth: '#8A6D2F',
        sidebar: '#0D1F14', sidebarFg: '#EAF3EC', sidebarBorder: '#1F3A28',
        charts: ['#15803D', '#B45309', '#0F766E', '#8A6D2F', '#64748B'],
      }),
      darkColors: buildPalette({
        bg: '#0C130E', fg: '#E8EEE9', card: '#111A13', muted: '#1A261D', mutedFg: '#98A99C', border: '#243327',
        primary: '#4ADE80', secondary: '#F59E0B', accent: '#2DD4BF', destructive: '#F87171', ring: '#86EFAC',
        success: '#4ADE80', warning: '#FBBF24', saffron: '#FB923C', teal: '#2DD4BF', earth: '#C9A961',
        sidebar: '#08100A', sidebarFg: '#EAF3EC', sidebarBorder: '#1B2D20',
        charts: ['#4ADE80', '#F59E0B', '#2DD4BF', '#C9A961', '#94A3B8'],
      }),
      layout: { radius: '16px' },
    },
  },
  {
    id: 'diwali-gold',
    name: 'Diwali Gold',
    tagline: 'Festive warmth for campaigns.',
    swatch: ['#B45309', '#9F1239', '#6D28D9'],
    config: {
      colors: buildPalette({
        bg: '#FFFBF5', fg: '#2A1A0A', card: '#FFFFFF', muted: '#FBF1E2', mutedFg: '#6B5A45', border: '#EFDFC8', input: '#DCC8A8',
        primary: '#B45309', secondary: '#9F1239', accent: '#6D28D9', destructive: '#B91C1C', ring: '#D97706',
        success: '#166534', warning: '#B45309', saffron: '#F97316', teal: '#287D7D', earth: '#A8894B',
        sidebar: '#2A1206', sidebarFg: '#FFF3E0', sidebarBorder: '#4A2410',
        charts: ['#B45309', '#9F1239', '#6D28D9', '#A8894B', '#64748B'],
      }),
      darkColors: buildPalette({
        bg: '#150D06', fg: '#F6EBDD', card: '#1C1209', muted: '#2A1C0F', mutedFg: '#B09A80', border: '#3A2816',
        primary: '#FBBF24', secondary: '#FB7185', accent: '#A78BFA', destructive: '#F87171', ring: '#FCD34D',
        success: '#4ADE80', warning: '#FBBF24', saffron: '#FB923C', teal: '#3FA3A3', earth: '#C9A961',
        sidebar: '#0F0804', sidebarFg: '#FFF3E0', sidebarBorder: '#33200F',
        charts: ['#FBBF24', '#FB7185', '#A78BFA', '#C9A961', '#94A3B8'],
      }),
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    tagline: 'AAA-leaning text for low-vision users.',
    swatch: ['#0B3FA8', '#000000', '#FFFFFF'],
    config: {
      colors: buildPalette({
        bg: '#FFFFFF', fg: '#000000', card: '#FFFFFF', muted: '#F2F2F2', mutedFg: '#3A3A3A', border: '#5C5C5C', input: '#5C5C5C',
        primary: '#0B3FA8', secondary: '#064E3B', accent: '#7C2D12', destructive: '#9B1C1C', ring: '#0B3FA8',
        success: '#14532D', warning: '#92400E', saffron: '#C2410C', teal: '#064E3B', earth: '#6B4F12',
        sidebar: '#000000', sidebarFg: '#FFFFFF', sidebarBorder: '#4A4A4A',
        charts: ['#0B3FA8', '#064E3B', '#7C2D12', '#6B4F12', '#374151'],
      }),
      darkColors: buildPalette({
        bg: '#000000', fg: '#FFFFFF', card: '#000000', muted: '#161616', mutedFg: '#D0D0D0', border: '#A3A3A3', input: '#A3A3A3',
        primary: '#8AB4FF', secondary: '#5EEAD4', accent: '#FDBA74', destructive: '#FCA5A5', ring: '#8AB4FF',
        success: '#86EFAC', warning: '#FCD34D', saffron: '#FDBA74', teal: '#5EEAD4', earth: '#E5C97A',
        sidebar: '#000000', sidebarFg: '#FFFFFF', sidebarBorder: '#6B6B6B',
        charts: ['#8AB4FF', '#5EEAD4', '#FDBA74', '#E5C97A', '#D1D5DB'],
      }),
      typography: { bodyWeight: '500', headingWeight: '800', baseFontSize: 18, lineHeight: 'relaxed' },
    },
  },
];

/** Presets as complete, sanitized configs ready to load into the editor. */
export const PRESETS = RAW_PRESETS.map((p) => ({ ...p, config: sanitizeConfig(mergeDesign(DEFAULT_DESIGN, p.config)) }));

export const getPreset = (id) => PRESETS.find((p) => p.id === id) || null;
