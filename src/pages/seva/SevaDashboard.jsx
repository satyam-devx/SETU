import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, IndianRupee, Star, MapPin, Calendar, ChevronRight, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AppHeader from '@/components/shared/AppHeader';
import StatCard from '@/components/shared/StatCard';
import { SevaAPI } from '@/lib/api';
import { SEVA_PROVIDERS, SEVA_CATEGORIES } from '@/lib/mockData';

const provider = SEVA_PROVIDERS[0];

export default function SevaDashboard() {
  const [available, setAvailable] = useState(true);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    SevaAPI.getJobs(provider.id).then(({ data }) => data && setJobs(data));
  }, []);

  const pendingJobs = jobs.filter(j => j.status === 'pending');

  return (
    <div className="pb-20">
      <AppHeader
        title={provider.name}
        subtitle={provider.skills.join(' · ')}
        notificationCount={pendingJobs.length}
        rightAction={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{available ? 'Available' : 'Busy'}</span>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="This Month"   value={`₹${provider.monthlyEarnings.toLocaleString()}`} icon={IndianRupee} trend="↑22% vs last" trendUp />
          <StatCard title="Jobs Done"    value={String(provider.completedJobs)} icon={Briefcase} subtitle="this month" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Rating"       value={`${provider.rating} ★`} icon={Star} subtitle={`${provider.reviewCount} reviews`} />
          <StatCard title="Trust Score"  value={String(provider.trustScore)} icon={Star} trend="Verified" trendUp />
        </div>

        {/* Pending jobs alert */}
        {pendingJobs.length > 0 && (
          <Link to="/seva/jobs">
            <Card className="p-3 border-amber-300 bg-amber-50/60 flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{pendingJobs.length} new job request{pendingJobs.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-amber-700">Tap to review and accept</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </Card>
          </Link>
        )}

        {/* Upcoming jobs from API */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Upcoming Jobs</h3>
            <Link to="/seva/schedule" className="text-xs text-primary font-medium">View schedule</Link>
          </div>
          {jobs.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Briefcase className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming jobs</p>
              <Link to="/seva/jobs">
                <Button size="sm" className="mt-2">Browse Jobs</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <Card key={job.id} className="p-3 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.customer} · {job.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">₹{job.amount}</p>
                      <Badge className={`text-[9px] border-0 ${job.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Skills */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-2">My Skills</h3>
          <div className="flex flex-wrap gap-2">
            {provider.skills.map(skill => (
              <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
            ))}
          </div>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          <Link to="/seva/jobs">
            <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
              <Briefcase className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Find Jobs</span>
            </Card>
          </Link>
          <Link to="/seva/earnings">
            <Card className="p-3 border-border flex items-center gap-2 hover:bg-muted/40 transition-colors">
              <IndianRupee className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Earnings</span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
