/**
 * Config diffing for the Studio (draft vs published, version vs version).
 * Pure and DOM-free.
 */
import { COLOR_LABELS } from './schema.js';

export const DIFF_SECTIONS = ['colors', 'darkColors', 'typography', 'layout', 'motion', 'icons', 'theme'];
export const SECTION_LABELS = {
  colors: 'Light colors', darkColors: 'Dark colors', typography: 'Typography', layout: 'Layout',
  motion: 'Motion', icons: 'Icons', theme: 'Theme policy',
};

const humanize = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

function flatten(config) {
  const flat = new Map();
  for (const section of DIFF_SECTIONS) {
    const obj = config?.[section];
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, value] of Object.entries(obj)) {
      if (section === 'icons' && key === 'mappings' && value && typeof value === 'object') {
        for (const [mk, mv] of Object.entries(value)) flat.set(`icons.mappings.${mk}`, { section, key: `mappings.${mk}`, value: mv });
      } else {
        flat.set(`${section}.${key}`, { section, key, value });
      }
    }
  }
  return flat;
}

function labelFor(section, key) {
  if (section === 'colors' || section === 'darkColors') return COLOR_LABELS[key] || humanize(key);
  if (key.startsWith('mappings.')) return `${humanize(key.slice(9))} icon`;
  return humanize(key);
}

/** @returns {Array<{path,section,key,label,before,after,kind}>} ordered by section. */
export function diffConfigs(before, after) {
  const a = flatten(before);
  const b = flatten(after);
  const changes = [];
  for (const [path, next] of b) {
    const prev = a.get(path);
    if (!prev) changes.push({ path, section: next.section, key: next.key, label: labelFor(next.section, next.key), before: undefined, after: next.value, kind: 'added' });
    else if (JSON.stringify(prev.value) !== JSON.stringify(next.value)) {
      changes.push({ path, section: next.section, key: next.key, label: labelFor(next.section, next.key), before: prev.value, after: next.value, kind: 'changed' });
    }
  }
  for (const [path, prev] of a) {
    if (!b.has(path)) changes.push({ path, section: prev.section, key: prev.key, label: labelFor(prev.section, prev.key), before: prev.value, after: undefined, kind: 'removed' });
  }
  const order = (c) => DIFF_SECTIONS.indexOf(c.section);
  return changes.sort((x, y) => order(x) - order(y));
}

export function summarizeDiff(changes) {
  const bySection = {};
  for (const c of changes) bySection[c.section] = (bySection[c.section] || 0) + 1;
  return { total: changes.length, bySection };
}

export const formatValue = (v) => (v === undefined ? '-' : typeof v === 'boolean' ? (v ? 'On' : 'Off') : String(v));

/**
 * The minimal partial config that, merged over `base`, reproduces `next`.
 * Scoped portals (vendor, rider, ...) save only these overrides so they keep
 * inheriting every other token from the Global design instead of freezing a
 * full copy. The server merges global + scoped per section; because that merge
 * is shallow, a changed icon mapping ships the full mappings object.
 */
export function extractOverrides(base, next) {
  const out = {};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const section of ['colors', 'darkColors', 'typography', 'layout', 'motion', 'theme']) {
    for (const [key, value] of Object.entries(next?.[section] || {})) {
      if (!same(base?.[section]?.[key], value)) {
        out[section] = out[section] || {};
        out[section][key] = value;
      }
    }
  }
  const icons = {};
  for (const key of ['size', 'strokeWidth']) {
    if (next?.icons && !same(base?.icons?.[key], next.icons[key])) icons[key] = next.icons[key];
  }
  if (next?.icons?.mappings && !same(base?.icons?.mappings, next.icons.mappings)) icons.mappings = { ...next.icons.mappings };
  if (Object.keys(icons).length) out.icons = icons;
  return out;
}
