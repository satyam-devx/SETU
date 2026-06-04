import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { SCHEMES } from '@/lib/mockData';

const EXTENDED_SCHEMES = [
  { id: 's1', name: 'PM Kisan Samman Nidhi', description: '₹6,000/year for small farmers', eligible: true,  category: 'Agriculture', benefit: '₹6,000/year', howToApply: 'Visit gram panchayat with Aadhaar and land records', deadline: 'Ongoing', applied: false },
  { id: 's2', name: 'MNREGA Work Guarantee', description: '100 days guaranteed employment', eligible: true,  category: 'Employment',  benefit: '100 days work', howToApply: 'Register at Panchayat office with Aadhaar and job card', deadline: 'Ongoing', applied: true  },
  { id: 's3', name: 'Jan Dhan Yojana',       description: 'Zero-balance bank account',      eligible: false, category: 'Finance',     benefit: 'Free bank account + ₹10k overdraft', howToApply: 'Visit nearest bank branch with Aadhaar', deadline: 'Ongoing', applied: false },
  { id: 's4', name: 'Ujjwala Yojana',        description: 'Free LPG connection for BPL',    eligible: true,  category: 'Energy',      benefit: 'Free LPG connection', howToApply: 'Apply at nearest gas agency with BPL card and Aadhaar', deadline: 'Jun 30, 2025', applied: false },
  { id: 's5', name: 'PM Fasal Bima Yojana',  description: 'Crop insurance for farmers',     eligible: true,  category: 'Agriculture', benefit: 'Up to 90% loss coverage', howToApply: 'Apply through bank or CSC center', deadline: 'Before sowing', applied: false },
  { id: 's6', name: 'Ayushman Bharat',       description: '₹5 lakh health coverage',        eligible: true,  category: 'Health',      benefit: '₹5 lakh/year for family', howToApply: 'Check eligibility at Ayushman portal with Aadhaar', deadline: 'Ongoing', applied: true  },
];

const CATEGORY_COLORS = {
  Agriculture: 'bg-green-100 text-green-700',
  Employment:  'bg-blue-100 text-blue-700',
  Finance:     'bg-purple-100 text-purple-700',
  Energy:      'bg-amber-100 text-amber-700',
  Health:      'bg-red-100 text-red-700',
};

export default function CustomerSchemes() {
  const [query, setQuery]     = useState('');
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]   = useState('all');

  const filtered = EXTENDED_SCHEMES.filter(s => {
    const matchQ = !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase());
    if (filter === 'eligible') return matchQ && s.eligible;
    if (filter === 'applied')  return matchQ && s.applied;
    return matchQ;
  });

  const eligibleCount = EXTENDED_SCHEMES.filter(s => s.eligible).length;

  return (
    <div className="pb-6">
      <AppHeader title="Government Schemes" subtitle={`${eligibleCount} schemes you're eligible for`} showBack />
      <div className="px-4 py-4 space-y-3">

        {eligibleCount > 0 && (
          <Card className="p-3 border-green-200 bg-green-50/40">
            <p className="text-xs font-semibold text-green-800">
              ✓ You qualify for {eligibleCount} government schemes. Tap each to see how to apply.
            </p>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search schemes..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="flex gap-2">
          {[['all', 'All'], ['eligible', 'Eligible'], ['applied', 'Applied']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === val ? 'bg-primary text-white border-primary' : 'border-border'}`}>
              {label}
            </button>
          ))}
        </div>

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
                      {scheme.applied && <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">Applied</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{scheme.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge className={`text-[9px] border-0 ${CATEGORY_COLORS[scheme.category] || 'bg-gray-100 text-gray-700'}`}>
                        {scheme.category}
                      </Badge>
                      {scheme.eligible
                        ? <Badge className="text-[9px] bg-green-100 text-green-700 border-0 flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Eligible</Badge>
                        : <Badge className="text-[9px] bg-gray-100 text-gray-600 border-0">Check eligibility</Badge>
                      }
                    </div>
                  </div>
                  {expanded === scheme.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />}
                </div>
              </button>

              {expanded === scheme.id && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-muted-foreground">Benefit</p>
                      <p className="font-semibold mt-0.5">{scheme.benefit}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-muted-foreground">Deadline</p>
                      <p className="font-semibold mt-0.5">{scheme.deadline}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">How to Apply</p>
                    <p className="text-xs text-muted-foreground">{scheme.howToApply}</p>
                  </div>
                  {!scheme.applied && (
                    <Button className="w-full h-8 text-xs gap-1">
                      <ExternalLink className="w-3 h-3" /> Apply / Learn More
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
