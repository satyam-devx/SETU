// ═══════════════════════════════════════════════════════════
// SETU — ProductCard
// Extracted from CustomerHome so it can be shared with the
// CustomerCategories page's per-category product shelves.
//
// Image container: aspect-square + object-contain (not object-cover
// in a short fixed-height box) — vendor photos come in whatever
// aspect ratio the vendor shot them in, and object-cover inside a
// box shorter than the photo's natural proportions was cropping the
// top and bottom off. object-contain never crops; a photo that
// isn't square letterboxes against bg-muted instead, which reads as
// intentional since every card uses the same neutral background.
// Also switched from a hand-rolled <img>+onError to the shared Img
// component (lazy-load + fallback already lives there once).
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cartContext';
import { formatCurrency } from '@/lib/utils';
import Img from '@/components/shared/Img';

export default function ProductCard({ product }) {
  const { items, addItem } = useCart();
  const inCart = items.find(i => i.id === product.id);

  const handleAdd = (e) => {
    e.preventDefault();
    addItem(product, 1);
  };

  return (
    <Link to={`/customer/product/${product.id}`} className="block">
      <div className="setu-card overflow-hidden h-full">
        <div className="aspect-square bg-muted overflow-hidden relative">
          <Img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain"
          />
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
