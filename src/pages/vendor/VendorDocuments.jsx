import React from 'react';
import { FileText, CheckCircle, XCircle, Clock, Upload, Building2, CreditCard, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

const documents = [
  { id: 'd1', name: 'Aadhaar Card', icon: FileText, status: 'verified', number: 'XXXX-XXXX-1234', uploaded: 'Jan 15, 2026' },
  { id: 'd2', name: 'PAN Card', icon: FileText, status: 'verified', number: 'ABCDE1234F', uploaded: 'Jan 15, 2026' },
  { id: 'd3', name: 'FSSAI License', icon: Receipt, status: 'verified', number: '12345678901234', expiry: 'Dec 2027' },
  { id: 'd4', name: 'GST Certificate', icon: Building2, status: 'pending', number: '—', uploaded: '—' },
  { id: 'd5', name: 'Bank Account Proof', icon: CreditCard, status: 'verified', number: 'HDFC ****4521', uploaded: 'Jan 16, 2026' },
  { id: 'd6', name: 'Shop Photo (Front)', icon: FileText, status: 'verified', number: '3 photos', uploaded: 'Jan 15, 2026' },
  { id: 'd7', name: 'Trade License', icon: Receipt, status: 'expired', number: 'TL-2024-0456', expiry: 'Mar 2026' },
];

const statusConfig = {
  verified: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Verified' },
  pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pending' },
  expired: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Expired' },
};

export default function VendorDocuments() {
  const verifiedCount = documents.filter(d => d.status === 'verified').length;

  return (
    <div className="pb-20">
      <AppHeader title="Business Documents" subtitle="KYC & compliance records" />
      <div className="p-4 space-y-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Verification Status</p>
              <p className="text-lg font-bold">{verifiedCount} / {documents.length} verified</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(verifiedCount / documents.length) * 100}%` }} />
          </div>
        </Card>

        <div className="space-y-2">
          {documents.map(doc => {
            const cfg = statusConfig[doc.status];
            return (
              <Card key={doc.id} className="p-4 border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <doc.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.number}</p>
                      {doc.expiry && <p className={`text-[10px] ${doc.status === 'expired' ? 'text-red-500' : 'text-muted-foreground'}`}>Expires: {doc.expiry}</p>}
                      {doc.status !== 'pending' && <p className="text-[10px] text-muted-foreground">Uploaded: {doc.uploaded}</p>}
                    </div>
                  </div>
                  <Badge className={`text-[9px] ${cfg.bg} ${cfg.color} border-0 shrink-0`}>{cfg.label}</Badge>
                </div>
                {(doc.status === 'pending' || doc.status === 'expired') && (
                  <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-xs">
                    <Upload className="w-3 h-3 mr-1" /> {doc.status === 'expired' ? 'Renew Document' : 'Upload Document'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="p-4 border-border bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800"><strong>Need help?</strong> Contact your block anchor or SETU support to assist with document verification. Expired documents may affect your store visibility.</p>
        </Card>
      </div>
    </div>
  );
}
