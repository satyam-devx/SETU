import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, Clock, Store, MapPin, Star, FileText, Phone, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import StatCard from '@/components/shared/StatCard';

const pendingVendors = [
  {
    id: 'pv1', name: 'Sunita Vegetable Mart', owner: 'Sunita Kumari', phone: '+91 98765 43210',
    category: 'Fresh Vegetables', village: 'Laxmipur', anchor: 'Ramkali Devi', anchorVouched: true,
    aadhaarVerified: true, selfieVerified: true, shopPhotos: 3, productsAdded: 7, bankVerified: true,
    applied: '2025-05-31T08:00:00', experience: '3 years market vendor',
    riskScore: 'low', subscriptionPlan: 'free',
    documents: ['Aadhaar ✓', 'Selfie ✓', 'Shop Front ✓', 'Inside Photo ✓'],
  },
  {
    id: 'pv2', name: 'Mohan Mobile Repairs', owner: 'Mohan Kumar', phone: '+91 98765 43211',
    category: 'Electronics', village: 'Madhepur', anchor: 'Ramkali Devi', anchorVouched: false,
    aadhaarVerified: true, selfieVerified: false, shopPhotos: 1, productsAdded: 2, bankVerified: false,
    applied: '2025-05-30T15:00:00', experience: '1 year',
    riskScore: 'medium', subscriptionPlan: 'free',
    documents: ['Aadhaar ✓', 'Selfie ✗ (pending)', 'Shop Front ✓', 'Bank ✗'],
  },
  {
    id: 'pv3', name: 'Shiv Ration Depot', owner: 'Shiv Prasad', phone: '+91 98765 43212',
    category: 'Grocery & Essentials', village: 'Parsad', anchor: 'Geeta Devi', anchorVouched: true,
    aadhaarVerified: true, selfieVerified: true, shopPhotos: 4, productsAdded: 15, bankVerified: true,
    applied: '2025-05-29T10:00:00', experience: '12 years PDS dealer',
    riskScore: 'low', subscriptionPlan: 'pro',
    documents: ['Aadhaar ✓', 'Selfie ✓', 'Shop Front ✓', 'PDS License ✓', 'Bank ✓'],
  },
];

const riskColors = { low: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', high: 'bg-red-100 text-red-800' };

function VendorCard({ vendor }) {
  const [expanded, setExpanded] = useState(true);
  const [notes, setNotes] = useState('');
  const readiness = [vendor.aadhaarVerified, vendor.selfieVerified, vendor.shopPhotos >= 2, vendor.productsAdded >= 5, vendor.bankVerified, vendor.anchorVouched].filter(Boolean).length;

  return (
    <Card className="border-border">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{vendor.name}</h4>
            <p className="text-xs text-muted-foreground">{vendor.owner} · {vendor.phone}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {vendor.village} · {vendor.category}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className={`text-[9px] ${riskColors[vendor.riskScore]}`}>Risk: {vendor.riskScore}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1" />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={(readiness / 6) * 100} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground shrink-0">{readiness}/6 checks</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium mb-2">KYC & Compliance</p>
              <div className="space-y-1">
                {[
                  { label: 'Aadhaar Verified', done: vendor.aadhaarVerified },
                  { label: 'Selfie Matched', done: vendor.selfieVerified },
                  { label: 'Bank Account', done: vendor.bankVerified },
                  { label: 'Anchor Vouched', done: vendor.anchorVouched },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    {item.done ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className={item.done ? '' : 'text-muted-foreground'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2">Store Readiness</p>
              <div className="space-y-1">
                {[
                  { label: `${vendor.shopPhotos} shop photos`, done: vendor.shopPhotos >= 2 },
                  { label: `${vendor.productsAdded} products added`, done: vendor.productsAdded >= 5 },
                  { label: `${vendor.experience}`, done: true },
                  { label: vendor.subscriptionPlan === 'pro' ? '✓ Pro subscriber' : 'Free plan', done: vendor.subscriptionPlan === 'pro' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.done ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                    <span className={!item.done ? 'text-amber-700' : ''}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!vendor.anchorVouched && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">⚠️ Anchor has not yet vouched for this vendor. Consider contacting {vendor.anchor} before approving.</p>
            </div>
          )}

          <Textarea placeholder="Admin notes (optional — visible in vendor profile)" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="text-xs" />

          <div className="flex gap-2">
            <Button className="flex-1 bg-accent hover:bg-accent/90 text-xs h-9">
              <CheckCircle className="w-3 h-3 mr-1" /> Approve & Activate
            </Button>
            <Button variant="outline" className="flex-1 text-xs h-9 text-destructive border-destructive/30">
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
            <Button variant="outline" className="h-9 w-9 shrink-0">
              <Phone className="w-3 h-3" />
            </Button>
          </div>
          <Button variant="outline" className="w-full text-xs h-8">Request Additional Documents</Button>
        </div>
      )}
    </Card>
  );
}

export default function AdminVendorApproval() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading">Vendor Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and approve vendor applications for Madhepur Block</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard title="Pending Review" value={pendingVendors.length.toString()} icon={Clock} />
        <StatCard title="Approved Today" value="3" icon={CheckCircle} />
        <StatCard title="Rejected This Week" value="2" icon={XCircle} />
      </div>

      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-xs text-blue-800"><Shield className="w-3 h-3 inline mr-1" /><strong>Approval checklist:</strong> All 6 checks must pass. Anchor vouching is strongly recommended. If fraud risk is medium/high, request additional verification before approving.</p>
      </div>

      <div className="space-y-4">
        {pendingVendors.map(v => <VendorCard key={v.id} vendor={v} />)}
      </div>
    </div>
  );
}
