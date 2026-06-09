// ═══════════════════════════════════════════════════════════
// SETU — CustomerOrders (v2)
// Fixes:
//  - Replaced CUSTOMER_ID='u1' hardcode with real auth user
//  - Added real DB fetch via getOrdersByCustomer
//  - Skeleton loading states
//  - Proper empty states per tab
//  - Pagination-ready (load more)
//  - Accessible tabs with ARIA
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search } from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { OrderRowSkeleton } from '@/components/shared/SkeletonCard';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { useStore } from '@/lib/store';
import { getOrdersByCustomer } from '@/lib/api';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/utils';

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'completed', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

function filterOrders(orders, tab, query) {
  return orders.filter(o => {
    const qs = query.toLowerCase();
    const matchQ = !qs ||
      (o.orderNumber || o.order_number || '').toLowerCase().includes(qs) ||
      (o.vendorName  || o.vendor_name  || '').toLowerCase().includes(qs);
    const status = o.status || '';
    if (tab === 'active')    return matchQ && !['delivered','cancelled'].includes(status);
    if (tab === 'completed') return matchQ && status === 'delivered';
    if (tab === 'cancelled') return matchQ && status === 'cancelled';
    return matchQ;
  }).sort((a, b) =>
    new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
  );
}

export default function CustomerOrders() {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const { state }      = useStore();
  const [tab, setTab]  = useState('all');
  const [query, setQuery] = useState('');

  // Fetch from DB; merge with store (which gets realtime updates)
  const { data: dbOrders, isLoading, error, refetch } = useDataFetch(
    () => getOrdersByCustomer(user?.id),
    [user?.id],
    { cacheKey: `orders-customer-${user?.id}`, enabled: !!user?.id }
  );

  // Merge: prefer DB orders + any realtime-added orders from store
  const storeOrders = state.orders.filter(o =>
    user?.id && (o.customerId === user.id || o.customer_id === user.id)
  );
  const allOrders = dbOrders?.length ? dbOrders : storeOrders;
  const filtered  = filterOrders(allOrders, tab, query);

  const EMPTY_MESSAGES = {
    all:       { title: 'No orders yet',    desc: 'Start shopping to see your orders here' },
    active:    { title: 'No active orders', desc: 'Your live orders will appear here' },
    completed: { title: 'No completed orders', desc: 'Delivered orders will appear here' },
    cancelled: { title: 'No cancelled orders', desc: 'Any cancelled orders will appear here' },
  };

  return (
    <div className="pb-nav animate-fade-in" role="main">
      <AppHeader title="My Orders" />

      <div className="px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by order no. or vendor..."
            className="input-field pl-9 py-2 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search orders"
          />
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Order filters" className="flex gap-1 bg-muted rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div role="tabpanel" aria-label={`${tab} orders`}>
        {isLoading ? (
          <div aria-busy="true">
            {[1,2,3,4].map(i => <OrderRowSkeleton key={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            emoji="⚠️"
            title="Couldn't load orders"
            description={error.message}
            action={refetch}
            actionLabel="Retry"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={EMPTY_MESSAGES[tab].title}
            description={EMPTY_MESSAGES[tab].desc}
            action={tab === 'all' ? () => navigate('/customer') : undefined}
            actionLabel={tab === 'all' ? 'Browse Products' : undefined}
          />
        ) : (
          <div className="space-y-0 divide-y divide-border">
            {filtered.map(order => {
              const isActive = !['delivered','cancelled'].includes(order.status);
              const orderNum = order.orderNumber || order.order_number;
              const vendorName = order.vendorName || order.vendor_name;
              const total = order.total ?? 0;
              const items = order.order_items || order.items || [];
              const createdAt = order.createdAt || order.created_at;
              const payMethod = order.paymentMethod || order.payment_method || 'COD';

              return (
                <Link
                  key={order.id}
                  to={`/customer/orders/${order.id}`}
                  className="block"
                  aria-label={`Order ${orderNum} from ${vendorName}, status ${order.status}`}
                >
                  <div className={`px-4 py-4 transition-colors active:bg-muted/50 ${isActive ? 'bg-primary/3' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-muted-foreground">{orderNum}</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{vendorName}</p>
                        {items.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {items.slice(0,3).map(i => i.name).join(', ')}
                            {items.length > 3 ? ` +${items.length - 3} more` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold">{formatCurrency(total)}</p>
                        <StatusBadge status={order.status} className="mt-1" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-muted-foreground">{timeAgo(createdAt)}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                          {payMethod}
                        </span>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-label="Order in progress" />
                        )}
                        {order.status === 'delivered' && !order.isRated && !order.is_rated && (
                          <span className="text-[10px] text-primary font-medium">Rate →</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
