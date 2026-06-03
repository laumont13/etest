'use client';

import { useState } from 'react';
import type { AnalysisPayload, RankInfo } from '@/components/ResultCard';
import type { SourceStatus } from '@/lib/source-status';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductDecisionResultProps {
  data: AnalysisPayload;
  rankInfo?: RankInfo | null;
  /** Number of non-discarded history items (to gate Battle Mode) */
  historyCount: number;
  onBattle: () => void;
  onReset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VERDICT_META: Record<string, { label: string; color: string; bg: string; border: string; tag: string }> = {
  go:    { label: 'Avanzar',   color: '#4ADE80', bg: 'rgba(74,222,128,0.07)',  border: 'rgba(74,222,128,0.22)',  tag: 'Prometedor'     },
  maybe: { label: 'Dudoso',    color: '#FACC15', bg: 'rgba(250,204,21,0.07)', border: 'rgba(250,204,21,0.22)', tag: 'Evaluar primero' },
  kill:  { label: 'Descartar', color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.22)', tag: 'No recomendado'  },
};

function dimColor(v: number): string {
  if (v >= 4) return '#4ADE80';
  if (v >= 3) return '#FACC15';
  if (v >= 2) return '#FB923C';
  return '#F87171';
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es').format(Math.round(n));
}

function shortRankColor(pos: number): string {
  if (pos === 1) return '#B8FF5C';
  if (pos === 2) return '#FACC15';
  if (pos === 3) return '#FB923C';
  return 'rgba(255,255,255,0.36)';
}

function nextStepText(verdict: string): string {
  if (verdict === 'go')    return 'Comparar contra otro producto en Battle Mode. El ganador de la batalla es el que merece el Launch Command y el capital de lanzamiento.';
  if (verdict === 'maybe') return 'Necesitás validar contra un producto alternativo antes de comprometer capital. Battle Mode te da el criterio.';
  return 'Descartar. Los datos actuales no justifican el esfuerzo frente a otras oportunidades disponibles.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductDecisionResult({
  data,
  rankInfo,
  historyCount,
  onBattle,
  onReset,
}: ProductDecisionResultProps) {
  const [showDetails, setShowDetails] = useState(false);

  const v = VERDICT_META[data.result.verdict] ?? VERDICT_META.maybe;
  const adjustedScore = data.result.adjustedScore ?? data.result.score;
  const dataPenalty   = data.result.dataPenalty   ?? 0;
  const confidence    = data.result.confidence    ?? 'high';
  const confidenceLabel = data.result.confidenceLabel ?? 'Alta';
  const canBattle = historyCount >= 2;

  // Top 3 strongest dimensions for 'go'; weakest 3 for others
  const sortedDims = [...data.result.breakdown].sort((a, b) =>
    data.result.verdict === 'go' ? b.raw - a.raw : a.raw - b.raw
  ).slice(0, 3);

  const STATUS_COLORS: Record<SourceStatus, string> = {
    ok: '#4ADE80', low_volume: '#FACC15', no_results: '#FB923C',
    blocked: 'rgba(255,255,255,0.24)', rate_limited: '#FB923C',
    not_configured: 'rgba(255,255,255,0.24)', error: '#F87171',
  };

  return (
    <div className="animate-fade-up space-y-4">

      {/* ── Hero ── */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: v.border, background: v.bg }}
      >
        {/* Rank banner (compact) */}
        {rankInfo && rankInfo.total > 1 && (
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-soft">
            <span
              className="font-display text-2xl tabular-nums leading-none"
              style={{ color: shortRankColor(rankInfo.position) }}
            >
              #{rankInfo.position}
            </span>
            <span className="text-xs text-text-40">
              de {rankInfo.total} en tu ranking
              {rankInfo.scoreDelta !== null && (
                <span className="ml-2 font-mono" style={{ color: '#F87171' }}>
                  {rankInfo.scoreDelta > 0 ? '+' : ''}{rankInfo.scoreDelta} pts del líder
                </span>
              )}
            </span>
            {rankInfo.isNewLeader && (
              <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: '#B8FF5C' }}>★ Nuevo líder</span>
            )}
          </div>
        )}

        {/* Score + verdict + product info */}
        <div className="flex items-start gap-4 mb-4">
          <div>
            <div
              className="font-display tabular-nums leading-none"
              style={{ fontSize: 'clamp(3.5rem, 12vw, 5.5rem)', color: v.color }}
            >
              {adjustedScore}
            </div>
            <div className="text-xs font-mono text-text-40 text-center tabular-nums">/100</div>
          </div>
          <div className="flex-1 min-w-0 pt-1 space-y-2">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em]"
                style={{ background: `${v.color}22`, color: v.color }}
              >
                {v.label}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-mono"
                style={{
                  background: confidence === 'high' ? 'rgba(74,222,128,0.1)' : confidence === 'medium' ? 'rgba(250,204,21,0.1)' : 'rgba(248,113,113,0.1)',
                  color: confidence === 'high' ? '#4ADE80' : confidence === 'medium' ? '#FACC15' : '#F87171',
                }}
              >
                {confidenceLabel}{dataPenalty > 0 ? ` (-${dataPenalty})` : ''}
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl text-text-100 leading-tight">
              {data.product.title}
            </h2>
            <div className="flex flex-wrap gap-2 text-xs font-mono text-text-40">
              <span>{data.product.country}</span>
              <span>·</span>
              <span style={{ color: data.margin.multiple >= 3 ? '#4ADE80' : '#F87171' }}>
                {data.margin.multiple}x margen
              </span>
              <span>·</span>
              <span>{Math.round(data.margin.marginPct * 100)}% ganancia</span>
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        <p className="text-sm text-text-80 leading-relaxed border-t border-border-soft pt-4">
          {data.result.reason}
        </p>
      </div>

      {/* ── Factores + Riesgos ── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Factors */}
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4">
          <div
            className="text-[10px] uppercase tracking-[0.14em] font-mono mb-3"
            style={{ color: data.result.verdict === 'go' ? '#4ADE80' : '#F87171' }}
          >
            {data.result.verdict === 'go' ? 'Fortalezas principales' : 'Puntos débiles clave'}
          </div>
          <div className="space-y-2.5">
            {sortedDims.map(d => (
              <div key={d.key} className="flex items-center gap-2.5">
                <div className="flex-1 h-1 rounded-full bg-bg-3 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.raw / 5) * 100}%`, background: dimColor(d.raw) }}
                  />
                </div>
                <span className="text-xs text-text-60 w-32 shrink-0 text-right truncate">{d.label}</span>
                <span
                  className="text-xs font-mono tabular-nums w-4 text-right shrink-0"
                  style={{ color: dimColor(d.raw) }}
                >
                  {d.raw}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risks */}
        <div className="rounded-2xl border border-border-soft bg-bg-2 p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3">
            Riesgos críticos
          </div>
          {data.analysis.keyRisks.length > 0 ? (
            <ul className="space-y-2">
              {data.analysis.keyRisks.slice(0, 3).map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-70">
                  <span className="text-score-orange shrink-0 mt-0.5">·</span>
                  <span className="leading-snug">{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-30">Sin riesgos críticos identificados.</p>
          )}
        </div>
      </div>

      {/* ── Señales de mercado (strip compacto) ── */}
      <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-3 flex flex-wrap gap-4">
        {[
          {
            label: 'Tendencia',
            value: data.signals.trendsInterest !== null ? `${data.signals.trendsInterest}/100` : 'N/D',
            sub: data.signals.trendDirection ?? '',
          },
          {
            label: 'Competidores ML',
            value: data.signals.mlCompetitors !== null
              ? fmt(data.signals.mlCompetitors)
              : data.signals.googleMLEstimate !== null
              ? `~${fmt(data.signals.googleMLEstimate)}`
              : 'N/D',
            sub: data.signals.mlCompetitors !== null ? 'publicaciones' : '',
          },
          {
            label: 'Margen',
            value: `${data.margin.multiple}x`,
            sub: `${Math.round(data.margin.marginPct * 100)}% sobre venta`,
          },
          ...(data.signals.mlPriceRange ? [{
            label: 'Rango ML',
            value: `${fmt(data.signals.mlPriceRange[0])}–${fmt(data.signals.mlPriceRange[1])}`,
            sub: 'precios ML',
          }] : []),
        ].map(s => (
          <div key={s.label} className="flex-1 min-w-[80px]">
            <div className="text-[9px] uppercase tracking-[0.12em] font-mono text-text-30 mb-0.5">{s.label}</div>
            <div className="text-sm font-display tabular-nums text-text-80">{s.value}</div>
            {s.sub && <div className="text-[10px] text-text-30">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Próximo paso ── */}
      <div className="rounded-xl border border-border-soft bg-bg-1/60 px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-1.5">
          Próximo paso recomendado
        </div>
        <p className="text-sm text-text-80 leading-relaxed">{nextStepText(data.result.verdict)}</p>
      </div>

      {/* ── CTAs ── */}
      <div className="space-y-2">
        {/* Battle CTA — primary for all verdicts except kill */}
        {data.result.verdict !== 'kill' ? (
          <button
            onClick={canBattle ? onBattle : undefined}
            className="w-full py-3.5 rounded-xl text-sm font-semibold border transition-all"
            style={{
              borderColor: canBattle ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.08)',
              background: canBattle ? 'rgba(184,255,92,0.08)' : 'rgba(255,255,255,0.02)',
              color: canBattle ? '#B8FF5C' : 'rgba(255,255,255,0.3)',
              cursor: canBattle ? 'pointer' : 'default',
            }}
            title={!canBattle ? 'Analizá otro producto para poder comparar' : undefined}
          >
            {canBattle ? '⚔ Comparar en Battle Mode' : '⚔ Battle Mode — analizá otro producto primero'}
          </button>
        ) : (
          <button
            onClick={onReset}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171' }}
          >
            Descartar y analizar otro
          </button>
        )}

        {/* Secondary CTAs */}
        <div className="flex gap-2 flex-wrap">
          {data.result.verdict !== 'kill' && canBattle && (
            <button
              onClick={onReset}
              className="flex-1 py-3 rounded-xl text-sm border border-border-mid bg-bg-2 text-text-60 hover:text-text-100 transition-colors"
            >
              Analizar otro antes de comparar
            </button>
          )}
          {!canBattle && (
            <button
              onClick={onReset}
              className="flex-1 py-3 rounded-xl text-sm border border-border-mid bg-bg-2 text-text-60 hover:text-text-100 transition-colors"
            >
              Analizar otro producto
            </button>
          )}
          {data.result.verdict === 'kill' && canBattle && (
            <button
              onClick={onBattle}
              className="flex-1 py-3 rounded-xl text-sm border border-border-mid bg-bg-2 text-text-60 hover:text-text-100 transition-colors"
            >
              ⚔ Comparar de todas formas
            </button>
          )}
        </div>
      </div>

      {/* ── Accordion: detalles completos ── */}
      <div className="rounded-2xl border border-border-soft overflow-hidden">
        <button
          onClick={() => setShowDetails(d => !d)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-40 hover:text-text-80 transition-colors bg-bg-2"
        >
          <span className="font-mono text-xs uppercase tracking-[0.12em]">
            {showDetails ? '↑ Ocultar' : '↓ Ver análisis completo'}
          </span>
          <span className="text-[10px] font-mono text-text-30">
            {data.result.breakdown.length} dimensiones · {data.analysis.angles.length} ángulos
          </span>
        </button>

        {showDetails && (
          <div className="p-4 space-y-4 border-t border-border-soft bg-bg-1/60">
            {/* 9 dimensions */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3">Las 9 dimensiones</div>
              <div className="space-y-2">
                {data.result.breakdown.map(b => (
                  <div key={b.key} className="flex items-center gap-3">
                    <span className="text-xs text-text-60 w-40 shrink-0">{b.label}</span>
                    <div className="flex-1 h-1 rounded-full bg-bg-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(b.raw / 5) * 100}%`, background: dimColor(b.raw) }} />
                    </div>
                    <span className="text-xs font-mono text-text-60 w-4 text-right tabular-nums">{b.raw}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '¿Existe el negocio?', value: data.result.filters.business },
                { label: '¿Se vende con pauta?', value: data.result.filters.sellability },
                { label: '¿Vale el esfuerzo?',   value: data.result.filters.worthwhile },
              ].map(f => (
                <div key={f.label} className="rounded-xl border border-border-soft bg-bg-2 p-3 text-center">
                  <div className="font-display text-xl tabular-nums mb-0.5" style={{ color: dimColor((f.value / 100) * 5) }}>
                    {f.value}
                  </div>
                  <div className="text-[10px] text-text-40 leading-tight">{f.label}</div>
                </div>
              ))}
            </div>

            {/* Posicionamiento */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-2">Mejor posicionamiento</div>
              <p className="text-sm text-text-70 leading-relaxed">{data.analysis.positioning}</p>
            </div>

            {/* Ángulos */}
            {data.analysis.angles.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3">Ángulos de venta</div>
                <div className="space-y-2">
                  {data.analysis.angles.map((a, i) => (
                    <div key={i} className="rounded-xl border border-border-soft bg-bg-2 p-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.1em] mb-1.5" style={{ color: '#B8FF5C' }}>
                        {a.trigger}
                      </div>
                      <p className="text-sm font-medium text-text-90 mb-1">"{a.hook}"</p>
                      <p className="text-xs text-text-50 leading-relaxed">{a.angle}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {data.sourceStatuses && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-2">Fuentes de datos</div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Google Trends', info: data.sourceStatuses.trends },
                    { label: 'Mercado Libre', info: data.sourceStatuses.mercadoLibre },
                    { label: 'Precios ML',    info: data.sourceStatuses.prices },
                    { label: 'Google Market', info: data.sourceStatuses.googleMarket },
                    { label: 'Alibaba',       info: data.sourceStatuses.supplier },
                  ].filter(s => s.info).map(s => {
                    const color = STATUS_COLORS[s.info!.status] ?? 'rgba(255,255,255,0.24)';
                    return (
                      <div key={s.label} className="flex items-center gap-2.5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-text-50 w-28 shrink-0">{s.label}</span>
                        <span className="text-text-30 truncate">{s.info?.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
