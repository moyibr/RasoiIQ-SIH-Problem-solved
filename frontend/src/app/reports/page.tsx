'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BarChart2, Cloud, Users, CheckCircle, Leaf, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getSustainabilityReport(dateRange);
        setReport(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange]);

  const metrics = report?.metrics;
  const prov = report?.provenance;
  const llmStatus = report?.llm_error || '';

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold text-content-primary mb-6">Sustainability Report</h1>
          <p className="text-sm text-content-secondary mt-1">
            {demoMode ? "Automated sustainability narrative and impact metrics" : "LLM-grounded narrative backed by aggregated metrics"}
          </p>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer bg-ink-surface px-3 py-1.5 rounded-sm border border-ink-raised hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={demoMode} 
              onChange={e => setDemoMode(e.target.checked)} 
              className="rounded text-accent-secondary focus:ring-accent-secondary bg-ink-base border-ink-raised"
            />
            <span className="text-xs font-mono uppercase tracking-wide text-content-secondary">Presentation Mode</span>
          </label>
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border-ink-raised rounded-sm text-xs font-mono uppercase tracking-wide bg-ink-surface text-content-primary focus:border-accent-primary focus:outline-none px-3 py-1.5"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last Quarter</option>
          </select>
        </div>
      </div>

      {loading && <div className="p-8 animate-pulse text-content-secondary">Generating report...</div>}
      
      {error && (
        <div className="bg-status-critical/10 text-status-critical border border-status-critical/20 font-mono p-4 rounded-xl border border-status-critical/20">
          {error}
        </div>
      )}

      {!demoMode && llmStatus && (
        <div className="bg-status-warning/10 border border-status-warning/20 rounded-lg px-4 py-3 text-sm text-status-warning flex items-center gap-2">
          <AlertCircle size={16} />
          <strong>Developer Notice:</strong> {llmStatus.includes('fell back') ? 'Add GEMINI_API_KEY to backend/.env to enable real narrative generation.' : llmStatus}
        </div>
      )}

      {!loading && report && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-ink-surface p-5 rounded-sm border border-ink-raised shadow-none">
              <div className="flex items-center gap-3 mb-2">
                <Leaf size={16} className="text-status-success" />
                <h3 className="font-mono text-xs  tracking-wide text-content-secondary">Rescued</h3>
              </div>
              <p className="text-3xl font-display font-bold uppercase tracking-wide text-content-primary">{metrics?.rescue?.kg_rescued || 0} <span className="font-mono text-xs text-content-secondary uppercase tracking-wide">kg</span></p>
            </div>
            
            <div className="bg-ink-surface p-5 rounded-sm border border-ink-raised shadow-none">
              <div className="flex items-center gap-3 mb-2">
                <Cloud size={16} className="text-accent-secondary" />
                <h3 className="font-mono text-xs  tracking-wide text-content-secondary">CO2e Avoided</h3>
              </div>
              <p className="text-3xl font-display font-bold uppercase tracking-wide text-content-primary">{metrics?.impact?.co2e_avoided_kg || 0} <span className="font-mono text-xs text-content-secondary uppercase tracking-wide">kg</span></p>
            </div>

            <div className="bg-ink-surface p-5 rounded-sm border border-ink-raised shadow-none">
              <div className="flex items-center gap-3 mb-2">
                <Users size={16} className="text-accent-primary" />
                <h3 className="font-mono text-xs  tracking-wide text-content-secondary">Meals Redistributed</h3>
              </div>
              <p className="text-3xl font-display font-bold uppercase tracking-wide text-content-primary">{metrics?.impact?.meals_redistributed || 0}</p>
            </div>

            <div className="bg-ink-surface p-5 rounded-sm border border-ink-raised shadow-none">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle size={16} className="text-status-warning" />
                <h3 className="font-mono text-xs  tracking-wide text-content-secondary">Rescue Rate</h3>
              </div>
              <p className="text-3xl font-display font-bold uppercase tracking-wide text-content-primary">{metrics?.rescue?.rescue_rate_pct || 0}%</p>
            </div>
          </div>

          {/* Narrative */}
          <div className="bg-ink-surface rounded-sm border border-ink-raised shadow-none overflow-hidden flex flex-col">
            <div className="p-5 border-b border-ink-raised flex justify-between items-center bg-ink-base/50">
              <h2 className="font-display font-bold  tracking-wide text-content-primary">Executive Summary</h2>
              <span className={clsx("text-xs font-semibold px-2 py-1 rounded border", 
                report.narrative_source === 'gemini' ? 'bg-accent-secondary/10 text-accent-secondary border-accent-secondary/20 font-mono tracking-wide' : 'bg-slate-100 text-content-secondary font-mono tracking-wide uppercase border-ink-raised'
              )}>
                Source: {report.narrative_source}
              </span>
            </div>
            <div className="p-6 max-w-none text-content-primary font-sans text-[15px] leading-8">
              {report.narrative.split('\n\n').map((paragraph: string, i: number) => (
                <p key={i} className="mb-4 last:mb-0 leading-relaxed text-sm">{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Provenance */}
          {!demoMode && (
            <div className="bg-ink-surface rounded-sm p-5 border border-ink-raised shadow-none">
              <h2 className="font-display font-bold uppercase tracking-wide text-content-primary mb-3 flex items-center gap-2">
                <BarChart2 size={18} className="text-accent-secondary" /> Provenance & Assumptions
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-content-secondary text-xs font-medium mb-1">Data Sources</p>
                  <ul className="text-content-primary space-y-1 list-disc list-inside">
                    <li>Synthetic SQLite Kitchen Data</li>
                    <li>{prov?.processing_unit_dataset || 'processing_unit_dataset_v3_verified.csv'}</li>
                  </ul>
                </div>
                <div>
                  <p className="text-content-secondary text-xs font-medium mb-1">Standard Assumptions</p>
                  <ul className="text-content-primary space-y-1 list-disc list-inside">
                    <li>Meals: {prov?.documented_assumptions?.meal_weight_kg || '0.4 kg/meal'}</li>
                    <li>Emissions: {prov?.documented_assumptions?.co2e_factor || '2.5 kg CO2e/kg'}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {demoMode && (
             <div className="text-center pb-8 pt-4">
               <p className="text-xs text-content-secondary">
                 Note: CO2e factor based on global average (FAO, 2013). Meal weight assumption sourced from FSSAI institutional guidance (0.4kg/meal).
               </p>
             </div>
          )}
        </>
      )}
    </div>
  );
}
