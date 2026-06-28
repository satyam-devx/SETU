// ═══════════════════════════════════════════════════════════
// SETU — AdminShell
//
// Shared responsive chrome for the Block-Admin and Super-Admin
// portals. Encapsulates the sidebar, the mobile slide-in drawer,
// the mobile top bar and the scrollable main content — so both
// layouts stay identical and accessible without duplication.
//
// Accessibility (mobile drawer):
//   • role="dialog" + aria-modal when open
//   • Esc closes the drawer
//   • focus moves into the drawer on open and is restored to the
//     hamburger trigger on close
//   • Tab is trapped within the drawer while open
//   • background scroll is locked while open
// ═══════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function AdminShell({ title, renderSidebar, banner = null, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  // Focus management, Esc-to-close, Tab trap and scroll lock — only
  // while the mobile drawer is actually open.
  useEffect(() => {
    if (!sidebarOpen) return;

    const node = drawerRef.current;
    if (!node) return;

    // Move focus into the drawer.
    const focusables = node.querySelectorAll(FOCUSABLE);
    (focusables[0] ?? node).focus?.();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        const items = node.querySelectorAll(FOCUSABLE);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the hamburger trigger that opened the drawer.
      triggerRef.current?.focus?.();
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {banner}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <div
        ref={drawerRef}
        id="admin-sidebar"
        role={sidebarOpen ? 'dialog' : undefined}
        aria-modal={sidebarOpen ? 'true' : undefined}
        aria-label={sidebarOpen ? 'Navigation menu' : undefined}
        className={`
          fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {renderSidebar(closeSidebar)}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 max-w-full">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-20">
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={openSidebar}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-heading font-bold text-sm">{title}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
