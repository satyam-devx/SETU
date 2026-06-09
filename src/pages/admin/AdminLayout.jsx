import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';

function AdminContent() {
  return (
    <div className="flex min-h-screen bg-background">
      <OfflineBanner />
      <AdminSidebar />
      <main className="flex-1 overflow-auto max-w-full">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <ErrorBoundary portal="Block Admin" fallbackRoute="/admin">
      <AdminContent />
    </ErrorBoundary>
  );
}
