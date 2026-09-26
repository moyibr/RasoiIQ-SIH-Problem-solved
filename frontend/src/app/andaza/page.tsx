'use client';

import { useState, useEffect, useRef } from 'react';
import { api, PredictDemandRequest, PredictDemandResponse } from '@/lib/api';
import { Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Fonts (loaded via CSS @import in globals or inline style) ───────────────
// IBM Plex Mono + IBM Plex Sans via Google Fonts — added to <head> below

// ─── Constants ───────────────────────────────────────────────────────────────

const LOCATIONS = Array.from({ length: 26 }, (_, i) => `Loc_${i + 1}`);

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const EXAMPLE: PredictDemandRequest = {
  locationId: 'Loc_3',
  date: '2026-09-22',
  isHoliday: 0,
  tempCelsius: 24.5,
  rainMm: 0,
  localEvent: 0,
  activePromotion: 1,
  competitorPromo: 0,
  cpiIndex: 142.3,
  onlineRating: 4.2,
  reservations: 125,
  demandYesterday: 410,
  demand7DaysAgo: 395,
  demandMa7: 402.7,
};

// ─── Palette ─────────────────────────────────────────────────────────────────
// ticket paper  #F4EFE6   aged ink     #1C1917   burner       #C2440E
// steel         #4A5568   butcher paper #E2E8F0  chalk        #F9F7F4

// ─── Validation ──────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof PredictDemandRequest, string>>;

function validate(f: PredictDemandRequest): FormErrors {
  const err: FormErrors = {};
  if (!f.locationId) err.locationId = 'Required';
  if (!f.date) err.date = 'Required';
  if (f.tempCelsius < -20 || f.tempCelsius > 60)
    err.tempCelsius = 'Must be −20 to 60 °C';
  if (f.rainMm < 0) err.rainMm = 'Must be ≥ 0';
  if (f.cpiIndex <= 0) err.cpiIndex = 'Must be > 0';
  if (f.onlineRating < 1 || f.onlineRating > 5)
    err.onlineRating = 'Must be 1.0 – 5.0';
  if (f.reservations < 0) err.reservations = 'Must be ≥ 0';
  if (f.demandYesterday < 0) err.demandYesterday = 'Must be ≥ 0';
  if (f.demand7DaysAgo < 0) err.demand7DaysAgo = 'Must be ≥ 0';
  if (f.demandMa7 < 0) err.demandMa7 = 'Must be ≥ 0';
  return err;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#D97706', textShadow: '0 0 10px rgba(232,163,61,0.5)' }}>
      <AlertCircle size={10} /> {msg}
    </p>
  );
}

function DocketLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block mb-1 text-xs tracking-wide"
      style={{ color: '#64748B', fontFamily: "var(--font-sans), sans-serif" }}
    >
      {children}
    </span>
  );
}

function DocketInput({
  id, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      {...props}
      style={{
        width: '100%',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '3px',
        padding: '7px 10px',
        fontSize: '13px',
        fontFamily: "var(--font-mono), monospace",
        color: '#0F172A',
        outline: 'none',
        ...props.style,
      }}
    />
  );
}

function DocketSelect({
  id, children, value, onChange,
}: { id: string; children: React.ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '3px',
        padding: '7px 10px',
        fontSize: '13px',
        fontFamily: "var(--font-mono), monospace",
        color: '#0F172A',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
      }}
    >
      {children}
    </select>
  );
}

function Toggle({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === 1 ? 0 : 1)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 0',
        background: '#F8FAFC',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "var(--font-sans), sans-serif",
        fontSize: '13px',
        color: value === 1 ? '#0F172A' : '#64748B',
      }}
    >
      <span>{label}</span>
      {/* Toggle pill */}
      <span style={{
        position: 'relative',
        width: '36px',
        height: '20px',
        borderRadius: '9999px',
        background: value === 1 ? '#D97706' : '#FFFFFF',
        flexShrink: 0,
        transition: 'background 200ms',
        overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute',
          top: '2px',
          left: value === 1 ? '16px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '9999px',
          background: '#FFFFFF', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          transition: 'left 200ms',
        }} />
      </span>
    </button>
  );
}

