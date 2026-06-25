// ═══════════════════════════════════════════════════════════
// SETU — MaintenanceBanner
// Real consumer of the settings system: shows a platform-wide banner
// when `maintenance_mode` is enabled (Super Admin → Configuration).
// Driven entirely by get_public_settings() — no hardcoded copy.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePublicSettings } from '@/lib/settings';

export default function MaintenanceBanner() {
  const { isMaintenance, get } = usePublicSettings();
  if (!isMaintenance) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm shadow-md"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium text-center">
        {get('maintenance_message', 'Scheduled maintenance in progress.')}
      </span>
    </div>
  );
}
