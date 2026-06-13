// ═══════════════════════════════════════════════════════════
// SETU — SuperAdminSidebar (v3)
// Fixed: real profile from DB, close button for mobile
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, CreditCard, Map,
  ShieldAlert, FileText, Settings, Zap,
  CheckSquare, Heart, Cpu, ArrowLeft, Crown, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const menuItems = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/superadmin'            },
  { label: 'Analytics',        icon: BarChart2,       path: '/superadmin/analytics'  },
  { label: 'Users',            icon: Users,           path: '/superadmin/users'      },
  { label: 'SETU Credit',      icon: CreditCard,      path: '/superadmin/credit'     },
  { label: 'Blocks & Geo',     icon: Map,             path: '/superadmin/blocks'     },
  { label: 'Fraud & Security', icon: ShieldAlert,     path: '/superadmin/security'   },
  { label: 'Audit Log',        icon: FileText,        path: '/superadmin/audit'      },
  { label: 'Configuration',    icon: Settings,        path: '/superadmin/config'     },
  { label: 'Expansion',        icon: Zap,             path: '/superadmin/expansion'  },
  { label: 'Compliance',       icon: CheckSquare,     path: '/superadmin/compliance' },
  { label: 'Platform Health',  icon: Heart,           path: '/superadmin/health'     },
  { label: 'AI Monitoring',    icon: Cpu,             path: '/superadmin/ai'         },
];

export default function SuperAdminSidebar({ onClose }) {
  const location = useLocation();
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
      <div className="p-5 border-b border-sidebar-border">
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 text-sidebar-foreground/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <Link
          to="/admin"
          className="text-xs text-sidebar-foreground/50 flex items-center gap-1 mb-3 hover:text-sidebar-foreground"
          onClick={onClose}
        >
          <ArrowLeft className="w-3 h-3" /> Block Admin
        </Link>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h1 className="font-heading text-xl font-bold text-white tracking-tight">Super Admin</h1>
        </div>
        <p className="text-xs text-sidebar-foreground/60 mt-0.5">All Blocks — God Mode</p>
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
              onClick={onClose}
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
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.name ?? 'Super Admin'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize truncate">
              {profile?.phone ?? profile?.role ?? 'super_admin'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
