'use client';

import { useEffect, useState } from 'react';
import { api, RescueEvent } from '@/lib/api';
import Link from 'next/link';
import clsx from 'clsx';
import { Clock } from 'lucide-react';
import SpotlightCard from '@/components/ui/SpotlightCard';

export default function RescueAlertList({ events: initialEvents }: { events: RescueEvent[] }) {
  const [events, setEvents] = useState<RescueEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEvents.length === 0) {
      setLoading(true);
      api.getRescue('active').then(setEvents).finally(() => setLoading(false));
    }
  }, [initialEvents]);

  const getUrgencyIndicator = (level: string) => {
    switch (level.toUpperCase()) {
      case 'RED': return 'bg-status-critical shadow-sm animate-pulse';
      case 'AMBER': return 'bg-status-warning shadow-sm';
      case 'GREEN': return 'bg-status-success';
      default: return 'bg-slate-100';
    }
  };

  const getUrgencyText = (level: string) => {
    switch (level.toUpperCase()) {
      case 'RED': return 'text-status-critical';
      case 'AMBER': return 'text-status-warning';
      case 'GREEN': return 'text-status-success';
      default: return 'text-content-secondary';
    }
  };

  const formatTime = (hours: number) => {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} T-MINUS`;
  };

  return (
    <SpotlightCard className="p-8 shadow-2xl shadow-black/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
        <h3 className="text-lg font-display text-content-primary uppercase tracking-wide flex items-center gap-3">
          Active Rescue
          {!loading && events.length > 0 && (
            <span className="bg-slate-50 text-accent-primary font-mono font-bold text-[10px] py-1 px-2 rounded-md border border-[#E2E8F0]">
              {events.length}
            </span>
          )}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse border border-[#E2E8F0]"></div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-content-secondary text-sm font-mono text-center py-8">NO ACTIVE RESCUE.</p>
        ) : (
          (() => {
            const active = events.filter(e => e.urgency_level.toUpperCase() !== 'EXPIRED')
                                 .sort((a,b) => a.rescue_window_hours - b.rescue_window_hours);
            const expired = events.filter(e => e.urgency_level.toUpperCase() === 'EXPIRED').slice(0, 2);
            return [...active, ...expired];
          })().map((event) => {
            const isExpired = event.urgency_level.toUpperCase() === 'EXPIRED';
            const isRed = event.urgency_level.toUpperCase() === 'RED';
            return (
              <div key={event.id} className={clsx(
                'p-4 rounded-xl border transition-all flex gap-4', 
                isExpired ? 'opacity-40 border-[#E2E8F0] bg-slate-50' : 'bg-slate-50 border-[#E2E8F0] hover:bg-slate-50'
              )}>
                <div className="flex flex-col items-center gap-2 mt-1 shrink-0">
                  <div className={clsx('w-2 h-2 rounded-full', getUrgencyIndicator(event.urgency_level))} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className={clsx('text-sm font-display font-bold truncate uppercase tracking-wide', isExpired ? 'text-content-secondary line-through' : 'text-content-primary')}>{event.category}</p>
                    <span className={clsx('font-mono font-bold whitespace-nowrap ml-2', isExpired ? 'text-content-secondary line-through' : 'text-accent-secondary')}>{event.quantity_kg} <span className="text-xs opacity-70">kg</span></span>
                  </div>
                  <p className="text-[11px] font-mono text-content-secondary truncate mb-3 uppercase tracking-wider">{event.kitchen_name}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className={clsx('flex items-center gap-1.5 font-mono font-bold text-xs tabular-nums', getUrgencyText(event.urgency_level))}>
                      <Clock size={12} className={isRed && !isExpired ? 'animate-pulse' : ''} />
                      {isExpired ? 'EXPIRED' : formatTime(event.rescue_window_hours)}
                    </div>
                    {event.status && (
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-content-secondary border border-[#E2E8F0] bg-slate-50 px-1.5 py-0.5 rounded-sm">
                        {event.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Link href="/rescue" className="mt-6 text-center block text-[11px] font-display font-bold uppercase tracking-wide text-accent-secondary hover:text-content-primary transition-colors">
        View All Alerts &rarr;
      </Link>
    </SpotlightCard>
  );
}
