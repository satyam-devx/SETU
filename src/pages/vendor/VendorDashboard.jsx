import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, IndianRupee, Users, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { useStore } from '@/lib/store';
import { AIAPI } from '@/lib/api';
import { VENDORS, PRODUCTS } from '@/lib/mockData';

const VENDOR_ID = 'vn1';
const vendor = VENDORS[0];

export default function VendorDashboard() {
  const { state } = useStore();
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    AIAPI.getDemandForecast(VENDOR_ID).then(({ data }) => data && setForecast(data));
  }, []);

  const vendorOrders  = state.orders.filter(o => o.vendorId === VENDOR_ID);
  const pendingOrders = vendorOrders.filter(o => o.status === 'pending');
  const todayOrders   = vendorOrders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue  = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const vendorProducts = PRODUCTS.filter(p => p.vendorId === VENDOR_ID);
  const lowStock      = vendorProducts.filter(p => p.stock < 5);

  return (
    <div className="pb-20">
      <AppHeader
        title={vendor.name}
        subtitle={`${vendor.village} · ${vendor.category}`}
        notificationCount={pendingOrders.length}
        rightAction={
          <Badge className={`text-xs border-0 ${vendor.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {vendor.isOpen ? '● Open' : '● Closed'}
          </Badge>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Today's Revenue" value={`₹${todayRevenue.toLocaleString()}`} icon={IndianRupee} />
          <StatCard title="Today's Orders"  value={String(todayOrders.length)} icon={ShoppingBag} subtitle={`${pendingOrders.length} pending`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Products" value={String(vendorProducts.length)} icon={Package} subtitle={`${vendorProducts.filter(p => p.isAvailable !== false).length} available`} />
          <StatCard title="Trust Score" value={String(vendor.trustScore)} icon={TrendingUp} trend="Top 20%" trendUp />
        </div>

        {pendingOrders.length > 0 && (
          <Link to="/vendor/orders">
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} need your response
                </p>
                <p className="text-xs text-amber-700">Tap to accept or reject</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </Card>
          </Link>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
            <Link to="/vendor/orders" className="text-xs text-primary font-medium">View all</Link>
          </div>
          {vendorOrders.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <ShoppingBag className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {vendorOrders.slice(0, 3).map(o => (
                <Card key={o.id} className="p-3 border-border flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{o.orderNumber}</p>
                    <p className="text-sm font-medium">{o.customerName || 'Customer'}</p>
                    <p className="text-xs text-muted-foreground truncate">{(o.items || []).map(i => i.name).join(', ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">₹{o.total}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {lowStock.length > 0 && (
          <Card className="p-3 border-destructive/30 bg-destructive/5">
            <p className="text-xs font-semibold text-destructive mb-2">⚠ Low Stock Alert</p>
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs py-0.5">
                <span>{p.name}</span>
                <Badge className="text-[9px] bg-red-100 text-red-700 border-0">Only {p.stock} left</Badge>
              </div>
            ))}
            <Link to="/vendor/products">
              <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs">Manage Products</Button>
            </Link>
          </Card>
        )}

        {forecast && (
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> AI Demand Forecast
            </h3>
            {forecast.festivalAlert && (
              <div className="p-2 bg-amber-50 rounded-lg mb-3 text-xs text-amber-800">🎉 {forecast.festivalAlert}</div>
            )}
            <div className="space-y-2">
              {forecast.forecasts.map(f => (
                <div key={f.product} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{f.product}</span>
                  <span className="text-muted-foreground shrink-0">Pred: {f.nextWeekDemand}</span>
                  <Badge className="text-[9px] bg-primary/10 text-primary border-0 shrink-0">Order {f.reorderSuggestion}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Add Product', path: '/vendor/products/new', icon: Package },
            { label: 'Analytics',   path: '/vendor/analytics',    icon: TrendingUp },
            { label: 'Customers',   path: '/vendor/customers',    icon: Users },
            { label: 'Credit',      path: '/vendor/credit',       icon: IndianRupee },
          ].map(q => (
            <Link key={q.path} to={q.path}>
              <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
                <q.icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{q.label}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
