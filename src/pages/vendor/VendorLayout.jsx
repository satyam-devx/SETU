import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, ShoppingBag, Package, User, IndianRupee } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useRealtimeOrders, useRealtimeNotifications } from '@/hooks/useRealtimeOrders';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId } from '@/lib/api';

function VendorContent() {
  const { user }  = useAuth();
  const { state } = useStore();
  // Orders are keyed by vendors.id (NOT the auth uid) — resolve it so the
  // realtime store populates this vendor's real orders.
  const { data: vendor } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );
  useRealtimeOrders('vendor', vendor?.id);
  useRealtimeNotifications();

  const pendingOrders = state.orders.filter(o =>
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
