// ═══════════════════════════════════════════════════════════
// SETU — StatusBadge (production version)
// Replaces stub. Uses shared STATUS_COLORS from utils.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { cn, getStatusLabel, getStatusColor } from '@/lib/utils';

export default function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusColor(status),
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
