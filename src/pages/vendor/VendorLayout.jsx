import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, IndianRupee } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';

const navItems = [
  { path: '/vendor',           label: 'Dashboard', icon: Home },
  { path: '/vendor/orders',    label: 'Orders',    icon: ShoppingBag,  badge: 3 },
  { path: '/vendor/products',  label: 'Products',  icon: Package },
  { path: '/vendor/earnings',  label: 'Earnings',  icon: IndianRupee },
  { path: '/vendor/profile',   label: 'Profile',   icon: User },
];

export default function VendorLayout() {
  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}
