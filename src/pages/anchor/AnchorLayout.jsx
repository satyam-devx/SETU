import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Users, Newspaper, MessageSquare, BarChart3 } from 'lucide-react';

const navItems = [
  { label: 'Home',     icon: Home,          path: '/anchor' },
  { label: 'Village',  icon: Users,         path: '/anchor/village' },
  { label: 'Notice',   icon: Newspaper,     path: '/anchor/noticeboard' },
  { label: 'Disputes', icon: MessageSquare, path: '/anchor/disputes' },
  { label: 'Reports',  icon: BarChart3,     path: '/anchor/reports' },
];

export default function AnchorLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <Outlet />
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-lg border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/anchor'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
