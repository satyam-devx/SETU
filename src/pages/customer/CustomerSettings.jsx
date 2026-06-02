import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, Lock, Bell, Eye, Trash2, Info, Mic, WifiOff, Shield, Award, ChevronRight, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const sections = [
  {
    title: 'Language & Voice',
    icon: Globe,
    items: [
      { type: 'link', label: 'Language Preferences', sublabel: 'हिन्दी · Maithili · Voice settings', path: '/customer/language', icon: Globe },
      { type: 'link', label: 'Voice Assistant', sublabel: 'Bolkar kharido · बोलकर खरीदो', path: '/customer/voice', icon: Mic },
    ],
  },
  {
    title: 'Notifications',
    icon: Bell,
    items: [
      { type: 'toggle', label: 'Order Updates', defaultVal: true },
      { type: 'toggle', label: 'SETU Credit Reminders', defaultVal: true },
      { type: 'toggle', label: 'Promotions & Offers', defaultVal: true },
      { type: 'toggle', label: 'Scheme Updates', defaultVal: false },
      { type: 'toggle', label: 'WhatsApp Messages (Hindi)', defaultVal: true },
      { type: 'toggle', label: 'SMS Alerts', defaultVal: true },
    ],
  },
  {
    title: 'Trust & Safety',
    icon: Shield,
    items: [
      { type: 'link', label: 'My Trust Score', sublabel: 'SETU Score: 720 · Silver Tier', path: '/customer/trust', icon: Award, badge: '720' },
      { type: 'link', label: 'Report Fraud / Misconduct', sublabel: 'Zero tolerance policy', path: '/customer/fraud', icon: Shield },
    ],
  },
  {
    title: 'Connectivity',
    icon: WifiOff,
    items: [
      { type: 'link', label: 'Offline Mode Settings', sublabel: 'Manage cached data & queued actions', path: '/customer/offline', icon: WifiOff },
      { type: 'toggle', label: 'Auto-cache for offline use', defaultVal: true },
      { type: 'toggle', label: 'SMS fallback when no internet', defaultVal: true },
    ],
  },
  {
    title: 'Privacy',
    icon: Lock,
    items: [
      { type: 'toggle', label: 'Share data for recommendations', defaultVal: true },
      { type: 'toggle', label: 'Show profile to vendors', defaultVal: false },
      { type: 'link', label: 'Data & Privacy Policy', sublabel: 'DPDP Act 2023 compliant', path: '#', icon: FileText },
    ],
  },
  {
    title: 'About SETU',
    icon: Info,
    items: [
      { type: 'info', label: 'Version', value: 'v1.0 MVP' },
      { type: 'info', label: 'Location', value: 'Madhepur, Madhubani, Bihar' },
      { type: 'info', label: 'Compliance', value: 'DPDP Act 2023 · PCI-DSS' },
      { type: 'info', label: '© 2025', value: 'SETU Platform · बिहार में बना' },
    ],
  },
];

export default function CustomerSettings() {
  return (
    <div className="pb-24">
      <AppHeader title="Settings" subtitle="सेटिंग्स" showBack />
      <div className="px-4 py-4 space-y-4">
        {sections.map(section => {
          const SectionIcon = section.icon;
          return (
            <Card key={section.title} className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <SectionIcon className="w-4 h-4 text-primary" /> {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, i) => {
                  if (item.type === 'toggle') {
                    return (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm">{item.label}</span>
                        <Switch defaultChecked={item.defaultVal} />
                      </div>
                    );
                  }
                  if (item.type === 'link') {
                    const ItemIcon = item.icon;
                    return (
                      <Link key={i} to={item.path} className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-lg -mx-2 px-2 transition-colors">
                        {ItemIcon && <ItemIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.badge && <Badge variant="outline" className="text-[9px]">{item.badge}</Badge>}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    );
                  }
                  if (item.type === 'info') {
                    return (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-medium">{item.value}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </Card>
          );
        })}

        <button className="flex items-center gap-2 text-destructive text-sm font-medium py-2">
          <Trash2 className="w-4 h-4" /> Delete My Account
        </button>
      </div>
    </div>
  );
}
