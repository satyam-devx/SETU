/**
 * Pure color utilities for the SETU Design System Studio.
 * No DOM, no React, no app imports: safe to run under plain Node for tests.
 */

export const HEX6_RE = /^#[0-9a-f]{6}$/i;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** Convert HSL (h: 0-360, s/l: 0-100) to integer RGB. */
export function hslToRgb({ h, s, l }) {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hh + 1 / 3) * 255),
    g: Math.round(channel(hh) * 255),
    b: Math.round(channel(hh - 1 / 3) * 255),
  };
}

/** Convert RGB (0-255) to HSL floats (h: 0-360, s/l: 0-100). */
export function rgbToHsl({ r, g, b }) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function toHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

/**
 * Parse #RGB, #RRGGBB, rgb()/rgba() and hsl()/hsla() (comma or space syntax).
 * Alpha is ignored. Returns {r,g,b} or null.
 */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();

  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) };
  }
  m = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    return [r, g, b].every((v) => v >= 0 && v <= 255) ? { r, g, b } : null;
  }
  m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s);
  if (m) {
    const h = Number(m[1]);
    const sat = Number(m[2]);
    const light = Number(m[3]);
    if ([h, sat, light].some((v) => !Number.isFinite(v)) || sat > 100 || light > 100) return null;
    return hslToRgb({ h, s: sat, l: light });
  }
  return null;
}

/** Any supported color syntax -> normalized #RRGGBB, or null. */
export function normalizeHex(input) {
  const rgb = parseColor(input);
  return rgb ? toHex(rgb) : null;
}

export const formatRgb = (hex) => {
  const c = parseColor(hex);
  return c ? `rgb(${c.r} ${c.g} ${c.b})` : '';
};

export const formatHsl = (hex) => {
  const c = parseColor(hex);
  if (!c) return '';
  const { h, s, l } = rgbToHsl(c);
  return `hsl(${round(h)} ${round(s)}% ${round(l)}%)`;
};

/**
 * "H S% L%" triplet used by the app's `hsl(var(--token))` Tailwind colors.
 * One decimal keeps the round-trip error under one RGB step (the previous
 * integer rounding could shift a color by a few steps).
 */
export function hexToHslTriplet(input, digits = 1) {
  const rgb = parseColor(input);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  return `${round(h, digits)} ${round(s, digits)}% ${round(l, digits)}%`;
}

export function relativeLuminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two colors (any supported syntax), or null. */
export function contrastRatio(a, b) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pick whichever candidate reads better on `background`. The defaults are
 * white and near-black; when neither reaches AA 4.5:1 (mid-tone backgrounds),
 * fall back to pure white/black, one of which always does (>= 4.58:1).
 */
export function readableOn(background, light = '#FFFFFF', dark = '#0D0D0D') {
  const best = (a, b) => {
    const ra = contrastRatio(a, background);
    const rb = contrastRatio(b, background);
    return { color: ra >= rb ? a : b, ratio: Math.max(ra, rb) };
  };
  if (contrastRatio(light, background) === null || contrastRatio(dark, background) === null) return light;
  const first = best(light, dark);
  if (first.ratio >= 4.5) return first.color;
  return best('#FFFFFF', '#000000').color;
}

/**
 * Move `fg` along the lightness axis (keeping hue/saturation) by the smallest
 * amount that reaches `target` contrast on `bg`. Returns null when impossible.
 */
export function ensureContrast(fg, bg, target = 4.5) {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const start = contrastRatio(fg, bg);
  if (start >= target) return { color: toHex(f), ratio: start, changed: false };
  const hsl = rgbToHsl(f);
  // On light backgrounds darken first; on dark backgrounds lighten first.
  const directions = relativeLuminance(b) > 0.179 ? [-1, 1] : [1, -1];
  for (const dir of directions) {
    for (let step = 0.5; step <= 100; step += 0.5) {
      const l = clamp(hsl.l + dir * step, 0, 100);
      const candidate = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }));
      const ratio = contrastRatio(candidate, bg);
      if (ratio >= target) return { color: candidate, ratio, changed: true };
      if (l === 0 || l === 100) break;
    }
  }
  return null;
}

/**
 * Suggest the smallest edit that makes a foreground/background pair pass.
 * Prefers changing the foreground token; falls back to the background.
 * Returns { side: 'fg'|'bg', color, ratio } or null.
 */
export function suggestFix(fg, bg, target = 4.5) {
  const direct = ensureContrast(fg, bg, target);
  if (direct) return { side: 'fg', color: direct.color, ratio: direct.ratio };
  const other = ensureContrast(bg, fg, target);
  if (other) return { side: 'bg', color: other.color, ratio: other.ratio };
  return null;
}

/**
 * Derive the brand-driven tokens of both palettes from a single brand color.
 * Only brand tokens are produced; neutrals and status colors are untouched so
 * the result always layers cleanly on top of any base palette.
 */
export function deriveBrandTokens(brand, { background = '#FFFFFF', darkBackground = '#14110F', sidebar = '#0F172A', darkSidebar = '#0C1019' } = {}) {
  const base = normalizeHex(brand);
  if (!base) return null;
  const pick = (fg, bg, target) => ensureContrast(fg, bg, target)?.color ?? fg;

  const primary = pick(base, '#FFFFFF', 4.5);
  const darkPrimary = pick(base, darkBackground, 4.5);
  return {
    colors: {
      primary,
      primaryForeground: readableOn(primary),
      ring: pick(base, background, 3),
      sidebarAccent: pick(base, sidebar, 3),
      sidebarPrimary: pick(base, sidebar, 3),
      chart1: primary,
    },
    darkColors: {
      primary: darkPrimary,
      primaryForeground: readableOn(darkPrimary),
      ring: pick(base, darkBackground, 3),
      sidebarAccent: pick(base, darkSidebar, 3),
      sidebarPrimary: pick(base, darkSidebar, 3),
      chart1: darkPrimary,
    },
  };
}
