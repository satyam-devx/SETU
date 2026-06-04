import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, IndianRupee, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppHeader from '@/components/shared/AppHeader';
import EmptyState from '@/components/shared/EmptyState';
import { SevaAPI } from '@/lib/api';
import { SEVA_CATEGORIES } from '@/lib/mockData';

const OPEN_JOBS = [
  { id: 'j1', title: 'Electrical wiring repair', category: 'Electrician', village: 'Madhepur', distance: '1.2 km', amount: 450, urgency: 'today',   customer: 'Ram Kumar',   phone: '+91 94501 11100', description: 'MCB tripping repeatedly. Need urgent fix.' },
  { id: 'j2', title: 'Water pump installation', category: 'Plumber',     village: 'Laxmipur', distance: '3.4 km', amount: 800, urgency: 'tomorrow', customer: 'Sunita Devi',  phone: '+91 94501 11101', description: 'New submersible pump, needs fitting.' },
  { id: 'j3', title: 'Roof tile replacement',   category: 'Mason',       village: 'Parsad',   distance: '5.1 km', amount: 1200,urgency: 'weekend',  customer: 'Mohan Lal',   phone: '+91 94501 11102', description: 'About 20 tiles cracked after rain.' },
  { id: 'j4', title: 'Crop pest inspection',    category: 'Agriculture', village: 'Madhepur', distance: '0.8 km', amount: 300, urgency: 'today',   customer: 'Rekha Singh',  phone: '+91 94501 11103', description: 'Yellow leaves on paddy crop. Need advice.' },
  { id: 'j5', title: 'Window frame carpentry',  category: 'Carpenter',   village: 'Madhepur', distance: '2.1 km', amount: 650, urgency: 'flexible', customer: 'Arjun Prasad', phone: '+91 94501 11104', description: 'Wooden window frame broken, needs repair.' },
];

const urgencyStyle = {
  today:    'bg-red-100 text-red-700',
  tomorrow: 'bg-amber-100 text-amber-700',
  weekend:  'bg-blue-100 text-blue-700',
  flexible: 'bg-green-100 text-green-700',
};

export default function SevaJobs() {
  const [tab, setTab]       = useState('available');
  const [query, setQuery]   = useState('');
  const [accepting, setAccepting] = useState(null);
  const [accepted, setAccepted]   = useState(new Set());

  const filtered = OPEN_JOBS.filter(j =>
    !query || j.title.toLowerCase().includes(query.toLowerCase()) || j.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleAccept = (jobId) => {
    setAccepting(jobId);
    SevaAPI.acceptJob(jobId).then(() => {
      setAccepted(s => new Set([...s, jobId]));
      setAccepting(null);
    });
  };

  return (
    <div className="pb-20">
      <AppHeader title="Available Jobs" subtitle={`${OPEN_JOBS.length} jobs near you`} />
      <div className="px-4 py-3 space-y-3">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9 h-8 text-sm" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', ...SEVA_CATEGORIES.map(c => c.name)].map(cat => (
            <button key={cat} className="text-xs px-3 py-1 rounded-full border border-border bg-card shrink-0 first:bg-primary first:text-white first:border-primary">
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No jobs found" description="Try different search terms" />
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <Card key={job.id} className={`border ${accepted.has(job.id) ? 'border-green-300 bg-green-50/30' : 'border-border'}`}>
                <Link to={`/seva/jobs/${job.id}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.category} · {job.customer}</p>
                      </div>
                      <Badge className={`text-[9px] border-0 shrink-0 ml-2 ${urgencyStyle[job.urgency]}`}>
                        {job.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.village} · {job.distance}</span>
                      <span className="flex items-center gap-1 font-bold text-foreground"><IndianRupee className="w-3 h-3" />₹{job.amount}</span>
                    </div>
                  </div>
                </Link>
                {!accepted.has(job.id) ? (
                  <div className="px-4 pb-3 flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs"
                      disabled={accepting === job.id}
                      onClick={() => handleAccept(job.id)}>
                      {accepting === job.id ? 'Accepting...' : 'Accept Job'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">View Details</Button>
                  </div>
                ) : (
                  <div className="px-4 pb-3">
                    <Badge className="w-full justify-center bg-green-100 text-green-700 border-0 py-1.5">
                      ✓ Accepted — check schedule
                    </Badge>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
