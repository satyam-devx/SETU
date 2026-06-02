import React from 'react';
import { MapPin, Star, Calendar, Clock, IndianRupee, CheckCircle, Phone, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';

const provider = { name: 'Rajesh Electrician', category: 'Electrician', rating: 4.7, jobsCompleted: 156, todayEarnings: 1200, isAvailable: true };

const jobRequests = [
  { id: 'j1', customer: 'Mohan Lal', village: 'Madhepur', service: 'Wiring repair', date: '2025-05-31', time: '2:00 PM', budget: '₹500-800', status: 'new', distance: '1.2 km' },
  { id: 'j2', customer: 'Priya Singh', village: 'Laxmipur', service: 'Fan installation', date: '2025-06-01', time: '10:00 AM', budget: '₹300-500', status: 'new', distance: '3.5 km' },
  { id: 'j3', customer: 'Anita Devi', village: 'Madhepur', service: 'Switch replacement', date: '2025-05-31', time: '5:00 PM', budget: '₹200-300', status: 'accepted', distance: '0.8 km' },
];

export default function SevaDashboard() {
  return (
    <div className="pb-20">
      <AppHeader title={provider.name} subtitle={provider.category} notificationCount={2} rightAction={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Available</span>
          <Switch defaultChecked={provider.isAvailable} />
        </div>
      } />

      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <StatCard title="Today's Earnings" value={`₹${provider.todayEarnings}`} icon={IndianRupee} />
        <StatCard title="Jobs Completed" value={provider.jobsCompleted.toString()} subtitle={`${provider.rating} ★ rating`} icon={CheckCircle} />
      </div>

      <div className="px-4 mb-4">
        <h3 className="font-semibold text-sm mb-2">New Job Requests</h3>
        {jobRequests.filter(j => j.status === 'new').map(job => (
          <Card key={job.id} className="p-4 border-border mb-2 bg-primary/5 border-primary/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold">{job.service}</h4>
                <p className="text-xs text-muted-foreground">{job.customer} · {job.village}</p>
              </div>
              <Badge className="bg-primary/10 text-primary text-[9px] border-0">New</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {job.date}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.time}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.distance}</span>
            </div>
            <p className="text-xs font-medium mb-3">Budget: {job.budget}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs">Accept</Button>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">Decline</Button>
              <Button size="sm" variant="outline" className="h-8 w-8 shrink-0"><Phone className="w-3 h-3" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="px-4">
        <h3 className="font-semibold text-sm mb-2">Upcoming Jobs</h3>
        {jobRequests.filter(j => j.status === 'accepted').map(job => (
          <Card key={job.id} className="p-4 border-border mb-2">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold">{job.service}</h4>
                <p className="text-xs text-muted-foreground">{job.customer} · {job.village}</p>
              </div>
              <Badge className="bg-accent/10 text-accent text-[9px] border-0">Accepted</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {job.date}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.time}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"><Phone className="w-3 h-3 mr-1" /> Call</Button>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"><MessageSquare className="w-3 h-3 mr-1" /> Chat</Button>
              <Button size="sm" className="flex-1 h-8 text-xs bg-accent hover:bg-accent/90">Start Job</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}