import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Bike, IndianRupee, Phone, MapPin, Edit2,
  Shield, TrendingUp, ChevronRight, CheckCircle, Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { RiderAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function RiderProfile() {
  const { user } = useAuth();

  const [rider,    setRider]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [phone,    setPhone]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saveErr,  setSaveErr]  = useState(null);

  // ── Load real rider row ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    RiderAPI.getProfile(user.id).then(({ data, error }) => {
      if (error) console.warn('[RiderProfile] load error:', error.message);
      if (data) {
        setRider(data);
        setPhone(data.phone ?? '');
      }
      setLoading(false);
    });
  }, [user?.id]);

  // ── Save phone ───────────────────────────────────────────
  const handleSave = async () => {
    if (!rider?.id) return;
    setSaving(true);
    setSaveErr(null);

    const { error } = await supabase
      .from('riders')
      .update({ phone })
      .eq('id', rider.id);

    if (error) {
      setSaveErr('Could not save. Try again.');
    } else {
      setRider(r => ({ ...r, phone }));
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="pb-20">
        <AppHeader title="My Profile" />
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!rider) {
    return (
      <div className="pb-20">
        <AppHeader title="My Profile" />
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          Profile not found. Please contact support.
        </div>
      </div>
    );
  }

  const initials = (rider.name ?? 'R')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const memberSince = rider.created_at
    ? new Date(rider.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';

  const verifications = [
    { label: 'Aadhaar',          done: !!rider.aadhaar_verified   },
    { label: 'Driving License',  done: !!rider.dl_verified        },
    { label: 'Vehicle RC',       done: !!rider.rc_verified        },
    { label: 'Background Check', done: !!rider.bg_check_done      },
    { label: 'Training',         done: (rider.rating ?? 0) >= 4.5 },
  ];

  return (
    <div className="pb-20">
      <AppHeader title="My Profile" />
      <div className="px-4 py-4 space-y-4">

        {/* Profile hero */}
        <Card className="p-5 border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-2xl font-bold text-primary">
                {initials}
              </div>
              {rider.is_online && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{rider.name ?? '—'}</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{rider.zone ?? 'Unassigned'}</span>
              </div>
              {saved    && <p className="text-xs text-green-600 mt-0.5">✓ Saved</p>}
              {saveErr  && <p className="text-xs text-destructive mt-0.5">{saveErr}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(s => !s)}>
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          {editing ? (
            <div className="flex gap-2 mb-4">
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 h-8 text-sm"
                placeholder="Phone number"
              />
              <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Phone className="w-3.5 h-3.5" />
              <span>{phone || '—'}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold">{rider.total_deliveries ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Deliveries</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <div className="flex items-center justify-center gap-0.5">
                <p className="text-lg font-bold">{(rider.rating ?? 0).toFixed(1)}</p>
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">Rating</p>
            </div>
            <div className="p-2 bg-muted/40 rounded-xl">
              <p className="text-lg font-bold text-primary">
                ₹{((rider.total_earnings ?? 0) / 1000).toFixed(0)}k
              </p>
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
              { label: 'Vehicle Type',   value: rider.vehicle_type   ?? '—' },
              { label: 'Vehicle Number', value: rider.vehicle_number ?? '—' },
              { label: 'Zone',           value: rider.zone           ?? '—' },
              { label: 'Member Since',   value: memberSince               },
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
          {verifications.map(item => (
            <div key={item.label} className="flex items-center gap-2 py-1.5">
              <CheckCircle className={`w-4 h-4 shrink-0 ${item.done ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">{item.label}</span>
              {!item.done && (
                <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 ml-auto">Pending</Badge>
              )}
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
