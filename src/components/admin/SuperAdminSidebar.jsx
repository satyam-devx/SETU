// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminSidebar (v5 — enterprise design system)
// Super Admin has full access to:
//   • All SuperAdmin-only pages (/superadmin/*) — "God Mode" gold
//   • All Admin pages (/admin/*) — same components, no duplication
// ═══════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import {
  // SuperAdmin icons
  LayoutDashboard as SADashboard, BarChart2, CreditCard, Map,
  ShieldAlert, FileText, Settings as SASettings, Zap,
  CheckSquare, Heart, Cpu, Crown, Users as SAUsers,
  // Admin icons
  ShoppingBag, Store, Bike, IndianRupee, HeadphonesIcon,
  Settings, MapPin, AlertTriangle, Wrench, Users, Activity,
  Tag, Package, Bell, Image, FileCheck, Megaphone, TrendingUp,
  ClipboardList, Scale, ShieldCheck, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  NavItem, SectionLabel, CollapsibleGroup, RailToggleButton, SidebarUserFooter,
} from '@/components/admin/SidebarPrimitives';

// ── SuperAdmin-only menu ─────────────────────────────────
const SUPERADMIN_MENU = [
  { label: 'SA Dashboard',        icon: SADashboard, path: '/superadmin'               },
  { label: 'Platform Analytics',  icon: BarChart2,   path: '/superadmin/analytics'     },
  { label: 'User Management',     icon: SAUsers,     path: '/superadmin/users'         },
  { label: 'Roles & Permissions', icon: ShieldCheck, path: '/superadmin/roles'         },
  { label: 'Feature Flags',       icon: Zap,         path: '/superadmin/feature-flags' },
  { label: 'SETU Credit',         icon: CreditCard,  path: '/superadmin/credit'        },
  { label: 'Finance Center',      icon: IndianRupee, path: '/superadmin/finance'       },
  { label: 'Blocks & Geo',        icon: Map,         path: '/superadmin/blocks'        },
  { label: 'Fraud & Security',    icon: ShieldAlert, path: '/superadmin/security'      },
  { label: 'SA Audit Log',        icon: FileText,    path: '/superadmin/audit'         },
  { label: 'Configuration',       icon: SASettings,  path: '/superadmin/config'        },
  { label: 'Expansion',           icon: Zap,         path: '/superadmin/expansion'     },
  { label: 'Compliance',          icon: CheckSquare, path: '/superadmin/compliance'    },
  { label: 'Platform Health',     icon: Heart,       path: '/superadmin/health'        },
  { label: 'Developer Center',    icon: Cpu,         path: '/superadmin/developer'     },
  { label: 'AI Monitoring',       icon: Cpu,         path: '/superadmin/ai'            },
];

// ── Admin menu (same paths as /admin, super_admin now allowed) ──
const ADMIN_MENU_GROUPS = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard',       icon: SADashboard,  path: '/admin'            },
      { label: 'Orders',          icon: ShoppingBag,  path: '/admin/orders'     },
      { label: 'Analytics',       icon: TrendingUp,   path: '/admin/analytics'  },
      { label: 'Live Monitoring', icon: Activity,     path: '/admin/monitoring' },
      { label: 'Disputes',        icon: Scale,        path: '/admin/disputes'   },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { label: 'Vendor Approvals', icon: AlertTriangle, path: '/admin/vendor-approval' },
      { label: 'KYC Review',       icon: FileCheck,     path: '/admin/kyc'             },
      { label: 'Image Moderation', icon: Image,         path: '/admin/image-moderation'},
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
      { label: 'Coupons',    icon: Tag,     path: '/admin/coupons'    },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Banners',       icon: Megaphone, path: '/admin/banners'       },
      { label: 'Notifications', icon: Bell,      path: '/admin/notifications' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'COD & Cash', icon: IndianRupee,  path: '/admin/cash'      },
      { label: 'Incidents',  icon: ShieldAlert,  path: '/admin/incidents' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support'   },
      { label: 'Villages',        icon: MapPin,          path: '/admin/villages'  },
      { label: 'Settings',        icon: Settings,        path: '/admin/settings'  },
      { label: 'Audit Log',       icon: ClipboardList,   path: '/admin/audit-log' },
    ],
  },
];

const ROOT_PATHS = ['/admin', '/superadmin'];
const DEFAULT_OPEN_GROUPS = new Set(['Operations', 'Onboarding', 'People']);

export default function SuperAdminSidebar({ onClose, collapsed = false, onToggleCollapsed, accent = 'gold' }) {
  const { profile, signOut } = useAuth();

  const initials = profile?.name
    ? profile.name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  // Rail mode has no room for group headers or a collapse/expand
  // interaction that means anything visually — flatten to one
  // continuous icon column instead of nested collapsible groups.
  const flatAdminItems = useMemo(() => ADMIN_MENU_GROUPS.flatMap((g) => g.items), []);

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="relative shrink-0 border-b border-sidebar-border p-4">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="absolute right-3 top-3 text-sidebar-foreground/40 transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <Crown className="h-4 w-4 shrink-0 text-yellow-400" />
          {!collapsed && <h1 className="font-heading text-base font-bold tracking-tight text-white">Super Admin</h1>}
        </div>
        {!collapsed && <p className="mt-0.5 text-[10px] text-sidebar-foreground/50">All Blocks · God Mode</p>}
      </div>

      {/* Scrollable nav */}
      <nav className="nav-scroll flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {/* ── SuperAdmin-only section ── */}
        <div>
          <SectionLabel collapsed={collapsed}>Super Admin</SectionLabel>
          <div className="space-y-0.5">
            {SUPERADMIN_MENU.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                collapsed={collapsed}
                onNavigate={onClose}
                rootPaths={ROOT_PATHS}
                accent={accent}
              />
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="mx-1 border-t border-sidebar-border/50" />

        {/* ── Block Admin section (all /admin/* routes) ── */}
        <div>
          <SectionLabel collapsed={collapsed} tone="accent">Block Admin Access</SectionLabel>
          {collapsed ? (
            <div className="space-y-0.5">
              {flatAdminItems.map((item) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  collapsed
                  onNavigate={onClose}
                  rootPaths={ROOT_PATHS}
                  accent="saffron"
                />
              ))}
            </div>
          ) : (
            <div className="mt-1 space-y-1.5">
              {ADMIN_MENU_GROUPS.map((group) => (
                <CollapsibleGroup
                  key={group.label}
                  label={group.label}
                  items={group.items}
                  onNavigate={onClose}
                  defaultOpen={DEFAULT_OPEN_GROUPS.has(group.label)}
                  rootPaths={ROOT_PATHS}
                  accent="saffron"
                />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Desktop-only rail toggle */}
      {onToggleCollapsed && (
        <div className={cn('shrink-0 border-t border-sidebar-border p-2', collapsed ? 'flex justify-center' : 'flex justify-end')}>
          <RailToggleButton collapsed={collapsed} onToggle={onToggleCollapsed} accent={accent} />
        </div>
      )}

      <SidebarUserFooter
        initials={initials}
        name={profile?.name ?? 'Super Admin'}
        subtitle={profile?.phone ?? 'super_admin'}
        accentClass="bg-yellow-500"
        collapsed={collapsed}
        onSignOut={signOut}
      />
    </aside>
  );
}