// Ruled divider between docket sections
function Rule() {
  return <div style={{ borderTop: '1px solid #E2E8F0', margin: '20px 0' }} />;
}

// Section label (not all-caps eyebrow — small, steel-colored, sentence case)
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "var(--font-sans), sans-serif",
      fontSize: '11px',
      letterSpacing: '0.08em',
      color: '#64748B',
      marginBottom: '14px',
      textTransform: 'uppercase',
    }}>
      {children}
    </p>
  );
}

// Animated counter for the result number
function AnimatedCount({ target }: { target: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let frame = 0;
    const total = 40;
    const timer = setInterval(() => {
      frame++;
      setN(Math.round((target * frame) / total));
      if (frame >= total) clearInterval(timer);
    }, 350 / total);
    return () => clearInterval(timer);
  }, [target]);
  return <>{n.toLocaleString()}</>;
}

function pctDelta(predicted: number, baseline: number): string {
  if (baseline === 0) return '—';
  const d = ((predicted - baseline) / baseline) * 100;
  const sign = d >= 0 ? '▲ +' : '▼ ';
  return `${sign}${Math.abs(d).toFixed(1)}%`;
}

function deltaColor(predicted: number, baseline: number): string {
  if (baseline === 0) return '#64748B';
  return predicted >= baseline ? '#16A34A' : '#D97706';
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AndazaPage() {
  const [form, setForm] = useState<PredictDemandRequest>({
    locationId: 'Loc_1',
    date: tomorrowStr(),
    isHoliday: 0,
    tempCelsius: 22,
    rainMm: 0,
    localEvent: 0,
    activePromotion: 0,
    competitorPromo: 0,
    cpiIndex: 105,
    onlineRating: 4.0,
    reservations: 80,
    demandYesterday: 400,
    demand7DaysAgo: 390,
    demandMa7: 395,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictDemandResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  function setField<K extends keyof PredictDemandRequest>(k: K, v: PredictDemandRequest[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setApiError(null);
    setResult(null);
    try {
      const res = await api.predictDemand(form);
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: any) {
      setApiError(err.message ?? 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans), sans-serif",
    minHeight: '100vh',
    background: '#F8FAFC',
    color: '#0F172A',
  };

  return (
    <>
      <div style={inputStyle}>
        {/* Page header */}
        <div style={{
          borderBottom: '1px solid #E2E8F0',
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        }}>
          <div>
            <span style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: '18px',
              fontWeight: 600,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}>
              ANYA Ai
            </span>
            <span style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: '13px',
              color: '#64748B',
              marginLeft: '12px',
            }}>
              demand forecast
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setForm(EXAMPLE); setErrors({}); setResult(null); }}
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: '12px',
              color: '#64748B',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '2px',
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            Load sample
          </button>
        </div>

        {/* Body — two column on desktop, stacked on mobile */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
          minHeight: 'calc(100vh - 61px)',
          alignItems: 'start',
        }}
          className="andaza-grid"
        >
          {/* ── LEFT: Docket ─────────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '32px',
              borderRight: '1px solid #E2E8F0',
            }}
          >
            {/* Single docket container — like a printed form */}
            <div style={{
              background: '#FFFFFF', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '640px',
            }}>

              {/* ── 1. Identity ─────────────────────────────────────────── */}
              <SectionLabel>Location & date</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <DocketLabel>Location</DocketLabel>
                  <DocketSelect id="andaza-location" value={form.locationId} onChange={v => setField('locationId', v)}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </DocketSelect>
                  <FieldError msg={errors.locationId} />
                </div>
                <div>
                  <DocketLabel>Date</DocketLabel>
                  <DocketInput id="andaza-date" type="date" value={form.date}
                    onChange={e => setField('date', e.target.value)} />
                  <FieldError msg={errors.date} />
                </div>
              </div>

              <Rule />

              {/* ── 2. Historical demand ─────────────────────────────────── */}
              <SectionLabel>Historical demand — same location</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <DocketLabel>Yesterday</DocketLabel>
                  <DocketInput id="andaza-demand-yesterday" type="number" min="0" step="1"
                    value={form.demandYesterday}
                    onChange={e => setField('demandYesterday', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.demandYesterday} />
                </div>
                <div>
                  <DocketLabel>Same day last week</DocketLabel>
                  <DocketInput id="andaza-demand-7d" type="number" min="0" step="1"
                    value={form.demand7DaysAgo}
                    onChange={e => setField('demand7DaysAgo', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.demand7DaysAgo} />
                </div>
                <div>
                  <DocketLabel>7-day rolling avg</DocketLabel>
                  <DocketInput id="andaza-demand-ma7" type="number" min="0" step="0.1"
                    value={form.demandMa7}
                    onChange={e => setField('demandMa7', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.demandMa7} />
                </div>
              </div>

              <Rule />

              {/* ── 3. Context flags ─────────────────────────────────────── */}
              <SectionLabel>Service context</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <Toggle label="Public holiday" value={form.isHoliday} onChange={v => setField('isHoliday', v)} />
                <Toggle label="Local event nearby" value={form.localEvent} onChange={v => setField('localEvent', v)} />
                <Toggle label="Active promotion" value={form.activePromotion} onChange={v => setField('activePromotion', v)} />
                <Toggle label="Competitor promo" value={form.competitorPromo} onChange={v => setField('competitorPromo', v)} />
              </div>

              <Rule />

              {/* ── 4. Weather ───────────────────────────────────────────── */}
              <SectionLabel>Weather forecast</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <DocketLabel>Temperature (°C)</DocketLabel>
                  <DocketInput id="andaza-temp" type="number" step="0.1" min="-20" max="60"
                    value={form.tempCelsius}
                    onChange={e => setField('tempCelsius', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.tempCelsius} />
                </div>
                <div>
                  <DocketLabel>Rainfall (mm)</DocketLabel>
                  <DocketInput id="andaza-rain" type="number" step="0.1" min="0"
                    value={form.rainMm}
                    onChange={e => setField('rainMm', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.rainMm} />
                </div>
              </div>

              <Rule />

              {/* ── 5. Market signals ────────────────────────────────────── */}
              <SectionLabel>Market signals</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <DocketLabel>CPI index</DocketLabel>
                  <DocketInput id="andaza-cpi" type="number" step="0.01" min="0.01"
                    value={form.cpiIndex}
                    onChange={e => setField('cpiIndex', parseFloat(e.target.value) || 0)} />
                  <FieldError msg={errors.cpiIndex} />
                </div>
                <div>
                  <DocketLabel>Online rating</DocketLabel>
                  <DocketInput id="andaza-rating" type="number" step="0.1" min="1.0" max="5.0"
                    value={form.onlineRating}
                    onChange={e => setField('onlineRating', parseFloat(e.target.value) || 1)} />
                  <FieldError msg={errors.onlineRating} />
                </div>
                <div>
                  <DocketLabel>Reservations</DocketLabel>
                  <DocketInput id="andaza-reservations" type="number" step="1" min="0"
                    value={form.reservations}
                    onChange={e => setField('reservations', parseInt(e.target.value) || 0)} />
                  <FieldError msg={errors.reservations} />
                </div>
              </div>

              {/* Submit */}
              <div style={{ marginTop: '28px' }}>
                <motion.button
                  id="andaza-submit"
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.01 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className={clsx(
                    "relative w-full py-5 text-[15px] font-display font-bold tracking-wide uppercase transition-all rounded-xl overflow-hidden",
                    loading 
                      ? "bg-slate-100 text-content-secondary" 
                      : "bg-accent-primary text-white glow-button-primary"
                  )}
                >
                  {!loading && <div className="absolute inset-0 bg-white/20 -translate-x-full hover:animate-[shimmer_1s_infinite] skew-x-12" />}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading
                      ? <><Loader2 size={15} className="animate-spin" /> Running model…</>
                      : 'Run ANYA Ai'}
                  </span>
                </motion.button>

                {apiError && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '3px',
                    color: '#D97706', textShadow: '0 0 10px rgba(232,163,61,0.5)',
                    fontSize: '13px',
                    fontFamily: "var(--font-sans), sans-serif",
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    {apiError}
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* ── RIGHT: KDS result panel ───────────────────────────────────── */}
          <div
            ref={resultRef}
            className="andaza-kds"
            style={{
              background: 'transparent',
              minHeight: 'calc(100vh - 61px)',
              padding: '40px 32px',
              position: 'sticky',
              top: '0',
              transition: 'background 350ms ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: result ? 'flex-start' : 'center',
              alignItems: result ? 'flex-start' : 'center',
            }}
          >
            {/* Empty state */}
            {!result && !loading && (
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: '13px',
                  color: '#64748B',
                  lineHeight: 1.6,
                }}>
                  Fill in the docket<br />and run the model.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div style={{ textAlign: 'center' }}>
                <Loader2 size={24} style={{ color: '#D97706', textShadow: '0 0 10px rgba(232,163,61,0.5)', animation: 'spin 1s linear infinite' }} />
                <p style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: '12px',
                  color: '#64748B',
                  marginTop: '12px',
                }}>
                  reading the model…
                </p>
              </div>
            )}

            {/* Result */}
            {result && !loading && (
              <div className="andaza-result-enter" style={{ width: '100%' }}>
                {/* Location + date context */}
                <p style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: '11px',
                  color: '#64748B',
                  letterSpacing: '0.08em',
                  marginBottom: '24px',
                }}>
                  {result.location_id} · {result.date}
                </p>

                {/* The number */}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: '96px', textShadow: '0 0 30px rgba(255,255,255,0.3)',
                    fontWeight: 600,
                    color: '#0F172A',
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                  }}>
                    <AnimatedCount target={result.predicted_customers} />
                  </span>
                </div>
                <p style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: '12px',
                  color: '#64748B',
                  marginBottom: '36px',
                }}>
                  estimated covers
                </p>

                {/* Two deltas */}
                <div style={{
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}>
                  {/* vs yesterday */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '12px',
                      color: '#64748B',
                    }}>
                      vs. yesterday ({form.demandYesterday})
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '13px',
                      fontWeight: 500,
                      color: deltaColor(result.predicted_customers, form.demandYesterday),
                    }}>
                      {pctDelta(result.predicted_customers, form.demandYesterday)}
                    </span>
                  </div>

                  {/* vs same day last week */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '12px',
                      color: '#64748B',
                    }}>
                      vs. same day last week ({form.demand7DaysAgo})
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '13px',
                      fontWeight: 500,
                      color: deltaColor(result.predicted_customers, form.demand7DaysAgo),
                    }}>
                      {pctDelta(result.predicted_customers, form.demand7DaysAgo)}
                    </span>
                  </div>
                </div>

                {/* Production planning stub */}
                {result.recommended_production !== null && (
                  <div style={{
                    marginTop: '32px',
                    borderTop: '1px solid #E2E8F0',
                    paddingTop: '20px',
                  }}>
                    <p style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '11px',
                      color: '#64748B',
                      marginBottom: '4px',
                    }}>
                      recommended production
                    </p>
                    <p style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '28px',
                      fontWeight: 600,
                      color: '#0F172A',
                    }}>
                      {result.recommended_production}
                    </p>
                  </div>
                )}

                {/* "What ANYA Ai considered" accordion */}
                <div style={{ marginTop: '36px', borderTop: '1px solid #E2E8F0' }}>
                  <button
                    type="button"
                    onClick={() => setShowDetails(v => !v)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 0',
                      background: '#F8FAFC',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: '11px',
                      color: '#64748B',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span>What ANYA Ai considered</span>
                    {showDetails
                      ? <ChevronUp size={13} style={{ color: '#64748B' }} />
                      : <ChevronDown size={13} style={{ color: '#64748B' }} />}
                  </button>

                  {showDetails && (
                    <div style={{
                      borderTop: '1px solid #E2E8F0',
                      paddingTop: '16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '6px 24px',
                    }}>
                      {Object.entries(result.derived_features).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: '10px',
                            color: '#0F172A',
                          }}>{k}</span>
                          <span style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: '10px',
                            color: '#64748B',
                            marginLeft: '8px',
                          }}>
                            {typeof v === 'number' ? v.toFixed(3) : v}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
