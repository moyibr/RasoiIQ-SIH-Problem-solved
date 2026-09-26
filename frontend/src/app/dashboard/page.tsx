'use client';

import { useEffect, useState } from 'react';
import { api, DashboardSummary, ForecastResponse } from '@/lib/api';
import ForecastChart from '@/components/dashboard/ForecastChart';
import RescueAlertList from '@/components/dashboard/RescueAlertList';
import SpotlightCard from '@/components/ui/SpotlightCard';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [productionPlan, setProductionPlan] = useState<any | null>(null);
  const [rescueEvents, setRescueEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumData, foreData, planData, rescueData] = await Promise.all([
          api.getDashboardSummary(),
          api.getForecast('K1_MainCampus', '2026-09-25', 7),
          api.getProductionPlan('K1_MainCampus', '2026-09-25'),
          api.getRescue('active')
        ]);
        setSummary(sumData);
        setForecast(foreData);
        setProductionPlan(planData);
        setRescueEvents(rescueData);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleConfirmPlan = async () => {
    try {
      await api.saveProductionPlan(productionPlan);
      alert('Production plan saved successfully!');
    } catch (err: any) {
      alert('Error saving plan: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent-secondary"></div>
      </div>
    );
  }

  if (error || !summary || !forecast) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="bg-status-critical/10 text-status-critical border border-status-critical/30 p-6 rounded-xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-2">Dashboard Error</h2>
          <p>{error || 'Failed to load essential data.'}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 md:p-10 space-y-10 pb-20">
      
      {/* Top Header & KPI Strip */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end border-b border-[#E2E8F0] pb-6 gap-6">
        <div>
          <motion.h1 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-5xl lg:text-6xl font-display font-bold text-content-primary tracking-tighter drop-shadow-md glow-text-primary">
            Dashboard
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-content-secondary mt-2 font-mono text-xs tracking-wide uppercase">
            REAL-TIME OVERVIEW &middot; BMTC STAFF CANTEEN, BENGALURU
          </motion.p>
        </div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ staggerChildren: 0.1 }} className="flex flex-wrap gap-4 lg:gap-8">
          <div className="text-right">
            <p className="text-[10px] text-content-secondary uppercase tracking-wide font-bold mb-1 opacity-70">Rescued Today</p>
            <p className="text-3xl font-bold font-display tracking-tight text-status-success ">
              <AnimatedCounter value={summary.kg_rescued_today} /> <span className="text-sm font-sans">kg</span>
            </p>
          </div>
          <div className="w-px bg-slate-200 hidden md:block" />
          <div className="text-right">
            <p className="text-[10px] text-content-secondary uppercase tracking-wide font-bold mb-1 opacity-70">Wasted Today</p>
            <p className="text-3xl font-bold font-display tracking-tight text-status-critical ">
              <AnimatedCounter value={summary.kg_wasted_today} /> <span className="text-sm font-sans">kg</span>
            </p>
          </div>
          <div className="w-px bg-slate-200 hidden md:block" />
          <div className="text-right">
            <p className="text-[10px] text-content-secondary uppercase tracking-wide font-bold mb-1 opacity-70">Active Alerts</p>
            <p className="text-3xl font-bold font-display tracking-tight text-status-warning ">
              <AnimatedCounter value={summary.active_rescue_count} />
            </p>
          </div>
          <div className="w-px bg-slate-200 hidden md:block" />
          <div className="text-right">
            <p className="text-[10px] text-content-secondary uppercase tracking-wide font-bold mb-1 opacity-70">CO2 Saved</p>
            <p className="text-3xl font-bold font-display tracking-tight text-accent-secondary glow-text-secondary">
              <AnimatedCounter value={summary.co2_saved_today_kg} /> <span className="text-sm font-sans">kg</span>
            </p>
          </div>
        </motion.div>
      </header>

      {/* Hero Chart */}
      <SpotlightCard className="p-8 shadow-2xl shadow-black/50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-display text-content-primary uppercase tracking-wide flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse shadow-sm" />
            Demand Forecast
          </h2>
          <span className="text-[10px] font-mono text-content-secondary tracking-wide uppercase bg-slate-50 px-3 py-1 rounded-full border border-[#E2E8F0]">
            ANYA Ai ENGINE &middot; MAE 49
          </span>
        </div>
        <div className="h-80 w-full relative z-10">
          <ForecastChart data={forecast.predictions} category="Rice" />
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Production Plan Table */}
        <section className="col-span-2">
          <SpotlightCard className="p-8 h-full shadow-2xl shadow-black/50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display text-content-primary  tracking-wide">Production Plan</h2>
              <button 
                onClick={handleConfirmPlan}
                className="glow-button-primary text-white px-6 py-2.5 rounded-full font-bold text-xs transition-all uppercase tracking-wide"
              >
                Confirm Plan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left font-mono">
                <thead className="bg-slate-50 text-content-secondary text-[10px] uppercase tracking-wide border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-5 py-4 font-bold rounded-tl-xl">Category</th>
                    <th className="px-5 py-4 font-bold">Forecast</th>
                    <th className="px-5 py-4 font-bold">Buffer</th>
                    <th className="px-5 py-4 font-bold text-accent-secondary rounded-tr-xl">Recommended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {productionPlan?.categories?.map((cat: any) => (
                    <tr key={cat.category_id} className="hover:bg-slate-100 transition-colors">
                      <td className="px-5 py-4 font-medium text-content-primary capitalize">{cat.category_name}</td>
                      <td className="px-5 py-4 text-content-secondary">{cat.predicted_qty} {cat.unit}</td>
                      <td className="px-5 py-4 text-content-secondary">
                        <span className="bg-slate-50 px-2 py-1 rounded-md border border-[#E2E8F0]" title={cat.buffer_reasoning}>
                          {(cat.buffer_pct * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-accent-secondary tracking-tight text-base">
                        {cat.recommended_production_qty} <span className="text-xs opacity-70">{cat.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        </section>

        {/* Active Rescue */}
        <section className="col-span-1 h-full">
          <RescueAlertList events={rescueEvents} />
        </section>
      </div>
    </motion.div>
  );
}
