import React from 'react';
import { Shield, Download, Eye, Trash2, Lock, Activity, Smartphone, MapPin, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

export default function CustomerDataPrivacy() {
  return (
    <div className="pb-20">
      <AppHeader title="Data & Privacy" subtitle="DPDP Act 2023 Compliant" showBack />

      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border bg-primary/5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Your Data is Protected</h3>
              <p className="text-xs text-muted-foreground mt-1">
                SETU follows the Digital Personal Data Protection Act 2023 guidelines. Your data is encrypted
                and stored securely on servers in India.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Data We Collect
          </h3>
          <div className="space-y-3 text-sm">
            {[
              { icon: MapPin,     label: 'Location',     desc: 'Your village and delivery address',    shared: true  },
              { icon: Smartphone, label: 'Phone Number', desc: 'For order updates and OTP verification', shared: false },
              { icon: Eye,        label: 'Order History', desc: 'Past orders for recommendations',      shared: true  },
              { icon: Download,   label: 'Payment Info', desc: 'UPI ID / wallet transactions',          shared: false },
            ].map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex items-start gap-2">
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {item.shared ? 'Shared with vendor' : 'Private'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Privacy Controls
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm">Personalised recommendations</span>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm">Share profile with vendors</span>
              <Switch />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm">Location-based services</span>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Your Rights</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start text-sm gap-3">
              <Download className="w-4 h-4 text-muted-foreground" /> Download My Data
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm gap-3">
              <Trash2 className="w-4 h-4 text-destructive" /> Request Data Deletion
            </Button>
          </div>
        </Card>

        <Card className="p-4 border-border border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-destructive">Account Deletion</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Deleting your account will permanently remove all your data including order history, wallet
                balance, and SETU Credits. This action cannot be undone.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
