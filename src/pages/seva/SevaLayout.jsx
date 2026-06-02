import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Calendar, IndianRupee, User, Clock } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';

const navItems = [
  { path: '/seva',           label: 'Home',     icon: Home },
  { path: '/seva/jobs',      label: 'Jobs',     icon: Calendar, badge: 3 },
  { path: '/seva/schedule',  label: 'Schedule', icon: Clock },
  { path: '/seva/earnings',  label: 'Earnings', icon: IndianRupee },
  { path: '/seva/profile',   label: 'Profile',  icon: User },
];

export default function SevaLayout() {
  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}
