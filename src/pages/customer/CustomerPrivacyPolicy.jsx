import React from 'react';
import { Shield, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AppHeader from '@/components/shared/AppHeader';

export default function CustomerPrivacyPolicy() {
  return (
    <div className="pb-20">
      <AppHeader title="Privacy Policy" subtitle="Last updated: June 2025" showBack />

      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 border-border bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">SETU Privacy Commitment</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            At SETU, we take your privacy seriously. This policy explains how we collect, use, and protect
            your personal data. We are compliant with the Digital Personal Data Protection (DPDP) Act, 2023.
          </p>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Information We Collect
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Personal Information</p>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li>Name and phone number for account creation</li>
              <li>Delivery address for order fulfillment</li>
              <li>Village location for local vendor matching</li>
              <li>UPI ID / payment details for transactions</li>
            </ul>
            <p className="font-medium text-foreground mt-3">Usage Data</p>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li>Order history and preferences</li>
              <li>Search queries and browsing patterns</li>
              <li>Device information and app usage</li>
            </ul>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">How We Use Your Data</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            {[
              'To deliver products and services you order',
              'To send order updates via SMS and WhatsApp',
              'To personalise product recommendations',
              'To assess SETU Credit eligibility',
              'To improve our platform and prevent fraud',
            ].map((point, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary font-bold">·</span> {point}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">Data Sharing</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We share minimal necessary data with vendors for order fulfillment (name, address, phone).
            We do NOT sell your personal data to third parties. Payment data is processed through
            PCI-DSS compliant gateways and is never stored on our servers.
          </p>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">Your Rights Under DPDP Act 2023</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">Right to Access:</span> Request a copy of your personal data at any time.</p>
            <p><span className="font-semibold text-foreground">Right to Correction:</span> Update or correct inaccurate information.</p>
            <p><span className="font-semibold text-foreground">Right to Erasure:</span> Request deletion of your personal data.</p>
            <p><span className="font-semibold text-foreground">Right to Grievance:</span> File complaints about data processing.</p>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">Contact Us</h3>
          <p className="text-sm text-muted-foreground">
            For privacy-related queries or data requests, contact our Data Protection Officer:
          </p>
          <p className="text-sm font-medium mt-2">📧 privacy@setuplatform.in</p>
          <p className="text-xs text-muted-foreground">📞 +91 98765 43200</p>
        </Card>
      </div>
    </div>
  );
}
