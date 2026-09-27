// ═══════════════════════════════════════════════════════════
// SETU — CustomerProfile (v3)
// UI: minimal premium profile header, SETU-tinted identity card,
// compact account navigation, and bottom-sheet profile editing.
// Logic preserved: real auth, API updateProfile, village selection, sign-out.
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Star, Gift, Settings, ChevronRight, Edit2, ArrowLeft,
  CheckCircle, LogOut, Shield, HeadphonesIcon,
  CreditCard, FileText, Loader2, AlertCircle,
  Moon, Sun, Mic2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
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

  // ── Edit Profile bottom sheet ───────────────────────────
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
      {/* Minimal native-app header: no border, card, or secondary eyebrow. */}
      <header className="sticky top-0 z-30 bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="relative mx-auto flex h-14 max-w-2xl items-center justify-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-[20px] w-[20px]" aria-hidden="true" />
          </button>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Profile</h1>
          <div className="absolute right-3 h-10 w-10" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {/* Identity card — restrained SETU color, no glassmorphism or oversized hero. */}
        <section className="pt-4" aria-labelledby="profile-name-heading">
          <div className="overflow-hidden rounded-[26px] bg-primary/[0.075] px-5 py-5 dark:bg-primary/[0.11]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={openEdit}
                className="group relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary ring-1 ring-primary/15 transition-transform active:scale-[0.97]"
                aria-label="Edit profile"
              >
                {displayInitials}
                <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background">
                  <Edit2 className="h-3 w-3" aria-hidden="true" />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="profile-name-heading" className="truncate text-[21px] font-semibold tracking-[-0.025em]">
                    {profile?.name || 'SETU User'}
                  </h2>
                  {profile?.is_verified && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary">
                      <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
                {phone && <p className="mt-1 text-sm text-muted-foreground">{formatPhone(phone)}</p>}
                <button
                  type="button"
                  onClick={openEdit}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  Edit profile <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 px-1 py-1">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Delivery location</p>
              <p className="truncate text-sm font-medium">
                {selectedVillage?.name || 'Choose your village'}
                {selectedVillage?.district ? `, ${selectedVillage.district}` : ''}
              </p>
            </div>
            <button type="button" onClick={openEdit} className="shrink-0 text-xs font-semibold text-primary">
              Change
            </button>
          </div>

          {saved && (
            <div className="mt-3 flex items-center gap-2 px-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
              <CheckCircle className="h-3.5 w-3.5" /> Profile updated successfully
            </div>
          )}
        </section>

        {/* Account navigation begins directly after identity; no stat strip. */}


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

      {/* ── Edit Profile bottom sheet ── */}
      <Sheet open={editOpen} onOpenChange={(open) => !saving && setEditOpen(open)}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] rounded-t-[28px] border-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted-foreground/20" aria-hidden="true" />
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="text-[22px] tracking-[-0.025em]">Edit profile</SheetTitle>
            <SheetDescription>Keep your SETU account details up to date.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 overflow-y-auto pb-1">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-1 ring-primary/15">
                {displayInitials}
              </div>
              <div>
                <p className="text-sm font-semibold">Profile identity</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your initials are generated from your name.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name-input" className="text-xs font-semibold">Full name</Label>
              <Input
                id="profile-name-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={60}
                placeholder="Your full name"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="text-xs font-semibold">Phone number</Label>
              <Input id="profile-phone" value={phone ? formatPhone(phone) : 'Not set'} disabled className="h-12 rounded-xl bg-muted/30" />
              <Link
                to="/customer/account"
                className="inline-block text-xs font-semibold text-primary"
                onClick={() => setEditOpen(false)}
              >
                Change phone number
              </Link>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-village" className="text-xs font-semibold">Village</Label>
              {vilLoading ? (
                <div className="flex h-12 items-center rounded-xl bg-muted/30 px-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={form.villageId || undefined}
                  onValueChange={v => setForm(f => ({ ...f, villageId: v }))}
                >
                  <SelectTrigger id="profile-village" className="h-12 rounded-xl bg-muted/30">
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
                <div className="space-y-2">
                  <Label htmlFor="profile-district" className="text-xs font-semibold">District</Label>
                  <Input id="profile-district" value={selectedVillage.district} disabled className="h-11 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-state" className="text-xs font-semibold">State</Label>
                  <Input id="profile-state" value={selectedVillage.state} disabled className="h-11 rounded-xl bg-muted/30" />
                </div>
              </div>
            )}

            {formError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {formError}
              </p>
            )}

            <Button className="h-12 w-full rounded-xl gap-2 text-sm font-semibold" onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
