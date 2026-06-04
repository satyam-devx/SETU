import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Bike, IndianRupee, Phone, MapPin, Edit2, Shield, TrendingUp, ChevronRight, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { RIDERS } from '@/lib/mockData';

const rider = RIDERS[0];

export default function RiderProfile() {
  const [editing, setEditing]   = useState(false);
  const [phone, setPhone]       = useState(rider.phone);
  const [saved, setSaved]       = useState(false);

  const handleSave = () => { setSaved(true); setEditing(false); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="pb-20">
      <AppHeader title="My Profile" />
      <div className="px-4 py-4 space-y-4">

        {/* Profile hero */}
        <Card className="p-5 border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {rider.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{rider.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /><span>{rider.zone}</span>
              </div>
              {saved && <p className="text-xs text-green-600 mt-0.5">✓ Saved</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(s => !s)}>
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          {editing ? (
            <div className="flex gap-2 mb-4">
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="flex-1 h-8 text-sm" />
              <Button size="sm" className="h-8" onClick={handleSave}>Save</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Phone className="w-3.5 h-3.5" /><span>{phone}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold">{rider.totalDeliveries}</p>
              <p className="text-[10px] text-muted-foreground">Deliveries</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <div className="flex items-center justify-center gap-0.5">
                <p className="text-lg font-bold">{rider.rating}</p>
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">Rating</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-primary">₹{(rider.totalEarnings/1000).toFixed(0)}k</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
          </div>
        </Card>

        {/* Vehicle info */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Bike className="w-4 h-4 text-primary" /> Vehicle Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Vehicle Type',   value: rider.vehicleType    },
              { label: 'Vehicle Number', value: rider.vehicleNumber || 'BR01-AB-1234' },
              { label: 'Zone',           value: rider.zone           },
              { label: 'Member Since',   value: 'Jan 2024'           },
            ].map(row => (
              <div key={row.label}>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="font-medium">{row.value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Verification status */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Verification
          </h3>
          {[
            { label: 'Aadhaar',          done: true  },
            { label: 'Driving License',  done: true  },
            { label: 'Vehicle RC',       done: true  },
            { label: 'Background Check', done: true  },
            { label: 'Training',         done: rider.rating >= 4.5 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 py-1.5">
              <CheckCircle className={`w-4 h-4 shrink-0 ${item.done ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">{item.label}</span>
              {!item.done && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 ml-auto">Pending</Badge>}
            </div>
          ))}
        </Card>

        {/* Quick links */}
        <Card className="border-border divide-y divide-border">
          {[
            { label: 'Earnings & Payouts', path: '/rider/earnings',   icon: IndianRupee },
            { label: 'Incentives',         path: '/rider/incentives', icon: TrendingUp  },
            { label: 'Safety Center',      path: '/rider/safety',     icon: Shield      },
            { label: 'Settings',           path: '/rider/settings',   icon: Edit2       },
          ].map(item => (
            <Link key={item.path} to={item.path}>
              <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
