import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Globe, IndianRupee, Shield,
  BarChart3, Settings, CreditCard, FileText,
  ArrowLeft, TrendingUp, BookCheck, HeartPulse, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/superadmin' },
  { label: 'Blocks & Geography',icon: Globe,           path: '/superadmin/blocks' },
  { label: 'SETU Credit',       icon: CreditCard,      path: '/superadmin/credit' },
  { label: 'Fraud & Security',  icon: Shield,          path: '/superadmin/security' },
  { label: 'Analytics',         icon: BarChart3,       path: '/superadmin/analytics' },
  { label: 'Expansion Engine',  icon: TrendingUp,      path: '/superadmin/expansion' },
  { label: 'Compliance',        icon: BookCheck,       path: '/superadmin/compliance' },
  { label: 'Platform Health',   icon: HeartPulse,      path: '/superadmin/health' },
  { label: 'AI Monitoring',     icon: Brain,           path: '/superadmin/ai' },
  { label: 'Audit Log',         icon: FileText,        path: '/superadmin/audit' },
  { label: 'Configuration',     icon: Settings,        path: '/superadmin/config' },
];

export default function SuperAdminSidebar() {
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
        <h1 className="font-heading text-xl font-bold text-white tracking-tight">SETU Control</h1>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">Super Admin · God Mode</p>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/superadmin' && location.pathname.startsWith(item.path));
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
          <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-white text-xs font-bold">
            SA
          </div>
          <div>
            <p className="text-xs font-medium text-white">Super Admin</p>
            <p className="text-[10px] text-sidebar-foreground/50">2FA Active</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
