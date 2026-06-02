import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, ShoppingCart, Heart, Share2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useCart } from '@/lib/cartContext';
import { PRODUCTS, VENDORS } from '@/lib/mockData';

export default function CustomerProductDetail() {
  const { productId } = useParams();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];
  const vendor = VENDORS.find(v => v.id === product.vendorId);

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const discount = product.mrp > product.price ? Math.round((product.mrp - product.price) / product.mrp * 100) : 0;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/customer" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="font-semibold text-sm flex-1 truncate">{product.name}</span>
        <Button variant="ghost" size="icon"><Share2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon"><Heart className="w-4 h-4" /></Button>
      </div>

      {/* Image */}
      <div className="h-64 bg-muted">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
      </div>

      {/* Details */}
      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">{product.name}</h1>
              {product.nameHindi && <p className="text-sm text-muted-foreground">{product.nameHindi}</p>}
            </div>
            {discount > 0 && <Badge className="bg-green-100 text-green-700 border-0 shrink-0">{discount}% off</Badge>}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold">₹{product.price}</span>
            {product.mrp > product.price && <span className="text-sm text-muted-foreground line-through">₹{product.mrp}</span>}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-medium">4.2</span>
            <span className="text-xs text-muted-foreground">(128 reviews)</span>
          </div>
        </div>

        {vendor && (
          <Card className="p-3 border-border">
            <p className="text-xs text-muted-foreground">Sold by</p>
            <Link to={`/customer/vendor/${vendor.id}`} className="text-sm font-semibold hover:text-primary">{vendor.name}</Link>
            <p className="text-xs text-muted-foreground mt-0.5">Est. delivery: 30-45 min</p>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fresh and high quality {product.name}. Sourced directly from local farmers and vendors in {product.category} category to ensure the best quality for your family.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Category</h3>
          <Badge variant="outline">{product.category}</Badge>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Availability</h3>
          <p className="text-sm text-muted-foreground">{product.stock} units in stock · Per {product.unit}</p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 border border-border rounded-lg">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2"><Minus className="w-4 h-4" /></button>
          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="p-2"><Plus className="w-4 h-4" /></button>
        </div>
        <Button className="flex-1 gap-2" onClick={handleAddToCart}>
          <ShoppingCart className="w-4 h-4" />
          {added ? 'Added! ✓' : `Add to Cart — ₹${product.price * quantity}`}
        </Button>
      </div>
    </div>
  );
}
