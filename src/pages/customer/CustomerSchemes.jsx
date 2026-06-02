import React, { useState } from 'react';
import { Search, ChevronRight, CheckCircle, Clock, XCircle, ExternalLink, FileText, Mic } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AppHeader from '@/components/shared/AppHeader';

const schemes = [
  {
    id: 'sch1', name: 'PM Kisan Samman Nidhi', nameHindi: 'पीएम किसान सम्मान निधि',
    category: 'Farmer', benefit: '₹6,000/year', eligible: true, applied: true, status: 'active',
    desc: 'Annual income support of ₹6,000 in three equal installments of ₹2,000 for small and marginal farmers.',
    nextInstallment: '₹2,000 due June 2025', documents: ['Aadhaar', 'Land Record', 'Bank Account'],
    ministry: 'Ministry of Agriculture',
  },
  {
    id: 'sch2', name: 'Ayushman Bharat PM-JAY', nameHindi: 'आयुष्मान भारत',
    category: 'Health', benefit: '₹5 lakh/year health cover', eligible: true, applied: false, status: 'not_applied',
    desc: 'Free health insurance up to ₹5 lakh per family per year for secondary and tertiary care hospitalization.',
    documents: ['Aadhaar', 'Ration Card', 'Income Certificate'],
    ministry: 'Ministry of Health',
  },
  {
    id: 'sch3', name: 'PM Ujjwala Yojana', nameHindi: 'प्रधानमंत्री उज्ज्वला योजना',
    category: 'Women', benefit: 'Free LPG connection', eligible: false, applied: false, status: 'not_eligible',
    desc: 'Providing LPG connections to women from Below Poverty Line (BPL) households.',
    documents: ['BPL Card', 'Aadhaar', 'Bank Account'],
    ineligibleReason: 'You already have an LPG connection registered to this address.',
    ministry: 'Ministry of Petroleum',
  },
  {
    id: 'sch4', name: 'Kisan Credit Card', nameHindi: 'किसान क्रेडिट कार्ड',
    category: 'Farmer', benefit: 'Credit up to ₹3 lakh @ 4%', eligible: true, applied: false, status: 'not_applied',
    desc: 'Short-term credit for agricultural needs including crop cultivation, post-harvest expenses, and allied activities.',
    documents: ['Aadhaar', 'Land Record', 'Bank Statement'],
    ministry: 'Ministry of Finance',
  },
  {
    id: 'sch5', name: 'PM SVANidhi', nameHindi: 'पीएम स्वनिधि',
    category: 'Business', benefit: 'Working capital loan ₹10,000–₹50,000', eligible: true, applied: false, status: 'not_applied',
    desc: 'Collateral-free working capital loans for street vendors and small business owners.',
    documents: ['Aadhaar', 'Shop License/Certificate', 'Bank Account'],
    ministry: 'Ministry of Housing & Urban Affairs',
  },
  {
    id: 'sch6', name: 'PMEGP (Employment)', nameHindi: 'पीएमईजीपी',
    category: 'Business', benefit: '25-35% subsidy on new venture', eligible: true, applied: false, status: 'not_applied',
    desc: 'Credit-linked subsidy program for setting up new micro-enterprises in rural and urban areas.',
    documents: ['Aadhaar', 'Education Certificate', 'Project Report'],
    ministry: 'MSME Ministry',
  },
];

const CATEGORIES = ['All', 'Farmer', 'Health', 'Women', 'Business'];
const statusColors = { active: 'bg-green-100 text-green-800', not_applied: 'bg-blue-100 text-blue-800', not_eligible: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-800' };
const statusLabels = { active: '✓ Active', not_applied: 'Apply Now', not_eligible: 'Not Eligible', pending: 'Pending' };

export default function CustomerSchemes() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState(null);

  const filtered = schemes.filter(s =>
    (category === 'All' || s.category === category) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.nameHindi.includes(search))
  );

  return (
    <div className="pb-24">
      <AppHeader title="Government Schemes" subtitle="Find schemes you qualify for" showBack />

      <div className="px-4 py-3 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search schemes in Hindi or English..." className="pl-9 pr-10 bg-muted/50 border-0" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-primary"><Mic className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${category === c ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Eligibility summary */}
      <div className="px-4 mb-3">
        <Card className="p-3 border-border bg-accent/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-accent">🎯 You qualify for {schemes.filter(s => s.eligible).length} schemes</p>
              <p className="text-[10px] text-muted-foreground">{schemes.filter(s => s.eligible && !s.applied).length} not yet applied · Potential benefit: ₹{(6000 + 500000 + 300000).toLocaleString()}+</p>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7">Check All</Button>
          </div>
        </Card>
      </div>

      <div className="px-4 space-y-3">
        {filtered.map(scheme => (
          <Card key={scheme.id} className={`border ${scheme.status === 'active' ? 'border-accent/30' : scheme.status === 'not_eligible' ? 'border-border opacity-70' : 'border-border'}`}>
            <div className="p-4 cursor-pointer" onClick={() => setExpanded(expanded === scheme.id ? null : scheme.id)}>
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-semibold text-sm">{scheme.name}</h4>
                  <p className="text-xs text-muted-foreground">{scheme.nameHindi}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${statusColors[scheme.status]}`}>{statusLabels[scheme.status]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{scheme.category}</Badge>
                  <span className="text-xs font-bold text-primary">{scheme.benefit}</span>
                </div>
                <span className="text-xs text-muted-foreground">{scheme.ministry}</span>
              </div>
            </div>

            {expanded === scheme.id && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{scheme.desc}</p>
                {scheme.nextInstallment && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs text-green-800 font-medium">📅 Next: {scheme.nextInstallment}</p>
                  </div>
                )}
                {scheme.ineligibleReason && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-700">❌ {scheme.ineligibleReason}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium mb-2">Required Documents:</p>
                  <div className="flex flex-wrap gap-1">
                    {scheme.documents.map(doc => (
                      <Badge key={doc} variant="outline" className="text-[9px]"><FileText className="w-2.5 h-2.5 mr-1" />{doc}</Badge>
                    ))}
                  </div>
                </div>
                {scheme.eligible && scheme.status === 'not_applied' && (
                  <div className="flex gap-2">
                    <Button className="flex-1 text-xs h-9">Apply via SETU</Button>
                    <Button variant="outline" className="flex-1 text-xs h-9">
                      <ExternalLink className="w-3 h-3 mr-1" /> Official Portal
                    </Button>
                  </div>
                )}
                {scheme.status === 'active' && (
                  <Button variant="outline" className="w-full text-xs h-9">
                    <CheckCircle className="w-3 h-3 mr-1 text-accent" /> View Benefit Status
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
