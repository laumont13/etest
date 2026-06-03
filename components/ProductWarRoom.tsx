'use client';

import { useState, useEffect, useMemo } from 'react';
import { evaluateMargin } from '@/lib/scoring';
import type { AnalysisPayload } from '@/components/ResultCard';
import type { SourceStatus } from '@/lib/source-status';
import { SOURCE_STATUS_LABELS } from '@/lib/source-status';
import type { BattleContext } from '@/components/LaunchBoardView';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'resumen' | 'mercado' | 'margen' | 'riesgos' | 'angulos';
type RiskState = 'pending' | 'accepted' | 'saved' | 'dismissed';
type AngleState = 'pending' | 'saved' | 'dismissed';

interface SavedStates {
  risks: Record<number, RiskState>;
  angles: Record<number, AngleState>;
}

export interface MarginInputs {
  unitCost: number;
  importacion: number;
  fees: number;
  sellPrice: number;
}

interface Props {
  data: AnalysisPayload;
  productId: string;
  marginInputs?: MarginInputs;
  battleContext?: BattleContext | null;
  hasLaunchBoardData: boolean;
  onCreateLaunchBoard: () => void;
  onBack: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERDICT_META: Record<string, { label: string; color: string; bg: string; tag: string }> = {
  go:    { label: 'Avanzar',   color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  tag: 'Prometedor'     },
  maybe: { label: 'Dudoso',    color: '#FACC15', bg: 'rgba(250,204,21,0.08)', tag: 'Evaluar primero' },
  kill:  { label: 'Descartar', color: '#F87171', bg: 'rgba(248,113,113,0.08)', tag: 'No recomendado'  },
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen',  label: 'Resumen'  },
  { id: 'mercado',  label: 'Mercado'  },
  { id: 'margen',   label: 'Margen'   },
  { id: 'riesgos',  label: 'Riesgos'  },
  { id: 'angulos',  label: 'Ángulos'  },
];

const RISK_SAVE_KEY = (pid: string) => `etest_item_states_${pid}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dimColor(v: number): string {
  if (v >= 4) return '#4ADE80';
  if (v >= 3) return '#FACC15';
  if (v >= 2) return '#FB923C';
  return '#F87171';
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es').format(Math.round(n));
}

function riskSeverity(text: string, index: number): { label: string; color: string } {
  const t = text.toLowerCase();
  const high =
    index === 0 ||
    t.includes('saturaci') ||
    t.includes('competenci') ||
    t.includes('legal') ||
    t.includes('restricci') ||
    t.includes('commodit') ||
    t.includes('copi') ||
    t.includes('replica') ||
    t.includes('patente');
  if (high) return { label: 'Alta',  color: '#F87171' };
  if (index >= 3) return { label: 'Baja', color: '#4ADE80' };
  return { label: 'Media', color: '#FACC15' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]"
      style={{ background: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}

function ActionBtn({
  onClick,
  active,
  variant = 'ghost',
  children,
}: {
  onClick: () => void;
  active?: boolean;
  variant?: 'ghost' | 'accent' | 'danger';
  children: React.ReactNode;
}) {
  const styles = {
    ghost: {
      border: active ? '1px solid rgba(184,255,92,0.4)' : '1px solid rgba(255,255,255,0.1)',
      background: active ? 'rgba(184,255,92,0.08)' : 'transparent',
      color: active ? '#B8FF5C' : 'rgba(255,255,255,0.56)',
    },
    accent: {
      border: '1px solid rgba(184,255,92,0.35)',
      background: 'rgba(184,255,92,0.1)',
      color: '#B8FF5C',
    },
    danger: {
      border: '1px solid rgba(248,113,113,0.2)',
      background: 'rgba(248,113,113,0.06)',
      color: '#F87171',
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:opacity-80 active:scale-95"
      style={styles}
    >
      {children}
    </button>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-2 p-3 sm:p-4 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-1 truncate">{label}</div>
      <div className="font-display text-xl sm:text-2xl tabular-nums leading-none" style={{ color: color ?? 'rgba(255,255,255,0.9)' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-text-30 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

// ─── Margin Simulator ─────────────────────────────────────────────────────────

function MarginSimulator({ initial, result }: { initial?: MarginInputs; result: AnalysisPayload['margin'] }) {
  const [sim, setSim] = useState({
    unitCost:   String(initial?.unitCost   ?? ''),
    importacion: String(initial?.importacion ?? ''),
    fees:       String(initial?.fees       ?? ''),
    sellPrice:  String(initial?.sellPrice  ?? ''),
  });

  const n = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };

  const calc = useMemo(() => {
    const unitCost   = n(sim.unitCost);
    const importacion = n(sim.importacion);
    const fees       = n(sim.fees);
    const sellPrice  = n(sim.sellPrice);
    const totalCost  = unitCost + importacion + fees;
    const grossProfit = sellPrice - totalCost;
    const marginPct  = sellPrice > 0 ? grossProfit / sellPrice : 0;
    const multiple   = totalCost > 0 ? sellPrice / totalCost : 0;
    const maxAdsBudget = grossProfit > 0 ? Math.round(grossProfit * 0.25 * 100) / 100 : 0;
    const breakEvenCAC = Math.max(0, Math.round(grossProfit * 100) / 100);
    return { totalCost, grossProfit, marginPct, multiple, maxAdsBudget, breakEvenCAC, sellPrice };
  }, [sim]);

  const hasData = n(sim.sellPrice) > 0 && (n(sim.unitCost) > 0 || n(sim.importacion) > 0 || n(sim.fees) > 0);

  const statusLabel = (() => {
    if (!hasData) return null;
    if (calc.multiple >= 3.5) return { text: 'Margen sano', color: '#4ADE80' };
    if (calc.multiple >= 3.0) return { text: 'Margen ajustado', color: '#FACC15' };
    if (calc.multiple > 0)    return { text: 'No escala con pauta', color: '#F87171' };
    return { text: 'Datos insuficientes', color: '#F87171' };
  })();

  const field = (key: keyof typeof sim, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-40">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-30 text-sm font-mono">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={sim[key]}
          placeholder={placeholder}
          onChange={e => setSim(p => ({ ...p, [key]: e.target.value }))}
          className="w-full bg-bg-3 border border-border-mid rounded-lg pl-7 pr-3 py-2 text-text-100 font-mono text-sm
                     focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors
                     placeholder:text-text-20"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-text-40 mb-4 leading-relaxed">
          Editá los valores para simular distintos escenarios. Los cambios no afectan el análisis guardado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field('unitCost',    'Costo del producto', '0')}
          {field('importacion', 'Importación',        '0')}
          {field('fees',        'Fees y venta',       '0')}
          {field('sellPrice',   'Precio de venta',    '0')}
        </div>
      </div>

      {/* Results */}
      {hasData ? (
        <div className="space-y-3">
          {statusLabel && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ background: `${statusLabel.color}12`, border: `1px solid ${statusLabel.color}30` }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusLabel.color }} />
              <span className="text-sm font-medium" style={{ color: statusLabel.color }}>{statusLabel.text}</span>
              <span className="font-display text-lg tabular-nums ml-auto" style={{ color: statusLabel.color }}>
                {calc.multiple.toFixed(1)}x
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox label="Margen bruto" value={`$${calc.grossProfit.toFixed(2)}`} sub="por unidad" color={calc.grossProfit > 0 ? '#4ADE80' : '#F87171'} />
            <StatBox label="Margen %" value={`${Math.round(calc.marginPct * 100)}%`} sub="sobre venta" />
            <StatBox label="Múltiplo" value={`${calc.multiple.toFixed(1)}x`} sub="precio / costo" />
            <StatBox label="Max ads/unidad" value={`$${calc.maxAdsBudget.toFixed(2)}`} sub="25% del margen" />
            <StatBox label="Break-even CAC" value={`$${calc.breakEvenCAC.toFixed(2)}`} sub="punto de equilibrio" />
            <StatBox label="Costo total" value={`$${calc.totalCost.toFixed(2)}`} sub="por unidad" />
          </div>

          {/* Cost breakdown bar */}
          {calc.sellPrice > 0 && calc.totalCost > 0 && (
            <div>
              <div className="text-[10px] font-mono text-text-40 mb-2 uppercase tracking-[0.1em]">Estructura del precio</div>
              <div className="h-4 rounded-full overflow-hidden flex gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {n(sim.unitCost) > 0 && (
                  <div
                    className="h-full"
                    title="Costo del producto"
                    style={{ width: `${(n(sim.unitCost) / calc.sellPrice) * 100}%`, background: '#6366F1' }}
                  />
                )}
                {n(sim.importacion) > 0 && (
                  <div
                    className="h-full"
                    title="Importación"
                    style={{ width: `${(n(sim.importacion) / calc.sellPrice) * 100}%`, background: '#8B5CF6' }}
                  />
                )}
                {n(sim.fees) > 0 && (
                  <div
                    className="h-full"
                    title="Fees y venta"
                    style={{ width: `${(n(sim.fees) / calc.sellPrice) * 100}%`, background: '#EC4899' }}
                  />
                )}
                {calc.grossProfit > 0 && (
                  <div
                    className="h-full flex-1"
                    title="Margen"
                    style={{ background: '#4ADE80' }}
                  />
                )}
              </div>
              <div className="flex gap-3 mt-2 flex-wrap">
                {[
                  { label: 'Producto', color: '#6366F1', val: n(sim.unitCost) },
                  { label: 'Importación', color: '#8B5CF6', val: n(sim.importacion) },
                  { label: 'Fees', color: '#EC4899', val: n(sim.fees) },
                  { label: 'Margen', color: '#4ADE80', val: calc.grossProfit },
                ].filter(x => x.val > 0).map(x => (
                  <div key={x.label} className="flex items-center gap-1.5 text-[10px] font-mono text-text-40">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: x.color }} />
                    {x.label} ${x.val.toFixed(0)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border-soft bg-bg-2 p-5 text-center">
          <p className="text-sm text-text-40">Completá los valores para simular el margen.</p>
          {result && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <StatBox label="Múltiplo actual" value={`${result.multiple}x`} />
              <StatBox label="Margen %" value={`${Math.round(result.marginPct * 100)}%`} />
              <StatBox label="Ganancia" value={`$${result.grossProfit}`} sub="por unidad" color="#4ADE80" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

function TabResumen({ data }: { data: AnalysisPayload }) {
  const v = VERDICT_META[data.result.verdict] ?? VERDICT_META.maybe;
  const adjustedScore = data.result.adjustedScore ?? data.result.score;
  const topDims = [...data.result.breakdown].sort((a, b) => b.raw - a.raw).slice(0, 3);
  const bottomDims = [...data.result.breakdown].sort((a, b) => a.raw - b.raw).slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Reason */}
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: `${v.color}25`, background: v.bg }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: v.color }}>
            Diagnóstico
          </span>
          <span
            className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]"
            style={{ background: `${v.color}20`, color: v.color }}
          >
            Score {adjustedScore}/100
          </span>
        </div>
        <p className="text-sm text-text-80 leading-relaxed">{data.result.reason}</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '¿Existe el negocio?', value: data.result.filters.business },
          { label: '¿Se vende con pauta?', value: data.result.filters.sellability },
          { label: '¿Vale el esfuerzo?',   value: data.result.filters.worthwhile },
        ].map(f => (
          <div key={f.label} className="rounded-xl border border-border-soft bg-bg-2 p-3 sm:p-4">
            <div
              className="font-display text-2xl sm:text-3xl tabular-nums mb-1"
              style={{ color: dimColor((f.value / 100) * 5) }}
            >
              {f.value}
            </div>
            <div className="text-[10px] text-text-40 leading-tight">{f.label}</div>
          </div>
        ))}
      </div>

      {/* Top / bottom dimensions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3">Fortalezas</div>
          <div className="space-y-2.5">
            {topDims.map(d => (
              <div key={d.key} className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full bg-bg-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(d.raw / 5) * 100}%`, background: dimColor(d.raw) }} />
                </div>
                <span className="text-xs text-text-60 w-28 shrink-0 text-right">{d.label}</span>
                <span className="text-xs font-mono w-4 text-right" style={{ color: dimColor(d.raw) }}>{d.raw}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3">Puntos débiles</div>
          <div className="space-y-2.5">
            {bottomDims.map(d => (
              <div key={d.key} className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full bg-bg-3 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(d.raw / 5) * 100}%`, background: dimColor(d.raw) }} />
                </div>
                <span className="text-xs text-text-60 w-28 shrink-0 text-right">{d.label}</span>
                <span className="text-xs font-mono w-4 text-right" style={{ color: dimColor(d.raw) }}>{d.raw}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Posicionamiento */}
      <div className="rounded-2xl border border-border-soft bg-bg-2 p-4">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-2">Mejor posicionamiento</div>
        <p className="text-sm text-text-80 leading-relaxed">{data.analysis.positioning}</p>
      </div>

      {/* Data gaps */}
      {data.analysis.dataGaps.length > 0 && (
        <div className="rounded-xl border border-border-soft bg-bg-1/50 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-2">Datos no disponibles</div>
          <div className="flex flex-wrap gap-1.5">
            {data.analysis.dataGaps.map((g, i) => (
              <span key={i} className="text-[10px] font-mono text-text-40 bg-bg-3 rounded px-2 py-0.5">{g}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabMercado({ data }: { data: AnalysisPayload }) {
  const unavailableLabel = (status?: SourceStatus): string => {
    if (!status || status === 'ok' || status === 'low_volume') return 'N/D';
    return 'N/D';
  };

  const STATUS_COLORS: Record<SourceStatus, string> = {
    ok: '#4ADE80', low_volume: '#FACC15', no_results: '#FB923C',
    blocked: 'rgba(255,255,255,0.36)', rate_limited: '#FB923C',
    not_configured: 'rgba(255,255,255,0.24)', error: '#F87171',
  };
  const STATUS_DOT: Record<SourceStatus, string> = {
    ok: '●', low_volume: '◑', no_results: '○',
    blocked: '—', rate_limited: '⏳', not_configured: '—', error: '✕',
  };

  return (
    <div className="space-y-4">
      {/* Signals grid */}
      <div className="rounded-2xl border border-border-soft bg-bg-2 p-4 sm:p-5">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40">Señales de mercado</span>
          {data.product.searchTerm && (
            <span className="text-[10px] font-mono text-text-30">
              buscado como: <span className="text-text-50">"{data.product.searchTerm}"</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox
            label="Google Trends"
            value={data.signals.trendsInterest !== null ? `${data.signals.trendsInterest}/100` : unavailableLabel(data.sourceStatuses?.trends.status)}
            sub={data.signals.trendsInterest !== null ? data.signals.trendDirection : ''}
          />
          <StatBox
            label="Competidores ML"
            value={
              data.signals.mlCompetitors !== null ? fmt(data.signals.mlCompetitors)
              : data.signals.googleMLEstimate !== null ? `~${fmt(data.signals.googleMLEstimate)}`
              : unavailableLabel(data.sourceStatuses?.mercadoLibre.status)
            }
            sub={
              data.signals.mlCompetitors !== null ? 'publicaciones'
              : data.signals.googleMLEstimate !== null ? 'est. Google' : ''
            }
          />
          <StatBox
            label={data.signals.mlPriceRange ? 'Rango ML' : `Precios ${data.signals.argCurrency ?? 'ARS'}`}
            value={
              data.signals.mlPriceRange
                ? `${fmt(data.signals.mlPriceRange[0])}–${fmt(data.signals.mlPriceRange[1])}`
                : data.signals.argPriceRange
                ? `${fmt(data.signals.argPriceRange[0])}–${fmt(data.signals.argPriceRange[1])}`
                : unavailableLabel(data.sourceStatuses?.prices.status)
            }
            sub={data.signals.mlPriceRange ? 'competencia' : data.signals.argPriceRange ? 'Google Shopping' : ''}
          />
          <StatBox
            label="Margen actual"
            value={`${data.margin.multiple}x`}
            sub={`${Math.round(data.margin.marginPct * 100)}% sobre venta`}
            color={data.margin.multiple >= 3 ? '#4ADE80' : '#F87171'}
          />
        </div>
      </div>

      {/* Supplier signals */}
      {(data.signals.supplierPriceRangeUSD || data.signals.supplierCount !== null) && (
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-4">Señales de proveedor (Alibaba)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.signals.supplierPriceRangeUSD && (
              <StatBox label="Precio FOB (USD)" value={`$${data.signals.supplierPriceRangeUSD[0]}–$${data.signals.supplierPriceRangeUSD[1]}`} sub="por unidad" />
            )}
            {data.signals.supplierCount !== null && (
              <StatBox label="Proveedores" value={fmt(data.signals.supplierCount)} sub="en Alibaba" />
            )}
            {data.signals.supplierMOQ !== null && (
              <StatBox label="MOQ mínimo" value={fmt(data.signals.supplierMOQ)} sub={data.signals.supplierMOQUnit ?? 'unidades'} />
            )}
          </div>
        </div>
      )}

      {/* 9 Dimensions */}
      <div className="rounded-2xl border border-border-soft bg-bg-2 p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-4">Las 9 dimensiones</div>
        <div className="space-y-2">
          {data.result.breakdown.map(b => (
            <div key={b.key} className="flex items-center gap-3">
              <span className="text-xs text-text-60 w-40 shrink-0">{b.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-bg-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(b.raw / 5) * 100}%`, background: dimColor(b.raw) }}
                />
              </div>
              <span className="text-xs font-mono text-text-60 w-4 text-right tabular-nums">{b.raw}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sources */}
      {data.sourceStatuses && (
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40">Estado de fuentes</span>
            <span
              className="text-[10px] font-mono rounded-full px-2 py-0.5"
              style={{
                background: data.result.confidence === 'high' ? 'rgba(74,222,128,0.1)' : data.result.confidence === 'medium' ? 'rgba(250,204,21,0.1)' : 'rgba(248,113,113,0.1)',
                color: data.result.confidence === 'high' ? '#4ADE80' : data.result.confidence === 'medium' ? '#FACC15' : '#F87171',
              }}
            >
              Confianza: {data.result.confidenceLabel ?? 'Alta'}
              {(data.result.dataPenalty ?? 0) > 0 && ` (-${data.result.dataPenalty} pts)`}
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Google Trends', info: data.sourceStatuses?.trends },
              { label: 'Mercado Libre', info: data.sourceStatuses?.mercadoLibre },
              { label: 'Precios ML',    info: data.sourceStatuses?.prices },
              { label: 'Google Market', info: data.sourceStatuses?.googleMarket },
              { label: 'Alibaba',       info: data.sourceStatuses?.supplier },
            ].filter(s => s.info).map(s => {
              const status = s.info!.status;
              const color = STATUS_COLORS[status];
              return (
                <div key={s.label} className="flex items-center gap-3 py-1 border-b border-border-soft last:border-0">
                  <span className="text-[10px] shrink-0" style={{ color }}>{STATUS_DOT[status]}</span>
                  <span className="text-xs font-mono text-text-60 w-28 shrink-0">{s.label}</span>
                  <span
                    className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${color}18`, color }}
                  >
                    {SOURCE_STATUS_LABELS[status]}
                  </span>
                  {s.info?.reason && (
                    <span className="text-[10px] text-text-30 truncate">{s.info.reason}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabRiesgos({
  data,
  productId,
  saved,
  onSave,
}: {
  data: AnalysisPayload;
  productId: string;
  saved: SavedStates;
  onSave: (type: 'risks' | 'angles', idx: number, state: RiskState | AngleState) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-40 leading-relaxed">
        Evaluá cada riesgo y decidí cómo manejarlo. Las decisiones se guardan localmente.
      </p>
      {data.analysis.keyRisks.map((risk, i) => {
        const state = saved.risks[i] ?? 'pending';
        const sev = riskSeverity(risk, i);
        const isDismissed = state === 'dismissed';

        return (
          <div
            key={i}
            className="rounded-2xl border p-4 sm:p-5 transition-all duration-200"
            style={{
              borderColor: isDismissed ? 'rgba(255,255,255,0.04)' : `${sev.color}22`,
              background: isDismissed ? 'rgba(255,255,255,0.01)' : `${sev.color}06`,
              opacity: isDismissed ? 0.4 : 1,
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Pill color={sev.color}>Severidad {sev.label}</Pill>
                  {state === 'accepted' && <Pill color="#4ADE80">Aceptado</Pill>}
                  {state === 'saved'    && <Pill color="#B8FF5C">En Board ✓</Pill>}
                </div>
                <p className="text-sm text-text-80 leading-relaxed">{risk}</p>
              </div>
            </div>

            {!isDismissed && (
              <div className="flex gap-2 flex-wrap">
                {state !== 'accepted' && (
                  <ActionBtn onClick={() => onSave('risks', i, 'accepted')}>
                    Aceptar riesgo
                  </ActionBtn>
                )}
                <ActionBtn
                  onClick={() => onSave('risks', i, state === 'saved' ? 'pending' : 'saved')}
                  variant={state === 'saved' ? 'accent' : 'ghost'}
                  active={state === 'saved'}
                >
                  {state === 'saved' ? 'En Board ✓' : 'Guardar en Board'}
                </ActionBtn>
                <ActionBtn onClick={() => onSave('risks', i, 'dismissed')} variant="danger">
                  Descartar
                </ActionBtn>
              </div>
            )}

            {isDismissed && (
              <button
                className="text-xs text-text-30 hover:text-text-60 transition-colors font-mono"
                onClick={() => onSave('risks', i, 'pending')}
              >
                Restaurar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TabAngulos({
  data,
  saved,
  onSave,
}: {
  data: AnalysisPayload;
  saved: SavedStates;
  onSave: (type: 'risks' | 'angles', idx: number, state: RiskState | AngleState) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const toggleExpand = (i: number) =>
    setExpanded(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-40 leading-relaxed">
        Ángulos de venta para testear. Guardá los más prometedores en tu Board.
      </p>
      {data.analysis.angles.map((angle, i) => {
        const state = saved.angles[i] ?? 'pending';
        const isDismissed = state === 'dismissed';
        const isExpanded = expanded.has(i);

        return (
          <div
            key={i}
            className="rounded-2xl border transition-all duration-200"
            style={{
              borderColor: isDismissed ? 'rgba(255,255,255,0.04)' : state === 'saved' ? 'rgba(184,255,92,0.3)' : 'rgba(255,255,255,0.08)',
              background: isDismissed ? 'rgba(255,255,255,0.01)' : state === 'saved' ? 'rgba(184,255,92,0.04)' : 'rgba(255,255,255,0.02)',
              opacity: isDismissed ? 0.4 : 1,
            }}
          >
            <button
              className="w-full text-left p-4 sm:p-5"
              onClick={() => toggleExpand(i)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[10px] font-mono uppercase tracking-[0.12em] rounded-full px-2 py-0.5"
                      style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C' }}
                    >
                      {angle.trigger}
                    </span>
                    {state === 'saved' && <Pill color="#B8FF5C">En Board ✓</Pill>}
                  </div>
                  <p className="text-sm font-medium text-text-100 leading-snug">"{angle.hook}"</p>
                </div>
                <span className="text-text-40 shrink-0 mt-0.5 font-mono text-xs">
                  {isExpanded ? '↑' : '↓'}
                </span>
              </div>
            </button>

            {isExpanded && !isDismissed && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border-soft pt-3 space-y-3">
                <p className="text-xs text-text-60 leading-relaxed">{angle.angle}</p>
                <div className="flex gap-2 flex-wrap">
                  <ActionBtn
                    onClick={() => onSave('angles', i, state === 'saved' ? 'pending' : 'saved')}
                    variant={state === 'saved' ? 'accent' : 'ghost'}
                    active={state === 'saved'}
                  >
                    {state === 'saved' ? 'En Board ✓' : 'Guardar en Board'}
                  </ActionBtn>
                  <ActionBtn onClick={() => onSave('angles', i, 'dismissed')} variant="danger">
                    Descartar
                  </ActionBtn>
                </div>
              </div>
            )}

            {isDismissed && (
              <div className="px-4 pb-3">
                <button
                  className="text-xs text-text-30 hover:text-text-60 transition-colors font-mono"
                  onClick={() => onSave('angles', i, 'pending')}
                >
                  Restaurar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductWarRoom({
  data,
  productId,
  marginInputs,
  battleContext,
  hasLaunchBoardData,
  onCreateLaunchBoard,
  onBack,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('resumen');
  const [saved, setSaved] = useState<SavedStates>({ risks: {}, angles: {} });

  const v = VERDICT_META[data.result.verdict] ?? VERDICT_META.maybe;
  const adjustedScore = data.result.adjustedScore ?? data.result.score;
  const confidence = data.result.confidence ?? 'high';
  const savedCount = Object.values(saved.risks).filter(s => s === 'saved').length
    + Object.values(saved.angles).filter(s => s === 'saved').length;

  // Load saved states from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RISK_SAVE_KEY(productId));
      if (raw) setSaved(JSON.parse(raw));
      else setSaved({ risks: {}, angles: {} });
    } catch { setSaved({ risks: {}, angles: {} }); }
  }, [productId]);

  const handleSave = (type: 'risks' | 'angles', idx: number, state: RiskState | AngleState) => {
    setSaved(prev => {
      const next = { ...prev, [type]: { ...prev[type], [idx]: state } };
      try { localStorage.setItem(RISK_SAVE_KEY(productId), JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    resumen: <TabResumen data={data} />,
    mercado: <TabMercado data={data} />,
    margen: <MarginSimulator initial={marginInputs} result={data.margin} />,
    riesgos: <TabRiesgos data={data} productId={productId} saved={saved} onSave={handleSave} />,
    angulos: <TabAngulos data={data} saved={saved} onSave={handleSave} />,
  };

  return (
    <div className="animate-fade-up space-y-4">

      {/* ── Board header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5 shrink-0"
        >
          ← Resultado
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: '#B8FF5C' }}>
              Board
            </span>
            <span className="text-[10px] font-mono text-text-20">·</span>
            <span
              className="text-[10px] font-mono rounded-full px-1.5 py-0.5"
              style={{ background: `${v.color}1a`, color: v.color }}
            >
              {adjustedScore}/100 · {v.label}
            </span>
          </div>
          <h2 className="font-display text-lg text-text-100 leading-tight truncate mt-0.5">
            {data.product.title}
          </h2>
        </div>
        <button
          onClick={onCreateLaunchBoard}
          className="shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all hover:opacity-80"
          style={{
            borderColor: hasLaunchBoardData ? 'rgba(184,255,92,0.4)' : 'rgba(255,255,255,0.1)',
            color: hasLaunchBoardData ? '#B8FF5C' : 'rgba(255,255,255,0.5)',
            background: hasLaunchBoardData ? 'rgba(184,255,92,0.06)' : 'transparent',
          }}
          title="Generar Board creativo con territorios de marca, ángulos, prompts y shot list"
        >
          {hasLaunchBoardData ? '✦ Launch Board' : '+ Launch Board'}
        </button>
      </div>

      {/* Battle context banner */}
      {battleContext && (
        <div
          className="rounded-2xl border p-4 sm:p-5 space-y-2"
          style={{ borderColor: 'rgba(184,255,92,0.25)', background: 'rgba(184,255,92,0.05)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: '#B8FF5C' }}>
            ★ Ganador de Battle Mode
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-text-80">
            <div><span className="text-text-40 font-mono text-[10px] uppercase tracking-[0.1em]">Venció a · </span>{battleContext.opponent}</div>
            {battleContext.keyDifference && (
              <div><span className="text-text-40 font-mono text-[10px] uppercase tracking-[0.1em]">Diferencia clave · </span>{battleContext.keyDifference}</div>
            )}
          </div>
          {battleContext.reason && (
            <p className="text-xs text-text-60 leading-relaxed border-t border-border-soft pt-2">{battleContext.reason}</p>
          )}
          {battleContext.recommendation && (
            <p className="text-xs leading-relaxed" style={{ color: '#B8FF5C' }}>→ {battleContext.recommendation}</p>
          )}
        </div>
      )}

      {/* Saved items indicator */}
      {savedCount > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono"
          style={{ borderColor: 'rgba(184,255,92,0.2)', background: 'rgba(184,255,92,0.04)', color: 'rgba(184,255,92,0.7)' }}
        >
          <span>{savedCount} ítem{savedCount !== 1 ? 's' : ''} marcado{savedCount !== 1 ? 's' : ''} en este board</span>
        </div>
      )}

      {/* ── Tab nav ── */}
      <div className="flex gap-1 p-1 rounded-xl border border-border-soft bg-bg-2 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'riesgos' ? data.analysis.keyRisks.length
            : tab.id === 'angulos' ? data.analysis.angles.length
            : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-xs font-mono transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                borderBottom: isActive ? `2px solid rgba(184,255,92,0.6)` : '2px solid transparent',
              }}
            >
              {tab.label}
              {badge !== null && (
                <span
                  className="rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px]"
                  style={{
                    background: isActive ? 'rgba(184,255,92,0.2)' : 'rgba(255,255,255,0.08)',
                    color: isActive ? '#B8FF5C' : 'rgba(255,255,255,0.36)',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="animate-fade-up" key={activeTab}>
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
