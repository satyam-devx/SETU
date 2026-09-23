import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Navigation, IndianRupee, User, Wallet } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useRealtimeOrders, useRealtimeNotifications } from '@/hooks/useRealtimeOrders';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getRiderByUserId } from '@/lib/api';
import { supabase } from '@/lib/supabase';

function RiderContent() {
  const { user }  = useAuth();
  const { state } = useStore();
  // Orders are keyed by riders.id (NOT the auth uid) — resolve it so the
  // realtime store populates this rider's assigned orders.
  const { data: rider } = useDataFetch(
    () => getRiderByUserId(user?.id),
    [user?.id],
    { cacheKey: `rider-profile-${user?.id}`, enabled: !!user?.id }
  );
  useRealtimeOrders('rider', rider?.id);
  useRealtimeNotifications();

  const [offerCount, setOfferCount] = useState(0);
  useEffect(() => {
    if (!rider?.id) return undefined;
    const load = async () => {
      const { count } = await supabase.from('rider_offers').select('id', { count: 'exact', head: true }).eq('rider_id', rider.id).eq('status', 'offered').gt('expires_at', new Date().toISOString());
      setOfferCount(count ?? 0);
    };
    load();
    const ch = supabase.channel(`rider-dispatch-badge-${rider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'rider_offers', filter: `rider_id=eq.${rider.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rider?.id]);

  const available = offerCount;

  const navItems = [
    { path: '/rider',            label: 'Home',       icon: Home },
    { path: '/rider/deliveries', label: 'Deliveries', icon: Navigation, badge: available || null },
    { path: '/rider/earnings',   label: 'Earnings',   icon: IndianRupee },
    { path: '/rider/cod',        label: 'COD',        icon: Wallet },
    { path: '/rider/profile',    label: 'Profile',    icon: User },
  ];
  return (
    <div className="page-container relative">
      <OfflineBanner />
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}

export default function RiderLayout() {
  return (
    <ErrorBoundary portal="Rider" fallbackRoute="/rider">
      <RiderContent />
    </ErrorBoundary>
  );
}
