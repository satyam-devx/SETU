import React from 'react';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from '@/components/admin/SuperAdminSidebar';

export default function SuperAdminLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}