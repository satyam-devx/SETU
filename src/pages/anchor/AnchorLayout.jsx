import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Users, Newspaper, MessageSquare, BarChart3 } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';

const navItems = [
  { path: '/anchor',             label: 'Home',     icon: Home },
  { path: '/anchor/village',     label: 'Village',  icon: Users },
  { path: '/anchor/noticeboard', label: 'Notice',   icon: Newspaper },
  { path: '/anchor/disputes',    label: 'Disputes', icon: MessageSquare },
  { path: '/anchor/reports',     label: 'Reports',  icon: BarChart3 },
];

function AnchorContent() {
  return (
    <div className="page-container relative">
      <OfflineBanner />
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}

export default function AnchorLayout() {
  return (
    <ErrorBoundary portal="Village Anchor" fallbackRoute="/anchor">
      <AnchorContent />
    </ErrorBoundary>
  );
}
