import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Search, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useDataFetch } from '@/hooks/useDataFetch';
import { getSchemes } from '@/lib/api';

const CATEGORY_COLORS = {
  Agriculture: 'bg-green-100 text-green-700',
  Employment:  'bg-blue-100 text-blue-700',
  Finance:     'bg-purple-100 text-purple-700',
  Energy:      'bg-amber-100 text-amber-700',
  Health:      'bg-red-100 text-red-700',
};

export default function CustomerSchemes() {
  const [query,    setQuery]    = useState('');
  const [expanded, setExpanded] = useState(null);
  const [filter,   setFilter]   = useState('all');

  const { data: schemes, isLoading, error, refetch } = useDataFetch(
    () => getSchemes(),
    [],
    { cacheKey: 'schemes:all', staleTime: 120_000 }
  );

  const list = schemes ?? [];

  const filtered = list.filter(s => {
    const matchQ =
      !query ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(query.toLowerCase());
    if (filter === 'eligible') return matchQ && s.eligible;
    if (filter === 'applied')  return matchQ && s.applied;
    return matchQ;
  });

  const eligibleCount = list.filter(s => s.eligible).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Could not load schemes.</p>
        <Button variant="outline" onClick={refetch}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <AppHeader
        title="Government Schemes"
        subtitle={eligibleCount > 0 ? `${eligibleCount} scheme${eligibleCount > 1 ? 's' : ''} you're eligible for` : 'Browse available schemes'}
        showBack
      />
      <div className="px-4 py-4 space-y-3">
        {eligibleCount > 0 && (
          <Card className="p-3 border-green-200 bg-green-50/40">
            <p className="text-xs font-semibold text-green-800">
              ✓ You qualify for {eligibleCount} government scheme{eligibleCount > 1 ? 's' : ''}. Tap each to see how to apply.
            </p>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search schemes..."
            className="pl-9 h-8 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {[['all', 'All'], ['eligible', 'Eligible'], ['applied', 'Applied']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === val ? 'bg-primary text-white border-primary' : 'border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No schemes match your filter.</p>
        )}

        <div className="space-y-2">
          {filtered.map(scheme => (
            <Card key={scheme.id} className="border-border overflow-hidden">
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpanded(expanded === scheme.id ? null : scheme.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{scheme.name}</p>
                      {scheme.applied && (
                        <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">Applied</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{scheme.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge
                        className={`text-[9px] border-0 ${
                          CATEGORY_COLORS[scheme.category] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {scheme.category}
                      </Badge>
                      {scheme.eligible
                        ? <Badge className="text-[9px] bg-green-100 text-green-700 border-0 flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Eligible
                          </Badge>
                        : <Badge className="text-[9px] bg-gray-100 text-gray-600 border-0">
                            Check eligibility
                          </Badge>
                      }
                    </div>
                  </div>
                  {expanded === scheme.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />}
                </div>
              </button>

              {expanded === scheme.id && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-muted-foreground">Benefit</p>
                      <p className="font-semibold mt-0.5">{scheme.benefit ?? '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-muted-foreground">Deadline</p>
                      <p className="font-semibold mt-0.5">{scheme.deadline ?? 'Ongoing'}</p>
                    </div>
                  </div>
                  {scheme.how_to_apply && (
                    <div>
                      <p className="text-xs font-semibold mb-1">How to Apply</p>
                      <p className="text-xs text-muted-foreground">{scheme.how_to_apply}</p>
                    </div>
                  )}
                  {!scheme.applied && (
                    <Button className="w-full h-8 text-xs gap-1" asChild>
                      <a href={scheme.apply_url ?? '#'} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" /> Apply / Learn More
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
