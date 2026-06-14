// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminSidebar (v4)
// Super Admin has full access to:
//   • All SuperAdmin-only pages (/superadmin/*)
//   • All Admin pages (/admin/*) — same components, no duplication
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  // SuperAdmin icons
  LayoutDashboard as SADashboard, BarChart2, CreditCard, Map,
  ShieldAlert, FileText, Settings as SASettings, Zap,
  CheckSquare, Heart, Cpu, Crown, Users as SAUsers, ChevronDown, ChevronRight,
  // Admin icons
  ShoppingBag, Store, Bike, IndianRupee, HeadphonesIcon,
  Settings, MapPin, AlertTriangle, Wrench, Users, Activity,
  Tag, Package, Bell, Image, FileCheck, Megaphone, TrendingUp,
  ClipboardList, Scale, ShieldCheck, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// ── SuperAdmin-only menu ─────────────────────────────────
const SUPERADMIN_MENU = [
  { label: 'SA Dashboard',     icon: SADashboard, path: '/superadmin'              },
  { label: 'Platform Analytics', icon: BarChart2, path: '/superadmin/analytics'   },
  { label: 'User Management',  icon: SAUsers,     path: '/superadmin/users'        },
  { label: 'SETU Credit',      icon: CreditCard,  path: '/superadmin/credit'       },
  { label: 'Blocks & Geo',     icon: Map,         path: '/superadmin/blocks'       },
  { label: 'Fraud & Security', icon: ShieldAlert, path: '/superadmin/security'     },
  { label: 'SA Audit Log',     icon: FileText,    path: '/superadmin/audit'        },
  { label: 'Configuration',    icon: SASettings,  path: '/superadmin/config'       },
  { label: 'Expansion',        icon: Zap,         path: '/superadmin/expansion'    },
  { label: 'Compliance',       icon: CheckSquare, path: '/superadmin/compliance'   },
  { label: 'Platform Health',  icon: Heart,       path: '/superadmin/health'       },
  { label: 'AI Monitoring',    icon: Cpu,         path: '/superadmin/ai'           },
];

// ── Admin menu (same paths as /admin, super_admin now allowed) ──
const ADMIN_MENU_GROUPS = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard',       icon: SADashboard,  path: '/admin'                  },
      { label: 'Orders',          icon: ShoppingBag,  path: '/admin/orders'           },
      { label: 'Analytics',       icon: TrendingUp,   path: '/admin/analytics'        },
      { label: 'Live Monitoring', icon: Activity,     path: '/admin/monitoring'       },
      { label: 'Disputes',        icon: Scale,        path: '/admin/disputes'         },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { label: 'Vendor Approvals',  icon: AlertTriangle, path: '/admin/vendor-approval'  },
      { label: 'KYC Review',        icon: FileCheck,     path: '/admin/kyc'               },
      { label: 'Image Moderation',  icon: Image,         path: '/admin/image-moderation'  },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Users',          icon: Users,   path: '/admin/customers'      },
      { label: 'Vendors',        icon: Store,   path: '/admin/vendors'        },
      { label: 'Riders',         icon: Bike,    path: '/admin/riders'         },
      { label: 'Seva Providers', icon: Wrench,  path: '/admin/seva-providers' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { label: 'Categories', icon: Tag,     path: '/admin/categories' },
      { label: 'Products',   icon: Package, path: '/admin/products'   },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Banners',        icon: Megaphone, path: '/admin/banners'        },
      { label: 'Notifications',  icon: Bell,      path: '/admin/notifications'  },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'COD & Cash', icon: IndianRupee, path: '/admin/cash'      },
      { label: 'Incidents',  icon: ShieldCheck, path: '/admin/incidents' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support'    },
      { label: 'Villages',        icon: MapPin,          path: '/admin/villages'   },
      { label: 'Settings',        icon: Settings,        path: '/admin/settings'   },
      { label: 'Audit Log',       icon: ClipboardList,   path: '/admin/audit-log'  },
    ],
  },
];

function NavLink({ item, onClose, compact = false }) {
  const location = useLocation();
  const isActive =
    location.pathname === item.path ||
    (item.path !== '/admin' && item.path !== '/superadmin' && location.pathname.startsWith(item.path));

  return (
    <Link
      to={item.path}
      onClick={onClose}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
        isActive
          ? 'bg-sidebar-accent text-white font-medium'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-white'
      )}
    >
      <item.icon className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5')} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CollapsibleSection({ label, items, onClose, defaultOpen = false }) {
  const location = useLocation();
  const hasActive = items.some(i =>
    location.pathname === i.path ||
    (i.path !== '/admin' && i.path !== '/superadmin' && location.pathname.startsWith(i.path))
  );
  const [open, setOpen] = useState(defaultOpen || hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {items.map(item => (
            <NavLink key={item.path} item={item} onClose={onClose} compact />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminSidebar({ onClose }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, role, phone')
        .eq('id', data.user.id)
        .single();
      setProfile(prof);
    });
  }, []);

  const initials = profile?.name
    ? profile.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  return (
    <aside className="w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex flex-col">

      {/* Header */}
      <div className="p-4 border-b border-sidebar-border relative shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-3 right-3 text-sidebar-foreground/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
          <h1 className="font-heading text-base font-bold text-white tracking-tight">Super Admin</h1>
        </div>
        <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">All Blocks · God Mode</p>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 py-2 px-2 space-y-3 overflow-y-auto">

        {/* ── SuperAdmin-only section ── */}
        <div>
          <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
            Super Admin
          </p>
          <div className="space-y-0.5 mt-0.5">
            {SUPERADMIN_MENU.map(item => (
              <NavLink key={item.path} item={item} onClose={onClose} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-sidebar-border/50 mx-1" />

        {/* ── Block Admin section (all /admin/* routes) ── */}
        <div>
          <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-yellow-400/70">
            Block Admin Access
          </p>
          <div className="space-y-1.5 mt-1">
            {ADMIN_MENU_GROUPS.map(group => (
              <CollapsibleSection
                key={group.label}
                label={group.label}
                items={group.items}
                onClose={onClose}
                defaultOpen={['Operations', 'Onboarding', 'People'].includes(group.label)}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Profile footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.name ?? 'Super Admin'}</p>
            <p className="text-[9px] text-sidebar-foreground/50 truncate">
              {profile?.phone ?? 'super_admin'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
