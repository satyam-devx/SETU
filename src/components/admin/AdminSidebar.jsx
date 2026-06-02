import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Store, Bike,
  IndianRupee, HeadphonesIcon, Settings, MapPin,
  AlertTriangle, ArrowLeft, Wrench, Users,
  ShieldAlert, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/admin' },
  { label: 'Orders',           icon: ShoppingBag,     path: '/admin/orders' },
  { label: 'Vendors',          icon: Store,           path: '/admin/vendors' },
  { label: 'Vendor Approvals', icon: AlertTriangle,   path: '/admin/vendor-approval' },
  { label: 'Seva Providers',   icon: Wrench,          path: '/admin/seva-providers' },
  { label: 'Riders',           icon: Bike,            path: '/admin/riders' },
  { label: 'Customers',        icon: Users,           path: '/admin/customers' },
  { label: 'COD & Cash',       icon: IndianRupee,     path: '/admin/cash' },
  { label: 'Incidents',        icon: ShieldAlert,     path: '/admin/incidents' },
  { label: 'Live Monitoring',  icon: Activity,        path: '/admin/monitoring' },
  { label: 'Support Tickets',  icon: HeadphonesIcon,  path: '/admin/support' },
  { label: 'Villages',         icon: MapPin,          path: '/admin/villages' },
  { label: 'Settings',         icon: Settings,        path: '/admin/settings' },
];

export default function AdminSidebar() {
  const location = useLocation();
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
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => {
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
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
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
