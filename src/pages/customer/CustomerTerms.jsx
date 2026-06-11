import React from 'react';
import { Scale, FileText, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AppHeader from '@/components/shared/AppHeader';

const termsSections = [
  {
    icon: FileText,
    title: 'Account & Registration',
    content: 'You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account. SETU reserves the right to suspend or terminate accounts that violate these terms.',
  },
  {
    icon: Scale,
    title: 'Orders & Payments',
    content: 'All prices are in Indian Rupees (₹). Prices may vary based on your village and delivery distance. We accept UPI, Cash on Delivery, and SETU Wallet. For COD orders above ₹500, partial advance may be required.',
  },
  {
    icon: AlertTriangle,
    title: 'Cancellations & Refunds',
    content: 'Orders can be cancelled before the vendor begins preparation. Refunds for prepaid orders are processed within 5–7 business days. For quality issues, raise a support ticket within 24 hours of delivery.',
  },
  {
    icon: FileText,
    title: 'Product Quality',
    content: 'SETU verifies all vendors but does not guarantee product quality. If you receive damaged or incorrect items, raise a dispute immediately. We will investigate and facilitate resolution within 48 hours.',
  },
  {
    icon: Scale,
    title: 'SETU Credit Terms',
    content: 'SETU Credit is a Buy Now, Pay Later facility. Credit limit is based on your transaction history and SETU Score. Late payments may affect your credit score and future credit eligibility. Interest-free period: 30 days.',
  },
  {
    icon: AlertTriangle,
    title: 'Limitation of Liability',
    content: 'SETU acts as a technology platform connecting buyers and sellers. We are not liable for disputes between users, product quality issues, or delivery delays caused by third parties. Our liability is limited to the order value.',
  },
];

export default function CustomerTerms() {
  return (
    <div className="pb-20">
      <AppHeader title="Terms & Conditions" subtitle="SETU Platform" showBack />

      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Terms of Service</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By using the SETU platform, you agree to these terms. SETU connects local vendors and service
            providers with customers in rural Bihar. We facilitate transactions but do not manufacture or
            directly sell products.
          </p>
        </Card>

        {termsSections.map((section, i) => (
          <Card key={i} className="p-4 border-border">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <section.icon className="w-4 h-4 text-primary" /> {section.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </Card>
        ))}

        <Card className="p-4 border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            © 2025 SETU Platform · Built in Bihar, India · All disputes subject to Madhubani jurisdiction
          </p>
        </Card>
      </div>
    </div>
  );
}
