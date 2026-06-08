import React, { useState } from 'react';
import { CheckCircle, Camera, Upload, Store, MapPin, Package, ChevronRight, Mic, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { kyc as kycService } from '@/lib/kyc';
import { useAuth } from '@/lib/AuthContext';

const STEPS = [
  { id: 1, label: 'Identity', sublabel: 'Aadhaar + Face' },
  { id: 2, label: 'Shop Details', sublabel: 'Store info' },
  { id: 3, label: 'Products', sublabel: 'Your catalog' },
  { id: 4, label: 'Bank', sublabel: 'Payments' },
  { id: 5, label: 'Review', sublabel: 'Final check' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-border">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step.id < current ? 'bg-accent text-white' : step.id === current ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {step.id < current ? <CheckCircle className="w-4 h-4" /> : step.id}
            </div>
            <p className="text-[9px] text-center mt-1 font-medium hidden sm:block">{step.label}</p>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step.id < current ? 'bg-accent' : 'bg-border'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function Step1({ onNext }) {
  const { user } = useAuth();
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const { data, error } = await kycService.verifyAadhaar(user.id, aadhaar);
      if (error) throw error;
      setOtpSent(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">Verify Your Identity</h2>
        <p className="text-sm text-muted-foreground">Your Aadhaar verifies you are a real person from this village. This protects your customers.</p>
      </div>
      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-3">Aadhaar Verification</h3>
        <Input 
          placeholder="Aadhaar Number (12 digits)" 
          className="mb-2 font-mono tracking-widest" 
          maxLength={12} 
          value={aadhaar}
          onChange={(e) => setAadhaar(e.target.value)}
        />
        {otpSent && <Input placeholder="Registered Mobile OTP" className="mb-2" />}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs"
          onClick={otpSent ? onNext : handleVerify}
          disabled={loading || aadhaar.length !== 12}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (otpSent ? 'Confirm OTP & Continue' : 'Request OTP via UIDAI')}
        </Button>
      </Card>
      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-1">Selfie Verification</h3>
        <p className="text-xs text-muted-foreground mb-3">Take a clear selfie to match with your Aadhaar photo</p>
        <div className="h-36 bg-muted rounded-xl flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors">
          <div className="text-center">
            <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Tap to open camera</p>
          </div>
        </div>
      </Card>
      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-1">Village Anchor Vouching</h3>
        <p className="text-xs text-muted-foreground mb-3">Your Village Anchor must vouch for you before your store goes live.</p>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">RD</div>
          <div>
            <p className="text-sm font-medium">Ramkali Devi</p>
            <p className="text-xs text-muted-foreground">Village Anchor · Madhepur</p>
          </div>
          <Badge className="ml-auto bg-amber-100 text-amber-800 border-0 text-[9px]">Pending</Badge>
        </div>
      </Card>
      <Button className="w-full" onClick={onNext}>Continue to Shop Details <ChevronRight className="w-4 h-4 ml-1" /></Button>
    </div>
  );
}

function Step2({ onNext, onBack }) {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Shop Details</h2>
        <p className="text-sm text-muted-foreground">Tell customers about your store and what you sell.</p>
      </div>
      <div className="space-y-3">
        <Input placeholder="Shop Name (e.g. Ramesh Kirana Store)" />
        <Select>
          <SelectTrigger><SelectValue placeholder="Primary Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grocery">Grocery & Essentials</SelectItem>
            <SelectItem value="makhana">Makhana & Dry Fruits</SelectItem>
            <SelectItem value="vegetables">Fresh Vegetables</SelectItem>
            <SelectItem value="dairy">Dairy & Milk</SelectItem>
            <SelectItem value="fish">Fish & Meat</SelectItem>
            <SelectItem value="sweets">Sweets & Snacks</SelectItem>
            <SelectItem value="clothing">Clothing & Textiles</SelectItem>
            <SelectItem value="electronics">Electronics</SelectItem>
          </SelectContent>
        </Select>
        <Textarea placeholder="Shop description (Hindi/English)" rows={3} />
        <div>
          <label className="text-xs font-medium mb-1 block">Shop Photos</label>
          <div className="grid grid-cols-3 gap-2">
            {['Shop front', 'Inside', 'Products'].map(label => (
              <div key={label} className="aspect-square bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
                <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <Card className="p-3 border-border">
          <p className="text-xs font-medium mb-2"><MapPin className="w-3 h-3 inline mr-1" />Shop Location</p>
          <Select>
            <SelectTrigger className="mb-2"><SelectValue placeholder="Select Village" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="madhepur">Madhepur</SelectItem>
              <SelectItem value="laxmipur">Laxmipur</SelectItem>
              <SelectItem value="parsad">Parsad</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Landmark (e.g. Near Panchayat office)" />
        </Card>
        <div>
          <label className="text-xs font-medium mb-1 block">Delivery Radius</label>
          <div className="flex gap-2">
            {['1 km', '2 km', '3 km', '5 km', '10 km'].map(r => (
              <button key={r} className="flex-1 text-xs py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors">{r}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={onNext}>Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function Step3({ onNext, onBack }) {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Add Your Products</h2>
        <p className="text-sm text-muted-foreground">Add at least 5 products to go live. You can always add more later.</p>
      </div>
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3">
        <p className="text-xs text-accent font-medium">💡 Tip: Use voice input! Say the product name in Hindi and we'll fill it for you.</p>
      </div>
      {[
        { name: 'Basmati Rice (5kg)', price: '₹450', stock: '25 bags', status: 'added' },
        { name: 'Mustard Oil (1L)', price: '₹180', stock: '40 bottles', status: 'added' },
      ].map((p, i) => (
        <Card key={i} className="p-3 border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.price} · {p.stock}</p>
          </div>
          <Badge className="bg-green-100 text-green-800 border-0 text-[9px]">✓ Added</Badge>
        </Card>
      ))}
      <Card className="p-4 border-dashed border-2 border-border cursor-pointer hover:border-primary transition-colors">
        <div className="text-center">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Add New Product</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" className="text-xs"><Camera className="w-3 h-3 mr-1" /> Photo</Button>
            <Button size="sm" variant="outline" className="text-xs"><Mic className="w-3 h-3 mr-1" /> Voice</Button>
            <Button size="sm" variant="outline" className="text-xs"><Upload className="w-3 h-3 mr-1" /> Import</Button>
          </div>
        </div>
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={onNext}>Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function Step4({ onNext, onBack }) {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Payment Setup</h2>
        <p className="text-sm text-muted-foreground">Add your bank account or UPI ID to receive payments from SETU.</p>
      </div>
      <Card className="p-4 border-border space-y-3">
        <h3 className="font-semibold text-sm">Bank Account</h3>
        <Input placeholder="Account Holder Name" />
        <Input placeholder="Account Number" className="font-mono" />
        <Input placeholder="IFSC Code" className="font-mono uppercase" />
        <Input placeholder="Bank Name (e.g. SBI, PNB)" />
      </Card>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">OR</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <Card className="p-4 border-border">
        <h3 className="font-semibold text-sm mb-2">UPI ID</h3>
        <Input placeholder="yourname@upi" />
      </Card>
      <Card className="p-3 bg-muted/50 border-border">
        <p className="text-xs text-muted-foreground">💰 SETU Fee: <strong>2% per order</strong> deducted at settlement. COD payments settled next day. UPI payments settled same day.</p>
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>Back</Button>
        <Button className="flex-1" onClick={onNext}>Review Application <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function Step5() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Review & Submit</h2>
        <p className="text-sm text-muted-foreground">Your application will be reviewed by the Block Admin within 24 hours.</p>
      </div>
      {[
        { label: '✓ Aadhaar Verified', status: 'done' },
        { label: '✓ Selfie Verified', status: 'done' },
        { label: '⏳ Anchor Vouching (Pending)', status: 'pending' },
        { label: '✓ Shop Details Added', status: 'done' },
        { label: '✓ 2 Products Added', status: 'warn' },
        { label: '✓ Bank Account Added', status: 'done' },
      ].map((item, i) => (
        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.status === 'done' ? 'bg-green-50' : item.status === 'pending' ? 'bg-amber-50' : 'bg-muted'}`}>
          <p className={`text-sm ${item.status === 'pending' ? 'text-amber-700' : 'text-foreground'}`}>{item.label}</p>
        </div>
      ))}
      <Card className="p-3 bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-800">⚠️ You need <strong>5 products minimum</strong> to go live. You currently have 2. Add 3 more after submission.</p>
      </Card>
      <div className="p-3 bg-muted rounded-xl">
        <p className="text-xs text-muted-foreground"><strong>SETU Constitution Pledge:</strong> I agree to sell genuine products, honor all accepted orders, and maintain fair pricing. I understand that fraud or misconduct will result in permanent ban from SETU.</p>
      </div>
      <Button className="w-full">Submit Application 🚀</Button>
    </div>
  );
}

export default function VendorOnboarding() {
  const [step, setStep] = useState(1);
  const next = () => setStep(s => Math.min(s + 1, 5));
  const back = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sm">Vendor Registration</h1>
            <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
          </div>
          <div className="ml-auto">
            <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
          </div>
        </div>
        <StepIndicator current={step} />
      </div>
      {step === 1 && <Step1 onNext={next} />}
      {step === 2 && <Step2 onNext={next} onBack={back} />}
      {step === 3 && <Step3 onNext={next} onBack={back} />}
      {step === 4 && <Step4 onNext={next} onBack={back} />}
      {step === 5 && <Step5 />}
    </div>
  );
}
