import React, { useState } from 'react';
import { AlertTriangle, Shield, CheckCircle, ChevronRight, Camera, Mic } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const FRAUD_TYPES = [
  { value: 'fake_product', label: '🧪 Fake or Adulterated Product', desc: 'Received counterfeit or adulterated goods' },
  { value: 'wrong_quantity', label: '📦 Short Delivery / Missing Items', desc: 'Did not receive all items ordered' },
  { value: 'price_manipulation', label: '💰 Price Overcharging', desc: 'Charged more than the listed price' },
  { value: 'cod_fraud', label: '💵 COD Fraud by Rider', desc: 'Rider demanded extra cash or didn\'t return change' },
  { value: 'fake_review', label: '⭐ Fake Reviews', desc: 'Suspecting fake ratings on a vendor' },
  { value: 'impersonation', label: '👤 Identity Fraud', desc: 'Someone impersonating a vendor or rider' },
  { value: 'other', label: '🚩 Other Misconduct', desc: 'Report any other fraudulent activity' },
];

export default function CustomerFraudReport() {
  const [step, setStep] = useState(1);
  const [fraudType, setFraudType] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="pb-24">
      <AppHeader title="Report Fraud / Misconduct" subtitle="Your report is confidential" showBack />

      <div className="px-4 py-4">
        {!submitted ? (
          <>
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-destructive" />
                    <h3 className="font-semibold text-sm text-destructive">SETU Zero Tolerance Policy</h3>
                  </div>
                  <p className="text-xs text-red-700">SETU has zero tolerance for fraud. Every report is investigated within 24 hours. Fraudulent vendors or riders are permanently banned. Your identity is kept confidential.</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-3">What are you reporting?</h3>
                  <div className="space-y-2">
                    {FRAUD_TYPES.map(type => (
                      <Card key={type.value} onClick={() => setFraudType(type.value)} className={`p-3 border-2 cursor-pointer transition-all ${fraudType === type.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.desc}</p>
                          </div>
                          {fraudType === type.value && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <Button className="w-full" disabled={!fraudType} onClick={() => setStep(2)}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Badge className="mb-3 bg-destructive/10 text-destructive border-0">
                    {FRAUD_TYPES.find(t => t.value === fraudType)?.label}
                  </Badge>
                  <h3 className="font-semibold text-sm mb-1">Provide Details</h3>
                  <p className="text-xs text-muted-foreground">The more detail you provide, the faster we can investigate.</p>
                </div>

                <Card className="p-4 border-border space-y-3">
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Related Order (if any)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="o1">SETU-2025-0001</SelectItem>
                      <SelectItem value="o2">SETU-2025-0002</SelectItem>
                      <SelectItem value="none">No specific order</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Name of vendor / rider (if known)" />
                  <Textarea placeholder="Describe what happened in detail. When did it happen? What was the loss? Who was involved?" rows={5} />
                </Card>

                <Card className="p-4 border-border">
                  <p className="text-xs font-medium mb-2">Evidence (optional but helpful)</p>
                  <div className="flex gap-2">
                    <div className="flex-1 aspect-square max-h-24 bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
                      <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                      <p className="text-[9px] text-muted-foreground">Photo</p>
                    </div>
                    <div className="flex-1 max-h-24 bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors p-3">
                      <Mic className="w-5 h-5 text-muted-foreground mb-1" />
                      <p className="text-[9px] text-muted-foreground text-center">Voice recording in Hindi</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-3 bg-muted/50 border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>Confidentiality:</strong> Your name will not be shared with the accused. Village Anchor will be informed only if mediation is needed. False reports may affect your SETU trust score.
                  </p>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1 bg-destructive hover:bg-destructive/90" onClick={() => setSubmitted(true)}>Submit Report</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
              <p className="text-sm text-muted-foreground">Reference: #FR-2025-047</p>
            </div>
            <Card className="p-4 border-border text-left space-y-2">
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /><p className="text-sm">Report received and logged</p></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><p className="text-sm">Investigation starts within 2 hours</p></div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /><p className="text-sm">Your identity is confidential</p></div>
            </Card>
            <p className="text-xs text-muted-foreground">You'll receive an SMS update at each step of the investigation. Expected resolution: 24-48 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Missing import fix
function Clock({ className }) { return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }