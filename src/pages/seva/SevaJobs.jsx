import React, { useState } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';

const allJobs = [
  { id: 'j1', customer: 'Mohan Lal', service: 'Wiring repair', village: 'Madhepur', date: '2025-05-31', time: '2:00 PM', status: 'upcoming', amount: 600 },
  { id: 'j2', customer: 'Priya Singh', service: 'Fan installation', village: 'Laxmipur', date: '2025-06-01', time: '10:00 AM', status: 'upcoming', amount: 400 },
  { id: 'j3', customer: 'Raj Kumar', service: 'MCB replacement', village: 'Madhepur', date: '2025-05-30', time: '3:00 PM', status: 'completed', amount: 350, rating: 5 },
  { id: 'j4', customer: 'Rekha Kumari', service: 'Full house wiring', village: 'Parsad', date: '2025-05-28', time: '9:00 AM', status: 'completed', amount: 2500, rating: 4 },
  { id: 'j5', customer: 'Anita Devi', service: 'Light fixture', village: 'Madhepur', date: '2025-05-27', time: '4:00 PM', status: 'completed', amount: 300, rating: 5 },
];

export default function SevaJobs() {
  const [tab, setTab] = useState('upcoming');
  const jobs = allJobs.filter(j => j.status === tab);

  return (
    <div className="pb-20">
      <AppHeader title="Jobs" />
      <div className="px-4 py-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="px-4 space-y-2">
        {jobs.map(job => (
          <Card key={job.id} className="p-4 border-border">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold">{job.service}</h4>
                <p className="text-xs text-muted-foreground">{job.customer} · {job.village}</p>
              </div>
              <span className="text-sm font-bold">₹{job.amount}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {job.date}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.time}</span>
            </div>
            {job.status === 'completed' && job.rating && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({length: job.rating}).map((_, i) => <Star key={i} className="w-3 h-3 text-primary fill-primary" />)}
                <span className="text-xs text-muted-foreground ml-1">Customer rating</span>
              </div>
            )}
            {job.status === 'upcoming' && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 h-8 text-xs">Start Job</Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">Reschedule</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}