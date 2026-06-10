// ═══════════════════════════════════════════════════════════
// SETU — VendorProducts (v2)
// Changes:
//  - Removed hardcoded VENDOR_ID + PRODUCTS mock
//  - Fetches vendor via getVendorByOwnerId(user.id), then
//    products via getProducts({ vendorId })
//  - Toggle availability persisted via upsertProduct
//  - Delete product via deleteProduct
//  - Loading skeleton + error state
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Package, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getVendorByOwnerId, getProducts, upsertProduct, deleteProduct } from '@/lib/api';

function ProductSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-muted rounded-xl" />
      ))}
    </div>
  );
}

export default function VendorProducts() {
  const { user } = useAuth();
  const [query,   setQuery]   = useState('');
  const [toggling, setToggling] = useState(null); // productId being toggled
  const [deleting, setDeleting] = useState(null); // productId being deleted
  const [actionErr, setActionErr] = useState(null);

  // 1. Fetch vendor for this user
  const { data: vendor, isLoading: vendorLoading } = useDataFetch(
    () => getVendorByOwnerId(user?.id),
    [user?.id],
    { cacheKey: `vendor-profile-${user?.id}`, enabled: !!user?.id }
  );

  // 2. Fetch products for this vendor
  const {
    data: rawProducts,
    isLoading: productsLoading,
    error: productsError,
    refetch,
  } = useDataFetch(
    () => getProducts({ vendorId: vendor?.id }),
    [vendor?.id],
    { cacheKey: `vendor-products-${vendor?.id}`, enabled: !!vendor?.id }
  );

  // Local optimistic copy so toggles feel instant
  const [localProducts, setLocalProducts] = useState(null);
  const products = localProducts ?? rawProducts ?? [];

  // Sync local copy when API data arrives (and we haven't diverged)
  React.useEffect(() => {
    if (rawProducts) setLocalProducts(rawProducts);
  }, [rawProducts]);

  const isLoading = vendorLoading || productsLoading;

  const filtered = products.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  );

  // ── Toggle availability ──────────────────────────────────
  const handleToggle = useCallback(async (product) => {
    if (toggling) return;
    const newVal = !(product.is_available ?? product.isAvailable ?? true);
    setToggling(product.id);
    setActionErr(null);

    // Optimistic update
    setLocalProducts(ps =>
      (ps ?? []).map(p => p.id === product.id ? { ...p, is_available: newVal } : p)
    );

    const { error } = await upsertProduct({ ...product, is_available: newVal });
    if (error) {
      // Rollback
      setLocalProducts(ps =>
        (ps ?? []).map(p => p.id === product.id ? { ...p, is_available: !newVal } : p)
      );
      setActionErr(`Failed to update ${product.name}: ${error.message}`);
    }
    setToggling(null);
  }, [toggling]);

  // ── Delete product ────────────────────────────────────────
  const handleDelete = useCallback(async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeleting(product.id);
    setActionErr(null);

    setLocalProducts(ps => (ps ?? []).filter(p => p.id !== product.id));
    const { error } = await deleteProduct(product.id);
    if (error) {
      setLocalProducts(ps => [...(ps ?? []), product]); // re-add on fail
      setActionErr(`Failed to delete: ${error.message}`);
    }
    setDeleting(null);
  }, []);

  const availableCount = products.filter(p => p.is_available ?? p.isAvailable ?? true).length;

  return (
    <div className="pb-24">
      <AppHeader
        title="My Products"
        subtitle={isLoading ? 'Loading...' : `${availableCount} available`}
        rightAction={
          <Link to="/vendor/products/new">
            <Button size="sm" className="h-8 gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </Link>
        }
      />

      <div className="px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Action error */}
        {actionErr && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{actionErr}</p>
          </div>
        )}

        {/* States */}
        {isLoading && <ProductSkeleton />}

        {!isLoading && productsError && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Could not load products.</p>
            <Button size="sm" variant="outline" onClick={refetch}>Try again</Button>
          </div>
        )}

        {!isLoading && !productsError && filtered.length === 0 && (
          <Card className="p-8 border-border text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {query ? 'No products match your search.' : 'No products yet.'}
            </p>
            {!query && (
              <Link to="/vendor/products/new">
                <Button size="sm" className="mt-3 gap-1">
                  <Plus className="w-3 h-3" /> Add Product
                </Button>
              </Link>
            )}
          </Card>
        )}

        {!isLoading && !productsError && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(p => {
              const isAvailable = p.is_available ?? p.isAvailable ?? true;
              const image       = p.image_url ?? p.image ?? '/placeholder-product.jpg';
              const mrp         = p.mrp ?? p.price;
              const stock       = p.stock ?? 0;

              return (
                <Card
                  key={p.id}
                  className={`p-3 border ${isAvailable ? 'border-border' : 'border-border opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden">
                      <img src={image} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.name_hindi ?? p.nameHindi} · {p.category}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold">₹{p.price}</span>
                        {mrp > p.price && (
                          <span className="text-xs line-through text-muted-foreground">₹{mrp}</span>
                        )}
                        <Badge variant="outline" className="text-[9px]">Stock: {stock}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {toggling === p.id
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : <Switch
                            checked={isAvailable}
                            onCheckedChange={() => handleToggle(p)}
                          />
                      }
                      <div className="flex gap-1">
                        <Link to={`/vendor/products/${p.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          disabled={deleting === p.id}
                          onClick={() => handleDelete(p)}
                        >
                          {deleting === p.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                  {stock < 5 && (
                    <div className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                      ⚠ Low stock — only {stock} left
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4">
        <Link to="/vendor/products/new">
          <Button className="rounded-full w-12 h-12 p-0 shadow-lg">
            <Plus className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
