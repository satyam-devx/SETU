import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, IndianRupee } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useRealtimeOrders, useRealtimeNotifications } from '@/hooks/useRealtimeOrders';
import { useVendorOrders } from '@/hooks/queries/useOrders';
import { useAuth } from '@/lib/AuthContext';
import { useVendorByOwner } from '@/hooks/queries/useVendor';

function VendorContent() {
  const { user }  = useAuth();
  // Orders are keyed by vendors.id (NOT the auth uid) — resolve it so the
  // realtime store populates this vendor's real orders.
  const { data: vendor } = useVendorByOwner(user?.id);
  const { data: orders = [] } = useVendorOrders(vendor?.id, { limit: 100 });
  useRealtimeOrders('vendor', vendor?.id);
  useRealtimeNotifications();

  const pendingOrders = orders.filter(o =>
    ['pending','confirmed'].includes(o.status)
  ).length;

  const navItems = [
    { path: '/vendor',          label: 'Dashboard', icon: Home },
    { path: '/vendor/orders',   label: 'Orders',    icon: ShoppingBag, badge: pendingOrders || null },
    { path: '/vendor/products', label: 'Products',  icon: Package },
    { path: '/vendor/earnings', label: 'Earnings',  icon: IndianRupee },
    { path: '/vendor/profile',  label: 'Profile',   icon: User },
  ];
  return (
    <div className="page-container relative">
      <OfflineBanner />
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}

export default function VendorLayout() {
  return (
    <ErrorBoundary portal="Vendor" fallbackRoute="/vendor">
      <VendorContent />
    </ErrorBoundary>
  );
}
