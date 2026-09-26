'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Leaf, Download, DollarSign, Cloud, Heart, Target } from 'lucide-react';
// import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';

export default function ESGReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getEsgAnalytics();
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDownload = async () => {
    // A simplified PDF download hook. For now, it will just trigger browser print.
    window.print();
  };

  if (loading) return <div className="p-8 text-content-primary">Loading ESG data...</div>;
  if (!data) return <div className="p-8 text-status-critical">Failed to load ESG data.</div>;

  const { overall, monthly_trend } = data;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in" ref={reportRef}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-content-primary mb-6">ESG & Sustainability Report</h1>
          <p className="text-content-secondary mt-2">Impact tracking for environmental and social governance.</p>
        </div>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 bg-accent-secondary hover:bg-accent-secondary/90 text-content-primary font-bold py-2 px-4 rounded-xl transition-all"
        >
          <Download size={18} />
          Download PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-accent-primary"><Heart size={24} /></div>
          <p className="text-content-secondary text-sm">Meals Donated</p>
          <p className="text-2xl font-bold text-content-primary">{overall.meals_donated.toLocaleString()}</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-accent-secondary"><Cloud size={24} /></div>
          <p className="text-content-secondary text-sm">CO2e Avoided (kg)</p>
          <p className="text-2xl font-bold text-content-primary">{overall.co2e_avoided_kg.toLocaleString()}</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-status-success"><Leaf size={24} /></div>
          <p className="text-content-secondary text-sm">Food Saved (kg)</p>
          <p className="text-2xl font-bold text-content-primary">{overall.kg_food_saved.toLocaleString()}</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-content-primary"><DollarSign size={24} /></div>
          <p className="text-content-secondary text-sm">Cost Saved (INR)</p>
          <p className="text-2xl font-bold text-content-primary">₹{overall.estimated_cost_saved.toLocaleString()}</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-status-warning"><Target size={24} /></div>
          <p className="text-content-secondary text-sm">Waste Prevention</p>
          <p className="text-2xl font-bold text-content-primary">{overall.waste_prevention_rate_pct}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0]">
          <h2 className="text-xl font-bold text-content-primary mb-6">CO2 Avoided vs Food Saved</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }} />
                <Legend />
                <Bar dataKey="co2_saved" name="CO2 Saved (kg)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="food_saved" name="Food Saved (kg)" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0]">
          <h2 className="text-xl font-bold text-content-primary mb-6">Meals Donated Over Time</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }} />
                <Legend />
                <Bar dataKey="meals_donated" name="Meals Donated" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] text-sm text-content-secondary">
        <p><strong>Methodology Notes:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Assumes ~0.4 kg per meal donated (FSSAI institutional guidance).</li>
          <li>CO2e avoided calculated at 2.5 kg CO2e per kg of food saved (FAO 2013).</li>
          <li>Cost saved estimated at an average of 50 INR per kg of food.</li>
        </ul>
      </div>
    </div>
  );
}
