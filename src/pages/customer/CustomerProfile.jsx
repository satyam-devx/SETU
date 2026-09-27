// ═══════════════════════════════════════════════════════════
// SETU — CustomerProfile (v3)
// UI refreshed: Camera avatar, SETU Score badge, quick-stat
// cards, rich menu with descriptions, Dark Mode toggle in header.
// Logic unchanged: real auth, API updateProfile, store counts.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Star, Gift, Settings, ChevronRight, Edit2,
  CheckCircle, LogOut, Shield, HeadphonesIcon,
  CreditCard, FileText, Loader2, AlertCircle,
  Moon, Sun,
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
import { useCustomerOrders } from '@/hooks/queries/useOrders';
import { getVillages } from '@/lib/api';
import { initials, formatPhone } from '@/lib/utils';

const MENU_ITEMS = [
  { label: 'My Addresses',       icon: MapPin,         path: '/customer/addresses',     desc: 'Manage delivery addresses' },
  { label: 'Wallet & Payments',  icon: CreditCard,     path: '/customer/wallet',        desc: 'Balance, credit & transactions' },
  { label: 'SETU Credit',        icon: Shield,         path: '/customer/credit',        desc: 'Buy now, pay later · Credit score' },
  { label: 'My Trust Score',     icon: Star,           path: '/customer/trust',         desc: 'SETU Score · Silver Tier' },
  { label: 'Government Schemes', icon: FileText,       path: '/customer/schemes',       desc: 'Eligible schemes near you' },
  { label: 'Voice Assistant',    icon: Bell,           path: '/customer/voice',         desc: 'Bolkar kharido · बोलकर खरीदो' },
  { label: 'Refer & Earn',       icon: Gift,           path: '/customer/referral',      desc: 'Invite friends — coming soon' },
  { label: 'Help & Support',     icon: HeadphonesIcon, path: '/customer/support',       desc: 'Get help with your orders' },
  { label: 'Settings',           icon: Settings,       path: '/customer/settings',      desc: 'Language, privacy, offline mode' },
  { label: 'Account Management', icon: Shield,         path: '/customer/account',       desc: 'Privacy, terms, data & security' },
];

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { profile, user, signOut, updateProfile } = useAuth();
  const { data: orders = [] } = useCustomerOrders(user?.id, { limit: 100 });

  const [showSignout, setShowSignout] = useState(false);

  // ── Dark Mode State & Handler ─────────────────────────────
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

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

  const myOrders  = orders.filter(o =>
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
    if (saving) return;
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-500 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-muted-foreground transition-transform hover:-rotate-12" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={openEdit} aria-label="Edit profile">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* ── Premium profile hero ── */}
      <section className="px-4 pt-4 pb-3">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary via-primary to-orange-700 text-primary-foreground shadow-lg">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-16 -left-8 h-32 w-32 rounded-full bg-black/10" aria-hidden="true" />

          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-[72px] h-[72px] rounded-[22px] bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-inner">
                    {displayInitials}
                  </div>
                  {profile?.is_verified && (
                    <span className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full bg-white text-primary flex items-center justify-center border-2 border-primary shadow-sm" aria-label="Verified SETU member">
                      <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">SETU Member</p>
                  <h2 className="text-xl font-bold leading-tight truncate mt-0.5">{profile?.name || 'SETU User'}</h2>
                  {phone && <p className="text-xs text-white/75 mt-1">{formatPhone(phone)}</p>}
                </div>
              </div>

              <button
                onClick={openEdit}
                className="w-10 h-10 shrink-0 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
                aria-label="Edit profile"
                type="button"
              >
                <Edit2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-white/70">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Delivering to</span>
                </div>
                <p className="text-xs font-semibold mt-1 truncate">
                  {selectedVillage?.name || 'Choose village'}
                  {selectedVillage?.district ? `, ${selectedVillage.district}` : ''}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-white/70">
                  <Star className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">SETU Score</span>
                </div>
                <p className="text-xs font-semibold mt-1">{setuScore} <span className="font-normal text-white/60">· Silver</span></p>
              </div>
            </div>

            {saved && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/12 px-3 py-2 text-xs font-medium" role="status">
                <CheckCircle className="w-3.5 h-3.5" /> Profile updated successfully
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick stats ── */}
      <section className="px-4 mb-5" aria-label="Account overview">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3.5 border-border rounded-2xl shadow-sm">
            <p className="text-xl font-bold text-primary">{myOrders.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total orders</p>
          </Card>
          <Card className="p-3.5 border-border rounded-2xl shadow-sm">
            <p className="text-xl font-bold text-secondary">₹{walletBal}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Wallet balance</p>
          </Card>
          <Card className="p-3.5 border-border rounded-2xl shadow-sm">
            <p className="text-xl font-bold text-accent">{delivered}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Delivered</p>
          </Card>
        </div>
      </section>

      {/* ── Account menu ── */}
      <div className="px-4 space-y-5">
        <section aria-labelledby="account-title">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 id="account-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your account</h3>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border/70">
            {MENU_ITEMS.map(item => (
              <Link key={item.label} to={item.path} className="group flex items-center gap-3 p-3.5 hover:bg-muted/50 active:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <item.icon className="w-[18px] h-[18px] text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="preferences-title">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 id="preferences-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preferences</h3>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                {darkMode ? <Sun className="w-[18px] h-[18px] text-primary" /> : <Moon className="w-[18px] h-[18px] text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Appearance</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{darkMode ? 'Dark mode is on' : 'Use light mode'}</p>
              </div>
              <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${darkMode ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true">
                <span className={`block w-5 h-5 rounded-full bg-card shadow-sm transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </span>
            </button>
          </div>
        </section>

        <Separator />

        {/* Sign out */}
        {!showSignout ? (
          <button
            onClick={() => setShowSignout(true)}
            className="flex items-center gap-3 p-3 w-full text-destructive hover:bg-destructive/5 rounded-2xl transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold">Sign Out</span>
          </button>
        ) : (
          <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-center mb-2">
            <p className="text-sm font-medium mb-3">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSignout(false)} className="flex-1 py-2.5 rounded-xl border border-border bg-card text-sm font-medium">Cancel</button>
              <button onClick={handleSignOut} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium">Sign Out</button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground py-1 pb-4">SETU v1.0.0 · बिहार में बना</p>
      </div>

      {/* ── Edit Profile modal ── */}
      <Dialog open={editOpen} onOpenChange={(open) => !saving && setEditOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="profile-name" className="text-xs mb-1 block">Full Name *</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={60}
                placeholder="Your full name"
              />
            </div>

            <div>
              <Label htmlFor="profile-phone" className="text-xs mb-1 block">Phone Number</Label>
              <Input id="profile-phone" value={phone ? formatPhone(phone) : 'Not set'} disabled />
              <Link
                to="/customer/account"
                className="text-xs text-primary font-medium mt-1 inline-block"
                onClick={() => setEditOpen(false)}
              >
                Change phone number
              </Link>
            </div>

            <div>
              <Label htmlFor="profile-village" className="text-xs mb-1 block">Village</Label>
              {vilLoading ? (
                <div className="h-10 flex items-center px-3 border border-border rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={form.villageId || undefined}
                  onValueChange={v => setForm(f => ({ ...f, villageId: v }))}
                >
                  <SelectTrigger id="profile-village">
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
                  <Label htmlFor="profile-district" className="text-xs mb-1 block">District</Label>
                  <Input id="profile-district" value={selectedVillage.district} disabled />
                </div>
                <div>
                  <Label htmlFor="profile-state" className="text-xs mb-1 block">State</Label>
                  <Input id="profile-state" value={selectedVillage.state} disabled />
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
