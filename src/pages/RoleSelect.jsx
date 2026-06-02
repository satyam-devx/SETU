import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Store, Bike, Wrench, LayoutDashboard, Shield, Users, ChevronRight } from 'lucide-react';

const roles = [
  { key: 'customer', label: 'Customer App', desc: 'Shop local products & services', icon: ShoppingBag, color: 'bg-primary', path: '/customer', tag: 'आपका SETU' },
  { key: 'vendor', label: 'Vendor App', desc: 'Manage your store & orders', icon: Store, color: 'bg-accent', path: '/vendor', tag: 'दुकानदार' },
  { key: 'rider', label: 'Rider App', desc: 'Deliver & earn daily', icon: Bike, color: 'bg-chart-3', path: '/rider', tag: 'डिलीवरी' },
  { key: 'seva', label: 'Seva Provider', desc: 'Offer your skilled services', icon: Wrench, color: 'bg-chart-4', path: '/seva', tag: 'सेवा' },
  { key: 'anchor', label: 'Village Anchor', desc: 'Lead your village on SETU', icon: Users, color: 'bg-chart-5', path: '/anchor', tag: 'ग्राम नेता' },
  { key: 'admin', label: 'Admin Dashboard', desc: 'Block operations management', icon: LayoutDashboard, color: 'bg-muted-foreground', path: '/admin', tag: 'Admin' },
  { key: 'superadmin', label: 'Super Admin', desc: 'Platform-wide control center', icon: Shield, color: 'bg-foreground', path: '/superadmin', tag: 'Super Admin' },
];

const onboardingLinks = [
  { label: 'Become a Vendor →', path: '/onboarding/vendor', color: 'text-accent' },
  { label: 'Become a Rider →', path: '/onboarding/rider', color: 'text-chart-3' },
  { label: 'Register as Seva Provider →', path: '/onboarding/seva', color: 'text-chart-4' },
];

export default function RoleSelect() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <h1 className="font-heading text-5xl md:text-7xl font-bold text-foreground tracking-tight">SETU</h1>
        <p className="text-muted-foreground mt-2 text-base font-light">Rural Commerce Operating System</p>
        <p className="text-muted-foreground/60 text-sm mt-1">Madhepur · Madhubani · Bihar · मिथिला</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-2xl w-full mb-6">
        {roles.map((role, i) => (
          <motion.div key={role.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Link to={role.path} className="group block">
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 relative">
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] text-muted-foreground/60">{role.tag}</span>
                </div>
                <div className={`w-11 h-11 ${role.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <role.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">{role.label}</h3>
                <p className="text-muted-foreground text-xs mt-0.5 leading-tight">{role.desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex flex-wrap justify-center gap-4">
        {onboardingLinks.map(link => (
          <Link key={link.path} to={link.path} className={`text-xs font-medium ${link.color} hover:underline`}>{link.label}</Link>
        ))}
      </motion.div>

      <p className="text-muted-foreground/40 text-xs mt-6">SETU Technical Constitution · v1.0 MVP · बिहार में बना</p>
    </div>
  );
}
