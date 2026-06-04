import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Mic, MapPin, ChevronRight, Star, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CATEGORIES, VENDORS, PRODUCTS, SCHEMES } from '@/lib/mockData';
import { AIAPI } from '@/lib/api';
import { useStore } from '@/lib/store';

const BANNERS = [
  { id: 1, title: 'Chhath Festival Sale', subtitle: 'Up to 30% off on pooja essentials', bg: 'bg-gradient-to-r from-primary to-primary/70', link: '/customer/search?category=c6' },
  { id: 2, title: 'Fresh Makhana Season', subtitle: 'Premium quality from Madhepur farms', bg: 'bg-gradient-to-r from-accent to-accent/70', link: '/customer/search?category=c2' },
];

export default function CustomerHome() {
  const navigate  = useNavigate();
  const { state } = useStore();
  const [query, setQuery]         = useState('');
  const [listening, setListening] = useState(false);

  const liveOrders = state.orders.filter(o =>
    o.customerId === 'u1' && !['delivered', 'cancelled'].includes(o.status)
  );

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      navigate(`/customer/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleVoice = () => {
    navigate('/customer/voice');
  };

  return (
    <div className="pb-20">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Delivering to</p>
            <p className="text-sm font-semibold text-foreground">Madhepur, Madhubani</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <Link to="/customer/notifications" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {state.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
              {state.unreadCount > 9 ? '9+' : state.unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, vendors..."
            className="pl-10 pr-10 bg-muted/50 border-0 rounded-xl"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            onClick={() => navigate('/customer/search')}
          />
          <button onClick={handleVoice} className={`absolute right-3 top-1/2 -translate-y-1/2 ${listening ? 'text-red-500' : 'text-primary'}`}>
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live order tracker */}
      {liveOrders.length > 0 && (
        <div className="px-4 mb-3">
          {liveOrders.map(o => (
            <Link key={o.id} to={`/customer/orders/${o.id}`}>
              <Card className="p-3 border-primary/30 bg-primary/5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{o.orderNumber} · {o.vendorName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{o.status.replace('_', ' ')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Banner */}
      <div className="px-4 mb-4">
        <Link to={BANNERS[0].link}>
          <div className={`${BANNERS[0].bg} rounded-2xl p-5 text-white`}>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide">Limited Offer</p>
            <h2 className="text-xl font-bold mt-1">{BANNERS[0].title}</h2>
            <p className="text-sm opacity-90 mt-1">{BANNERS[0].subtitle}</p>
            <span className="inline-block mt-3 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg">
              Shop Now →
            </span>
          </div>
        </Link>
      </div>

      {/* Categories */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Categories</h3>
          <Link to="/customer/search" className="text-xs text-primary font-medium">See All</Link>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.slice(0, 10).map(cat => (
            <Link key={cat.id} to={`/customer/search?category=${cat.id}`} className="flex flex-col items-center gap-1 p-2">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-xl">{cat.icon}</div>
              <span className="text-[10px] text-center text-muted-foreground font-medium leading-tight line-clamp-2">{cat.name.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Nearby Vendors */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Nearby Vendors</h3>
          <Link to="/customer/vendors" className="text-xs text-primary font-medium">See All</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {VENDORS.filter(v => v.isOpen).map(vendor => (
            <Link key={vendor.id} to={`/customer/vendor/${vendor.id}`} className="shrink-0 w-40">
              <Card className="overflow-hidden border-border">
                <div className="h-24 bg-muted relative">
                  <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" />
                  {vendor.isVerified && <Badge className="absolute top-2 left-2 bg-accent text-white text-[9px] border-0">✓</Badge>}
                </div>
                <div className="p-3">
                  <h4 className="text-xs font-semibold truncate">{vendor.name}</h4>
                  <p className="text-[10px] text-muted-foreground">{vendor.category}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    <span className="text-[10px] font-medium">{vendor.rating}</span>
                    <span className="text-[10px] text-muted-foreground">({vendor.reviewCount})</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Products */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Popular Products</h3>
          <Link to="/customer/search" className="text-xs text-primary font-medium">See All</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PRODUCTS.slice(0, 4).map(product => (
            <Link key={product.id} to={`/customer/product/${product.id}`}>
              <Card className="overflow-hidden border-border">
                <div className="h-28 bg-muted">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h4 className="text-xs font-semibold truncate">{product.name}</h4>
                  <p className="text-[10px] text-muted-foreground">{product.nameHindi}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-bold text-foreground">₹{product.price}</span>
                    {product.mrp > product.price && <span className="text-[10px] text-muted-foreground line-through">₹{product.mrp}</span>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Government Schemes */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Government Schemes</h3>
          <Link to="/customer/schemes" className="text-xs text-primary font-medium">See All</Link>
        </div>
        {SCHEMES.map(scheme => (
          <Link key={scheme.id} to="/customer/schemes">
            <Card className="p-3 mb-2 border-border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-sm">🏛️</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium">{scheme.name}</h4>
                  <p className="text-xs text-muted-foreground">{scheme.description}</p>
                </div>
                {scheme.eligible && <Badge className="shrink-0 bg-green-100 text-green-800 text-[9px] border-0">Eligible</Badge>}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Referral CTA */}
      <div className="px-4 mb-4">
        <Link to="/customer/referral">
          <Card className="p-4 border-primary/20 bg-primary/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Refer & Earn ₹100</p>
              <p className="text-xs text-muted-foreground">Invite friends, get wallet credit</p>
            </div>
            <ChevronRight className="w-5 h-5 text-primary" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
