// ═══════════════════════════════════════════════════════════
// SETU — SkeletonCard & skeleton primitives
// Used across all portals for loading states.
// Avoids layout shift during data fetching.
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { cn } from '@/lib/utils';

// Base shimmer skeleton block
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/70',
        className
      )}
      {...props}
    />
  );
}

// Product card skeleton
export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      <Skeleton className="h-28 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-1" />
      </div>
    </div>
  );
}

// Vendor card skeleton
export function VendorCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shrink-0 w-40">
      <Skeleton className="h-24 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-2/5 mt-1" />
      </div>
    </div>
  );
}

// Order row skeleton
export function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

// Full page skeleton (for route-level lazy loads)
export function PageSkeleton({ rows = 4 }) {
  return (
    <div className="px-4 py-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <OrderRowSkeleton key={i} />
      ))}
    </div>
  );
}

// Home banner skeleton
export function BannerSkeleton() {
  return <Skeleton className="h-32 w-full rounded-2xl" />;
}

// Category icon skeleton
export function CategorySkeleton({ count = 5 }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1 p-2">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <Skeleton className="h-2 w-8" />
        </div>
      ))}
    </div>
  );
}
