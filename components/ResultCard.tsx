'use client';

import type { Verdict } from '@/lib/scoring';
import type { SourceStatus } from '@/lib/source-status';
import { SOURCE_STATUS_LABELS } from '@/lib/source-status';

interface SourceInfo {
  status: SourceStatus;
  reason: string;
  keywordsTried?: string[];
  queriesTried?: string[];
}

interface AnalysisPayload {
  product: { title: string; category: string | null; searchTerm?: string; sourceUrl: string | null; country: string };
  margin: { multiple: number; totalCost: number; grossProfit: number; marginPct: number };
  signals: {
    trendsInterest: number | null;
    trendDirection: string;
    mlCompetitors: number | null;
    mlPriceRange: [number, number] | null;
    googleMLEstimate: number | null;
    argPriceRange: [number, number] | null;
    argCurrency: string | null;
    supplierPriceRangeUSD: [number, number] | null;
    supplierCount: number | null;
    supplierMOQ: number | null;
    supplierMOQUnit: string | null;
  };
  sourceStatuses?: {
    trends: SourceInfo;
    mercadoLibre: SourceInfo;
    prices: SourceInfo;
    googleMarket?: SourceInfo & { queriesTried?: string[] };
    supplier?: SourceInfo;
  };
  analysis: {
    positioning: string;
    keyRisks: string[];
    angles: { hook: string; angle: string; trigger: string }[];
    dataGaps: string[];
  };
  result: {
    score: number;
    adjustedScore?: number;
    dataPenalty?: number;
    confidence?: 'high' | 'medium' | 'low';
    confidenceLabel?: string;
    verdict: Verdict;
    filters: { business: number; sellability: number; worthwhile: number };
    breakdown: { key: string; label: string; weighted: number; raw: number }[];
    reason: string;
  };
}

export interface RankInfo {
  position: number;
  total: number;
  isNewLeader: boolean;
  scoreDelta: number | null;
  leaderTitle: string | null;
}

const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string; emoji: string }> = {
  go: { label: 'Avanzar', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)', emoji: '→' },
  maybe: { label: 'Dudoso', color: '#FACC15', bg: 'rgba(250,204,21,0.1)', emoji: '~' },
  kill: { label: 'Descartar', color: '#F87171', bg: 'rgba(248,113,113,0.1)', emoji: '✕' },
};

function rankColor(pos: number): string {
  if (pos === 1) return '#B8FF5C';
  if (pos === 2) return '#FACC15';
  if (pos === 3) return '#FB923C';
  return 'rgba(255,255,255,0.36)';
}

function shortTitle(title: string | null, words = 4): string {
  if (!title) return '';
  const parts = title.split(' ').slice(0, words);
  return parts.join(' ') + (title.split(' ').length > words ? '…' : '');
}

