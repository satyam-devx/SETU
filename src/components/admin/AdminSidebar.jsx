// ═══════════════════════════════════════════════════════════
// SETU — AdminSidebar (v4 — enterprise design system)
// Static sidebar on desktop (expanded or icon-only rail),
// rendered inside AdminShell's modal drawer on mobile.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Store, Bike,
  IndianRupee, HeadphonesIcon, Settings, MapPin,
  AlertTriangle, ArrowLeft, Wrench, Users,
  ShieldAlert, Activity, Tag, Package, Bell,
  Image, FileCheck, Megaphone, TrendingUp,
  ClipboardList, Scale, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { NavItem, SectionLabel, RailToggleButton, SidebarUserFooter } from '@/components/admin/SidebarPrimitives';

const menuItems = [
  // ── Core ──────────────────────────────────────────────
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/admin',                      group: 'core'     },
  { label: 'Orders',            icon: ShoppingBag,     path: '/admin/orders',               group: 'core'     },
  { label: 'Analytics',         icon: TrendingUp,      path: '/admin/analytics',            group: 'core'     },
  { label: 'Live Monitoring',   icon: Activity,        path: '/admin/monitoring',           group: 'core'     },
  { label: 'Disputes',          icon: Scale,           path: '/admin/disputes',             group: 'core', badge: 'disputes' },

  // ── Onboarding ────────────────────────────────────────
  { label: 'Vendor Approvals',  icon: AlertTriangle,   path: '/admin/vendor-approval',      group: 'onboard', badge: 'pending_vendors' },
  { label: 'KYC Review',        icon: FileCheck,       path: '/admin/kyc',                  group: 'onboard', badge: 'kyc_queue' },
  { label: 'Image Moderation',  icon: Image,           path: '/admin/image-moderation',     group: 'onboard'  },

  // ── People ────────────────────────────────────────────
  { label: 'Users',             icon: Users,           path: '/admin/customers',            group: 'people'   },
  { label: 'Vendors',           icon: Store,           path: '/admin/vendors',              group: 'people'   },
  { label: 'Riders',            icon: Bike,            path: '/admin/riders',               group: 'people'   },
  { label: 'Seva Providers',    icon: Wrench,          path: '/admin/seva-providers',       group: 'people'   },

  // ── Catalogue ─────────────────────────────────────────
  { label: 'Categories',        icon: Tag,             path: '/admin/categories',           group: 'catalogue'},
  { label: 'Products',          icon: Package,         path: '/admin/products',             group: 'catalogue'},
  { label: 'Coupons',           icon: Tag,             path: '/admin/coupons',              group: 'catalogue'},

  // ── Content & Comms ───────────────────────────────────
  { label: 'Banners',           icon: Megaphone,       path: '/admin/banners',              group: 'content'  },
  { label: 'Notifications',     icon: Bell,            path: '/admin/notifications',        group: 'content'  },

  // ── Finance ───────────────────────────────────────────
  { label: 'COD & Cash',        icon: IndianRupee,     path: '/admin/cash',                 group: 'finance'  },
  { label: 'Incidents',         icon: ShieldAlert,     path: '/admin/incidents',            group: 'finance'  },

  // ── Platform ──────────────────────────────────────────
  { label: 'Support Tickets',   icon: HeadphonesIcon,  path: '/admin/support',              group: 'platform' },
  { label: 'Villages',          icon: MapPin,          path: '/admin/villages',             group: 'platform' },
  { label: 'Settings',          icon: Settings,        path: '/admin/settings',             group: 'platform' },
  { label: 'Audit Log',         icon: ClipboardList,   path: '/admin/audit-log',            group: 'platform' },
];

const GROUP_LABELS = {
  core:      'Operations',
  onboard:   'Onboarding',
  people:    'People',
  catalogue: 'Catalogue',
  content:   'Content',
  finance:   'Finance',
  platform:  'Platform',
};

const ROOT_PATHS = ['/admin'];

export default function AdminSidebar({ onClose, collapsed = false, onToggleCollapsed, accent = 'saffron' }) {
  const { profile, signOut } = useAuth();
  const [badges, setBadges] = useState({});

  // Load badge counts (pending vendors, KYC queue, open disputes).
  // Guarded against setState-after-unmount and a rejected query
  // silently breaking the whole poll.
  useEffect(() => {
    let cancelled = false;

    async function loadBadges() {
      try {
        const [pendingVendors, kycQueue, disputes] = await Promise.all([
          supabase.from('vendors').select('id', { count: 'exact', head: true })
            .eq('is_verified', false).neq('kyc_status', 'rejected'),
          supabase.from('kyc_records').select('id', { count: 'exact', head: true })
            .eq('status', 'submitted'),
          supabase.from('disputes').select('id', { count: 'exact', head: true })
            .in('status', ['open', 'escalated']),
        ]);
        if (cancelled) return;
        setBadges({
          pending_vendors: pendingVendors.count ?? 0,
          kyc_queue:       kycQueue.count       ?? 0,
          disputes:        disputes.count       ?? 0,
        });
      } catch (err) {
        if (!cancelled) console.warn('[AdminSidebar] badge counts failed to load:', err?.message);
      }
    }

    loadBadges();
    const interval = setInterval(loadBadges, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const groups = useMemo(
    () =>
      menuItems.reduce((acc, item) => {
        if (!acc[item.group]) acc[item.group] = [];
        acc[item.group].push(item);
        return acc;
      }, {}),
    []
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="relative shrink-0 border-b border-sidebar-border p-5">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="absolute right-4 top-4 text-sidebar-foreground/50 transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!collapsed && (
          <Link
            to="/"
            className="mb-3 flex items-center gap-1 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground"
            onClick={onClose}
          >
            <ArrowLeft className="h-3 w-3" /> Back to SETU
          </Link>
        )}
        <h1 className={cn('font-heading font-bold text-white tracking-tight', collapsed ? 'text-center text-lg' : 'text-xl')}>
          {collapsed ? 'S' : 'SETU Admin'}
        </h1>
        {!collapsed && <p className="mt-0.5 text-xs text-sidebar-foreground/60">Operations Control Center</p>}
      </div>

      <nav className="nav-scroll flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {Object.entries(groups).map(([groupKey, items]) => (
          <div key={groupKey}>
            <SectionLabel collapsed={collapsed}>{GROUP_LABELS[groupKey]}</SectionLabel>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  badgeCount={item.badge ? badges[item.badge] ?? 0 : 0}
                  collapsed={collapsed}
                  onNavigate={onClose}
                  rootPaths={ROOT_PATHS}
                  accent={accent}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Desktop-only rail toggle */}
      {onToggleCollapsed && (
        <div className={cn('shrink-0 border-t border-sidebar-border p-2', collapsed ? 'flex justify-center' : 'flex justify-end')}>
          <RailToggleButton collapsed={collapsed} onToggle={onToggleCollapsed} accent={accent} />
        </div>
      )}

      <SidebarUserFooter
        initials={(profile?.name ?? 'A')[0].toUpperCase()}
        name={profile?.name ?? 'Admin User'}
        subtitle={profile?.role ?? 'admin'}
        accentClass="bg-sidebar-primary"
        collapsed={collapsed}
        onSignOut={signOut}
      />
    </aside>
  );
}
