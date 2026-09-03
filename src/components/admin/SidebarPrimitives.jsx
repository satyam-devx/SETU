// ═══════════════════════════════════════════════════════════
// SETU — Sidebar Primitives
//
// Shared, reusable building blocks for AdminSidebar and
// SuperAdminSidebar so both portals get the exact same premium
// interactions (active-state, hover, rail-collapse + tooltips,
// badges) without duplicating markup or drifting out of sync.
// ═══════════════════════════════════════════════════════════
import React, { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Accent themes ─────────────────────────────────────────
// Admin portal reads as SETU saffron; Super Admin reads as its
// own "God Mode" gold — same interaction language, different
// brand temperature, so a glance at the accent tells you which
// portal you're in.
export const ACCENTS = {
  saffron: {
    bar: 'bg-sidebar-primary',
    icon: 'text-sidebar-primary',
    ring: 'focus-visible:ring-sidebar-primary',
  },
  gold: {
    bar: 'bg-yellow-400',
    icon: 'text-yellow-400',
    ring: 'focus-visible:ring-yellow-400',
  },
};

// ── Active-path matching ─────────────────────────────────
// A path is "active" on an exact match, or — for anything but the
// portal root — when the current route is nested under it.
export function isPathActive(pathname, path, rootPaths = ['/admin', '/superadmin']) {
  if (pathname === path) return true;
  if (rootPaths.includes(path)) return false;
  return pathname.startsWith(`${path}/`) || pathname === path;
}

// ── Rail tooltip ──────────────────────────────────────────
// Renders via a portal so it's never clipped by the nav's
// scroll container, and only mounts the listeners it needs when
// `disabled` is false (i.e. only in collapsed/rail mode) so the
// expanded sidebar pays zero cost for this feature.
export const RailTooltip = memo(function RailTooltip({ label, disabled, children }) {
  const [coords, setCoords] = useState(null);
  const anchorRef = useRef(null);
  const showTimer = useRef(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    if (!anchorRef.current) return;
    clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    }, 200);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(showTimer.current);
    setCoords(null);
  }, []);

  // Belt-and-braces: clear any pending timer if the item unmounts
  // mid-hover (e.g. route change closes a menu) to avoid a setState
  // call landing on an unmounted component.
  useEffect(() => () => clearTimeout(showTimer.current), []);

  if (disabled) return children;

  return (
    <div
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={coords ? tooltipId : undefined}
    >
      {children}
      {coords &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className="pointer-events-none fixed z-[100] -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-150 whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-float"
          >
            {label}
            <div className="absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-neutral-900" />
          </div>,
          document.body
        )}
    </div>
  );
});

// ── Nav item ──────────────────────────────────────────────
export const NavItem = memo(function NavItem({
  icon: Icon,
  label,
  path,
  badgeCount = 0,
  collapsed = false,
  compact = false,
  onNavigate,
  rootPaths,
  accent = 'saffron',
}) {
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, path, rootPaths);
  const theme = ACCENTS[accent] ?? ACCENTS.saffron;

  const link = (
    <Link
      to={path}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group/nav relative flex items-center rounded-lg text-sm transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        theme.ring,
        'active:scale-[0.98]',
        compact ? 'gap-2.5 px-3 py-1.5 text-xs' : 'gap-3 px-3 py-2',
        collapsed && 'justify-center px-0 py-2.5',
        isActive
          ? 'bg-sidebar-accent/15 font-medium text-white'
          : 'text-sidebar-foreground/65 hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {/* Active accent bar — transform-only animation, GPU-friendly */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition-transform duration-150 origin-center',
          theme.bar,
          isActive ? 'scale-y-100' : 'scale-y-0'
        )}
      />
      <span className="relative shrink-0">
        <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]', isActive && theme.icon)} />
        {collapsed && badgeCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar"
          />
        )}
      </span>

      <span
        className={cn(
          'flex-1 truncate transition-[opacity,max-width] duration-150',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
        )}
      >
        {label}
      </span>

      {!collapsed && badgeCount > 0 && (
        <span
          className={cn(
            'min-w-[18px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold',
            isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
          )}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );

  return (
    <RailTooltip label={badgeCount > 0 ? `${label} (${badgeCount})` : label} disabled={!collapsed}>
      {link}
    </RailTooltip>
  );
});

// ── Section label ─────────────────────────────────────────
// Collapses to a thin divider (rather than disappearing outright)
// so the rail still communicates "new group starts here".
export function SectionLabel({ children, collapsed, tone = 'default' }) {
  if (collapsed) {
    return <div aria-hidden="true" className="mx-3 my-1.5 border-t border-sidebar-border/60" />;
  }
  return (
    <p
      className={cn(
        'mb-1 px-3 text-[9px] font-semibold uppercase tracking-widest',
        tone === 'accent' ? 'text-yellow-400/70' : 'text-sidebar-foreground/30'
      )}
    >
      {children}
    </p>
  );
}

// ── Collapsible group (used by SuperAdminSidebar's Admin-access
//    section) — only meaningful when expanded; in rail mode the
//    caller flattens groups into a single icon column instead. ──
export function CollapsibleGroup({ label, items, onNavigate, defaultOpen = false, rootPaths, accent = 'saffron' }) {
  const { pathname } = useLocation();
  const hasActive = items.some((i) => isPathActive(pathname, i.path, rootPaths));
  const [open, setOpen] = useState(defaultOpen || hasActive);
  const theme = ACCENTS[accent] ?? ACCENTS.saffron;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between rounded-md px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          theme.ring
        )}
      >
        <span>{label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              compact
              onNavigate={onNavigate}
              rootPaths={rootPaths}
              accent={accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rail collapse toggle ──────────────────────────────────
export function RailToggleButton({ collapsed, onToggle, accent = 'saffron' }) {
  const theme = ACCENTS[accent] ?? ACCENTS.saffron;
  return (
    <RailTooltip label={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'} disabled={false}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-white/[0.06] hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          theme.ring
        )}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    </RailTooltip>
  );
}

// ── User footer card ──────────────────────────────────────
export function SidebarUserFooter({ initials, name, subtitle, accentClass, collapsed, onSignOut }) {
  const avatar = (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm',
        accentClass
      )}
    >
      {initials}
    </div>
  );

  return (
    <div
      className="shrink-0 border-t border-sidebar-border p-3"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
        {collapsed ? (
          <RailTooltip label={`${name} · ${subtitle}`} disabled={false}>
            {avatar}
          </RailTooltip>
        ) : (
          avatar
        )}
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/50">{subtitle}</p>
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
