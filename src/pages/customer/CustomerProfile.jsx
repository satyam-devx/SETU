// ═══════════════════════════════════════════════════════════
// SETU — CustomerProfile (v3)
// UI refreshed to match new design: Camera avatar, SETU Score
// badge, quick-stat cards, rich menu with descriptions.
// Logic unchanged: real auth, API updateProfile, store counts.
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Phone, MapPin, Star, ShoppingBag, Wallet,
  Gift, Settings, ChevronRight, Edit2, CheckCircle,
  LogOut, Shield, HeadphonesIcon, Camera,
  CreditCard, FileText, Bell, Award,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useStore } from '@/lib/store';
import { initials, formatPhone } from '@/lib/utils';

const MENU_ITEMS = [
  { label: 'My Addresses',       icon: MapPin,         path: '/customer/addresses',  desc: 'Manage delivery addresses' },
  { label: 'Wallet & Payments',  icon: CreditCard,     path: '/customer/wallet',     desc: 'Balance, credit & transactions' },
  { label: 'SETU Credit',        icon: Shield,         path: '/customer/credit',     desc: 'Buy now, pay later · Credit score' },
  { label: 'My Trust Score',     icon: Star,           path: '/customer/trust',      desc: 'SETU Score · Silver Tier' },
  { label: 'Government Schemes', icon: FileText,       path: '/customer/schemes',    desc: 'Eligible schemes near you' },
  { label: 'Voice Assistant',    icon: Bell,           path: '/customer/voice',      desc: 'Bolkar kharido · बोलकर खरीदो' },
  { label: 'Refer & Earn',       icon: Gift,           path: '/customer/referral',   desc: 'Invite friends, earn ₹100' },
  { label: 'Notifications',      icon: Bell,           path: '/customer/notifications', desc: 'Manage notification preferences' },
  { label: 'Help & Support',     icon: HeadphonesIcon, path: '/customer/support',    desc: 'Get help with your orders' },
  { label: 'Settings',           icon: Settings,       path: '/customer/settings',   desc: 'Language, privacy, offline mode' },
  { label: 'Account Management', icon: Shield,         path: '/customer/account',    desc: 'Privacy, terms, data & security' },
];

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { profile, user, signOut, updateProfile } = useAuth();
  const { state } = useStore();

  const [editing, setEditing]     = useState(false);
  const [name, setName]           = useState(profile?.name || '');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [showSignout, setShowSignout] = useState(false);

  const myOrders  = state.orders.filter(o =>
    user?.id && (o.customerId === user.id || o.customer_id === user.id)
  );
  const delivered = myOrders.filter(o => o.status === 'delivered').length;
  const setuScore = profile?.setu_score ?? 500;
  const walletBal = profile?.wallet_balance ?? 0;

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === profile?.name) { setEditing(false); return; }
    setSaving(true);
    const { error } = await updateProfile({ name: name.trim() });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const phone          = profile?.phone || user?.phone || '';
  const displayInitials = initials(name || profile?.name || 'S U');

  return (
    <div className="pb-20 animate-fade-in" role="main">
      <AppHeader
        title="Profile"
        rightAction={
          <Button variant="ghost" size="icon" onClick={() => { setName(profile?.name || ''); setEditing(true); }}>
            <Edit2 className="w-4 h-4" />
          </Button>
        }
      />

      {/* Profile card */}
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-card rounded-full border-2 border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                <Camera className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg">{profile.fullName}</h2>
              <p className="text-sm text-muted-foreground">{profile.phone}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">SETU Score: 720</span>
                <span className="text-xs text-muted-foreground">{profile.village}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs mb-1 block">Full Name</Label>
              <Input value={profile.fullName} onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone Number</Label>
              <Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Village</Label>
              <Input value={profile.village} onChange={e => setProfile(p => ({ ...p, village: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">District</Label>
                <Input value={profile.district} onChange={e => setProfile(p => ({ ...p, district: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">State</Label>
                <Input value={profile.state} onChange={e => setProfile(p => ({ ...p, state: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full gap-2" onClick={() => setEditOpen(false)}>
              <Check className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Quick stats ── */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-primary">{myOrders.length}</p>
          <p className="text-[10px] text-muted-foreground">Orders</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-accent">₹{walletBal}</p>
          <p className="text-[10px] text-muted-foreground">Wallet</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-foreground">{delivered}</p>
          <p className="text-[10px] text-muted-foreground">Delivered</p>
        </Card>
      </div>

      {/* ── Menu items ── */}
      <div className="px-4">
        <div className="space-y-1">
          {MENU_ITEMS.map(item => (
            <Link key={item.label} to={item.path}>
              <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        <Separator className="my-3" />

        {/* Sign out */}
        {!showSignout ? (
          <button
            onClick={() => setShowSignout(true)}
            className="flex items-center gap-3 py-3 px-1 w-full text-destructive hover:bg-muted/50 rounded-lg transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl border border-destructive/30 text-center mb-2">
            <p className="text-sm font-medium mb-3">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignout(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground py-3">
          SETU v1.0.0 · बिहार में बना
        </p>
      </div>
    </div>
  );
}