export default function ResultCard({
  data,
  onBattle,
  rankInfo,
}: {
  data: AnalysisPayload;
  onBattle?: () => void;
  rankInfo?: RankInfo | null;
}) {
  const v = VERDICT_META[data.result.verdict];
  const adjustedScore = data.result.adjustedScore ?? data.result.score;
  const dataPenalty = data.result.dataPenalty ?? 0;
  const confidence = data.result.confidence ?? 'high';
  const confidenceLabel = data.result.confidenceLabel ?? 'Alta';
  const showAdjusted = dataPenalty > 0;

  const battleLabel = (() => {
    if (!rankInfo || rankInfo.total <= 1) return '⚔ Comparar con otro producto';
    if (rankInfo.isNewLeader) return '⚔ Sos el #1 — ¿puede otro destronarte?';
    if (rankInfo.leaderTitle) return `⚔ ¿Puede ganarle a ${shortTitle(rankInfo.leaderTitle, 3)}?`;
    return '⚔ Comparar con otro producto';
  })();

  return (
    <div className="animate-fade-up space-y-5">

      {/* Rank position banner */}
      {rankInfo && rankInfo.total > 1 && (
        rankInfo.isNewLeader ? (
          <div
            className="rounded-2xl border p-4 sm:p-5 text-center"
            style={{ borderColor: 'rgba(184,255,92,0.4)', background: 'rgba(184,255,92,0.07)' }}
          >
            <div
              className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2"
              style={{ color: '#B8FF5C' }}
            >
              ★ Nuevo líder
            </div>
            <div
              className="font-display text-5xl sm:text-6xl leading-none mb-2"
              style={{ color: '#B8FF5C' }}
            >
              #1
            </div>
            <div className="text-xs text-text-40 leading-relaxed">
              Este producto encabeza tu ranking — defendé el trono.
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border border-border-soft bg-bg-1/80 px-4 py-3 flex items-center gap-4"
          >
            <div
              className="font-display text-3xl tabular-nums shrink-0 leading-none"
              style={{ color: rankColor(rankInfo.position) }}
            >
              #{rankInfo.position}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-60">de {rankInfo.total} en tu ranking</div>
              {rankInfo.scoreDelta !== null && (
                <div className="text-[11px] font-mono mt-0.5" style={{ color: '#F87171' }}>
                  {rankInfo.scoreDelta > 0 ? '+' : ''}{rankInfo.scoreDelta} pts del líder
                </div>
              )}
            </div>
            {rankInfo.leaderTitle && (
              <div className="text-[10px] text-text-30 text-right shrink-0 max-w-[110px] leading-tight">
                Líder:<br />
                <span className="text-text-40">{shortTitle(rankInfo.leaderTitle, 3)}</span>
              </div>
            )}
          </div>
        )
      )}

      {/* Encabezado: veredicto + score */}
      <div
        className="rounded-2xl border p-6 sm:p-8"
        style={{ borderColor: `${v.color}33`, background: v.bg }}
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-[0.14em] font-mono mb-3"
              style={{ background: `${v.color}22`, color: v.color }}
            >
              <span>{v.emoji}</span> {v.label}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-text-100 leading-tight max-w-md">
              {data.product.title}
            </h2>
          </div>
          <div className="text-right">
            {showAdjusted ? (
              <>
                <div className="font-display text-6xl sm:text-7xl tabular-nums leading-none" style={{ color: v.color }}>
                  {adjustedScore}
                </div>
                <div className="text-xs font-mono text-text-40 mt-1 tracking-[0.14em]">/ 100 ajustado</div>
                <div className="text-[11px] font-mono text-text-40 mt-1 line-through">{data.result.score} base</div>
              </>
            ) : (
              <>
                <div className="font-display text-6xl sm:text-7xl tabular-nums leading-none" style={{ color: v.color }}>
                  {adjustedScore}
                </div>
                <div className="text-xs font-mono text-text-40 mt-1 tracking-[0.14em]">/ 100</div>
              </>
            )}
          </div>
        </div>
        <p className="text-text-80 mt-5 leading-relaxed border-t border-border-soft pt-4">
          {data.result.reason}
        </p>
      </div>

      {/* Battle CTA */}
      {onBattle && (
        <button
          onClick={onBattle}
          className="w-full py-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: 'rgba(184,255,92,0.1)',
            border: '1px solid rgba(184,255,92,0.3)',
            color: '#B8FF5C',
          }}
        >
          {battleLabel}
          <span className="text-xs font-mono opacity-60 ml-1">→</span>
        </button>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-3">
        <FilterBar label="¿Existe el negocio?" value={data.result.filters.business} />
        <FilterBar label="¿Se vende con pauta?" value={data.result.filters.sellability} />
        <FilterBar label="¿Vale el esfuerzo?" value={data.result.filters.worthwhile} />
      </div>

      {/* Señales reales */}
      <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-display text-lg">Señales de mercado</h3>
          {data.product.searchTerm && (
            <span className="text-[11px] font-mono text-text-40">
              buscado como: <span className="text-text-60">"{data.product.searchTerm}"</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Signal
            label="Google Trends"
            value={data.signals.trendsInterest !== null ? `${data.signals.trendsInterest}/100` : unavailableLabel(data.sourceStatuses?.trends.status)}
            sub={data.signals.trendsInterest !== null ? data.signals.trendDirection : ''}
            status={data.sourceStatuses?.trends.status}
          />
          <Signal
            label="Competidores ML"
            value={
              data.signals.mlCompetitors !== null
                ? fmt(data.signals.mlCompetitors)
                : data.signals.googleMLEstimate !== null
                ? `~${fmt(data.signals.googleMLEstimate)}`
                : unavailableLabel(data.sourceStatuses?.mercadoLibre.status)
            }
            sub={
              data.signals.mlCompetitors !== null
                ? 'publicaciones'
                : data.signals.googleMLEstimate !== null
                ? 'est. vía Google'
                : ''
            }
            status={data.signals.mlCompetitors === null && data.signals.googleMLEstimate === null ? data.sourceStatuses?.mercadoLibre.status : undefined}
          />
          <Signal
            label="Margen"
            value={`${data.margin.multiple}x`}
            sub={`${Math.round(data.margin.marginPct * 100)}% sobre venta`}
          />
          <Signal
            label={data.signals.mlPriceRange ? 'Rango precios ML' : `Precios ${data.signals.argCurrency ?? 'ARS'}`}
            value={
              data.signals.mlPriceRange
                ? `${fmt(data.signals.mlPriceRange[0])}–${fmt(data.signals.mlPriceRange[1])}`
                : data.signals.argPriceRange
                ? `${fmt(data.signals.argPriceRange[0])}–${fmt(data.signals.argPriceRange[1])}`
                : unavailableLabel(data.sourceStatuses?.prices.status)
            }
            sub={data.signals.mlPriceRange ? 'competencia ML' : data.signals.argPriceRange ? 'Google Shopping' : ''}
            status={!data.signals.mlPriceRange && !data.signals.argPriceRange ? data.sourceStatuses?.prices.status : undefined}
          />
        </div>
      </div>

      {/* Señales de proveedor (Alibaba) */}
      {(data.signals.supplierPriceRangeUSD || data.signals.supplierCount !== null || data.signals.supplierMOQ !== null) && (
        <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
          <h3 className="font-display text-lg mb-4">Señales de proveedor (Alibaba)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {data.signals.supplierPriceRangeUSD && (
              <Signal
                label="Precio FOB (USD)"
                value={`$${data.signals.supplierPriceRangeUSD[0]}–$${data.signals.supplierPriceRangeUSD[1]}`}
                sub="por unidad"
              />
            )}
            {data.signals.supplierCount !== null && (
              <Signal
                label="Proveedores"
                value={fmt(data.signals.supplierCount)}
                sub="en Alibaba"
              />
            )}
            {data.signals.supplierMOQ !== null && (
              <Signal
                label="MOQ mínimo"
                value={fmt(data.signals.supplierMOQ)}
                sub={data.signals.supplierMOQUnit ?? 'unidades'}
              />
            )}
          </div>
        </div>
      )}

      {/* Estado de fuentes */}
      <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-display text-lg">Estado de fuentes</h3>
          <ConfidenceBadge level={confidence} label={confidenceLabel} penalty={dataPenalty} />
        </div>
        <div className="space-y-2.5">
          <SourceRow
            label="Google Trends"
            info={data.sourceStatuses?.trends}
            fallbackStatus="not_configured"
            extra={data.sourceStatuses?.trends.keywordsTried}
            extraLabel="keywords probadas"
          />
          <SourceRow
            label="Mercado Libre"
            info={data.sourceStatuses?.mercadoLibre}
            fallbackStatus="not_configured"
            extra={data.sourceStatuses?.mercadoLibre.queriesTried}
            extraLabel="queries probadas"
          />
          <SourceRow
            label="Precios ML"
            info={data.sourceStatuses?.prices}
            fallbackStatus={data.signals.mlPriceRange ? 'ok' : 'no_results'}
          />
          <SourceRow
            label="Google Market"
            info={data.sourceStatuses?.googleMarket}
            fallbackStatus="not_configured"
            extra={data.sourceStatuses?.googleMarket?.queriesTried}
            extraLabel="queries"
          />
          <SourceRow
            label="Alibaba"
            info={data.sourceStatuses?.supplier}
            fallbackStatus="not_configured"
          />
        </div>
        {confidence === 'low' && (
          <div
            className="mt-4 rounded-xl p-3 text-xs text-text-80 leading-relaxed"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            Análisis preliminar con baja confianza. Requiere validación manual o test publicitario antes de comprometer capital.
          </div>
        )}
      </div>

      {/* Desglose por dimensión */}
      <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
        <h3 className="font-display text-lg mb-4">Las 9 dimensiones</h3>
        <div className="space-y-2.5">
          {data.result.breakdown.map((b) => (
            <div key={b.key} className="flex items-center gap-3">
              <span className="text-sm text-text-60 w-44 shrink-0">{b.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-bg-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(b.raw / 5) * 100}%`,
                    background: dimColor(b.raw),
                  }}
                />
              </div>
              <span className="text-xs font-mono text-text-80 w-6 text-right tabular-nums">
                {b.raw}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Posicionamiento + riesgos */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
          <h3 className="font-display text-lg mb-3">Mejor posicionamiento</h3>
          <p className="text-sm text-text-80 leading-relaxed">{data.analysis.positioning}</p>
        </div>
        <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
          <h3 className="font-display text-lg mb-3">Riesgos clave</h3>
          <ul className="space-y-1.5">
            {data.analysis.keyRisks.map((r, i) => (
              <li key={i} className="text-sm text-text-80 flex gap-2">
                <span className="text-score-orange shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ángulos de venta */}
      {data.analysis.angles.length > 0 && (
        <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
          <h3 className="font-display text-lg mb-4">Ángulos de venta para testear</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.analysis.angles.map((a, i) => (
              <div key={i} className="rounded-xl border border-border-soft bg-bg-2 p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-accent mb-2">
                  {a.trigger}
                </div>
                <p className="text-text-100 font-medium text-sm mb-1.5">"{a.hook}"</p>
                <p className="text-text-60 text-xs leading-relaxed">{a.angle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transparencia: datos que faltaron */}
      {data.analysis.dataGaps.length > 0 && (
        <div className="rounded-xl border border-border-soft bg-bg-1/50 p-4">
          <p className="text-xs font-mono text-text-40 mb-2 uppercase tracking-[0.14em]">
            Datos no disponibles (no se inventaron)
          </p>
          <ul className="text-xs text-text-60 space-y-1">
            {data.analysis.dataGaps.map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-1/80 p-4">
      <div className="font-display text-2xl tabular-nums mb-1" style={{ color: dimColor((value / 100) * 5) }}>
        {value}
      </div>
      <div className="text-[11px] text-text-60 leading-tight">{label}</div>
    </div>
  );
}

function Signal({ label, value, sub, status }: { label: string; value: string; sub: string; status?: SourceStatus }) {
  const isUnavailable = status && status !== 'ok' && status !== 'low_volume';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-1">
        {label}
      </div>
      <div
        className="font-display text-xl tabular-nums"
        style={{ color: isUnavailable ? 'rgba(255,255,255,0.36)' : undefined }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-40 capitalize">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<SourceStatus, string> = {
  ok: '#4ADE80',
  low_volume: '#FACC15',
  no_results: '#FB923C',
  blocked: 'rgba(255,255,255,0.36)',
  rate_limited: '#FB923C',
  not_configured: 'rgba(255,255,255,0.24)',
  error: '#F87171',
};

const STATUS_DOT: Record<SourceStatus, string> = {
  ok: '●',
  low_volume: '◑',
  no_results: '○',
  blocked: '—',
  rate_limited: '⏳',
  not_configured: '—',
  error: '✕',
};

function unavailableLabel(status?: SourceStatus): string {
  if (!status || status === 'ok' || status === 'low_volume') return 'N/D';
  const map: Partial<Record<SourceStatus, string>> = {
    no_results: 'Sin datos',
    not_configured: 'N/D',
    blocked: 'N/D',
    rate_limited: 'N/D',
    error: 'N/D',
  };
  return map[status] ?? 'N/D';
}

function ConfidenceBadge({ level, label, penalty }: { level: string; label: string; penalty: number }) {
  const colors: Record<string, string> = { high: '#4ADE80', medium: '#FACC15', low: '#F87171' };
  const c = colors[level] ?? '#FACC15';
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono"
      style={{ background: `${c}18`, color: c }}
    >
      Confianza: {label}
      {penalty > 0 && <span className="opacity-70">(-{penalty} pts)</span>}
    </div>
  );
}

function SourceRow({
  label,
  info,
  fallbackStatus,
  extra,
  extraLabel,
}: {
  label: string;
  info?: { status: SourceStatus; reason: string };
  fallbackStatus: SourceStatus;
  extra?: string[];
  extraLabel?: string;
}) {
  const status = info?.status ?? fallbackStatus;
  const reason = info?.reason ?? '';
  const color = STATUS_COLORS[status];
  const dot = STATUS_DOT[status];

  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-border-soft last:border-0">
      <span className="text-[10px] mt-0.5 shrink-0 w-3 text-center" style={{ color }}>{dot}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-text-60 shrink-0">{label}</span>
          <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${color}18`, color }}>
            {SOURCE_STATUS_LABELS[status] ?? status}
          </span>
        </div>
        {reason && <p className="text-[11px] text-text-40 mt-0.5 leading-snug">{reason}</p>}
        {extra && extra.length > 0 && (
          <p className="text-[10px] text-text-30 mt-0.5 font-mono">
            {extraLabel}: {extra.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

function dimColor(raw: number): string {
  if (raw >= 4) return '#4ADE80';
  if (raw >= 3) return '#FACC15';
  if (raw >= 2) return '#FB923C';
  return '#F87171';
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es').format(Math.round(n));
}
