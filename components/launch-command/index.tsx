'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LaunchCommandData, SectionId, UserEdits, TabStatus } from './types';
import { DEFAULT_USER_EDITS, TAB_ORDER, REQUIRED_TABS } from './types';
import {
  calculateTabCompletion, getLaunchReadiness, getMissingInputs,
  getNextAvailableStep, getBoardCompletion, getFinalLaunchConclusion,
} from './helpers';
import { StatusBadge } from './ui';

import SnapshotTab    from './tabs/Snapshot';
import StrategyTab    from './tabs/Strategy';
import EconomicsTab   from './tabs/Economics';
import PositioningTab from './tabs/Positioning';
import AnglesTab      from './tabs/Angles';
import CreativesTab   from './tabs/Creatives';
import LandingTab     from './tabs/Landing';
import ValidationTab  from './tabs/Validation';
import Plan14DTab     from './tabs/Plan14D';

// ─── Types re-exported for backward compat ─────────────────
export type { LaunchCommandData, SectionId };
export type { LaunchCommandData as LaunchBoardData } from './types';
export type { BattleContext } from './types';

// ─── Section metadata ──────────────────────────────────────

const SECTIONS: { id: SectionId; label: string; short: string }[] = [
  { id: 'snapshot',        label: 'Snapshot',        short: '01' },
  { id: 'estrategia',      label: 'Estrategia',      short: '02' },
  { id: 'economia',        label: 'Economía',        short: '03' },
  { id: 'posicionamiento', label: 'Posicionamiento', short: '04' },
  { id: 'angulos',         label: 'Ángulos',         short: '05' },
  { id: 'creativos',       label: 'Creativos',       short: '06' },
  { id: 'landing',         label: 'Landing',         short: '07' },
  { id: 'validacion',      label: 'Validación',      short: '08' },
  { id: 'plan',            label: 'Plan 14D',        short: '09' },
];

// ─── Helpers ───────────────────────────────────────────────

function getEditsKey(title: string, country: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `etest_board_edits_${country}_${slug}`;
}

function loadEdits(key: string): UserEdits {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...DEFAULT_USER_EDITS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_USER_EDITS };
}

function saveEdits(key: string, edits: UserEdits): void {
  try {
    localStorage.setItem(key, JSON.stringify(edits));
  } catch {}
}

function verdictColor(v: string): string {
  if (v === 'go') return '#4ADE80';
  if (v === 'maybe') return '#FACC15';
  return '#FB923C';
}

function CompletionRing({ pct }: { pct: number }) {
  const c = pct >= 70 ? '#4ADE80' : pct >= 40 ? '#FACC15' : '#F87171';
  return (
    <span className="text-[10px] font-mono tabular-nums" style={{ color: c }}>
      {pct}%
    </span>
  );
}

// ─── Main component ────────────────────────────────────────

interface Props {
  data: LaunchCommandData;
  onBack: () => void;
}

