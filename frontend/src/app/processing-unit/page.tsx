'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  api,
  ProcessingUnitMetrics,
  FlaggedDaysResponse,
  ProcessingUnitTrendPoint,
} from '@/lib/api';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Zap, AlertTriangle } from 'lucide-react';

const DATE_RANGES = ['7d', '30d', 'All'] as const;
type Range = (typeof DATE_RANGES)[number];

function rangeParam(r: Range): string {
  if (r === 'All') return '2026-03-24:2026-09-19';
  return r;
}

function fmt(n: number | null | undefined, decimals = 1, suffix = '') {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}${suffix}`;
}
function fmtINR(n: number | null | undefined) {
  if (n == null) return '\u2014';
  return '\u20B9 ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function Scorecard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  progressPct,
  statusClass,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  progressPct?: number;
  statusClass?: string;
}) {
  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.02 }}
      className="bg-ink-surface/80 backdrop-blur-md rounded-sm p-5 border border-ink-raised shadow-sm flex flex-col justify-between group overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-content-secondary">{label}</p>
          <Icon size={16} className="text-content-secondary opacity-50" />
        </div>
        <p className="text-3xl font-mono font-bold text-accent-secondary tabular-nums tracking-tight">{value}</p>
      </div>
      <div className="mt-4">
        {progressPct !== undefined && (
          <div className="h-0.5 bg-slate-100 rounded-full overflow-hidden mb-1.5 w-full">
            <div 
              className={`h-full transition-all ${statusClass || 'bg-accent-secondary'}`}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        )}
        {sub && <p className="text-[10px] font-mono tracking-wide uppercase text-content-secondary">{sub}</p>}
      </div>
    </motion.div>
  );
}

function TrendChart({
  data,
  dataKey,
  label,
  color,
  refLine,
  refLabel,
  suffix = '%',
}: {
  data: ProcessingUnitTrendPoint[];
  dataKey: keyof ProcessingUnitTrendPoint;
  label: string;
  color: string;
  refLine?: number;
  refLabel?: string;
  suffix?: string;
}) {
  const formatted = data.map((d) => ({
    ...d,
    displayDate: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="bg-ink-surface rounded-sm p-5 border border-ink-raised shadow-none">
      <h3 className="font-display font-bold  tracking-wide text-content-primary mb-3">{label}</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FFFFFF" />
            <XAxis
              dataKey="displayDate"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}${suffix}`}
              width={40}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '4px', color: '#0F172A', fontSize: 12 }} itemStyle={{ color: '#0F172A' }}
              formatter={(v: number) => [`${v.toFixed(2)}${suffix}`, label]}
            />
            {refLine != null && (
              <ReferenceLine y={refLine} stroke="#D97706" strokeDasharray="4 4" label={{ value: refLabel, position: 'insideTopRight', fontSize: 10, fill: '#D97706' }} />
            )}
            <Line type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ProcessingUnitPage() {
  const [range, setRange] = useState<Range>('30d');
  const [metrics, setMetrics] = useState<ProcessingUnitMetrics | null>(null);
  const [flagged, setFlagged] = useState<FlaggedDaysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getProcessingUnitMetrics(1, rangeParam(range)),
      api.getFlaggedDays(1),
    ])
      .then(([m, f]) => {
        setMetrics(m);
        setFlagged(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const agg = metrics?.aggregates ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-content-primary mb-6">Processing Unit Efficiency</h1>
          <p className="text-sm text-content-secondary mt-1">
            Central Processing Unit — Maize/Pulse Line Â· Peenya Industrial Area, Bengaluru
          </p>
        </div>
        <div className="flex gap-2">
          {DATE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-teal text-content-primary'
                  : 'bg-ink-surface text-content-secondary border border-ink-raised hover:bg-slate-100 transition-colors'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>



      {loading && <div className="text-content-secondary text-sm">Loadingâ€¦</div>}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {!loading && metrics && (
        <>
          {/* Period info */}
          <p className="text-xs text-content-secondary">
            Period: {metrics.date_range.start} â†’ {metrics.date_range.end} Â· {metrics.days_with_data} days with data
          </p>

          {/* Scorecards */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ staggerChildren: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Scorecard
              label="Avg Process Yield"
              value={fmt(agg?.avg_process_yield_pct, 1, '%')}
              sub="Threshold: â‰¥ 82%"
              color={
                (agg?.avg_process_yield_pct ?? 0) >= 82
                  ? 'bg-teal'
                  : 'bg-red-500'
              }
              icon={TrendingUp}
            />
            <Scorecard
              label="Avg Downtime"
              value={fmt(agg?.avg_downtime_pct, 1, '%')}
              sub="Threshold: â‰¤ 15%"
              color={
                (agg?.avg_downtime_pct ?? 99) <= 15
                  ? 'bg-teal'
                  : 'bg-red-500'
              }
              icon={TrendingDown}
            />
            <Scorecard
              label="Energy Intensity"
              value={fmt(agg?.period_energy_intensity_kwh_per_kg, 3, ' kWh/kg')}
              sub="SUM(kWh) / SUM(good output)"
              color=""
              icon={Zap}
              progressPct={50}
              statusClass="bg-accent-secondary"
            />
            <Scorecard
              label="Avg Rejection Rate"
              value={fmt(agg?.avg_rejection_pct, 2, '%')}
              sub="Threshold: â‰¤ 3%"
              color={
                (agg?.avg_rejection_pct ?? 99) <= 3
                  ? 'bg-teal'
                  : 'bg-red-500'
              }
              icon={AlertTriangle}
            />
            </motion.div>

          {/* Sum metrics row */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ staggerChildren: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Net Good Output', value: fmt(agg?.total_net_good_output_kg, 0, ' kg') },
              { label: 'Total Rejected', value: fmt(agg?.total_rejected_kg, 0, ' kg') },
              { label: 'Total Profit', value: fmtINR(agg?.total_profit_inr) },
              { label: 'Waste Loss', value: fmtINR(agg?.total_waste_loss_inr) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-ink-surface rounded-sm p-4 border border-ink-raised shadow-none">
                <p className="text-xs text-content-secondary">{label}</p>
                <p className="text-lg font-bold text-content-primary mt-1">{value}</p>
              </div>
            ))}
          </motion.div>

          {/* Trend charts */}
          {metrics.trend.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TrendChart
                data={metrics.trend}
                dataKey="process_yield_pct"
                label="Process Yield % (daily)"
                color="#0d9488"
                refLine={82}
                refLabel="Min 82%"
              />
              <TrendChart
                data={metrics.trend}
                dataKey="downtime_pct"
                label="Downtime % (daily)"
                color="#f59e0b"
                refLine={15}
                refLabel="Max 15%"
              />
              <TrendChart
                data={metrics.trend}
                dataKey="rejection_pct"
                label="Rejection % (daily)"
                color="#ef4444"
                refLine={3}
                refLabel="Max 3%"
              />
              <TrendChart
                data={metrics.trend}
                dataKey="energy_intensity_kwh_per_kg"
                label="Energy Intensity (kWh/kg daily)"
                color="#6366f1"
                suffix=" kWh/kg"
              />
            </div>
          )}

          {/* Flagged days */}
          {flagged && (
            <div className="bg-ink-surface rounded-sm border border-ink-raised shadow-none overflow-hidden">
              <div className="p-5 border-b border-ink-raised">
                <h2 className="font-bold text-content-primary">
                  Flagged Days{' '}
                  <span className="ml-2 px-2 py-0.5 text-xs bg-status-critical/10 text-status-critical border border-status-critical/20 font-mono rounded-full font-semibold">
                    {flagged.total_flagged_days} total
                  </span>
                </h2>
                <p className="text-xs text-content-secondary mt-1">
                  Yield &lt; 82% Â· Downtime &gt; 15% Â· Rejection &gt; 3%
                </p>
              </div>
              <div className="divide-y divide-ink-raised max-h-72 overflow-y-auto">
                {flagged.flagged_days.slice(0, 20).map((fd) => (
                  <div key={fd.date} className="px-5 py-3 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-content-primary">
                          {fd.date}
                        </span>
                        <span className="ml-2 text-xs text-content-secondary">{fd.day_of_week}</span>
                        <span className="ml-2 text-xs text-status-warning font-medium">{fd.root_cause}</span>
                      </div>
                      <span className={`text-xs font-medium ${(fd.daily_profit_inr ?? 0) >= 0 ? "text-status-success" : "text-status-critical"}`}>
                        {'\u20B9'}{Math.abs(fd.daily_profit_inr ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} {(fd.daily_profit_inr ?? 0) >= 0 ? 'profit' : 'loss'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {fd.failed_metrics.map((fm) => (
                        <span
                          key={fm.metric}
                          className="text-xs px-2 py-0.5 bg-status-critical/10 text-status-critical border border-status-critical/20 font-mono tracking-wide uppercase rounded-full"
                        >
                          {fm.metric}: {fm.value} ({fm.threshold})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
