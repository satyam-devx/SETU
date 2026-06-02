import React, { useState } from 'react';
import { CheckCircle, Camera, ChevronRight, Award, Star, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const SKILL_TESTS = {
  Electrician: [
    { q: 'What is the standard voltage in Indian homes?', options: ['110V', '220V', '380V', '440V'], correct: 1 },
    { q: 'Which wire is the earth/ground wire?', options: ['Red', 'Yellow', 'Green', 'Black'], correct: 2 },
    { q: 'What does an ELCB protect against?', options: ['Overload', 'Short circuit', 'Earth leakage', 'Power surge'], correct: 2 },
  ],
  Plumber: [
    { q: 'What is PVC pipe full form?', options: ['Poly Vinyl Chloride', 'Poly Vinyl Copper', 'Porous Vinyl Clamp', 'Plastic Vinyl Conduit'], correct: 0 },
  ],
};

const STEPS = [
  { id: 1, label: 'Identity & Skill' },
  { id: 2, label: 'Portfolio' },
  { id: 3, label: 'Skill Test' },
  { id: 4, label: 'Go Live' },
];

export default function SevaVerification() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const next = () => setStep(s => Math.min(s + 1, 4));
  const back = () => setStep(s => Math.max(s - 1, 1));
  const questions = SKILL_TESTS[category] || [];
  const score = questions.length > 0 ? Math.round((Object.values(answers).filter((a, i) => a === questions[i]?.correct).length / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="sticky top-0 bg-card z-10 border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-chart-4/20 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-chart-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm">Seva Provider Verification</h1>
              <p className="text-[10px] text-muted-foreground">Step {step} of {STEPS.length}</p>
            </div>
          </div>
          <Progress value={(step / STEPS.length) * 100} className="w-16 h-1.5" />
        </div>
        <div className="flex items-center px-4 py-2 gap-1">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.id < step ? 'bg-accent text-white' : s.id === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                {s.id < step ? '✓' : s.id}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${s.id < step ? 'bg-accent' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="px-4 py-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Identity & Skills</h2>
              <p className="text-sm text-muted-foreground">Tell us about yourself and your skill set.</p>
            </div>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Personal Details</h3>
              <Input placeholder="Full Name" />
              <Input placeholder="Mobile Number" />
              <Input placeholder="Aadhaar Number" className="font-mono" />
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Your Skill</h3>
              <Select onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Primary Skill Category" /></SelectTrigger>
                <SelectContent>
                  {['Electrician','Plumber','Tailoring','Beauty & Salon','Tutoring','Carpentry','Painting','Farming Help','AC Repair','Mobile Repair'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Years of experience (e.g. 5 years)" />
              <Textarea placeholder="Describe your work experience..." rows={3} />
            </Card>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Certifications (if any)</h3>
              <p className="text-xs text-muted-foreground">ITI certificate, training completion, etc.</p>
              <div className="h-20 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border cursor-pointer">
                <p className="text-xs text-muted-foreground">Upload certificate photos</p>
              </div>
            </Card>
            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-2">Village Anchor Vouching</h3>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">RD</div>
                <div>
                  <p className="text-sm font-medium">Ramkali Devi</p>
                  <p className="text-xs text-muted-foreground">Village Anchor</p>
                </div>
                <Badge className="ml-auto bg-amber-100 text-amber-800 border-0 text-[9px]">Pending</Badge>
              </div>
            </Card>
            <Button className="w-full" onClick={next}>Next: Portfolio <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-1">Your Work Portfolio</h2>
            <p className="text-sm text-muted-foreground">Show customers examples of your past work. Good photos lead to 3x more bookings.</p>
            <div className="grid grid-cols-2 gap-3">
              {Array(4).fill(null).map((_, i) => (
                <div key={i} className="aspect-square bg-muted rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors">
                  <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">Add photo {i + 1}</p>
                </div>
              ))}
            </div>
            <Card className="p-4 border-border space-y-2">
              <h3 className="font-semibold text-sm">Past Work Proof</h3>
              <p className="text-xs text-muted-foreground">Add 3 references from past customers (name + phone). They may be contacted.</p>
              {[1, 2, 3].map(n => (
                <div key={n} className="flex gap-2">
                  <Input placeholder={`Reference ${n} name`} className="flex-1" />
                  <Input placeholder="Phone" className="w-28" />
                </div>
              ))}
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next}>Next: Skill Test <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Skill Assessment</h2>
              <p className="text-sm text-muted-foreground">Pass this short test to earn a SETU Verified badge. Score 70%+ to pass.</p>
            </div>
            {!submitted ? (
              <>
                {questions.map((q, qi) => (
                  <Card key={qi} className="p-4 border-border">
                    <p className="text-sm font-medium mb-3">Q{qi + 1}. {q.q}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <button key={oi} onClick={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${answers[qi] === oi ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/50'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </Card>
                ))}
                <Button className="w-full" onClick={() => setSubmitted(true)}>Submit Test</Button>
              </>
            ) : (
              <div className="text-center py-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${score >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {score >= 70 ? <Award className="w-10 h-10 text-accent" /> : <span className="text-3xl">⚠️</span>}
                </div>
                <h3 className="text-2xl font-bold mb-1">{score}%</h3>
                <p className="text-sm text-muted-foreground mb-4">{score >= 70 ? '🎉 You passed! SETU Verified badge earned.' : 'Score below 70%. Please retake.'}</p>
                {score >= 70 && (
                  <Badge className="bg-accent text-white border-0 text-sm px-4 py-1">
                    <Star className="w-3.5 h-3.5 mr-1 fill-white" /> SETU Verified — {category}
                  </Badge>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={back}>Back</Button>
              <Button className="flex-1" onClick={next} disabled={!submitted || score < 70}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold mb-1">You're All Set!</h2>
              <p className="text-sm text-muted-foreground">Profile under admin review. Go live in 24 hours.</p>
            </div>
            <Card className="p-4 border-border">
              <h3 className="font-semibold text-sm mb-3">Your Pricing Setup</h3>
              <Input placeholder="Base hourly rate (₹)" defaultValue="300" className="mb-2" />
              <div className="flex gap-2 mb-2">
                <Input placeholder="Min charge (₹)" className="flex-1" defaultValue="200" />
                <Input placeholder="Visit charge (₹)" className="flex-1" defaultValue="50" />
              </div>
              <p className="text-[10px] text-muted-foreground">SETU fee: 10% per job. Paid to you next day after job completion confirmation.</p>
            </Card>
            <Card className="p-3 bg-muted/50 border-border">
              <p className="text-xs text-muted-foreground"><strong>Seva Constitution:</strong> Arrive on time, complete quality work, accept payment only via SETU app. Disputes unresolved in 48h result in account review.</p>
            </Card>
            <Button className="w-full">Submit Profile 🚀</Button>
          </div>
        )}
      </div>
    </div>
  );
}
