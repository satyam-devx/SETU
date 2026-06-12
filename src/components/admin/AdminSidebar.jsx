// ═══════════════════════════════════════════════════════════
// SETU — AdminSidebar (v2)
// Added new menu items for all implemented features:
// Categories, Products, KYC, Banners, Notifications,
// Image Moderation. Replaces src/components/admin/AdminSidebar.jsx
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Store, Bike,
  IndianRupee, HeadphonesIcon, Settings, MapPin,
  AlertTriangle, ArrowLeft, Wrench, Users,
  ShieldAlert, Activity, Tag, Package, Bell,
  Image, FileCheck, Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  // ── Core ──────────────────────────────────────────────
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/admin',                group: 'core'     },
  { label: 'Orders',            icon: ShoppingBag,     path: '/admin/orders',         group: 'core'     },
  { label: 'Live Monitoring',   icon: Activity,        path: '/admin/monitoring',     group: 'core'     },

  // ── Onboarding ────────────────────────────────────────
  { label: 'Vendor Approvals',  icon: AlertTriangle,   path: '/admin/vendor-approval',group: 'onboard'  },
  { label: 'KYC Review',        icon: FileCheck,       path: '/admin/kyc',            group: 'onboard'  },
  { label: 'Image Moderation',  icon: Image,           path: '/admin/image-moderation',group: 'onboard' },

  // ── People ────────────────────────────────────────────
  { label: 'Customers',         icon: Users,           path: '/admin/customers',      group: 'people'   },
  { label: 'Vendors',           icon: Store,           path: '/admin/vendors',        group: 'people'   },
  { label: 'Riders',            icon: Bike,            path: '/admin/riders',         group: 'people'   },
  { label: 'Seva Providers',    icon: Wrench,          path: '/admin/seva-providers', group: 'people'   },

  // ── Catalogue ─────────────────────────────────────────
  { label: 'Categories',        icon: Tag,             path: '/admin/categories',     group: 'catalogue'},
  { label: 'Products',          icon: Package,         path: '/admin/products',       group: 'catalogue'},

  // ── Content & Comms ───────────────────────────────────
  { label: 'Banners',           icon: Megaphone,       path: '/admin/banners',        group: 'content'  },
  { label: 'Notifications',     icon: Bell,            path: '/admin/notifications',  group: 'content'  },

  // ── Finance ───────────────────────────────────────────
  { label: 'COD & Cash',        icon: IndianRupee,     path: '/admin/cash',           group: 'finance'  },
  { label: 'Incidents',         icon: ShieldAlert,     path: '/admin/incidents',      group: 'finance'  },

  // ── Platform ──────────────────────────────────────────
  { label: 'Support Tickets',   icon: HeadphonesIcon,  path: '/admin/support',        group: 'platform' },
  { label: 'Villages',          icon: MapPin,          path: '/admin/villages',       group: 'platform' },
  { label: 'Settings',          icon: Settings,        path: '/admin/settings',       group: 'platform' },
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

export default function AdminSidebar() {
  const location = useLocation();

  // Group items
  const groups = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b border-sidebar-border">
        <Link
          to="/"
          className="text-xs text-sidebar-foreground/50 flex items-center gap-1 mb-3 hover:text-sidebar-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Back to SETU
        </Link>
        <h1 className="font-heading text-xl font-bold text-white tracking-tight">SETU Admin</h1>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">Madhepur Block</p>
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
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-white font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <div>
            <p className="text-xs font-medium text-white">Admin User</p>
            <p className="text-[10px] text-sidebar-foreground/50">admin@setu.in</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
