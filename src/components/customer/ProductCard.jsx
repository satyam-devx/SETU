import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, ShoppingCart, Star } from 'lucide-react';
import { useCart } from '@/lib/cartContext';
import { formatCurrency } from '@/lib/utils';
import Img from '@/components/shared/Img';

function ProductCard({ product }) {
  const { items, addItem } = useCart();
  const inCart = items.find(i => i.id === product.id);
  const discount = product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  const handleAdd = (e) => {
    e.preventDefault();
    addItem(product, 1);
  };

  return (
    <Link to={`/customer/product/${product.id}`} className="block group">
      <article className="h-full overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_5px_18px_rgba(30,20,10,0.06)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_28px_rgba(30,20,10,0.10)]">
        <div className="relative aspect-square bg-gradient-to-br from-muted/70 to-primary/[0.04] overflow-hidden">
          <Img src={product.image_url ?? product.image} alt={product.name} className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04]" />
          {discount > 0 && <span className="absolute left-2.5 top-2.5 rounded-full bg-primary text-primary-foreground px-2 py-1 text-[9px] font-extrabold shadow-sm">{discount}% OFF</span>}
          {product.stock > 0 && product.stock <= 5 && <span className="absolute right-2.5 bottom-2.5 rounded-full bg-card/90 border border-border/70 px-2 py-1 text-[8px] font-bold text-amber-700">Only {product.stock} left</span>}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-1">
            <Check className="w-2.5 h-2.5 text-primary" /> SETU seller
          </div>
          <h4 className="text-[12px] font-bold line-clamp-2 leading-snug min-h-[30px]">{product.name}</h4>
          {product.name_hindi && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{product.name_hindi}</p>}

          <div className="flex items-end justify-between gap-2 mt-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[16px] font-black">{formatCurrency(product.price)}</span>
                {product.mrp > product.price && <span className="text-[9px] text-muted-foreground line-through">{formatCurrency(product.mrp)}</span>}
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[8px] text-muted-foreground">
                <Star className="w-2.5 h-2.5 fill-current" /> Trusted local listing
              </div>
            </div>
            <button
              onClick={handleAdd}
              aria-label={inCart ? `${product.name} is in cart` : `Add ${product.name} to cart`}
              className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all active:scale-90 shrink-0 shadow-sm ${inCart ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`}
            >
              {inCart ? <ShoppingCart className="w-[17px] h-[17px]" /> : <Plus className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default React.memo(ProductCard);
