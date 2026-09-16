// ═══════════════════════════════════════════════════════════
// SETU — ProductCard
// Extracted from CustomerHome so it can be shared with the
// CustomerCategories page's per-category product shelves.
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cartContext';
import { formatCurrency } from '@/lib/utils';

export default function ProductCard({ product }) {
  const { items, addItem } = useCart();
  const [imgErr, setImgErr] = useState(false);
  const inCart = items.find(i => i.id === product.id);

  const handleAdd = (e) => {
    e.preventDefault();
    addItem(product, 1);
  };

  return (
    <Link to={`/customer/product/${product.id}`} className="block">
      <div className="setu-card overflow-hidden h-full">
        <div className="h-28 bg-muted overflow-hidden relative">
          {product.image_url && !imgErr ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
          )}
          {product.mrp > product.price && (
            <span className="absolute top-2 right-2 bg-destructive text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {Math.round((1 - product.price / product.mrp) * 100)}% OFF
            </span>
          )}
        </div>
        <div className="p-3">
          <h4 className="text-xs font-semibold line-clamp-2 leading-snug">{product.name}</h4>
          {product.name_hindi && (
            <p className="text-[10px] text-muted-foreground">{product.name_hindi}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-sm font-bold text-foreground">{formatCurrency(product.price)}</span>
              {product.mrp > product.price && (
                <span className="text-[10px] text-muted-foreground line-through ml-1">
                  {formatCurrency(product.mrp)}
                </span>
              )}
            </div>
            <button
              onClick={handleAdd}
              aria-label={inCart ? 'In cart' : `Add ${product.name} to cart`}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                inCart
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
              }`}
            >
              {inCart ? <ShoppingCart className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
