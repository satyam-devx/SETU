import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, FileText, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppHeader from '@/components/shared/AppHeader';

const PENDING = [
  { id: 'pv1', name: 'New Electronics Hub',   category: 'Electronics',    village: 'Madhepur',   phone: '+91 98765 43230', appliedAt: '2025-05-30', docs: ['Aadhaar', 'Shop License'], gst: 'PENDING', experience: '3 years' },
  { id: 'pv2', name: 'Fresh Bakery House',     category: 'Sweets & Snacks',village: 'Laxmipur',   phone: '+91 98765 43231', appliedAt: '2025-05-31', docs: ['Aadhaar', 'PAN'],          gst: 'NA',      experience: '1 year'  },
  { id: 'pv3', name: 'Raju Mobile Repair',     category: 'Electronics',    village: 'Parsad',     phone: '+91 98765 43232', appliedAt: '2025-06-01', docs: ['Aadhaar'],                  gst: 'NA',      experience: '5 years' },
];

export default function AdminVendorApproval() {
  const [vendors, setVendors]   = useState(PENDING);
  const [expanded, setExpanded] = useState(null);
  const [note, setNote]         = useState('');
  const [acting, setActing]     = useState(null);

  const act = (id, action) => {
    setActing(id + action);
    setTimeout(() => {
      setVendors(vs => vs.filter(v => v.id !== id));
      setActing(null);
      setExpanded(null);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-auto">
      <AppHeader title="Vendor Approvals" subtitle={`${vendors.length} pending`} />
      <div className="p-4 space-y-3">

        {vendors.length === 0 ? (
          <Card className="p-8 border-border text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground">No pending vendor approvals</p>
          </Card>
        ) : (
          vendors.map(v => (
            <Card key={v.id} className="border-border overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.category} · {v.village}</p>
                    <p className="text-xs text-muted-foreground">{v.phone} · Applied {v.appliedAt}</p>
                  </div>
                  <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> Pending
                  </Badge>
                </div>

                {/* Doc badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {v.docs.map(doc => (
                    <Badge key={doc} variant="outline" className="text-[9px] flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {doc}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-[9px]">GST: {v.gst}</Badge>
                  <Badge variant="outline" className="text-[9px]">Exp: {v.experience}</Badge>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1"
                    disabled={acting === v.id + 'approve'}
                    onClick={() => act(v.id, 'approve')}>
                    <CheckCircle className="w-3 h-3" />
                    {acting === v.id + 'approve' ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 text-destructive border-destructive/30"
                    disabled={acting === v.id + 'reject'}
                    onClick={() => act(v.id, 'reject')}>
                    <XCircle className="w-3 h-3" />
                    {acting === v.id + 'reject' ? 'Rejecting...' : 'Reject'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                    onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {expanded === v.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium mb-1">Add note (optional)</p>
                    <Textarea
                      placeholder="Reason for approval/rejection..."
                      className="h-16 text-xs mb-2"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Category: <span className="font-medium text-foreground">{v.category}</span></div>
                      <div>Village: <span className="font-medium text-foreground">{v.village}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
