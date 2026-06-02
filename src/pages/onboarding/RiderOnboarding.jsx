import React, { useState } from 'react';
import { CheckCircle, Camera, Bike, MapPin, ChevronRight, Shield, IndianRupee, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Vehicle' },
  { id: 3, label: 'Zone' },
  { id: 4, label: 'Training' },
  { id: 5, label: 'Go Live' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center px-4 py-3 gap-1">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.id < current ? 'bg-accent text-white' : step.id === current ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {step.id < current ? '✓' : step.id}
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${step.id < current ? 'bg-accent' : 'bg-border'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

const earningsInfo = [
  { label: 'Per Delivery (0-2 km)', amount: '₹30' },
  { label: 'Per Delivery (2-5 km)', amount: '₹50' },
  { label: 'Per Delivery (5+ km)', amount: '₹70' },
  { label: 'Surge (festival days)', amount: '+50%' },
  { label: 'Weekly bonus (50+ orders)', amount: '₹500' },
];

export default function RiderOnboarding() {
  const [step, setStep] = useState(1);
  const [vehicle, setVehicle] = useState('');
  const next = () => setStep(s => Math.min(s + 1, 5));
  const back = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-chart-3/20 rounded-lg flex items-center justify-center">
              <Bike className="w-4 h-4 text-chart-3" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Rider Registration</h1>
              <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
            </div>
          </div>
          <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
        </div>
        <StepIndicator current={step} />
      </div>

      <div className="px-4 py-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Verify Your Identity</h2>
              <p className="text-sm text-muted-foreground">You must be 18+ and have a valid driving license.</p>
            </div>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Aadhaar Verification</h3>
              <Input placeholder="Aadhaar Number" className="font-mono" />
              <Input placeholder="OTP from registered mobile" />
              <Button variant="outline" size="sm" className="w-full text-xs">Send OTP</Button>
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Driving License</h3>
              <Input placeholder="License Number (e.g. BR1420XX000001)" className="font-mono uppercase" />
              <div className="h-28 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
                <div className="text-center">
                  <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Upload DL photo (front)</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Police Verification</h3>
              <p className="text-xs text-muted-foreground">Required by SETU Constitution. Takes 3-5 working days.</p>
              <div className="h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer">
                <p className="text-xs text-muted-foreground">Upload PV Certificate (if available)</p>
              </div>
              <p className="text-[10px] text-muted-foreground">Don't have it yet? Admin will guide you through the process.</p>
            </Card>
            <Button className="w-full" onClick={next}>Next: Vehicle Details <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Your Vehicle</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'Bicycle', icon: '🚲', note: 'Best for 0-3km' },
                { type: 'E-Bike', icon: '⚡', note: 'Best for 0-5km' },
                { type: 'Motorcycle', icon: '🏍️', note: 'Best for 0-10km' },
                { type: 'Cycle Rickshaw', icon: '🛺', note: 'For heavy items' },
              ].map(v => (
                <Card key={v.type} onClick={() => setVehicle(v.type)} className={`p-4 cursor-pointer text-center border-2 transition-all ${vehicle === v.type ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <span className="text-3xl mb-2 block">{v.icon}</span>
                  <p className="text-sm font-semibold">{v.type}</p>
                  <p className="text-[10px] text-muted-foreground">{v.note}</p>
                </Card>
              ))}
            </div>
            {vehicle && (
              <Card className="p-4 border-border space-y-2">
                <h3 className="font-semibold text-sm">Vehicle Details</h3>
                <Input placeholder="Vehicle Number (if applicable)" className="font-mono uppercase" />
                <div className="h-24 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer">
                  <p className="text-xs text-muted-foreground">Upload vehicle photo</p>
                </div>
              </Card>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next} disabled={!vehicle}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Select Your Zone</h2>
            <p className="text-sm text-muted-foreground">You'll receive orders only from your selected zone. Choose wisely based on your location.</p>
            {[
              { name: 'Madhepur Central', riders: 3, avgOrders: 12, earn: '₹720/day avg', load: 'High' },
              { name: 'Laxmipur East', riders: 2, avgOrders: 8, earn: '₹480/day avg', load: 'Medium' },
              { name: 'Parsad South', riders: 1, avgOrders: 5, earn: '₹300/day avg', load: 'Low' },
            ].map(zone => (
              <Card key={zone.name} className="p-4 border-border cursor-pointer hover:border-primary transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{zone.name}</h4>
                  <Badge variant="outline" className={`text-[9px] ${zone.load === 'High' ? 'bg-red-100 text-red-800' : zone.load === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{zone.load} demand</Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bike className="w-3 h-3" /> {zone.riders} riders</span>
                  <span>{zone.avgOrders} avg orders/day</span>
                  <span className="font-medium text-accent">{zone.earn}</span>
                </div>
              </Card>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Rider Training</h2>
            <p className="text-sm text-muted-foreground">Watch these short videos before your first delivery. Takes ~15 minutes.</p>
            {[
              { title: 'How to use the SETU Rider App', duration: '4 min', done: true },
              { title: 'COD Cash Handling Rules', duration: '3 min', done: true },
              { title: 'Safe Delivery Protocols', duration: '3 min', done: false },
              { title: 'Escalation & SOS Procedures', duration: '2 min', done: false },
              { title: 'Code of Conduct & SETU Constitution', duration: '3 min', done: false },
            ].map((v, i) => (
              <Card key={i} className={`p-3 border flex items-center gap-3 ${v.done ? 'bg-green-50 border-green-200' : 'border-border cursor-pointer hover:border-primary'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${v.done ? 'bg-accent text-white' : 'bg-muted'}`}>
                  {v.done ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.duration}</p>
                </div>
                {!v.done && <Button size="sm" variant="outline" className="text-xs h-7">Watch</Button>}
              </Card>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-1">Almost Ready!</h2>
              <p className="text-sm text-muted-foreground">Your application is under review. Expect approval within 24 hours.</p>
            </div>
            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3">Your Earnings Structure</h3>
              {earningsInfo.map((e, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-bold">{e.amount}</span>
                </div>
              ))}
            </Card>
            <Card className="p-3 bg-muted/50 border-border">
              <p className="text-xs text-muted-foreground"><strong>COD Rule:</strong> All cash collected must be deposited at the SETU collection point by 8pm daily. Excess balance >₹2,000 triggers a mandatory deposit.</p>
            </Card>
            <Button className="w-full">Submit Application 🚀</Button>
          </div>
        )}
      </div>
    </div>
  );
}
