// ═══════════════════════════════════════════════════════════
// SETU — CustomerSeva (browse local service providers)
//
// This page (and CustomerSevaRequest/CustomerSevaBookings alongside
// it) is the customer half of a feature that only ever had a provider
// half: seva_providers/seva_jobs and their RLS policies have existed
// since the first migration, and the provider portal could already
// accept/complete jobs — but nothing anywhere let a customer actually
// see providers or post a request, so no job could ever be created.
//
// Requests are posted here as OPEN jobs in the customer's own village
// + chosen category (see createSevaJob) — not aimed at one specific
// provider. The list below is informational (so a customer can see
// there are real, rated people who do this before requesting), not a
// picker; any verified provider in that village+category can then
// accept it from their own Jobs list, same as the existing open-jobs
// pool the provider portal already reads from.
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, IndianRupee, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useSevaProvidersByVillage } from '@/hooks/queries/useCatalog';
import { useVillage } from '@/lib/village';
import { CATEGORIES } from '@/pages/onboarding/SevaVerification';

function ProviderRow({ p }) {
  return (
    <Card className="p-3 border-border flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
        <span className="text-base font-bold text-secondary">{p.name?.[0]?.toUpperCase() || '?'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
          {!p.is_available && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">Unavailable</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {p.rating > 0 ? p.rating.toFixed(1) : 'New'}
            {p.review_count > 0 && <span>({p.review_count})</span>}
          </span>
          {p.experience && <span className="truncate">· {p.experience}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-foreground flex items-center">
          <IndianRupee className="w-3 h-3" />{p.hourly_rate}<span className="text-muted-foreground font-normal">/hr</span>
        </p>
      </div>
    </Card>
  );
}

export default function CustomerSeva() {
  const navigate = useNavigate();
  const { village } = useVillage();
  const [category, setCategory] = useState(null);

  const { data: providers, isLoading, error, refetch } = useSevaProvidersByVillage(
    village?.id,
    category ? { category } : {}
  );

  return (
    <div className="pb-28">
      <AppHeader title="Seva Providers" subtitle="Electricians, plumbers & more, near you" showBack />

      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto scroll-strip -mx-1 px-1">
          <button
            onClick={() => setCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              category === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                category === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-2 mt-2">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-muted-foreground">Could not load providers.</p>
            <button onClick={refetch} className="text-xs text-primary font-semibold underline">Retry</button>
          </div>
        ) : !providers?.length ? (
          <EmptyState
            emoji="🧰"
            title={category ? `No ${category} providers yet` : 'No providers yet'}
            description="You can still post a request below — providers who join later will see it."
            size="sm"
          />
        ) : (
          providers.map(p => <ProviderRow key={p.id} p={p} />)
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-background border-t border-border">
        <Button
          className="w-full h-11"
          disabled={!category}
          onClick={() => navigate('/customer/seva/request', { state: { category } })}
        >
          {category ? `Request a ${category}` : 'Pick a service above to continue'}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
