'use client';

import { NGOMatch, RescueEvent } from '@/lib/api';
import { CheckCircle2, XCircle, MapPin, Scale, Clock } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface NGOMatchListProps {
  matches: NGOMatch[];
  rescueEvent: RescueEvent | null;
  isLoading: boolean;
}

export default function NGOMatchList({ matches, rescueEvent, isLoading }: NGOMatchListProps) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-1/2 bg-slate-100 rounded animate-pulse mb-6"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-ink-surface rounded-sm border border-ink-raised animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (!rescueEvent) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-ink-raised bg-ink-surface rounded-t-sm">
        <h2 className="font-display font-bold text-content-primary tracking-wide uppercase">
          Matching Results: <span className="text-accent-primary">{rescueEvent.category}</span>
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-wide text-content-secondary mt-1">
          ROUTING TO RESCUE {rescueEvent.quantity_kg}kg
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {matches.length === 0 ? (
          <div className="text-center py-10 bg-ink-surface rounded-sm border border-ink-raised">
            <p className="font-mono text-sm text-status-critical uppercase tracking-wide">No eligible NGOs found</p>
            <p className="font-mono text-xs text-content-secondary mt-2 uppercase tracking-wide max-w-[80%] mx-auto">(Capacity, distance, or time constraints violated)</p>
          </div>
        ) : (
          matches.map((match, idx) => {
            const isBestMatch = idx === 0 && match.match_score > 80;
            const scoreColor = 
              match.match_score >= 80 ? 'text-status-success' :
              match.match_score >= 60 ? 'text-status-warning' : 'text-status-critical';

            return (
              <div key={match.ngo_id} className={clsx("p-5 rounded-sm border transition-all", isBestMatch ? "bg-slate-100 border-accent-secondary" : "bg-ink-surface border-ink-raised")}>
                {isBestMatch && (
                  <div className="text-[10px] font-mono text-accent-secondary uppercase tracking-wide mb-2 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse" />
                    Optimal Route Recommended
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display font-bold text-content-primary text-lg  tracking-wide">{match.ngo_name}</h3>
                    <p className="text-xs font-mono text-content-secondary mt-1 uppercase">{match.contact_name} &middot; {match.contact_phone}</p>
                  </div>
                  <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-white"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={scoreColor}
                        strokeWidth="4"
                        strokeDasharray={`${match.match_score}, 100`}
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold text-content-primary">
                      {Math.round(match.match_score)}%
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-1 bg-ink-base text-content-secondary rounded-sm border border-ink-raised flex items-center gap-1.5">
                    <Clock size={12} className={match.eta_minutes > 45 ? "text-status-warning" : "text-accent-secondary"} />
                    {match.eta_minutes} min ETA
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-1 bg-ink-base text-content-secondary rounded-sm border border-ink-raised flex items-center gap-1.5">
                    <MapPin size={12} className="text-accent-secondary" />
                    {match.distance_km} km
                  </span>
                </div>

                <div className="space-y-2 mb-5 border-t border-ink-raised pt-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-content-secondary uppercase">
                    <CheckCircle2 size={14} className="text-status-success shrink-0" />
                    <span className="truncate">{match.match_reason}</span>
                  </div>
                </div>

                <button 
                  onClick={() => alert(`DISPATCH CONFIRMED: ${match.ngo_name}`)}
                  className={clsx(
                    "w-full font-mono font-medium py-2 rounded-sm transition-colors text-xs uppercase tracking-wide border",
                    isBestMatch 
                      ? "bg-accent-primary text-white hover:bg-opacity-90 border-transparent" 
                      : "bg-ink-surface text-content-primary hover:bg-slate-100 border-ink-raised hover:border-content-secondary"
                  )}
                >
                  Confirm Dispatch
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
