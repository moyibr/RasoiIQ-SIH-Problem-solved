'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Thermometer, Droplets, Clock, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

export default function IotMonitorPage() {
  const [data, setData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIotData = async () => {
    try {
      const res = await api.getIotData(1);
      
      // Format timestamps for chart
      const formatted = res.map((d: any) => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }));
      setData(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIotData();
    const interval = setInterval(fetchIotData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulate = async () => {
    try {
      const res = await api.simulateIotData(1);
      if (res.alerts && res.alerts.length > 0) {
        setAlerts(prev => [...res.alerts, ...prev].slice(0, 5)); // keep last 5
      }
      fetchIotData();
    } catch (err) {
      console.error(err);
    }
  };

  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-content-primary mb-6">Processing Unit Monitor</h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-content-secondary">IoT Sensor Dashboard</p>
            <span className="text-[10px] font-mono tracking-wide uppercase bg-accent-secondary/20 text-accent-secondary px-2 py-0.5 rounded border border-accent-secondary/30">
              Simulator Enabled
            </span>
            <span className="text-[10px] font-mono tracking-wide uppercase bg-slate-100 text-content-secondary px-2 py-0.5 rounded border border-[#E2E8F0]">
              Ingest API: POST /iot/ingest
            </span>
          </div>
        </div>
        <button 
          onClick={handleSimulate}
          className="flex items-center gap-2 bg-slate-200 hover:bg-white/20 border border-[#E2E8F0] text-content-primary font-medium py-2 px-4 rounded-xl transition-all"
        >
          <RefreshCw size={18} />
          Simulate Reading
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-blue-400"><Thermometer size={24} /></div>
          <p className="text-content-secondary text-sm">Cold Storage Temp</p>
          <p className="text-3xl font-bold text-content-primary">{latest ? latest.temperature_c.toFixed(1) : '--'}°C</p>
          <p className="text-xs text-content-secondary">Target: 0°C - 5°C</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-teal-400"><Droplets size={24} /></div>
          <p className="text-content-secondary text-sm">Humidity</p>
          <p className="text-3xl font-bold text-content-primary">{latest ? latest.humidity_pct.toFixed(1) : '--'}%</p>
          <p className="text-xs text-content-secondary">Target: &lt;85%</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-status-warning"><Clock size={24} /></div>
          <p className="text-content-secondary text-sm">Machine Downtime</p>
          <p className="text-3xl font-bold text-content-primary">{latest ? latest.downtime_minutes.toFixed(0) : '--'} min</p>
          <p className="text-xs text-content-secondary">Limit: &lt;15 min</p>
        </div>
        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] space-y-2">
          <div className="text-accent-primary"><Zap size={24} /></div>
          <p className="text-content-secondary text-sm">Energy Usage</p>
          <p className="text-3xl font-bold text-content-primary">{latest ? latest.energy_kwh.toFixed(1) : '--'} kWh</p>
          <p className="text-xs text-content-secondary">Normal: &lt;50 kWh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-premium p-6 rounded-xl border border-[#E2E8F0]">
          <h2 className="text-xl font-bold text-content-primary mb-6">Live Telemetry (Last 20 Readings)</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="time" stroke="#888" tick={{fontSize: 10}} />
                <YAxis yAxisId="left" stroke="#60a5fa" />
                <YAxis yAxisId="right" orientation="right" stroke="#D97706" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="temperature_c" name="Temp (°C)" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="energy_kwh" name="Energy (kWh)" stroke="#D97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-premium p-6 rounded-xl border border-[#E2E8F0] flex flex-col">
          <h2 className="text-xl font-bold text-content-primary mb-4 flex items-center gap-2">
            <AlertTriangle className="text-status-critical" size={20} /> Active Alerts
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {alerts.length === 0 ? (
              <p className="text-content-secondary text-sm">No recent alerts. System operating normally.</p>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-status-critical/10 border border-status-critical/20 text-sm text-status-critical">
                  {alert}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
