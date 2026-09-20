// ═══════════════════════════════════════════════════════════
// SETU — CustomerLayout (v2)
// Improvements:
//  - Error boundary per portal
//  - Realtime subscriptions bootstrapped here
//  - Cart FAB only shows when not on cart page
//  - Orders badge reflects live unconfirmed count
//  - Offline banner
//  - Safe area insets for notched phones
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Wallet, User, ShoppingCart } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useCart } from '@/lib/cartContext';
import { useStore } from '@/lib/store';
import { useRealtimeOrders, useRealtimeNotifications } from '@/hooks/useRealtimeOrders';
import { useAuth } from '@/lib/AuthContext';

function CustomerContent() {
  const { cartCount }  = useCart();
  const { state }      = useStore();
  const { user }       = useAuth();
  const location       = useLocation();

  // Bootstrap realtime subscriptions for this portal
  useRealtimeOrders('customer');
  useRealtimeNotifications();

  // Count pending (unconfirmed) orders for badge
  const pendingOrders = state.orders.filter(o =>
    user?.id &&
    (o.customerId === user.id || o.customer_id === user.id) &&
    !['delivered', 'cancelled'].includes(o.status)
  ).length;

  const navItems = [
    { path: '/customer',          label: 'Home',   icon: Home },
    { path: '/customer/orders',   label: 'Orders', icon: ShoppingBag, badge: pendingOrders || null },
    { path: '/customer/wallet',   label: 'Wallet', icon: Wallet },
    { path: '/customer/profile',  label: 'Profile', icon: User },
  ];

  const isCartPage = location.pathname === '/customer/cart';
  // Product detail owns its own full-width Add to Cart bar at the
  // bottom of the screen — showing MobileNav (or the cart FAB, which
  // is positioned to sit just above MobileNav) at the same time only
  // fights that bar for space and was hiding it entirely behind the
  // nav. Per the request, the bottom nav is dropped on this route
  // rather than trying to stack two bottom-fixed bars.
  const isProductDetailPage = location.pathname.startsWith('/customer/product/');

  return (
    <div className="page-container relative" role="application">
      <OfflineBanner />
      <Outlet />
      {/* Floating cart button — hide when already on cart page, or on
          product detail (which has its own Add to Cart bar) */}
      {cartCount > 0 && !isCartPage && !isProductDetailPage && (
        <Link
          to="/customer/cart"
          className="fixed bottom-24 right-4 z-40 bg-primary text-primary-foreground rounded-full p-3 shadow-float flex items-center gap-2 animate-scale-in"
          aria-label={`View cart — ${cartCount} items`}
        >
          <ShoppingCart className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-bold pr-1">{cartCount}</span>
        </Link>
      )}
      {!isProductDetailPage && <MobileNav items={navItems} />}
    </div>
  );
}

export default function CustomerLayout() {
  return (
    <ErrorBoundary portal="Customer" fallbackRoute="/customer">
      <CustomerContent />
    </ErrorBoundary>
  );
}
