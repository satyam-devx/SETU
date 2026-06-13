// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminLayout
// Fixed: mobile-responsive sidebar with hamburger toggle
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from '@/components/admin/SuperAdminSidebar';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

export default function SuperAdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ErrorBoundary portal="Super Admin" fallbackRoute="/superadmin">
      <div className="flex min-h-screen bg-background">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — hidden on mobile, slide-in when open */}
        <div className={`
          fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <SuperAdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-20">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-heading font-bold text-sm">SETU Super Admin</span>
          </div>
          <Outlet />
        </main>
      </div>
    </ErrorBoundary>
  );
}
