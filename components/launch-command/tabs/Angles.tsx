'use client';

import { useState } from 'react';
import { Card, SectionHeader, ConfidenceBadge, RiskBadge, CopyButton, DecisionCheckpoint } from '../ui';
import { canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

type FilterType = 'all' | 'high' | 'medium' | 'low';
type AngleCategory = 'pain' | 'desire' | 'comparison' | 'convenience' | 'identity' | 'proof';

const ANGLE_MAP: { id: AngleCategory; label: string; desc: string }[] = [
  { id: 'pain',        label: 'Pain-based',       desc: 'Ataca un problema o frustración activa' },
  { id: 'desire',      label: 'Desire-based',      desc: 'Activa el deseo o ambición del cliente' },
  { id: 'comparison',  label: 'Comparison-based',  desc: 'Compara con alternativas inferiores' },
  { id: 'convenience', label: 'Convenience-based', desc: 'Resuelve con menor esfuerzo o tiempo' },
  { id: 'identity',    label: 'Identity-based',    desc: 'Apela a quién es o quiere ser el cliente' },
  { id: 'proof',       label: 'Proof-based',       desc: 'La validación social o resultados demostrados' },
];

function categorizeAngle(emotion: string): AngleCategory {
  const e = emotion.toLowerCase();
  if (e.includes('frustrac') || e.includes('dolor') || e.includes('problema') || e.includes('molest')) return 'pain';
  if (e.includes('deseo') || e.includes('quero') || e.includes('ambic') || e.includes('lograr')) return 'desire';
  if (e.includes('compara') || e.includes('alternativ') || e.includes('mejor que')) return 'comparison';
  if (e.includes('convenien') || e.includes('rápid') || e.includes('fácil') || e.includes('practic')) return 'convenience';
  if (e.includes('identid') || e.includes('soy') || e.includes('estilo') || e.includes('pertenen')) return 'identity';
  return 'proof';
}

export default function AnglesTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const angles = data.creativeAngles;
  const decision = edits.tabDecisions.angulos ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('angulos', data, edits);
  const selected = edits.selectedAngles;

  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([angles[0]?.id ?? '']));
  const [activeMap, setActiveMap] = useState<AngleCategory | null>(null);

  function toggleSelected(id: string) {
    const next = selected.includes(id)
      ? selected.filter(s => s !== id)
      : selected.length < 3
        ? [...selected, id]
        : selected;
    onEditsChange({ ...edits, selectedAngles: next, lastUpdated: new Date().toISOString() });
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, angulos: d }, lastUpdated: new Date().toISOString() });
  }

  const filtered = angles.filter(a => filter === 'all' || a.confidence === filter);
  const priorities = ['high', 'medium', 'low'];
  const sorted = [...filtered].sort((a, b) => priorities.indexOf(a.confidence) - priorities.indexOf(b.confidence));

  const confColor = (c: string) => c === 'high' ? '#4ADE80' : c === 'medium' ? '#FACC15' : '#F87171';

  const hooksBatch = angles
    .filter(a => selected.includes(a.id))
    .map(a => `${a.name}: "${a.hook}"`)
    .join('\n');

  return (
    <div className="space-y-4">
      <SectionHeader
        number="05"
        title="Ángulos Creativos"
        sub="Hipótesis de comunicación a testear. Seleccioná los 3 mejores para el primer batch creativo."
      />

      {/* Angle map */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Mapa de ángulos</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ANGLE_MAP.map(cat => {
            const count = angles.filter(a => categorizeAngle(a.emotion) === cat.id).length;
            const isActive = activeMap === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveMap(isActive ? null : cat.id)}
                className="rounded-lg border px-3 py-2 text-left transition-all"
                style={{
                  borderColor: isActive ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.06)',
                  background: isActive ? 'rgba(184,255,92,0.04)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-text-80">{cat.label}</span>
                  {count > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C' }}>
                      {count}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-text-30 leading-relaxed">{cat.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-40">
            Seleccionados: <span className="font-mono" style={{ color: selected.length === 3 ? '#4ADE80' : 'rgba(255,255,255,0.56)' }}>{selected.length}/3</span>
          </span>
          {selected.length > 0 && <CopyButton text={hooksBatch} label="Copiar hooks seleccionados" />}
        </div>
        <div className="flex gap-1">
          {(['all', 'high', 'medium', 'low'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border transition-all"
              style={{
                borderColor: filter === f ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                color: filter === f ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
                background: filter === f ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
            >
              {f === 'all' ? 'Todos' : f === 'high' ? 'Alta' : f === 'medium' ? 'Media' : 'Baja'}
            </button>
          ))}
        </div>
      </div>

      {/* Angle list */}
      <div className="space-y-2">
        {sorted.map((a, idx) => {
          const isOpen = expanded.has(a.id);
          const isSel = selected.includes(a.id);
          const cat = ANGLE_MAP.find(c => c.id === categorizeAngle(a.emotion));
          const selRank = selected.indexOf(a.id) + 1;
          return (
            <div
              key={a.id}
              className="rounded-xl border overflow-hidden transition-all"
              style={{
                borderColor: isSel ? 'rgba(184,255,92,0.3)' : 'rgba(255,255,255,0.06)',
                background: isSel ? 'rgba(184,255,92,0.03)' : '#16161A',
              }}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Select button */}
                <button
                  onClick={() => toggleSelected(a.id)}
                  disabled={!isSel && selected.length >= 3}
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all disabled:opacity-30"
                  style={{
                    borderColor: isSel ? '#B8FF5C' : 'rgba(255,255,255,0.2)',
                    background: isSel ? 'rgba(184,255,92,0.15)' : 'transparent',
                  }}
                >
                  {isSel && <span className="text-[9px] font-mono" style={{ color: '#B8FF5C' }}>{selRank}</span>}
                </button>

                {/* Content */}
                <button
                  onClick={() => toggleExpanded(a.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <ConfidenceBadge value={a.confidence} />
                    <span className="text-[10px] font-mono text-text-40">{cat?.label ?? a.emotion}</span>
                    <span className="text-[10px] font-mono text-text-20 ml-auto">#{idx + 1}</span>
                  </div>
                  <p className="text-sm font-medium text-text-90 leading-snug">"{a.hook}"</p>
                  <p className="text-[10px] text-text-40 mt-0.5">{a.name}</p>
                </button>

                <button
                  onClick={() => toggleExpanded(a.id)}
                  className="text-text-30 font-mono text-xs shrink-0 pt-1"
                >
                  {isOpen ? '↑' : '↓'}
                </button>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border-soft pt-3 space-y-0 bg-bg-1/40">
                  <div className="grid sm:grid-cols-2 gap-0">
                    <div className="py-2 border-b border-border-soft last:border-0">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Trigger emocional</div>
                      <p className="text-sm text-text-70">{a.emotion}</p>
                    </div>
                    <div className="py-2 border-b border-border-soft last:border-0">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Dirección visual</div>
                      <p className="text-sm text-text-70">{a.visualDirection}</p>
                    </div>
                    <div className="py-2 border-b border-border-soft last:border-0">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Objeción atacada</div>
                      <p className="text-sm text-text-70">{a.objectionAttacked}</p>
                    </div>
                    <div className="py-2 border-b border-border-soft last:border-0">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Hipótesis</div>
                      <p className="text-sm text-text-70">{a.hypothesis}</p>
                    </div>
                  </div>
                  <div className="py-2 flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Riesgo del ángulo</div>
                      <p className="text-sm" style={{ color: '#F87171' }}>{a.risk}</p>
                    </div>
                    <CopyButton text={`Hook: "${a.hook}"\nEmoción: ${a.emotion}\nDirección: ${a.visualDirection}`} />
                  </div>
                  <div className="pt-2 border-t border-border-soft">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1.5">Señal de éxito</div>
                    <p className="text-xs text-text-50">CTR {'>'} 1.8%, CPC dentro del CAC máximo, comentarios orgánicos positivos, ROAS {'>'} 1.5x en los primeros 3 días.</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hook variations */}
      {data.creativeTestingPlan.hookVariations.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Variaciones de hook</div>
            <CopyButton text={data.creativeTestingPlan.hookVariations.join('\n')} label="Copiar todos" />
          </div>
          <div className="space-y-2">
            {data.creativeTestingPlan.hookVariations.filter(Boolean).map((h, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border-soft last:border-0">
                <span className="text-[10px] font-mono text-text-20 shrink-0 mt-0.5 w-4">{i + 1}</span>
                <p className="flex-1 text-sm text-text-60">"{h}"</p>
                <CopyButton text={h} label="↗" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <DecisionCheckpoint
        tabId="angulos"
        status={decision.status}
        note={decision.note}
        nextAction={
          selected.length < 3
            ? `Seleccioná ${3 - selected.length} ángulo${3 - selected.length !== 1 ? 's' : ''} más para el primer batch`
            : 'Ir a Creativos → generar briefs para los 3 ángulos seleccionados'
        }
        nextTabLabel="Creativos"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
