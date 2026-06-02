import React, { useState } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppHeader from '@/components/shared/AppHeader';

const initialAddresses = [
  { id: 'a1', label: 'Home', address: 'House No. 12, Ward 3, Madhepur', landmark: 'Near Shiv Temple', isDefault: true },
  { id: 'a2', label: 'Farm', address: 'Field Road, Near Pump, Laxmipur', landmark: '', isDefault: false },
];

export default function CustomerAddresses() {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [showAdd, setShowAdd] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home', address: '', landmark: '' });

  const handleAdd = () => {
    if (!newAddr.address.trim()) return;
    setAddresses(prev => [...prev, { ...newAddr, id: `a${Date.now()}`, isDefault: false }]);
    setNewAddr({ label: 'Home', address: '', landmark: '' });
    setShowAdd(false);
  };

  const handleDelete = (id) => setAddresses(prev => prev.filter(a => a.id !== id));
  const handleSetDefault = (id) => setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));

  return (
    <div className="pb-6">
      <AppHeader title="My Addresses" showBack />
      <div className="px-4 py-4 space-y-3">
        {addresses.map(addr => (
          <Card key={addr.id} className={`p-4 border ${addr.isDefault ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{addr.label}</p>
                  {addr.isDefault && <Badge className="text-[9px] bg-primary/10 text-primary border-0">Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{addr.address}</p>
                {addr.landmark && <p className="text-[10px] text-muted-foreground">Near: {addr.landmark}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(addr.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </div>
            {!addr.isDefault && (
              <Button variant="outline" size="sm" className="mt-2 text-xs w-full h-7 gap-1" onClick={() => handleSetDefault(addr.id)}>
                <CheckCircle className="w-3 h-3" /> Set as Default
              </Button>
            )}
          </Card>
        ))}

        {showAdd ? (
          <Card className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-3">New Address</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                {['Home', 'Work', 'Farm', 'Other'].map(label => (
                  <button key={label} onClick={() => setNewAddr(a => ({ ...a, label }))} className={`text-xs px-3 py-1 rounded-full border transition-colors ${newAddr.label === label ? 'bg-primary text-white border-primary' : 'border-border'}`}>{label}</button>
                ))}
              </div>
              <div><Label className="text-xs mb-1 block">Full Address *</Label><Input placeholder="House no., street, area" value={newAddr.address} onChange={e => setNewAddr(a => ({ ...a, address: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">Landmark</Label><Input placeholder="e.g. Near temple" value={newAddr.landmark} onChange={e => setNewAddr(a => ({ ...a, landmark: e.target.value }))} /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAdd}>Save Address</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add New Address
          </Button>
        )}
      </div>
    </div>
  );
}
