'use client';

import { useEffect, useState } from 'react';
import { api, RescueEvent, NGOMatch } from '@/lib/api';
import NGOMatchList from '@/components/rescue/NGOMatchList';
import clsx from 'clsx';
import { Clock } from 'lucide-react';

const categoryEmojis: Record<string, string> = {
  rice: '🍚',
  dal: '🫘',
  curry: '🥘',
  roti: '🫓',
  salad: '🥗',
  dessert: '🍮',
  sambar: '🍲',
  milk: '🥛'
};

export default function RescuePage() {
  const [events, setEvents] = useState<RescueEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RescueEvent | null>(null);
  const [matches, setMatches] = useState<NGOMatch[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRescue('active')
      .then((data) => {
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...data].sort((a, b) => 
          (urgencyOrder[a.urgency_level.toLowerCase()] ?? 4) - (urgencyOrder[b.urgency_level.toLowerCase()] ?? 4)
        );
        setEvents(sorted);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingEvents(false));
  }, []);

  const handleSelectEvent = async (event: RescueEvent) => {
    setSelectedEvent(event);
    setLoadingMatches(true);
    try {
      const matchData = await api.getMatches(event.id);
      setMatches(matchData);
    } catch (err: any) {
      console.error(err);
      // Fallback empty on error just in case
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency.toUpperCase()) {
      case 'RED': return 'bg-status-critical/10 text-status-critical border-status-critical/30';
      case 'AMBER': return 'bg-status-warning/10 text-status-warning border-status-warning/30';
      case 'GREEN': return 'bg-status-success/10 text-status-success border-status-success/30';
      case 'EXPIRED': return 'bg-slate-100 text-content-secondary border-ink-raised';
      default: return 'bg-slate-100 text-content-secondary border-ink-raised';
    }
  };

  const formatTime = (decimalHours: number) => {
    if (decimalHours <= 0) return '0m';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="p-8 h-screen flex flex-col max-w-7xl mx-auto">
      <div className="mb-6 shrink-0 border-b border-ink-raised pb-4">
        <h1 className="text-3xl font-display font-bold text-content-primary mb-6">Rescue & Matching</h1>
        <p className="text-content-secondary mt-1 font-mono text-sm tracking-wide uppercase">Triage Queue &middot; Dispatch Control</p>
      </div>

      {error && (
        <div className="bg-status-critical/10 text-status-critical p-4 rounded-sm border border-status-critical/20 mb-6 shrink-0 font-mono text-sm">
          ERROR: {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Rescue Events */}
        <div className="w-full lg:w-1/2 flex flex-col h-[50vh] lg:h-full bg-ink-surface rounded-sm border border-ink-raised">
          <div className="p-4 border-b border-ink-raised">
            <h2 className="font-display font-bold text-content-primary tracking-wide uppercase flex items-center gap-2">
              Active Rescue
              <span className="bg-slate-100 text-accent-primary font-mono text-[10px] py-0.5 px-1.5 rounded-sm">
                {events.length}
              </span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingEvents ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 bg-slate-100 rounded-sm animate-pulse"></div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="text-center text-content-secondary font-mono text-sm py-10 uppercase tracking-wide">No active rescue.</p>
            ) : (
              events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const isExpired = event.urgency_level.toUpperCase() === 'EXPIRED';
                const isRed = event.urgency_level.toUpperCase() === 'RED';
                
                return (
                  <div 
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    className={clsx(
                      'p-4 rounded-sm border cursor-pointer transition-all flex gap-3',
                      isSelected 
                        ? 'border-accent-primary bg-slate-100 shadow-sm' 
                        : isExpired ? 'border-ink-raised bg-ink-base opacity-50'
                        : isRed ? 'border-status-critical/30 bg-slate-100/50'
                        : 'border-ink-raised bg-ink-surface hover:bg-slate-100'
                    )}
                  >
                    <div className="flex flex-col items-center gap-2 mt-1 shrink-0">
                      <div className={clsx('w-2 h-2 rounded-full', 
                        isExpired ? 'bg-content-secondary' : 
                        isRed ? 'bg-status-critical shadow-sm animate-pulse' : 
                        event.urgency_level.toUpperCase() === 'AMBER' ? 'bg-status-warning' : 'bg-status-success')} 
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className={clsx("font-medium uppercase tracking-wider text-sm", isExpired ? "text-content-secondary line-through" : "text-content-primary")}>
                            {event.category}
                          </h3>
                          <p className="text-[11px] font-mono text-content-secondary uppercase truncate">{event.kitchen_name}</p>
                        </div>
                        <div className="text-right">
                          <span className={clsx("text-lg font-mono font-bold", isExpired ? "text-content-secondary line-through" : "text-accent-secondary")}>{event.quantity_kg}</span>
                          <span className="text-xs font-mono text-content-secondary ml-1">kg</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-ink-raised pt-2">
                        <div className="flex gap-2">
                          <span className={clsx('text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-sm border', getUrgencyBadge(event.urgency_level))}>
                            {event.urgency_level}
                          </span>
                          {!isExpired && (
                            <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-content-secondary rounded-sm border border-ink-raised">
                              {event.status}
                            </span>
                          )}
                        </div>
                        
                        <div className={clsx("flex items-center gap-1.5 font-mono text-xs tabular-nums", 
                            isExpired ? "text-content-secondary" : 
                            event.rescue_window_hours < 2 ? "text-status-critical" : "text-content-secondary")}>
                          <Clock size={12} className={!isExpired && event.rescue_window_hours < 2 ? 'animate-pulse' : ''} />
                          {isExpired ? 'EXPIRED' : `${formatTime(event.rescue_window_hours)} T-MINUS`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Manual Entry Form */}
          <div className="p-4 border-t border-ink-raised bg-ink-base rounded-b-sm">
            <h3 className="font-mono text-content-secondary mb-2 text-xs  tracking-wide">Manual Entry Override</h3>
            <form 
              className="flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const cat = (form.elements.namedItem('category') as HTMLInputElement).value;
                const qty = parseFloat((form.elements.namedItem('quantity') as HTMLInputElement).value);
                const hrs = parseFloat((form.elements.namedItem('hours') as HTMLInputElement).value);
                try {
                  await api.createManualRescue({
                    kitchen_id: 1, // K1_MainCampus
                    category_name: cat,
                    quantity_kg: qty,
                    hours_remaining_override: hrs
                  });
                  alert('Event seeded successfully!');
                  window.location.reload();
                } catch(err: any) {
                  alert('Error: ' + err.message);
                }
              }}
            >
              <div className="flex gap-2">
                <select name="category" className="flex-1 p-2 bg-ink-surface border border-ink-raised rounded-sm text-xs font-mono text-content-primary" required defaultValue="Rice">
                  <option value="Rice">Rice</option>
                  <option value="Dal">Dal</option>
                  <option value="Vegetable_Curry">Vegetable_Curry</option>
                  <option value="Roti_Bread">Roti_Bread</option>
                </select>
                <input name="quantity" type="number" placeholder="Qty (kg)" step="0.1" required className="w-20 p-2 bg-ink-surface border border-ink-raised rounded-sm text-xs font-mono text-content-primary focus:border-accent-primary focus:outline-none" />
                <input name="hours" type="number" placeholder="Hrs Left" step="0.5" required className="w-20 p-2 bg-ink-surface border border-ink-raised rounded-sm text-xs font-mono text-content-primary focus:border-accent-primary focus:outline-none" />
                <button type="submit" className="bg-slate-100 text-accent-primary border border-accent-primary/50 hover:bg-accent-primary hover:text-white px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wide transition-colors">Seed</button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: NGO Matches */}
        <div className="w-full lg:w-1/2 flex flex-col h-[50vh] lg:h-full bg-ink-base rounded-sm border border-ink-raised">
          {!selectedEvent ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-content-secondary font-mono text-sm tracking-wide uppercase">Select an event to match</p>
            </div>
          ) : (
            <NGOMatchList 
              matches={matches} 
              rescueEvent={selectedEvent} 
              isLoading={loadingMatches} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
