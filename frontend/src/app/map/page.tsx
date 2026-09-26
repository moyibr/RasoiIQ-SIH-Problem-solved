'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, RouteResponse, NGOMatch } from '@/lib/api';
import { Navigation2, Clock, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-full bg-ink-base animate-pulse flex items-center justify-center text-content-secondary">
      Loading map...
    </div>
  )
});

export default function MapPage() {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [ngos, setNgos] = useState<NGOMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const [activeRescueId, setActiveRescueId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const events = await api.getRescue('ACTIVE');
        if (events.length > 0) {
          const id = events[0].id;
          setActiveRescueId(id);
          const ngoData = await api.getMatches(id);
          setNgos(ngoData);
        } else {
          setNgos([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOptimize = async () => {
    if (!activeRescueId) {
      setError("No active rescue event to route.");
      return;
    }
    try {
      setOptimizing(true);
      setError(null);
      // Pass the active rescue delivery ID. Note: deliveries may not exist yet in demo, but we use the rescue ID as a proxy delivery ID for the demo spec
      const routeData = await api.optimizeRoute(1, [activeRescueId]);
      setRoute(routeData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-content-secondary font-mono text-sm uppercase tracking-wide">
        <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
        Loading map data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-status-critical/10 text-status-critical p-4 rounded-sm border border-status-critical/20 font-mono text-sm uppercase tracking-wide">
          ERROR: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full relative">
      <div className="p-6 pb-4 shrink-0 bg-ink-base border-b border-ink-raised z-10 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-display font-bold text-content-primary mb-6">Map / Routing</h1>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="bg-accent-primary text-white px-4 py-2 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            {optimizing ? 'Optimizing...' : 'Optimize Route'}
          </button>
        </div>
        
        {route ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3 bg-ink-surface px-4 py-3 rounded-sm border border-ink-raised">
                <Navigation2 className="text-accent-secondary" size={24} />
                <div>
                  <p className="text-[10px] text-content-secondary font-mono uppercase tracking-wide">Total Distance</p>
                  <p className="font-mono font-bold text-content-primary text-xl tabular-nums">{route.total_distance_km} km</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-ink-surface px-4 py-3 rounded-sm border border-ink-raised">
                <Clock className="text-status-warning" size={24} />
                <div>
                  <p className="text-[10px] text-content-secondary font-mono uppercase tracking-wide">Est. Time</p>
                  <p className="font-mono font-bold text-content-primary text-xl tabular-nums">{route.eta_minutes} mins</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-ink-surface px-4 py-3 rounded-sm border border-ink-raised">
                <MapPin className="text-content-primary" size={24} />
                <div>
                  <p className="text-[10px] text-content-secondary font-mono uppercase tracking-wide">Waypoints</p>
                  <p className="font-mono font-bold text-content-primary text-xl tabular-nums">{route.waypoints.length} stops</p>
                </div>
              </div>

              {route.routing_method_used && (
                <div className="flex items-center gap-3 bg-ink-surface px-4 py-3 rounded-sm border border-ink-raised">
                  <div>
                    <p className="text-[10px] text-content-secondary font-mono uppercase tracking-wide mb-1">Method</p>
                    <div className="px-2 py-0.5 bg-slate-100 text-accent-secondary font-mono font-bold text-[10px] rounded-sm uppercase tracking-wide border border-ink-raised">
                      {route.routing_method_used}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Waypoint Sequence */}
            <div className="flex items-center flex-wrap gap-2 text-sm text-content-secondary font-mono bg-ink-surface p-3 rounded-sm border border-ink-raised">
              <span className="text-[10px] text-content-secondary uppercase tracking-wide font-bold mr-1">Sequence:</span>
              {route.waypoints.map((wp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={clsx("px-2 py-0.5 rounded-sm text-[10px] tracking-wide uppercase", wp.type === 'kitchen' ? 'bg-slate-100 text-content-primary border border-ink-raised' : 'bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20')}>
                    {wp.label}
                  </span>
                  {i < route.waypoints.length - 1 && <span className="text-ink-raised">&rarr;</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-content-secondary font-mono text-sm tracking-wide uppercase">Click "Optimize Route" to generate an optimized delivery plan using OR-Tools VRPTW.</p>
        )}
      </div>

      <div className="flex-1 w-full relative z-0" style={{ height: 'calc(100vh - 140px)' }}>
        <RouteMap route={route} ngos={ngos} />
        
        {/* Overlay Sidebar */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="absolute top-4 right-4 w-80 max-h-[calc(100%-32px)] bg-ink-surface/80 backdrop-blur-xl rounded-sm border border-ink-raised flex flex-col overflow-hidden z-10 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        >
          <div className="p-4 border-b border-ink-raised bg-ink-surface">
            <h3 className="font-display font-bold  tracking-wide text-sm text-content-primary">NGO Dispatch Queue</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {ngos.map((ngo, index) => (
              <div key={ngo.ngo_id} className={`p-3 border-b border-ink-raised last:border-0 transition-colors ${index === 0 ? 'bg-slate-100/50 border-l-2 border-l-accent-secondary' : 'hover:bg-slate-100'}`}>
                {index === 0 && (
                  <div className="mb-2 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wide text-accent-secondary bg-accent-secondary/10 px-1.5 py-0.5 rounded-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse" />
                    Optimal Match
                  </div>
                )}
                <h4 className="font-display font-bold text-sm text-content-primary  tracking-wide">{ngo.ngo_name}</h4>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-[10px] font-mono text-content-secondary uppercase tracking-wide truncate max-w-[180px]">{ngo.match_reason}</p>
                  <span className="text-[10px] font-mono font-bold text-accent-primary bg-ink-base border border-ink-raised px-2 py-0.5 rounded-sm tabular-nums">
                    {ngo.distance_km} km
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
