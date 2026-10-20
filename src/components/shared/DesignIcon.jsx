import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useDesignSystem } from '@/lib/design-system-provider';

const ALLOWED_ICON_NAMES = new Set([
  'House','Search','Package','UserRound','ShoppingCart','MapPin','Settings','CircleHelp',
  'LayoutDashboard','Heart','Bell','Store','Bike','Map','ShieldCheck','Palette','History',
]);

/**
 * Central icon wrapper. Pass a Lucide component for fixed icons, or a semantic
 * key (home/search/orders/profile/cart/location/settings/help) for a configurable
 * mapping. Custom SVG injection is deliberately unsupported; only bundled Lucide
 * exports from the allow-list can be rendered.
 */
export default function DesignIcon({ icon, className = '', size, strokeWidth, ...props }) {
  const { design } = useDesignSystem();
  const mappedName = typeof icon === 'string' ? (design?.icons?.mappings?.[icon] || icon) : null;
  const Icon = typeof icon === 'string'
    ? (ALLOWED_ICON_NAMES.has(mappedName) ? LucideIcons[mappedName] : LucideIcons.CircleHelp)
    : icon;
  if (!Icon) return null;
  return (
    <Icon
      {...props}
      className={`setu-design-icon ${className}`.trim()}
      width={size ?? 'var(--setu-icon-size)'}
      height={size ?? 'var(--setu-icon-size)'}
      strokeWidth={strokeWidth ?? 'var(--setu-icon-stroke)'}
      aria-hidden={props['aria-label'] ? undefined : true}
    />
  );
}
