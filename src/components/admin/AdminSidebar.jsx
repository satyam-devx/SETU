// ═══════════════════════════════════════════════════════════
// SETU — AdminSidebar (v3 — production-grade)
// Includes all new pages: Analytics, Audit Log, Disputes
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Store, Bike,
  IndianRupee, HeadphonesIcon, Settings, MapPin,
  AlertTriangle, ArrowLeft, Wrench, Users,
  ShieldAlert, Activity, Tag, Package, Bell,
  Image, FileCheck, Megaphone, TrendingUp,
  ClipboardList, Scale, ChevronRight, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';

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

export default function AdminSidebar({ onClose }) {
  const location = useLocation();
  const [badges,  setBadges]  = useState({});
  const [profile, setProfile] = useState(null);

  // Load badge counts (pending vendors, KYC queue, open disputes)
  useEffect(() => {
    async function loadBadges() {
      const [pendingVendors, kycQueue, disputes] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true })
          .eq('is_verified', false).neq('kyc_status', 'rejected'),
        supabase.from('kyc_records').select('id', { count: 'exact', head: true })
          .eq('status', 'submitted'),
        supabase.from('disputes').select('id', { count: 'exact', head: true })
          .in('status', ['open', 'escalated']),
      ]);
      setBadges({
        pending_vendors: pendingVendors.count ?? 0,
        kyc_queue:       kycQueue.count       ?? 0,
        disputes:        disputes.count       ?? 0,
      });
    }

    loadBadges();
    const interval = setInterval(loadBadges, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Load current admin profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', data.user.id)
        .single();
      setProfile(prof);
    });
  }, []);

  // Group items
  const groups = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b border-sidebar-border relative">
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 text-sidebar-foreground/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <Link
          to="/"
          className="text-xs text-sidebar-foreground/50 flex items-center gap-1 mb-3 hover:text-sidebar-foreground"
          onClick={onClose}
        >
          <ArrowLeft className="w-3 h-3" /> Back to SETU
        </Link>
        <h1 className="font-heading text-xl font-bold text-white tracking-tight">SETU Admin</h1>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">Operations Control Center</p>
      </div>

      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {Object.entries(groups).map(([groupKey, items]) => (
          <div key={groupKey}>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-3 mb-1">
              {GROUP_LABELS[groupKey]}
            </p>
            <div className="space-y-0.5">
              {items.map(item => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));
                const badgeCount = item.badge ? (badges[item.badge] ?? 0) : 0;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-white font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-red-500 text-white'
                      )}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(profile?.name ?? 'A')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.name ?? 'Admin User'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{profile?.role ?? 'admin'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
