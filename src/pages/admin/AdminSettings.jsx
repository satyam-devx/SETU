import React, { useState } from 'react';
import { Bell, Shield, Sliders, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

export default function AdminSettings() {
  const [saved, setSaved] = useState(false);
  const [alerts, setAlerts] = useState({ newVendor: true, fraudFlag: true, codOverdue: false });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="pb-6">
      <AppHeader title="Settings" subtitle="Admin configuration" />
      <div className="p-4 space-y-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Platform Limits
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Max COD balance per rider (₹)</Label>
              <Input type="number" defaultValue="1000" className="w-36" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Max credit limit per customer (₹)</Label>
              <Input type="number" defaultValue="500" className="w-36" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Vendor approval timeout (hours)</Label>
              <Input type="number" defaultValue="48" className="w-36" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Alert Settings
          </h3>
          <div className="space-y-3">
            {[
              { key: 'newVendor', label: 'New vendor registration', desc: 'Alert on new vendor sign-ups' },
              { key: 'fraudFlag', label: 'Fraud flag raised', desc: 'Alert when a fraud report is filed' },
              { key: 'codOverdue', label: 'COD overdue alerts', desc: 'Rider COD not deposited in 24h' },
            ].map((item, i) => (
              <div key={item.key}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={alerts[item.key]}
                    onCheckedChange={v => setAlerts(a => ({ ...a, [item.key]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Security
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require 2FA for admins</p>
                <p className="text-xs text-muted-foreground">Two-factor authentication for all admin logins</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-suspend on fraud</p>
                <p className="text-xs text-muted-foreground">Auto-suspend accounts with 3+ fraud flags</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Button className="w-full" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
