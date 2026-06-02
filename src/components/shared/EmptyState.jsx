import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function EmptyState({ icon: Icon = PackageOpen, title = 'Nothing here yet', description = '', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}