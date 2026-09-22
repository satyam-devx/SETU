import React from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Calendar, IndianRupee, User, Clock } from 'lucide-react';
import MobileNav from '@/components/shared/MobileNav';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import OfflineBanner from '@/components/shared/OfflineBanner';
import { useAuth } from '@/lib/AuthContext';
import { useDataFetch } from '@/hooks/useDataFetch';
import { SevaAPI } from '@/lib/api';

function SevaContent() {
  const { user } = useAuth();

  const { data: provider } = useDataFetch(
    () => SevaAPI.getMyProvider(user?.id),
    [user?.id],
    { cacheKey: `seva-provider-${user?.id}`, enabled: !!user?.id }
  );

  // Real open-jobs count, scoped to this provider's own village +
  // category — previously a hardcoded `badge: 3` shown to every
  // provider regardless of what was actually available to them.
  const { data: openJobs } = useDataFetch(
    () => SevaAPI.getOpenJobs({ villageId: provider?.village_id, category: provider?.category }),
    [provider?.village_id, provider?.category],
    { cacheKey: `seva-open-jobs-${provider?.village_id}-${provider?.category}`, enabled: !!provider?.village_id }
  );

  const navItems = [
    { path: '/seva',           label: 'Home',     icon: Home },
    { path: '/seva/jobs',      label: 'Jobs',     icon: Calendar, badge: (openJobs || []).length || null },
    { path: '/seva/schedule',  label: 'Schedule', icon: Clock },
    { path: '/seva/earnings',  label: 'Earnings', icon: IndianRupee },
    { path: '/seva/profile',   label: 'Profile',  icon: User },
  ];

  return (
    <div className="page-container relative">
      <OfflineBanner />
      <Outlet />
      <MobileNav items={navItems} />
    </div>
  );
}

export default function SevaLayout() {
  return (
    <ErrorBoundary portal="Seva Provider" fallbackRoute="/seva">
      <SevaContent />
    </ErrorBoundary>
  );
}
