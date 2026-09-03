// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminLayout
// Uses the shared, accessible AdminShell for sidebar + mobile drawer.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from '@/components/admin/SuperAdminSidebar';
import AdminShell from '@/components/admin/AdminShell';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

export default function SuperAdminLayout() {
  return (
    <ErrorBoundary portal="Super Admin" fallbackRoute="/superadmin">
      <AdminShell
        title="SETU Super Admin"
        persistKey="superadmin"
        accent="gold"
        renderSidebar={(onClose, { collapsed, onToggleCollapsed, accent }) => (
          <SuperAdminSidebar onClose={onClose} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} accent={accent} />
        )}
      >
        <Outlet />
      </AdminShell>
    </ErrorBoundary>
  );
}
