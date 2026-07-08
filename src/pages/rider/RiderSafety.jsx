import React, { useState } from 'react';
import { Shield, Phone, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import { usePublicSettings } from '@/lib/settings';

export default function RiderSafety() {
  const [sosActive, setSosActive] = useState(false);
  const { get: getSetting } = usePublicSettings();
  // Was hardcoded as the placeholder '1800-XXX-XXXX' — a rider in a real
  // emergency must never be shown a fake number next to real Police/
  // Ambulance numbers. Now reads the real, admin-configurable value from
  // app_settings (support_phone) via get_public_settings(); falls back to
  // null (hides the Call button) rather than a fake number if unset.
  const supportPhone = getSetting('support_phone', null);

  return (
    <div className="pb-6">
      <AppHeader title="Safety Center" showBack />
      <div className="px-4 py-4 space-y-4">
        <Card className={`p-6 border-2 text-center ${sosActive ? 'border-red-500 bg-red-50' : 'border-border'}`}>
          <Shield className={`w-12 h-12 mx-auto mb-3 ${sosActive ? 'text-red-500' : 'text-primary'}`} />
          <h2 className="font-bold text-lg mb-1">{sosActive ? 'SOS Active!' : 'Emergency SOS'}</h2>
          <p className="text-xs text-muted-foreground mb-4">{sosActive ? 'Help is on the way. Stay calm.' : 'Press to send emergency alert'}</p>
          <Button
            variant={sosActive ? 'destructive' : 'default'}
            size="lg"
            className="w-full"
            onClick={() => setSosActive(s => !s)}
          >
            {sosActive ? 'Cancel SOS' : 'Activate SOS'}
          </Button>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Emergency Contacts</h3>
          <div className="space-y-2">
            {[
              { name: 'SETU Support', number: supportPhone, type: 'Platform' },
              { name: 'Police', number: '100', type: 'Emergency' },
              { name: 'Ambulance', number: '108', type: 'Medical' },
            ].map(c => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.number || 'Not configured'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{c.type}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!c.number}
                    onClick={() => c.number && (window.location.href = `tel:${c.number}`)}
                  >
                    Call
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Safety Checklist</h3>
          <div className="space-y-2">
            {['Helmet worn', 'Vehicle insured', 'Phone charged', 'Route shared with family'].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
