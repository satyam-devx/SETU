import React, { useState } from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/shared/AppHeader';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const slots = [
  { day: 'Mon', time: '09:00 AM', job: 'Plumbing — Sharma Ji', status: 'confirmed' },
  { day: 'Wed', time: '11:00 AM', job: 'Electrician — Devi Store', status: 'confirmed' },
  { day: 'Thu', time: '02:00 PM', job: 'Carpentry — New Shop', status: 'pending' },
  { day: 'Sat', time: '10:00 AM', job: 'Plumbing — Water Tank', status: 'confirmed' },
];

const statusStyle = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function SevaSchedule() {
  const [selectedDay, setSelectedDay] = useState('Mon');
  const daySlots = slots.filter(s => s.day === selectedDay);

  return (
    <div className="pb-6">
      <AppHeader title="My Schedule" showBack />
      <div className="px-4 py-4 space-y-4">

        {/* Week strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map(d => {
            const hasJob = slots.some(s => s.day === d);
            const isSelected = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary text-white border-primary'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <span className="text-xs font-medium">{d}</span>
                {hasJob && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Day jobs */}
        <div>
          <h3 className="font-semibold text-sm mb-2">{selectedDay} — Schedule</h3>
          {daySlots.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No jobs scheduled for {selectedDay}</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1">
                <Plus className="w-3 h-3" /> Mark Availability
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {daySlots.map((slot, i) => (
                <Card key={i} className="p-4 border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{slot.job}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{slot.time}</span>
                      </div>
                    </div>
                    <Badge className={`text-[9px] border-0 ${statusStyle[slot.status]}`}>
                      {slot.status}
                    </Badge>
                  </div>
                  {slot.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 h-7 text-xs">Accept</Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">Decline</Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Weekly summary */}
        <Card className="p-4 border-border">
          <h3 className="font-semibold text-sm mb-3">This Week</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-primary">4</p>
              <p className="text-[10px] text-muted-foreground">Jobs Booked</p>
            </div>
            <div>
              <p className="text-xl font-bold">3</p>
              <p className="text-[10px] text-muted-foreground">Confirmed</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">1</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>

        <Button variant="outline" className="w-full gap-2 border-dashed">
          <Plus className="w-4 h-4" /> Mark Available Slot
        </Button>
      </div>
    </div>
  );
}
