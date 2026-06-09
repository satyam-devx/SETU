// ═══════════════════════════════════════════════════════════
// SETU — CustomerProfile (v2)
// Fixes:
//  - Reads from useAuth (real profile) not store mock user
//  - Name edit calls updateProfile API — not just local state
//  - No hardcoded 'u1' order counts
//  - Shows phone number properly (Google users may have none)
//  - Sign out with confirmation
//  - Initials avatar from real name
// ═══════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Phone, MapPin, Star, ShoppingBag, Wallet,
  Gift, Settings, ChevronRight, Edit2, CheckCircle,
  LogOut, Shield, HeadphonesIcon,
} from 'lucide-react';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';
import { useStore } from '@/lib/store';
import { updateProfile } from '@/lib/api';
import { formatCurrency, initials, formatPhone } from '@/lib/utils';

export default function CustomerProfile() {
  const navigate         = useNavigate();
  const { profile, user, signOut } = useAuth();
  const { state }        = useStore();

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(profile?.name || '');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [showSignout, setShowSignout] = useState(false);

  // Real counts from store (updated by realtime)
  const myOrders   = state.orders.filter(o =>
    user?.id && (o.customerId === user.id || o.customer_id === user.id)
  );
  const delivered  = myOrders.filter(o => o.status === 'delivered').length;
  const setuScore  = profile?.setu_score ?? 500;

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === profile?.name) { setEditing(false); return; }
    setSaving(true);
    const { error } = await updateProfile(user.id, { name: name.trim() });
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

  const MENU_ITEMS = [
    { label: 'My Orders',         icon: ShoppingBag,      path: '/customer/orders',    badge: null },
    { label: 'Wallet & Payments', icon: Wallet,           path: '/customer/wallet',    badge: null },
    { label: 'SETU Credit',       icon: Star,             path: '/customer/credit',    badge: null },
    { label: 'My Addresses',      icon: MapPin,           path: '/customer/addresses', badge: null },
    { label: 'Refer & Earn',      icon: Gift,             path: '/customer/referral',  badge: '₹100' },
    { label: 'Help & Support',    icon: HeadphonesIcon,   path: '/customer/support',   badge: null },
    { label: 'Settings',          icon: Settings,         path: '/customer/settings',  badge: null },
  ];

  const phone = profile?.phone || user?.phone || '';
  const displayInitials = initials(name || profile?.name || 'S U');

  return (
    <div className="pb-nav animate-fade-in" role="main">
      <AppHeader title="My Profile" />

      <div className="px-4 py-4 space-y-4">

        {/* Profile card */}
        <div className="setu-card p-4">
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0"
              aria-hidden="true"
            >
              {displayInitials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="input-field h-9 text-sm flex-1"
                    autoFocus
                    aria-label="Edit name"
                    maxLength={60}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="btn-primary h-9 px-3 text-sm min-w-[60px]"
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate">{profile?.name || 'SETU User'}</h2>
                  <button
                    onClick={() => { setName(profile?.name || ''); setEditing(true); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    aria-label="Edit name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{formatPhone(phone)}</p>
                </div>
              )}
              {profile?.village && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{profile.village}</p>
                </div>
              )}
            </div>
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-xs mb-3" role="status" aria-live="polite">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Profile updated successfully
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center" role="region" aria-label="Your stats">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xl font-bold text-foreground">{myOrders.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Orders</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xl font-bold text-foreground">{delivered}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Delivered</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-3">
              <p className="text-xl font-bold text-primary">{setuScore}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">SETU Score</p>
            </div>
          </div>

          {/* Verified badge */}
          {profile?.is_verified && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-green-600 font-medium">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              Verified SETU Member
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="setu-card overflow-hidden" role="list">
          {MENU_ITEMS.map((item, i) => (
            <Link
              key={item.path}
              to={item.path}
              role="listitem"
              className={`flex items-center gap-3 px-4 py-3.5 active:bg-muted/50 transition-colors ${
                i < MENU_ITEMS.length - 1 ? 'border-b border-border' : ''
              }`}
              aria-label={item.label}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        {!showSignout ? (
          <button
            onClick={() => setShowSignout(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 setu-card text-destructive"
            aria-label="Sign out"
          >
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        ) : (
          <div className="setu-card p-4 text-center border-destructive/30">
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

        {/* App version */}
        <p className="text-center text-[10px] text-muted-foreground pb-2">
          SETU v1.0.0 · {profile?.id?.slice(0,8)}
        </p>
      </div>
    </div>
  );
}
