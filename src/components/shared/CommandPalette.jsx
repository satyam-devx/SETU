// ═══════════════════════════════════════════════════════════
// SETU — Command Palette (admin UX layer)
//
// A permission-aware Cmd/Ctrl+K palette for admins & super admins.
//   - Static command registry: navigation routes + quick actions,
//     each tagged with an optional `permission` key and filtered
//     through can() from the dynamic RBAC client (migration 021).
//   - Live global search (≥2 chars, debounced 250ms) via
//     SearchAPI.global → admin_global_search() (migration 029),
//     which is itself is_admin()-gated server-side.
//   - Keyboard-first: ↑/↓ to move, Enter to go, Esc to close.
//
// Only mounts for admin / super_admin sessions. Authorization is
// enforced server-side; this is a UX convenience layer.
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import { SearchAPI } from '@/lib/api';
import {
  Search, LayoutDashboard, ShoppingBag, Users, Store, Bike, BadgeCheck,
  FolderTree, Package, Ticket, Image, Bell, Settings2, Flag, Shield,
  Wallet, ScrollText, Terminal, Plus, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react';

// ── Static command registry ───────────────────────────────
// `permission` gates visibility; commands with no permission show to any
// admin. Routes here are all real, already-mounted routes in App.jsx.
const NAV_COMMANDS = [
  { id: 'nav-admin',        label: 'Dashboard',           path: '/admin',                  icon: LayoutDashboard, keywords: 'home overview' },
  { id: 'nav-orders',       label: 'Orders',              path: '/admin/orders',           icon: ShoppingBag,     permission: 'orders.view' },
  { id: 'nav-users',        label: 'Users',               path: '/superadmin/users',       icon: Users,           permission: 'users.view', keywords: 'customers accounts' },
  { id: 'nav-vendors',      label: 'Vendors',             path: '/admin/vendors',          icon: Store },
  { id: 'nav-riders',       label: 'Riders',              path: '/admin/riders',           icon: Bike },
  { id: 'nav-kyc',          label: 'KYC Review',          path: '/admin/kyc',              icon: BadgeCheck,      keywords: 'verification identity' },
  { id: 'nav-vapproval',    label: 'Vendor Approval',     path: '/admin/vendor-approval',  icon: BadgeCheck,      permission: 'vendors.approve' },
  { id: 'nav-categories',   label: 'Categories',          path: '/admin/categories',       icon: FolderTree },
  { id: 'nav-products',     label: 'Products',            path: '/admin/products',         icon: Package,         keywords: 'catalog inventory' },
  { id: 'nav-coupons',      label: 'Coupons',             path: '/admin/coupons',          icon: Ticket,          permission: 'coupons.view', keywords: 'discount promo' },
  { id: 'nav-banners',      label: 'Banners & CMS',       path: '/admin/banners',          icon: Image,           permission: 'cms.view', keywords: 'content carousel' },
  { id: 'nav-notif',        label: 'Notification Center', path: '/admin/notifications',    icon: Bell,            permission: 'notifications.create', keywords: 'push campaign message' },
  { id: 'nav-config',       label: 'Application Settings',path: '/superadmin/config',      icon: Settings2,       permission: 'settings.update', keywords: 'configuration branding' },
  { id: 'nav-flags',        label: 'Feature Flags',       path: '/superadmin/feature-flags',icon: Flag,           permission: 'feature_flags.manage', keywords: 'toggle release' },
  { id: 'nav-roles',        label: 'Roles & Permissions', path: '/superadmin/roles',       icon: Shield,          permission: 'roles.view', keywords: 'rbac access' },
  { id: 'nav-finance',      label: 'Finance Center',      path: '/superadmin/finance',     icon: Wallet,          permission: 'finance.view', keywords: 'revenue payments earnings' },
  { id: 'nav-security',     label: 'Security Center',     path: '/superadmin/security',    icon: Shield,          permission: 'users.view', keywords: 'blocked banned events' },
  { id: 'nav-developer',    label: 'Developer Center',    path: '/superadmin/developer',   icon: Terminal,        permission: 'developer.view', keywords: 'health cron migrations logs' },
  { id: 'nav-audit',        label: 'Audit Log',           path: '/admin/audit-log',        icon: ScrollText,      keywords: 'history changes' },
];

const ACTION_COMMANDS = [
  { id: 'act-coupon',   label: 'New Coupon',   path: '/admin/coupons',       icon: Plus, permission: 'coupons.create', keywords: 'create discount add' },
  { id: 'act-campaign', label: 'New Campaign', path: '/admin/notifications', icon: Plus, permission: 'notifications.create', keywords: 'create push send broadcast' },
];

const KIND_ICON = {
  user:   Users,
  vendor: Store,
  order:  ShoppingBag,
  coupon: Ticket,
};

export default function CommandPalette() {
  const { userRole } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // ── Static commands filtered by permission + query text ──
  const staticItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    const match = (c) =>
      !text ||
      c.label.toLowerCase().includes(text) ||
      (c.keywords && c.keywords.toLowerCase().includes(text));
    const allowed = (c) => !c.permission || can(c.permission);
    return [...ACTION_COMMANDS, ...NAV_COMMANDS]
      .filter(allowed)
      .filter(match)
      .map((c) => ({
        kind: 'command',
        id: c.id,
        label: c.label,
        sublabel: c.id.startsWith('act-') ? 'Quick action' : 'Go to',
        path: c.path,
        icon: c.icon,
      }));
  }, [query, can]);

  // ── Live entity search (debounced) ──────────────────────
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await SearchAPI.global(q);
      const rows = Array.isArray(data) ? data : [];
      setResults(rows.map((r) => ({
        kind: r.kind,
        id: `${r.kind}-${r.id}`,
        label: r.label,
        sublabel: r.sublabel,
        path: r.path,
        icon: KIND_ICON[r.kind] || Search,
      })));
      setSearching(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  // Merged, ordered list: commands first, then entity matches.
  const items = useMemo(() => [...staticItems, ...results], [staticItems, results]);

  // Keep selection in range whenever the list changes.
  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    if (selected >= items.length) setSelected(items.length > 0 ? items.length - 1 : 0);
  }, [items.length, selected]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelected(0);
  }, []);

  const go = useCallback((item) => {
    if (!item) return;
    close();
    navigate(item.path);
  }, [navigate, close]);

  // ── Global Cmd/Ctrl+K toggle ────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin]);

  // Focus the input when opened.
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!isAdmin || !open) return null;

  const onInputKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); go(items[selected]); return; }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-[12vh]"
      onMouseDown={close}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search users, vendors, orders, coupons or jump to…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search commands and entities"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {searching
                ? 'Searching…'
                : query.trim().length >= 2
                  ? 'No matches found.'
                  : 'Type to search, or pick a destination below.'}
            </div>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon || Search;
              const active = i === selected;
              return (
                <button
                  key={item.id}
                  data-index={i}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">{item.sublabel}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
          <span className="ml-auto inline-flex items-center gap-1"><kbd className="rounded border border-border px-1">Ctrl</kbd>+<kbd className="rounded border border-border px-1">K</kbd></span>
        </div>
      </div>
    </div>
  );
}
