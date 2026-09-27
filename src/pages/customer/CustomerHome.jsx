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
  Moon, Sun, Mic2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
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
  { label: 'Voice Assistant',    icon: Mic2,           path: '/customer/voice',         desc: 'Bolkar kharido · बोलकर खरीदो' },
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
    <div className="pb-24 animate-fade-in" role="main">
      {/* Quiet, app-native header — intentionally no hero card / glassmorphism. */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account</p>
            <h1 className="text-[17px] font-semibold tracking-tight">Profile</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openEdit}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Edit profile"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {/* Identity */}
        <section className="py-6" aria-labelledby="profile-name">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-1 ring-primary/15">
                {displayInitials}
              </div>
              {profile?.is_verified && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground" aria-label="Verified SETU member">
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 id="profile-name" className="truncate text-[20px] font-semibold tracking-tight">
                  {profile?.name || 'SETU User'}
                </h2>
                {profile?.is_verified && (
                  <span className="shrink-0 text-[10px] font-medium text-primary">Verified</span>
                )}
              </div>
              {phone && <p className="mt-0.5 text-sm text-muted-foreground">{formatPhone(phone)}</p>}
              <button
                type="button"
                onClick={openEdit}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Edit profile <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5">
            <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delivery location</p>
              <p className="truncate text-xs font-medium">
                {selectedVillage?.name || 'Choose your village'}
                {selectedVillage?.district ? `, ${selectedVillage.district}` : ''}
              </p>
            </div>
            <button type="button" onClick={openEdit} className="shrink-0 text-xs font-medium text-primary">
              Change
            </button>
          </div>

          {saved && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
              <CheckCircle className="h-3.5 w-3.5" /> Profile updated successfully
            </div>
          )}
        </section>

        {/* Compact account snapshot — no cards competing with the profile identity. */}
        <section className="border-y border-border/70 py-3.5" aria-label="Account overview">
          <div className="grid grid-cols-3 divide-x divide-border/70">
            <div className="px-3 text-center first:pl-0 last:pr-0">
              <p className="text-base font-semibold tracking-tight">{myOrders.length}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Orders</p>
            </div>
            <div className="px-3 text-center first:pl-0 last:pr-0">
              <p className="text-base font-semibold tracking-tight">₹{walletBal}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Wallet</p>
            </div>
            <div className="px-3 text-center first:pl-0 last:pr-0">
              <p className="text-base font-semibold tracking-tight">{setuScore}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">SETU Score</p>
            </div>
          </div>
        </section>

        <div className="space-y-7 py-6">
          <section aria-labelledby="account-title">
            <h3 id="account-title" className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account</h3>
            <div className="divide-y divide-border/70 border-y border-border/70">
              {MENU_ITEMS.slice(0, 5).map(item => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="group flex min-h-[58px] items-center gap-3 py-2.5 transition-colors active:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <item.icon className="h-[17px] w-[17px]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="more-title">
            <h3 id="more-title" className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">More from SETU</h3>
            <div className="divide-y divide-border/70 border-y border-border/70">
              {MENU_ITEMS.slice(5).map(item => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="group flex min-h-[58px] items-center gap-3 py-2.5 transition-colors active:bg-muted/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <item.icon className="h-[17px] w-[17px]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="preferences-title">
            <h3 id="preferences-title" className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preferences</h3>
            <div className="border-y border-border/70">
              <button onClick={toggleDarkMode} className="flex min-h-[58px] w-full items-center gap-3 py-2.5 text-left transition-colors active:bg-muted/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  {darkMode ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Appearance</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{darkMode ? 'Dark mode is on' : 'Light mode is on'}</p>
                </div>
                <span className={`relative h-5 w-9 rounded-full p-0.5 transition-colors ${darkMode ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true">
                  <span className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>
            </div>
          </section>

          {!showSignout ? (
            <button
              onClick={() => setShowSignout(true)}
              className="flex w-full items-center gap-3 py-2.5 text-left text-destructive transition-colors active:opacity-70"
            >
              <LogOut className="ml-1 h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Sign out of SETU?</p>
              <p className="mt-1 text-xs text-muted-foreground">You can sign back in anytime.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setShowSignout(false)} className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium">Cancel</button>
                <button onClick={handleSignOut} className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground">Sign Out</button>
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground">SETU v1.0.0 · बिहार में बना</p>
        </div>
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
