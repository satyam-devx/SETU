import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Navigation, IndianRupee, User, Wallet } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';

const navItems = [
  { path: '/rider',             label: 'Home',       icon: Home },
  { path: '/rider/deliveries',  label: 'Deliveries', icon: Navigation, badge: 2 },
  { path: '/rider/earnings',    label: 'Earnings',   icon: IndianRupee },
  { path: '/rider/cod',         label: 'COD',        icon: Wallet },
  { path: '/rider/profile',     label: 'Profile',    icon: User },
];

export default function RiderLayout() {
  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}