export default function LaunchBoardView({ data, onBack }: Props) {
  const [active, setActive] = useState<SectionId>('snapshot');
  const [edits, setEdits] = useState<UserEdits>({ ...DEFAULT_USER_EDITS });
  const [editsKey, setEditsKey] = useState('');
  const [showMissingStrip, setShowMissingStrip] = useState(true);

  useEffect(() => {
    const key = getEditsKey(data.product.title, data.product.country);
    setEditsKey(key);
    setEdits(loadEdits(key));
  }, [data.product.title, data.product.country]);

  const handleEditsChange = useCallback((next: UserEdits) => {
    setEdits(next);
    if (editsKey) saveEdits(editsKey, next);
  }, [editsKey]);

  const completion = calculateTabCompletion(data, edits);
  const readiness = getLaunchReadiness(data, edits);
  const missing = getMissingInputs(data, edits);
  const overallPct = Math.round(Object.values(completion).reduce((a, b) => a + b, 0) / 9);
  const boardCompletion = getBoardCompletion(data, edits);

  function getTabStatus(id: SectionId): TabStatus {
    return edits.tabDecisions[id]?.status ?? 'pending';
  }

  // Navigate to the next incomplete tab
  function handleGoNext() {
    const next = getNextAvailableStep(edits);
    if (next) setActive(next);
  }

  // Compute next tab label for each tab's checkpoint
  function getNextTabLabel(id: SectionId): string | undefined {
    const idx = TAB_ORDER.indexOf(id);
    if (idx === -1 || idx >= TAB_ORDER.length - 1) return undefined;
    return SECTIONS.find(s => s.id === TAB_ORDER[idx + 1])?.label;
  }

  const tabContent: Record<SectionId, React.ReactNode> = {
    snapshot:        <SnapshotTab    data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    estrategia:      <StrategyTab    data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    economia:        <EconomicsTab   data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    posicionamiento: <PositioningTab data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    angulos:         <AnglesTab      data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    creativos:       <CreativesTab   data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    landing:         <LandingTab     data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    validacion:      <ValidationTab  data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
    plan:            <Plan14DTab     data={data} edits={edits} onEditsChange={handleEditsChange} onGoNext={handleGoNext} />,
  };

  const vc = verdictColor(data.product.verdict);

  // Final conclusion (shown when all required tabs are ready)
  const conclusion = boardCompletion.allRequiredReady ? getFinalLaunchConclusion(data, edits) : null;

  return (
    <div className="animate-fade-up space-y-3">

      {/* ── Back nav ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5 shrink-0"
        >
          ← Battle
        </button>
        <span className="text-text-20 font-mono">·</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: '#B8FF5C' }}>
          Launch Command
        </span>
      </div>

      {/* ── Sticky product context header ─────────────────── */}
      <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-text-100 leading-tight truncate mb-0.5">
              {data.product.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-text-30">
              <span>{data.product.country}</span>
              <span>·</span>
              <span>{data.market.currency}</span>
              <span>·</span>
              <span>vs {data.battle.opponent}</span>
              {edits.lastUpdated !== DEFAULT_USER_EDITS.lastUpdated && (
                <>
                  <span>·</span>
                  <span>Editado {new Date(edits.lastUpdated).toLocaleDateString('es-AR')}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <div className="font-display text-2xl tabular-nums" style={{ color: vc }}>{data.product.score}</div>
              <div className="text-[9px] font-mono text-text-20">score</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl tabular-nums" style={{ color: data.product.marginMultiple >= 3 ? '#4ADE80' : '#FACC15' }}>
                {data.product.marginMultiple}x
              </div>
              <div className="text-[9px] font-mono text-text-20">margen</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl tabular-nums" style={{ color: data.battle.confidence >= 75 ? '#4ADE80' : '#FACC15' }}>
                {data.battle.confidence}%
              </div>
              <div className="text-[9px] font-mono text-text-20">IA conf.</div>
            </div>
            <div className="text-center">
              <CompletionRing pct={overallPct} />
              <div className="text-[9px] font-mono text-text-20">board</div>
            </div>
          </div>
        </div>

        {/* Readiness strip */}
        <div className="mt-3 pt-3 border-t border-border-soft flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: readiness.color }} />
            <span className="text-xs font-mono" style={{ color: readiness.color }}>{readiness.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(['snapshot', 'economia', 'validacion'] as SectionId[]).map(id => {
              const st = getTabStatus(id);
              const pct = completion[id];
              if (st === 'pending' && pct === 0) return null;
              return (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className="text-[9px] font-mono text-text-30 hover:text-text-60 transition-colors"
                >
                  {SECTIONS.find(s => s.id === id)?.short} <StatusBadge status={st} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Missing inputs strip ───────────────────────────── */}
      {showMissingStrip && missing.length > 0 && (
        <div
          className="rounded-xl border px-4 py-2.5 flex items-start justify-between gap-3"
          style={{ borderColor: 'rgba(250,204,21,0.18)', background: 'rgba(250,204,21,0.04)' }}
        >
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] mr-2" style={{ color: '#FACC15' }}>
              Inputs faltantes:
            </span>
            <span className="text-xs text-text-40">
              {missing.slice(0, 3).join(' · ')}
              {missing.length > 3 && ` · +${missing.length - 3} más`}
            </span>
          </div>
          <button
            onClick={() => setShowMissingStrip(false)}
            className="text-text-20 hover:text-text-40 transition-colors shrink-0 font-mono text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Tab navigation ────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl border border-border-soft bg-bg-2 overflow-x-auto">
        {SECTIONS.map(s => {
          const isActive = active === s.id;
          const status = getTabStatus(s.id);
          const pct = completion[s.id];
          const isNextStep = !boardCompletion.allRequiredReady &&
            getNextAvailableStep(edits) === s.id &&
            s.id !== 'snapshot'; // don't highlight snapshot as "next" on fresh board
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="flex flex-col items-center flex-1 px-2 py-2.5 rounded-lg text-center transition-all min-w-fit relative"
              style={{
                background: isActive ? 'rgba(255,255,255,0.07)' : isNextStep ? 'rgba(184,255,92,0.04)' : 'transparent',
                borderBottom: isActive ? '2px solid rgba(184,255,92,0.55)' : isNextStep ? '2px solid rgba(184,255,92,0.2)' : '2px solid transparent',
              }}
            >
              <span className="text-[9px] font-mono" style={{ color: isActive ? 'rgba(184,255,92,0.6)' : 'rgba(255,255,255,0.2)' }}>
                {s.short}
              </span>
              <span className="text-[11px] font-mono" style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)' }}>
                {s.label}
              </span>
              {/* Status dot */}
              {pct > 0 && (
                <div
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{
                    background: status === 'ready' ? '#4ADE80' : status === 'in-progress' ? '#60A5FA' : status === 'blocked' ? '#FACC15' : '#60A5FA',
                    opacity: 0.8,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────── */}
      <div key={active} className="animate-fade-up">
        {tabContent[active]}
      </div>

      {/* ── Final conclusion panel ────────────────────────── */}
      {conclusion && (
        <div
          className="rounded-xl border px-5 py-5 space-y-4"
          style={{ borderColor: `${conclusion.statusColor}30`, background: `${conclusion.statusColor}06` }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">
                Conclusión del board — {boardCompletion.requiredReady}/{boardCompletion.requiredTotal} pasos requeridos completados
              </div>
              <div className="font-display text-xl" style={{ color: conclusion.statusColor }}>
                {conclusion.statusLabel}
              </div>
            </div>
            <div
              className="shrink-0 text-[10px] font-mono uppercase tracking-[0.1em] px-3 py-1 rounded-full"
              style={{ color: conclusion.statusColor, background: `${conclusion.statusColor}15` }}
            >
              Board {boardCompletion.pct}% listo
            </div>
          </div>

          {/* Strengths + Risks */}
          <div className="grid sm:grid-cols-2 gap-3">
            {conclusion.strengths.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] font-mono mb-2" style={{ color: '#4ADE80' }}>
                  Validado
                </div>
                <ul className="space-y-1.5">
                  {conclusion.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-60">
                      <span className="shrink-0 mt-0.5" style={{ color: '#4ADE80' }}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {conclusion.risks.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] font-mono mb-2" style={{ color: '#FACC15' }}>
                  Riesgos activos
                </div>
                <ul className="space-y-1.5">
                  {conclusion.risks.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: '#FACC15' }}>
                      <span className="shrink-0 mt-0.5">!</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Still needed */}
          {conclusion.stillNeeded.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-2">Aún pendiente</div>
              <div className="flex flex-wrap gap-1.5">
                {conclusion.stillNeeded.map((item, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border-soft text-text-40">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Next move */}
          <div
            className="rounded-lg border px-4 py-3"
            style={{ borderColor: `${conclusion.statusColor}25`, background: `${conclusion.statusColor}08` }}
          >
            <div className="text-[10px] uppercase tracking-[0.1em] font-mono mb-1" style={{ color: conclusion.statusColor }}>
              Próximo movimiento concreto
            </div>
            <p className="text-sm leading-relaxed" style={{ color: conclusion.statusColor }}>
              {conclusion.nextMove}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
