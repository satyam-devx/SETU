import React, { useState } from 'react';
import { Clock, MapPin, Bell, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

const timeSlots = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM'];

export default function VendorSettings() {
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyPayment, setNotifyPayment] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="pb-24">
      <AppHeader title="Settings" showBack />
      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Store Hours
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Opens at</Label>
              <Select defaultValue="8:00 AM">
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Closes at</Label>
              <Select defaultValue="9:00 PM">
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Closed days</p>
            <div className="flex flex-wrap gap-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <button key={d} className={`text-xs px-3 py-1 rounded-lg border transition-colors ${d === 'Sun' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Settings
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Delivery radius (km)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" defaultValue="3" className="w-24" min={1} max={10} />
                <span className="text-xs text-muted-foreground">km from store</span>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Min order value (₹)</Label>
              <Input type="number" defaultValue="100" className="w-24" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Avg prep time (min)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" defaultValue="15" className="w-24" />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Order Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-accept orders</p>
                <p className="text-xs text-muted-foreground">Orders auto-confirmed without manual review</p>
              </div>
              <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Accept UPI payments</p>
                <p className="text-xs text-muted-foreground">Allow customers to pay via UPI</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Accept COD orders</p>
                <p className="text-xs text-muted-foreground">Cash on delivery orders</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notifications
          </h3>
          <div className="space-y-3">
            {[
              { label: 'New order received', desc: 'Alert when a new order comes in', val: notifyNewOrder, set: setNotifyNewOrder },
              { label: 'Low stock alert', desc: 'When product stock falls below 5', val: notifyLowStock, set: setNotifyLowStock },
              { label: 'Payment received', desc: 'UPI payment confirmation alerts', val: notifyPayment, set: setNotifyPayment },
            ].map((item, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.val} onCheckedChange={item.set} />
                </div>
              </div>
            ))}
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
