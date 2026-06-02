import React, { useState } from 'react';
import { Sliders, Percent, Clock, Globe, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

export default function SuperAdminConfig() {
  const [saved, setSaved] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [newRegistrations, setNewRegistrations] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="pb-6">
      <AppHeader title="Platform Config" subtitle="Global settings" />
      <div className="p-4 space-y-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> Fee Configuration
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Platform commission (%)</Label>
              <Input type="number" defaultValue="8" className="w-28" min={0} max={30} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Rider earning per delivery (₹)</Label>
              <Input type="number" defaultValue="25" className="w-28" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Seva provider platform fee (%)</Label>
              <Input type="number" defaultValue="10" className="w-28" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Default customer credit limit (₹)</Label>
              <Input type="number" defaultValue="500" className="w-28" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Operational Limits
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Max COD balance per rider (₹)</Label>
              <Input type="number" defaultValue="1000" className="w-28" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Order cancellation window (min)</Label>
              <Input type="number" defaultValue="10" className="w-28" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Vendor approval SLA (hours)</Label>
              <Input type="number" defaultValue="48" className="w-28" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Platform Controls
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Disable all user-facing features</p>
              </div>
              <Switch checked={maintenance} onCheckedChange={setMaintenance} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">New Registrations</p>
                <p className="text-xs text-muted-foreground">Allow new vendors/riders to register</p>
              </div>
              <Switch checked={newRegistrations} onCheckedChange={setNewRegistrations} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Voice Orders</p>
                <p className="text-xs text-muted-foreground">Enable voice-based ordering for customers</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        {maintenance && (
          <Card className="p-3 border-amber-300 bg-amber-50/60">
            <p className="text-sm font-semibold text-amber-800">⚠️ Maintenance mode is ON</p>
            <p className="text-xs text-amber-700 mt-0.5">All customer-facing features are currently disabled.</p>
          </Card>
        )}

        <Button className="w-full" onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          {saved ? 'Saved!' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
