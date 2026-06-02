import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, ShoppingBag, Wallet, User, ShoppingCart } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import { useCart } from '@/lib/cartContext';

const navItems = [
  { path: '/customer',             label: 'Home',   icon: Home },
  { path: '/customer/orders',      label: 'Orders', icon: ShoppingBag, badge: 2 },
  { path: '/customer/wallet',      label: 'Wallet', icon: Wallet },
  { path: '/customer/profile',     label: 'Profile', icon: User },
];

export default function CustomerLayout() {
  const { cartCount } = useCart();
  return (
    <div className="max-w-md mx-auto bg-background min-h-screen relative">
      <Outlet />
      {cartCount > 0 && (
        <Link
          to="/customer/cart"
          className="fixed bottom-20 right-4 z-50 bg-primary text-white rounded-full p-3 shadow-lg flex items-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm font-bold">{cartCount}</span>
        </Link>
      )}
      <MobileNav items={navItems} />
    </div>
  );
}
