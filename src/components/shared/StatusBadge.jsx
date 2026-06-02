import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  preparing: { label: 'Preparing', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  ready: { label: 'Ready', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  picked_up: { label: 'Picked Up', className: 'bg-violet-100 text-violet-800 border-violet-200' },
  on_the_way: { label: 'On the Way', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-200' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  open: { label: 'Open', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800 border-green-200' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200' },
  collected: { label: 'Collected', className: 'bg-green-100 text-green-800 border-green-200' },
  refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  online: { label: 'Online', className: 'bg-green-100 text-green-800 border-green-200' },
  offline: { label: 'Offline', className: 'bg-gray-100 text-gray-800 border-gray-200' },
};

export default function StatusBadge({ status, className: extraClass }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium border', config.className, extraClass)}>
      {config.label}
    </Badge>
  );
}
