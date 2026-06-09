import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ShoppingCart, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/cartContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getOrderById, getProducts } from '@/lib/api';

export default function CustomerReorder() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const { state }   = useStore();
  const { addItem, clearCart } = useCart();

  const [added, setAdded]           = useState(false);
  const [unavailable, setUnavailable] = useState([]);

  // 1. Try store first (already hydrated from the orders list page)
  const storeOrder = state.orders.find(o => o.id === orderId);

  // 2. If not in store, fetch from DB — enabled only when missing
  const { data: fetchedOrder, isLoading: orderLoading } = useDataFetch(
    () => getOrderById(orderId),
    [orderId],
    {
      cacheKey: `order:${orderId}`,
      enabled:  !storeOrder && !!orderId,
    }
  );

  const order = storeOrder ?? fetchedOrder;

  // 3. Once we have the order's vendor, fetch live product stock for that vendor
  const vendorId = order?.vendor_id ?? order?.vendorId;
  const { data: liveProducts, isLoading: productsLoading } = useDataFetch(
    () => getProducts({ vendorId }),
    [vendorId],
    {
      cacheKey: `products:vendor:${vendorId}`,
      enabled:  !!vendorId,
    }
  );

  const isLoading = orderLoading || productsLoading;

  // ── Early states ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Original order not found.</p>
        <Button onClick={() => navigate('/customer/orders')}>Back to Orders</Button>
      </div>
    );
  }

  // ── Enrich order items with live stock data ──────────────
  const orderItems = order.items ?? order.order_items ?? [];
  const enrichedItems = orderItems.map(item => {
    // Match by name (display name) or product_id
    const live = (liveProducts ?? []).find(
      p => p.id === (item.product_id ?? item.productId) || p.name === item.name
    );
    return {
      ...item,
      product:  live ?? null,
      inStock:  live ? live.stock > 0 && live.is_available !== false : false,
      imageUrl: live?.image_url ?? live?.image ?? null,
    };
  });

  const allAvailable  = enrichedItems.every(i => i.inStock);
  const someAvailable = enrichedItems.some(i => i.inStock);

  const handleAddAll = () => {
    clearCart();
    const missing = [];
    enrichedItems.forEach(item => {
      if (item.product && item.inStock) {
        addItem(item.product, item.qty ?? item.quantity ?? 1);
      } else {
        missing.push(item.name);
      }
    });
    setUnavailable(missing);
    setAdded(true);
  };

  // ── Success screen ────────────────────────────────────────
  if (added) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Added to Cart!</h2>
        {unavailable.length > 0 && (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3 w-full max-w-xs">
            <p className="font-medium mb-1">Some items were unavailable:</p>
            {unavailable.map(n => <p key={n} className="text-xs">• {n}</p>)}
          </div>
        )}
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/customer/orders')}>
            Back
          </Button>
          <Button className="flex-1 gap-2" onClick={() => navigate('/customer/cart')}>
            <ShoppingCart className="w-4 h-4" /> View Cart
          </Button>
        </div>
      </div>
    );
  }

  const createdAt = order.createdAt ?? order.created_at;
  const vendorName = order.vendorName ?? order.vendor_name ?? 'Vendor';

  return (
    <div className="pb-24">
      <AppHeader title="Reorder" subtitle={order.orderNumber ?? order.order_number} showBack backTo="/customer/orders" />

      <div className="px-4 py-4 space-y-3">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-1">From {vendorName}</h3>
          <p className="text-xs text-muted-foreground">
            Original order —{' '}
            {createdAt ? new Date(createdAt).toLocaleDateString('en-IN') : '—'}
          </p>
        </Card>

        <div className="space-y-2">
          {enrichedItems.map((item, i) => (
            <Card key={i} className="p-3 border-border flex items-center gap-3">
              {item.imageUrl && (
                <div className="w-12 h-12 rounded-lg bg-muted shrink-0 overflow-hidden">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.qty ?? item.quantity ?? 1} · ₹{item.price}
                </p>
              </div>
              <Badge
                className={`text-[9px] shrink-0 border-0 ${
                  item.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {item.inStock ? 'Available' : 'Out of stock'}
              </Badge>
            </Card>
          ))}
        </div>

        {!someAvailable && (
          <Card className="p-3 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-700">
              None of the items from this order are currently available.
            </p>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
        <Button
          className="w-full gap-2"
          disabled={!someAvailable}
          onClick={handleAddAll}
        >
          <RefreshCw className="w-4 h-4" />
          {allAvailable ? 'Reorder All Items' : 'Add Available Items to Cart'}
        </Button>
      </div>
    </div>
  );
}
