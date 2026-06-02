import React from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, Star, Briefcase, HelpCircle, Settings, ChevronRight, LogOut, Award, Shield, Bell, Edit, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

const provider = {
  name: 'Rajesh Electrician', category: 'Electrician', village: 'Madhepur',
  rating: 4.7, reviewCount: 85, jobsCompleted: 156, totalEarnings: 98500,
  experience: '8 years', hourlyRate: 300, isVerified: true, setuLevel: 'Pro',
  phone: '+91 98765 43220',
  skills: ['Wiring', 'MCB', 'Fan installation', 'Inverter repair', 'Solar panels'],
  availability: 'Mon–Sat, 8am–7pm',
};

const menuItems = [
  { label: 'My Jobs', icon: Briefcase, path: '/seva/jobs', desc: 'Upcoming and completed jobs' },
  { label: 'Earnings', icon: IndianRupee, path: '/seva/earnings', desc: 'Payments and invoices' },
  { label: 'Reviews', icon: Star, path: '/seva/reviews', desc: 'Customer feedback' },
  { label: 'Availability Calendar', icon: Calendar, path: '/seva/calendar', desc: 'Set your schedule' },
  { label: 'Documents & Certificates', icon: Shield, path: '/seva/documents', desc: 'Skill certs, ID verification' },
  { label: 'Notifications', icon: Bell, path: '/seva/notifications', desc: 'Job requests and alerts' },
  { label: 'Support', icon: HelpCircle, path: '/seva/support', desc: 'Help and dispute resolution' },
  { label: 'Settings', icon: Settings, path: '/seva/settings', desc: 'Rates, area, preferences' },
];

export default function SevaProfile() {
  return (
    <div className="pb-20">
      <AppHeader title="Profile" rightAction={
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit className="w-4 h-4" />
        </Button>
      } />

      {/* Identity */}
      <div className="px-4 py-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-3xl">⚡</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg">{provider.name}</h2>
              <p className="text-sm text-muted-foreground">{provider.category} · {provider.village}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className="bg-accent/10 text-accent text-[9px] border-0">✓ Verified</Badge>
                <Badge className="bg-primary/10 text-primary text-[9px] border-0">{provider.setuLevel}</Badge>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-xs font-medium">{provider.rating} ({provider.reviewCount})</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <p>📅 {provider.availability}</p>
            <p>💰 ₹{provider.hourlyRate}/hr</p>
            <p>🛠️ {provider.experience} experience</p>
            <p>📞 {provider.phone}</p>
          </div>
        </Card>
      </div>

      {/* Stats */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-primary">{provider.jobsCompleted}</p>
          <p className="text-[10px] text-muted-foreground">Jobs Done</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-accent">₹{(provider.totalEarnings/1000).toFixed(0)}k</p>
          <p className="text-[10px] text-muted-foreground">Earned</p>
        </Card>
        <Card className="p-3 text-center border-border">
          <p className="text-xl font-bold text-foreground">{provider.rating}</p>
          <p className="text-[10px] text-muted-foreground">Rating</p>
        </Card>
      </div>

      {/* Skills */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Skills & Expertise</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7">Edit</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {provider.skills.map(s => (
              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* Level badge */}
      <div className="px-4 mb-4">
        <Card className="p-4 border-border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm font-bold">SETU Pro Provider</p>
              <p className="text-xs text-muted-foreground">Top 10% in Madhepur block — keep completing jobs to maintain status</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Menu */}
      <div className="px-4">
        {menuItems.map(item => (
          <Link key={item.label} to={item.path}>
            <div className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        <Separator className="my-3" />
        <button className="flex items-center gap-3 py-3 px-1 text-destructive w-full">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}
