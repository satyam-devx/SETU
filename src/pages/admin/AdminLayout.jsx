// ═══════════════════════════════════════════════════════════
// SETU — AdminLayout
// Uses the shared, accessible AdminShell for sidebar + mobile drawer.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminShell from '@/components/admin/AdminShell';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';

export default function AdminLayout() {
  return (
    <ErrorBoundary portal="Block Admin" fallbackRoute="/admin">
      <AdminShell
        title="SETU Admin"
        banner={<OfflineBanner />}
        persistKey="admin"
        accent="saffron"
        renderSidebar={(onClose, { collapsed, onToggleCollapsed, accent }) => (
          <AdminSidebar onClose={onClose} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} accent={accent} />
        )}
      >
        <Outlet />
      </AdminShell>
    </ErrorBoundary>
  );
}
