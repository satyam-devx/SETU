// ═══════════════════════════════════════════════════════════
// SETU — VendorDashboard (v2)
// Fixes:
//  - Removed hardcoded VENDOR_ID = 'vn1'
//  - Fetches vendor profile from DB using authenticated user
//  - Real orders from store (populated via realtime)
//  - Skeleton loading states
//  - Stats computed from real data
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, Package, IndianRupee, TrendingUp,
  ChevronRight, AlertCircle, RefreshCw,
} from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { StatCardSkeleton, OrderRowSkeleton } from '@/components/shared/SkeletonCard';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getProducts } from '@/lib/api';
import { formatCurrency, timeAgo } from '@/lib/utils';

export default function VendorDashboard() {
  const { user } = useAuth();
  const { state } = useStore();

  // Fetch vendor profile for this authenticated user
  const { data: vendor, isLoading: vendorLoading } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );

  const { data: products, isLoading: productsLoading } = useDataFetch(
    () => getProducts({ vendorId: vendor?.id }),
    [vendor?.id],
    { cacheKey: `vendor-products-${vendor?.id}`, enabled: !!vendor?.id }
  );

  // Orders from realtime store (filtered to this vendor)
  const vendorOrders = state.orders.filter(o =>
    vendor?.id && (o.vendorId === vendor.id || o.vendor_id === vendor.id)
  );

  const pendingOrders = vendorOrders.filter(o => o.status === 'pending');
  const todayOrders   = vendorOrders.filter(o => {
    const d = new Date(o.createdAt || o.created_at);
    return d.toDateString() === new Date().toDateString();
  });
  const todayRevenue  = todayOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + (o.total || 0), 0);

  const lowStock = (products || []).filter(p => (p.stock ?? 99) < 5 && p.is_available);

  const isLoading = vendorLoading || productsLoading;

  return (
    <div className="pb-nav animate-fade-in" role="main">
      <AppHeader
        title={vendor?.name || 'My Shop'}
        subtitle={vendor ? `${vendor.village || ''} · ${vendor.category}` : 'Loading...'}
        notificationCount={pendingOrders.length}
        notificationPath="/vendor/orders"
        rightAction={vendor && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
            vendor.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {vendor.is_open ? '● Open' : '● Closed'}
          </span>
        )}
      />

      <div className="px-4 py-4 space-y-4">
        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1,2,3,4].map(i => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                title="Today's Revenue"
                value={formatCurrency(todayRevenue)}
                icon={IndianRupee}
                accent
              />
              <StatCard
                title="Today's Orders"
                value={String(todayOrders.length)}
                icon={ShoppingBag}
                subtitle={pendingOrders.length ? `${pendingOrders.length} pending` : 'All clear'}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                title="Products"
                value={String((products || []).length)}
                icon={Package}
                subtitle={`${(products || []).filter(p => p.is_available).length} available`}
              />
              <StatCard
                title="Trust Score"
                value={String(vendor?.trust_score ?? 500)}
                icon={TrendingUp}
                trendValue={vendor?.trust_score >= 700 ? 'Top 20%' : undefined}
                trend={vendor?.trust_score >= 700 ? 'up' : 'neutral'}
              />
            </div>
          </>
        )}

        {/* Pending orders alert */}
        {pendingOrders.length > 0 && (
          <Link to="/vendor/orders" className="block">
            <div className="setu-card p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} need your response
                </p>
                <p className="text-xs text-amber-700">Tap to accept or reject</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            </div>
          </Link>
        )}

        {/* Recent orders */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Recent Orders</h3>
            <Link to="/vendor/orders" className="section-link">View All</Link>
          </div>
          {isLoading ? (
            <div>{[1,2].map(i => <OrderRowSkeleton key={i} />)}</div>
          ) : vendorOrders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders yet" description="Orders will appear here as customers place them" size="sm" />
          ) : (
            <div className="space-y-2">
              {vendorOrders.slice(0, 3).map(o => (
                <Link key={o.id} to={`/vendor/orders`} className="block">
                  <div className="setu-card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {o.orderNumber || o.order_number}
                      </p>
                      <p className="text-sm font-medium">{o.customerName || o.customer_name || 'Customer'}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(o.createdAt || o.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(o.total)}</p>
                      <StatusBadge status={o.status} className="mt-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="setu-card p-3 border-destructive/30 bg-destructive/5">
            <p className="text-xs font-semibold text-destructive mb-2">⚠ Low Stock Alert</p>
            <div className="space-y-1">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{p.name}</span>
                  <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                    Only {p.stock} left
                  </span>
                </div>
              ))}
            </div>
            <Link to="/vendor/products">
              <button className="w-full mt-2 h-8 text-xs border border-border rounded-lg">
                Manage Products
              </button>
            </Link>
          </div>
        )}

        {/* KYC reminder if not verified */}
        {vendor && !vendor.is_verified && (
          <div className="setu-card p-4 border-primary/30 bg-primary/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm">🛡</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Complete KYC</p>
              <p className="text-xs text-muted-foreground">Get verified to build customer trust</p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
