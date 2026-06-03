'use client';

import type { BattleResult } from '@/lib/gemini';
import type { HistoryItem } from '@/lib/history';
import { itemScore } from '@/lib/history';

interface Props {
  itemA: HistoryItem;
  itemB: HistoryItem;
  result: BattleResult | null;
  loading: boolean;
  battleError?: string | null;
  onBack: () => void;
  onNewBattle?: () => void;
  onShowRanking?: () => void;
  onOpenLaunchCommand?: () => void;
}

const VERDICT_COLORS: Record<string, string> = {
  go: '#4ADE80',
  maybe: '#FACC15',
  kill: '#F87171',
};

function ProductCard({
  label,
  title,
  score,
  verdict,
  margin,
  demand,
  isWinner,
  someWinnerKnown,
}: {
  label: string;
  title: string;
  score: number;
  verdict: string;
  margin?: number;
  demand?: number | null;
  isWinner?: boolean;
  someWinnerKnown?: boolean;
}) {
  const color = VERDICT_COLORS[verdict] ?? '#FACC15';
  const isLoser = someWinnerKnown && !isWinner;

  return (
    <div
      className="rounded-2xl border p-3 sm:p-4 flex flex-col gap-2 transition-all min-w-0"
      style={{
        borderColor: isWinner ? `${color}60` : isLoser ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)',
        background: isWinner ? `${color}10` : isLoser ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
        opacity: isLoser ? 0.6 : 1,
        boxShadow: isWinner ? `0 0 40px ${color}20, 0 0 80px ${color}0a` : 'none',
        transition: 'all 0.4s ease',
      }}
    >
      {isWinner && (
        <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color }}>
          ★ Ganador
        </div>
      )}
      {isLoser && someWinnerKnown && (
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-text-30">
          Perdedor
        </div>
      )}
      {!someWinnerKnown && (
        <div className="text-[9px] font-mono text-text-40 uppercase tracking-[0.12em]">Prod. {label}</div>
      )}
      <div className="text-xs text-text-80 font-medium leading-snug line-clamp-3 min-h-[2.5rem]">
        {title}
      </div>
      <div
        className="font-display text-3xl sm:text-4xl tabular-nums leading-none"
        style={{ color: isLoser ? 'rgba(255,255,255,0.36)' : color }}
      >
        {score}
      </div>
      <div className="text-[9px] font-mono text-text-30">/100</div>
      <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-border-soft">
        {margin != null && (
          <div className="flex justify-between text-[10px]">
            <span className="text-text-40">Margen</span>
            <span className="font-mono text-text-60">{margin}x</span>
          </div>
        )}
        {demand != null && (
          <div className="flex justify-between text-[10px]">
            <span className="text-text-40">Demanda</span>
            <span className="font-mono text-text-60">{demand}/100</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBadge({
  label,
  winner,
  aColor,
  bColor,
}: {
  label: string;
  winner: 'A' | 'B' | 'tie';
  aColor: string;
  bColor: string;
}) {
  const wColor = winner === 'A' ? aColor : winner === 'B' ? bColor : '#FACC15';
  const wLabel = winner === 'tie' ? 'Empate' : `Prod. ${winner}`;
  return (
    <div className="rounded-xl border border-border-soft bg-bg-2 p-3 text-center">
      <div className="text-[9px] font-mono text-text-30 uppercase tracking-[0.1em] mb-1.5 leading-tight">
        {label}
      </div>
      <div className="text-xs font-mono font-medium" style={{ color: wColor }}>{wLabel}</div>
    </div>
  );
}

function DimBar({ label, aScore, bScore, winner }: {
  label: string;
  aScore: number;
  bScore: number;
  winner: 'A' | 'B' | 'tie';
}) {
  const aColor = winner === 'A' ? '#B8FF5C' : winner === 'tie' ? '#FACC15' : 'rgba(255,255,255,0.22)';
  const bColor = winner === 'B' ? '#B8FF5C' : winner === 'tie' ? '#FACC15' : 'rgba(255,255,255,0.22)';
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center py-2 border-b border-border-soft last:border-0">
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px] font-mono tabular-nums" style={{ color: aColor }}>{aScore}</span>
        <div className="w-12 sm:w-14 h-1.5 rounded-full bg-bg-3 overflow-hidden">
          <div className="h-full rounded-full ml-auto" style={{ width: `${(aScore / 5) * 100}%`, background: aColor }} />
        </div>
      </div>
      <div className="text-[9px] sm:text-[10px] text-text-40 text-center whitespace-nowrap px-1 min-w-[70px] sm:min-w-[80px]">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-12 sm:w-14 h-1.5 rounded-full bg-bg-3 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(bScore / 5) * 100}%`, background: bColor }} />
        </div>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: bColor }}>{bScore}</span>
      </div>
    </div>
  );
}

function StrengthBox({ title, strengths, weaknesses, color, label }: {
  title: string;
  strengths: string[];
  weaknesses: string[];
  color: string;
  label: string;
}) {
  if (strengths.length === 0 && weaknesses.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1" style={{ color }}>{title}</div>
      <div className="text-xs text-text-30 mb-3 truncate">{label}</div>
      {strengths.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {strengths.map((s, i) => (
            <li key={i} className="text-xs text-text-80 flex gap-1.5">
              <span className="text-score-green shrink-0">+</span> {s}
            </li>
          ))}
        </ul>
      )}
      {weaknesses.length > 0 && (
        <ul className="space-y-1">
          {weaknesses.map((w, i) => (
            <li key={i} className="text-xs text-text-60 flex gap-1.5">
              <span className="text-score-red shrink-0">−</span> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BattleView({ itemA, itemB, result, loading, battleError, onBack, onNewBattle, onShowRanking, onOpenLaunchCommand }: Props) {
  const aScore = itemScore(itemA);
  const bScore = itemScore(itemB);
  const aVerdict = itemA.data?.result?.verdict ?? 'kill';
  const bVerdict = itemB.data?.result?.verdict ?? 'kill';
  const aTitle = itemA.data?.product?.title ?? 'Producto A';
  const bTitle = itemB.data?.product?.title ?? 'Producto B';
  const aColor = VERDICT_COLORS[aVerdict] ?? '#FACC15';
  const bColor = VERDICT_COLORS[bVerdict] ?? '#FACC15';
  const aMargin = itemA.data?.margin?.multiple;
  const bMargin = itemB.data?.margin?.multiple;
  const aDemand = itemA.data?.signals?.trendsInterest ?? null;
  const bDemand = itemB.data?.signals?.trendsInterest ?? null;

  const winner = result?.winner;
  const someWinnerKnown = !loading && winner !== undefined && winner !== 'tie';
  const winnerColor = winner === 'A' ? aColor : winner === 'B' ? bColor : '#FACC15';
  const winnerTitle = winner === 'A' ? aTitle : winner === 'B' ? bTitle : null;
  const loserTitle = winner === 'A' ? bTitle : winner === 'B' ? aTitle : null;

  return (
    <div className="animate-fade-up space-y-4 sm:space-y-5">
      {/* Back */}
      <button
        onClick={onBack}
        className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5"
      >
        ← Volver
      </button>

      {/* Header */}
      <div className="text-center pb-1">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-mono uppercase tracking-[0.14em] mb-3"
          style={{ background: 'rgba(184,255,92,0.1)', color: '#B8FF5C', border: '1px solid rgba(184,255,92,0.2)' }}
        >
          ⚔ Modo Batalla
        </div>
        <p className="text-sm text-text-40">
          Compará cuál tiene más chances reales antes de invertir.
        </p>
      </div>

      {/* Products side by side */}
      <div className="grid grid-cols-[1fr_48px_1fr] sm:grid-cols-[1fr_64px_1fr] gap-2 sm:gap-3 items-start">
        <ProductCard
          label="A"
          title={aTitle}
          score={aScore}
          verdict={aVerdict}
          margin={aMargin}
          demand={aDemand}
          isWinner={winner === 'A'}
          someWinnerKnown={someWinnerKnown}
        />

        {/* VS divider */}
        <div className="self-center flex flex-col items-center gap-2 py-2">
          <div className="w-px flex-1 min-h-[24px]" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12))' }} />
          <div
            className="font-display text-xl sm:text-3xl leading-none"
            style={{ color: someWinnerKnown ? winnerColor : 'rgba(255,255,255,0.28)' }}
          >
            VS
          </div>
          <div className="w-px flex-1 min-h-[24px]" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)' }} />
        </div>

        <ProductCard
          label="B"
          title={bTitle}
          score={bScore}
          verdict={bVerdict}
          margin={bMargin}
          demand={bDemand}
          isWinner={winner === 'B'}
          someWinnerKnown={someWinnerKnown}
        />
      </div>

      {/* Error state */}
      {battleError && !loading && (
        <div
          className="rounded-2xl border p-5 space-y-3 text-center"
          style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}
        >
          <div className="text-sm text-text-80">{battleError}</div>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl text-sm border border-border-mid bg-bg-2 text-text-80 hover:text-text-100 transition-colors"
            >
              ← Volver al War Room
            </button>
            {onNewBattle && (
              <button
                onClick={onNewBattle}
                className="px-4 py-2 rounded-xl text-sm border transition-colors"
                style={{ borderColor: 'rgba(184,255,92,0.3)', color: '#B8FF5C', background: 'rgba(184,255,92,0.06)' }}
              >
                Nueva batalla
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6 text-center space-y-3">
          <div className="text-sm text-text-60 animate-pulse">IA analizando cuál vale más la pena…</div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent opacity-60"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1 pt-3 border-t border-border-soft text-center">
            {[
              { label: 'Score', a: String(aScore), b: String(bScore) },
              { label: 'Margen', a: aMargin ? `${aMargin}x` : 'N/D', b: bMargin ? `${bMargin}x` : 'N/D' },
              { label: 'Demanda', a: aDemand != null ? `${aDemand}/100` : 'N/D', b: bDemand != null ? `${bDemand}/100` : 'N/D' },
            ].map(({ label, a, b }) => (
              <div key={label}>
                <div className="text-[9px] font-mono text-text-30 uppercase tracking-[0.1em] mb-1">{label}</div>
                <div className="flex justify-center items-center gap-1.5">
                  <span className="text-xs font-mono" style={{ color: aColor }}>{a}</span>
                  <span className="text-text-20 text-[9px]">·</span>
                  <span className="text-xs font-mono" style={{ color: bColor }}>{b}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <>
          {/* Test mode banner */}
          {result.testMode && (
            <div
              className="rounded-xl border px-4 py-3 flex items-start gap-3"
              style={{ borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.06)' }}
            >
              <div className="shrink-0 mt-0.5">
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.12em] rounded-full px-2 py-0.5"
                  style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24' }}
                >
                  Modo test · sin IA
                </span>
              </div>
              <p className="text-xs text-text-40 leading-relaxed">
                {result.fallbackReason ?? 'IA no disponible'}. Resultado generado solo para probar el flujo. No usar como decisión real de inversión.
              </p>
            </div>
          )}

          {/* Winner announcement */}
          {winner !== 'tie' ? (
            <div
              className="rounded-2xl border p-6 sm:p-10 text-center"
              style={{
                borderColor: `${winnerColor}50`,
                background: `${winnerColor}0a`,
                boxShadow: `0 0 80px ${winnerColor}18, 0 0 160px ${winnerColor}08`,
              }}
            >
              <div
                className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3 opacity-70"
                style={{ color: winnerColor }}
              >
                El ganador es
              </div>
              <div
                className="font-display text-6xl sm:text-8xl leading-none mb-4"
                style={{ color: winnerColor }}
              >
                Producto {winner}
              </div>
              <h2 className="font-display text-lg sm:text-2xl text-text-100 leading-snug max-w-sm mx-auto mb-4">
                {winnerTitle}
              </h2>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono"
                style={{ background: `${winnerColor}18`, color: winnerColor }}
              >
                Confianza IA: {result.winnerConfidence}%
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-score-yellow/30 bg-score-yellow/08 p-6 text-center">
              <div className="font-display text-5xl text-score-yellow mb-2">Empate</div>
              <p className="text-sm text-text-60">Scores muy similares — decidí por margen o menor riesgo logístico.</p>
            </div>
          )}

          {/* Launch Command CTA inline with winner announcement */}
          {winner !== 'tie' && onOpenLaunchCommand && (
            <button
              onClick={onOpenLaunchCommand}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: '#B8FF5C', color: '#0A0A0B' }}
            >
              ✦ Crear Launch Command para el ganador
            </button>
          )}

          {/* Category winners */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CategoryBadge label="General" winner={winner ?? 'tie'} aColor={aColor} bColor={bColor} />
            <CategoryBadge label="Por pauta" winner={result.winnerByAds} aColor={aColor} bColor={bColor} />
            <CategoryBadge label="Por saturación" winner={result.winnerBySaturation} aColor={aColor} bColor={bColor} />
            <CategoryBadge label="Largo plazo" winner={result.winnerLongTerm} aColor={aColor} bColor={bColor} />
          </div>

          {/* Por qué gana */}
          {result.summary && (
            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{ borderColor: `${winnerColor}22`, background: `${winnerColor}06` }}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-2" style={{ color: winnerColor }}>
                Por qué gana
              </div>
              <p className="text-sm text-text-80 leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Diferencia clave */}
          {result.keyDifference && (
            <div className="rounded-xl border border-border-soft px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[10px] font-mono text-text-40 uppercase tracking-[0.12em]">Diferencia clave · </span>
              <span className="text-sm text-text-80">{result.keyDifference}</span>
            </div>
          )}

          {/* Riesgos del perdedor */}
          {(result.loserRisks?.length ?? 0) > 0 && loserTitle && (
            <div className="rounded-xl border border-score-red/20 p-4" style={{ background: 'rgba(248,113,113,0.05)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-score-red mb-1">
                Riesgos del perdedor
              </div>
              <div className="text-xs text-text-30 mb-2.5 truncate">{loserTitle}</div>
              <ul className="space-y-1.5">
                {result.loserRisks.map((r, i) => (
                  <li key={i} className="text-sm text-text-80 flex gap-2">
                    <span className="text-score-red shrink-0">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qué haría un ecommerce inteligente */}
          {result.smartMove && (
            <div
              className="rounded-xl border border-accent/20 p-4"
              style={{ background: 'rgba(184,255,92,0.04)' }}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-accent mb-2">
                Qué haría un ecommerce inteligente
              </div>
              <p className="text-sm text-text-80 leading-relaxed">{result.smartMove}</p>
            </div>
          )}

          {/* Recomendación final */}
          {result.recommendation && (
            <div className="rounded-xl border border-border-soft px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-1.5">
                Recomendación final
              </div>
              <p className="text-sm text-text-80 leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {/* Dimension bars */}
          {result.dimensionWins.length > 0 && (
            <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-4 sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-3 text-center">
                Dimensión por dimensión
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-1 mb-1.5">
                <div className="text-[10px] font-mono text-text-40 text-right">A</div>
                <div className="min-w-[70px] sm:min-w-[80px]" />
                <div className="text-[10px] font-mono text-text-40">B</div>
              </div>
              {result.dimensionWins.map(d => (
                <DimBar key={d.dim} label={d.label} aScore={d.aScore} bScore={d.bScore} winner={d.winner} />
              ))}
            </div>
          )}

          {/* Strengths + Weaknesses */}
          {(result.aStrengths.length > 0 || result.bStrengths.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              <StrengthBox
                title="Producto A"
                strengths={result.aStrengths}
                weaknesses={result.aWeaknesses}
                color={winner === 'A' ? aColor : 'rgba(255,255,255,0.28)'}
                label={aTitle}
              />
              <StrengthBox
                title="Producto B"
                strengths={result.bStrengths}
                weaknesses={result.bWeaknesses}
                color={winner === 'B' ? bColor : 'rgba(255,255,255,0.28)'}
                label={bTitle}
              />
            </div>
          )}

          {/* Action bar */}
          <div className="flex gap-2 flex-wrap">
            {onShowRanking && (
              <button
                onClick={onShowRanking}
                className="flex-1 py-3 rounded-xl text-sm border transition-all hover:opacity-90"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}
              >
                Ver Ranking
              </button>
            )}
            {onNewBattle && (
              <button
                onClick={onNewBattle}
                className="flex-1 py-3 rounded-xl text-sm border border-border-mid bg-bg-2 text-text-60 hover:text-text-100 transition-colors"
              >
                Nueva batalla
              </button>
            )}
            <button
              onClick={onBack}
              className="px-4 py-3 rounded-xl text-sm text-text-40 hover:text-text-80 transition-colors"
            >
              ← Volver
            </button>
          </div>
        </>
      )}
    </div>
  );
}
