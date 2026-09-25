import React from 'react';
import { TrendingUp, Package } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import { formatCurrency } from '@/lib/utils';

function VendorAnalyticsSummary({ avgOrderVal, totalRevenue }) {
  return (
    <div className="px-4 py-3 grid grid-cols-2 gap-2">
      <StatCard title="Avg Order Value" value={formatCurrency(avgOrderVal)} icon={Package} />
      <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={TrendingUp} accent />
    </div>
  );
}

export default React.memo(VendorAnalyticsSummary);
