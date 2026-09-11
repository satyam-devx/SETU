import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Shield, Download, Trash2, AlertTriangle, Smartphone, Key, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';
import { useAuth } from '@/lib/AuthContext';

export default function CustomerAccountManagement() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const phone = profile?.phone || user?.phone || '';

  // "Change Phone Number", "Download My Data", and "Delete My Account"
  // had no onClick at all — three fully-styled, confidently-worded
  // buttons (one right under a paragraph explaining exactly what
  // deletion does) that did nothing when tapped. None of these have
  // self-service backend support yet (no number-change/re-verification
  // flow, no data-export job, no account-deletion pipeline), so rather
  // than fake it, route them to the one thing that IS real and does
  // reach a human: a support ticket, pre-filled so the customer doesn't
  // have to explain the request type themselves.
  const requestViaSupport = (subject) => {
    navigate('/customer/support', { state: { prefillSubject: subject } });
  };

  return (
    <div className="pb-20">
      <AppHeader title="Account Management" subtitle="Manage your account settings" showBack />

      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Account Details
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between py-1">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{profile?.name || '—'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-xs text-muted-foreground">Phone</span>
              <span className="text-sm font-medium">{phone || '—'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-xs text-muted-foreground">Member since</span>
              <span className="text-sm font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Account Actions</h3>
          <div className="space-y-2">
            {[
              { to: '/customer/data-privacy',   icon: Shield,       label: 'Data & Privacy',    sub: 'Control your data sharing preferences' },
              { to: '/customer/privacy-policy',  icon: Shield,       label: 'Privacy Policy',    sub: 'How we handle your data'               },
              { to: '/customer/terms',           icon: AlertTriangle, label: 'Terms & Conditions', sub: 'Platform usage rules'                 },
            ].map(item => (
              <Link key={item.to} to={item.to} className="flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg -mx-2 px-2 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> Security
          </h3>
          <Button
            variant="outline"
            className="w-full justify-start text-sm gap-3"
            onClick={() => requestViaSupport('Request: Change phone number')}
          >
            <Smartphone className="w-4 h-4 text-muted-foreground" /> Change Phone Number
          </Button>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">Data Export</h3>
          <Button
            variant="outline"
            className="w-full justify-start text-sm gap-3 mb-2"
            onClick={() => requestViaSupport('Request: Export my data')}
          >
            <Download className="w-4 h-4 text-muted-foreground" /> Download My Data
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Get a copy of all your data including orders, transactions, and account details.
          </p>
        </Card>

        <Card className="p-4 border-border border-destructive/20 bg-destructive/5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Once you delete your account, there is no going back. All your data including orders,
            wallet balance, and SETU Credit history will be permanently removed.
          </p>
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => requestViaSupport('Request: Delete my account')}
          >
            <Trash2 className="w-4 h-4" /> Delete My Account
          </Button>
        </Card>
      </div>
    </div>
  );
}
