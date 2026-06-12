// ═══════════════════════════════════════════════════════════
// SETU — CustomerProfile (v3)
// UI refreshed: Camera avatar, SETU Score badge, quick-stat
// cards, rich menu with descriptions.
// Logic unchanged: real auth, API updateProfile, store counts.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Star, Gift, Settings, ChevronRight, Edit2,
  CheckCircle, LogOut, Shield, HeadphonesIcon, Camera,
  CreditCard, FileText, Bell, Loader2, AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useStore } from '@/lib/store';
import { getVillages } from '@/lib/api';
import { initials, formatPhone } from '@/lib/utils';

const MENU_ITEMS = [
  { label: 'My Addresses',       icon: MapPin,         path: '/customer/addresses',     desc: 'Manage delivery addresses' },
  { label: 'Wallet & Payments',  icon: CreditCard,     path: '/customer/wallet',        desc: 'Balance, credit & transactions' },
  { label: 'SETU Credit',        icon: Shield,         path: '/customer/credit',        desc: 'Buy now, pay later · Credit score' },
  { label: 'My Trust Score',     icon: Star,           path: '/customer/trust',         desc: 'SETU Score · Silver Tier' },
  { label: 'Government Schemes', icon: FileText,       path: '/customer/schemes',       desc: 'Eligible schemes near you' },
  { label: 'Voice Assistant',    icon: Bell,           path: '/customer/voice',         desc: 'Bolkar kharido · बोलकर खरीदो' },
  { label: 'Refer & Earn',       icon: Gift,           path: '/customer/referral',      desc: 'Invite friends, earn ₹100' },
  { label: 'Notifications',      icon: Bell,           path: '/customer/notifications', desc: 'Manage notification preferences' },
  { label: 'Help & Support',     icon: HeadphonesIcon, path: '/customer/support',       desc: 'Get help with your orders' },
  { label: 'Settings',           icon: Settings,       path: '/customer/settings',      desc: 'Language, privacy, offline mode' },
  { label: 'Account Management', icon: Shield,         path: '/customer/account',       desc: 'Privacy, terms, data & security' },
];

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { profile, user, signOut, updateProfile } = useAuth();
  const { state } = useStore();

  const [showSignout, setShowSignout] = useState(false);

  // ── Edit Profile modal ──────────────────────────────────
  const [editOpen, setEditOpen]   = useState(false);
  const [form, setForm]           = useState({ name: '', villageId: '' });
  const [villages, setVillages]   = useState([]);
  const [vilLoading, setVilLoading] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState(null);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    getVillages({ activeOnly: true }).then(({ data }) => {
      if (data) setVillages(data);
      setVilLoading(false);
    });
  }, []);

  const myOrders  = state.orders.filter(o =>
    user?.id && (o.customerId === user.id || o.customer_id === user.id)
  );
  const delivered = myOrders.filter(o => o.status === 'delivered').length;
  const setuScore = profile?.setu_score ?? 500;
  const walletBal = profile?.wallet_balance ?? 0;

  const phone = profile?.phone || user?.phone || '';
  const selectedVillage = villages.find(v => v.id === form.villageId)
    || villages.find(v => v.id === profile?.village_id);

  const openEdit = () => {
    setForm({ name: profile?.name || '', villageId: profile?.village_id || '' });
    setFormError(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!form.name.trim()) {
      setFormError('Full name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    const { error } = await updateProfile({
      name: form.name.trim(),
      village_id: form.villageId || null,
    });
    setSaving(false);
    if (error) {
      setFormError(error.message || 'Could not save changes');
      return;
    }
    setEditOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const displayInitials = initials(profile?.name || 'S U');

  return (
    <div className="pb-20 animate-fade-in" role="main">
      <AppHeader
        title="Profile"
        rightAction={
          <Button variant="ghost" size="icon" onClick={openEdit} aria-label="Edit profile">
            <Edit2 className="w-4 h-4" />
          </Button>
        }
      />

      {/* ── Profile card ── */}
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            {/* Avatar with camera button */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {displayInitials}
              </div>
              <button
                onClick={openEdit}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-card rounded-full border-2 border-border flex items-center justify-center cursor-pointer hover:bg-muted"
                aria-label="Edit profile"
                type="button"
              >
                <Camera className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>

            {/* Name + details */}
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg leading-tight">{profile?.name || 'SETU User'}</h2>

              {phone && (
                <p className="text-sm text-muted-foreground mt-0.5">{formatPhone(phone)}</p>
              )}

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  SETU Score: {setuScore}
                </span>
                {selectedVillage && (
                  <span className="text-xs text-muted-foreground">
                    {selectedVillage.name}, {selectedVillage.district}
                  </span>
                )}
              </div>
            </div>
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-xs mt-3" role="status">
              <CheckCircle className="w-3.5 h-3.5" /> Profile updated successfully
            </div>
          )}

          {profile?.is_verified && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-green-600 font-medium">
              <Shield className="w-3.5 h-3.5" /> Verified SETU Member
            </div>
          )}
        </Card>
      </div>

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

      {/* ── Edit Profile modal ── */}
      <Dialog open={editOpen} onOpenChange={(open) => !saving && setEditOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1 block">Full Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={60}
                placeholder="Your full name"
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Phone Number</Label>
              <Input value={phone ? formatPhone(phone) : 'Not set'} disabled />
              <Link
                to="/customer/account"
                className="text-xs text-primary font-medium mt-1 inline-block"
                onClick={() => setEditOpen(false)}
              >
                Change phone number
              </Link>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Village</Label>
              {vilLoading ? (
                <div className="h-10 flex items-center px-3 border border-border rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={form.villageId || undefined}
                  onValueChange={v => setForm(f => ({ ...f, villageId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your village" />
                  </SelectTrigger>
                  <SelectContent>
                    {villages.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedVillage && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">District</Label>
                  <Input value={selectedVillage.district} disabled />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">State</Label>
                  <Input value={selectedVillage.state} disabled />
                </div>
              </div>
            )}

            {formError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button className="w-full gap-2" onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
