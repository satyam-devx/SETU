import React, { useState } from 'react';
import { MapPin, Phone, MessageSquare, CheckCircle, Clock, Camera, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppHeader from '@/components/shared/AppHeader';

const job = {
  id: 'JOB-304',
  service: 'Plumbing Repair',
  customer: 'Sunita Devi',
  phone: '+91 94501 23456',
  address: 'House No. 12, Ward 3, Rampur Village',
  scheduled: 'Today, 2:00 PM',
  duration: '~2 hours',
  amount: 800,
  status: 'in_progress',
  notes: 'Leaking pipe under kitchen sink. Customer says it started 2 days ago.',
};

const steps = ['Arrived', 'Work Started', 'Work Completed', 'Payment Collected'];

export default function SevaJobDetail() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="pb-24">
      <AppHeader title="Job Details" subtitle={job.id} showBack />

      <div className="px-4 py-3 space-y-3">
        <Card className="p-4 border-border">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="font-bold text-base">{job.service}</h2>
              <p className="text-xs text-muted-foreground">{job.id}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
          </div>
          <Separator className="my-2" />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{job.scheduled} · {job.duration}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{job.address}</span>
            </div>
          </div>
          {job.notes && (
            <div className="mt-3 p-2 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Customer Notes</p>
              <p className="text-xs">{job.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-1">{job.customer}</h3>
          <p className="text-xs text-muted-foreground mb-3">{job.phone}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1">
              <Phone className="w-4 h-4" /> Call
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1">
              <MessageSquare className="w-4 h-4" /> Message
            </Button>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">Job Progress</h3>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${i < currentStep ? 'bg-green-500' : i === currentStep ? 'bg-primary' : 'bg-muted'}`}>
                  {i < currentStep
                    ? <CheckCircle className="w-4 h-4 text-white" />
                    : <span className="text-xs text-white font-bold">{i + 1}</span>}
                </div>
                <span className={`text-sm ${i === currentStep ? 'font-semibold' : i < currentStep ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>{step}</span>
              </div>
            ))}
          </div>
          {currentStep < steps.length && (
            <Button className="w-full mt-4" onClick={() => setCurrentStep(s => Math.min(s + 1, steps.length))}>
              Mark: {steps[currentStep]}
            </Button>
          )}
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Job Amount</p>
              <p className="text-2xl font-bold">₹{job.amount}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              <Camera className="w-4 h-4" /> Add Photo
            </Button>
          </div>
        </Card>

        <Button variant="outline" className="w-full text-destructive border-destructive/30 gap-2">
          <AlertTriangle className="w-4 h-4" /> Report Issue
        </Button>
      </div>
    </div>
  );
}
