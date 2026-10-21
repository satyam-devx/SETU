import * as LucideIcons from 'lucide-react';
import { ICON_NAMES } from '@/lib/design/schema';

// Same allow-list the database enforces, plus two internal Studio icons.
const ALLOWED_ICON_NAMES = new Set([...ICON_NAMES, 'Palette', 'History']);

// Lucide renamed a few icons over time (Home -> House, HelpCircle -> CircleHelp).
// Resolving through aliases keeps the allow-list names working on any installed version.
const ICON_ALIASES = { House: ['Home'], CircleHelp: ['HelpCircle'], UserRound: ['User'] };

/** Lucide component for an allow-listed icon name, or null. Custom SVG is deliberately unsupported. */
export function resolveDesignIcon(name) {
  if (!ALLOWED_ICON_NAMES.has(name)) return null;
  return LucideIcons[name] || (ICON_ALIASES[name] || []).map((alias) => LucideIcons[alias]).find(Boolean) || null;
}
