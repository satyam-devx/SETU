// ═══════════════════════════════════════════════════════════
// SETU — AdminShell
//
// Shared responsive chrome for the Block-Admin and Super-Admin
// portals: the sidebar (static rail on desktop, modal drawer on
// mobile), the mobile top bar, and the single scrollable content
// region — so both layouts stay identical, accessible and fast
// without duplicating any of this.
//
// Two genuinely different renderings, chosen in JS (not just CSS)
// so the mobile drawer's focus-trap / scroll-lock machinery fully
// unmounts on desktop instead of just being visually hidden:
//
//   • Desktop (≥1024px) — a static or icon-only "rail" sidebar,
//     collapse state persisted per-portal in localStorage,
//     toggleable via a button or ⌘/Ctrl+\.
//   • Mobile/tablet (<1024px) — a Radix Dialog-based slide-in
//     drawer: backdrop-blur overlay, real focus trap, Esc-to-close,
//     scroll lock and focus restoration all come from Radix, on top
//     of a hand-rolled swipe-to-close gesture for a native feel.
// ═══════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, storage } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/useMediaQuery';

const SWIPE_CLOSE_PX = 70;

export default function AdminShell({
  title,
  renderSidebar,
  banner = null,
  children,
  persistKey = 'default',
  accent = 'saffron',
}) {
  const isDesktop = useIsDesktop();
  const collapseStorageKey = `setu.admin.sidebar.collapsed.${persistKey}`;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => storage.get(collapseStorageKey, false));

  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  // Persist the rail-collapse preference per portal.
  useEffect(() => {
    storage.set(collapseStorageKey, collapsed);
  }, [collapsed, collapseStorageKey]);

  // If the viewport crosses into desktop width while the mobile
  // drawer happens to be open (rotation, external display, devtools
  // resize), drop the stale "open" state — it renders as a static
  // rail on desktop regardless, but we don't want it to silently
  // reopen as a modal drawer if the viewport later narrows again.
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  // ⌘/Ctrl+\ toggles the rail — the same shortcut power users
  // already know from Linear / VS Code-style tools. Ignored while
  // typing in a field so it never hijacks real input.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== '\\' || !(e.metaKey || e.ctrlKey)) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      setCollapsed((c) => !c);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Explicit focus restoration to the hamburger trigger on close —
  // Radix already does this by default, this is just a defensive
  // guarantee per the a11y spec for this component.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !sidebarOpen) triggerRef.current?.focus?.();
    wasOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  // ── Swipe-to-close (mobile drawer only) ───────────────────
  // Tracks the finger 1:1 via direct DOM mutation (no React
  // state during the drag) so this stays glitch-free at 60fps.
  // Uses a plain CSS *transition* (not a keyframe animation) for
  // both drag feedback and settle, so the browser always
  // interpolates smoothly from wherever the finger let go —
  // there's no "reset to 0 then re-animate" jump to fight.
  const dragStartX = useRef(0);
  const dragDeltaX = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = useCallback((e) => {
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    dragDeltaX.current = 0;
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    if (dx >= 0) return; // only track the closing (leftward) direction
    dragDeltaX.current = dx;
    if (drawerRef.current) drawerRef.current.style.transform = `translateX(${dx}px)`;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const shouldClose = dragDeltaX.current < -SWIPE_CLOSE_PX;
    dragDeltaX.current = 0;
    const node = drawerRef.current;
    if (node) {
      node.style.transition = ''; // hand control back to the CSS transition class
      node.style.transform = '';
    }
    if (shouldClose) setSidebarOpen(false);
  }, []);

  const railState = useMemo(
    () => ({ collapsed, onToggleCollapsed: toggleCollapsed, accent }),
    [collapsed, toggleCollapsed, accent]
  );

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background">
      {banner}

      {isDesktop ? (
        // ── Desktop: static / collapsible rail ──────────────
        <div className={cn('h-full shrink-0 transition-[width] duration-200 ease-in-out', collapsed ? 'w-[68px]' : 'w-64')}>
          {renderSidebar(undefined, railState)}
        </div>
      ) : (
        // ── Mobile / tablet: modal drawer ───────────────────
        <Dialog.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay
              forceMount
              className={cn(
                'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
                sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
            />
            <Dialog.Content
              forceMount
              ref={drawerRef}
              id="admin-sidebar-drawer"
              inert={!sidebarOpen}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              aria-describedby={undefined}
              className={cn(
                'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] outline-none',
                'transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
              )}
            >
              <Dialog.Title className="sr-only">{title} navigation</Dialog.Title>
              {renderSidebar(closeSidebar, { collapsed: false, onToggleCollapsed: undefined, accent })}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Main content — the single scroll container in this shell. */}
      <main className="min-w-0 max-w-full flex-1 overflow-auto">
        {/* Mobile top bar — intentionally non-sticky so it never
            overlaps a page's own sticky header (which would
            otherwise cover the hamburger trigger). */}
        {!isDesktop && (
          <div
            className="flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-sm"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={openSidebar}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar-drawer"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-heading font-bold text-sm">{title}</span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
