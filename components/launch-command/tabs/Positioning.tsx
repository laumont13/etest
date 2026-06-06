'use client';

import { useState } from 'react';
import { Card, SectionHeader, InfoRow, BulletList, CopyButton, DecisionCheckpoint, EditableTextarea } from '../ui';
import { canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

const POSITIONING_ROUTES = [
  {
    name: 'Problema directo',
    promise: 'Resuelve [problema] mejor que cualquier alternativa',
    customer: 'Compradores con dolor activo y urgencia',
    proofNeeded: 'Demo real, testimonio, comparativa',
    risk: 'Requiere que el problema sea reconocido',
    pricePx: 'Precio de valor (no el más barato)',
  },
  {
    name: 'Conveniencia / Practicidad',
    promise: 'El resultado más rápido con menos esfuerzo',
    customer: 'Personas ocupadas que buscan eficiencia',
    proofNeeded: 'Demostración de velocidad o simplicidad',
    risk: 'Baja diferenciación si hay muchos similares',
    pricePx: 'Precio premium justificado por ahorro de tiempo',
  },
  {
    name: 'Calidad percibida',
    promise: 'El producto que realmente funciona a largo plazo',
    customer: 'Compradores que ya probaron versiones baratas',
    proofNeeded: 'Test de durabilidad, materiales, garantía',
    risk: 'Alto CAC de adquisición, prueba social lenta',
    pricePx: 'Precio alto justificado por calidad',
  },
  {
    name: 'Identidad / Estilo de vida',
    promise: 'Para gente que se toma en serio [estilo/hábito/identidad]',
    customer: 'Compradores con identidad fuerte en la categoría',
    proofNeeded: 'Comunidad, UGC auténtico, influencers creíbles',
    risk: 'Más difícil de testear con pauta fría',
    pricePx: 'Premium o aspiracional',
  },
];

const TONE_AXES = [
  { left: 'Premium', right: 'Accesible' },
  { left: 'Clínico / técnico', right: 'Lifestyle / emocional' },
  { left: 'Directo / urgente', right: 'Suave / educativo' },
  { left: 'Minimalista', right: 'Bold / llamativo' },
];

export default function PositioningTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const pos = data.positioning;
  const decision = edits.tabDecisions.posicionamiento ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('posicionamiento', data, edits);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [toneValues, setToneValues] = useState<number[]>([3, 3, 3, 3]);

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, posicionamiento: d }, lastUpdated: new Date().toISOString() });
  }

  function setPositioningNote(v: string) {
    onEditsChange({ ...edits, chosenPositioningNote: v, lastUpdated: new Date().toISOString() });
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        number="04"
        title="Posicionamiento"
        sub="Hacé el producto más fácil de vender y más difícil de comparar. Elegí una sola ruta y ejecutala."
      />

      {/* One-liner hero */}
      {pos.oneLiner && (
        <div className="rounded-xl border border-border-soft bg-bg-2 px-5 py-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">One-liner de posicionamiento</div>
          <p className="font-display text-xl text-text-100 leading-snug mb-3">"{pos.oneLiner}"</p>
          <CopyButton text={pos.oneLiner} label="Copiar one-liner" />
        </div>
      )}

      {/* Personas + JTBD */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Audiencias</div>
          <InfoRow label="Persona primaria" value={pos.primaryAudience} />
          <InfoRow label="Persona secundaria" value={pos.secondaryAudience} />
          <InfoRow label="Marco de categoría" value={pos.categoryFraming} />
          <InfoRow label="Promesa principal" value={pos.mainPromise} />
        </Card>
        <Card>
          <BulletList label="Casos de uso" items={pos.useCases} />
          <div className="pt-2">
            <BulletList label="Objeciones a superar" items={pos.objectionsToOvercome} />
          </div>
        </Card>
      </div>

      {/* Positioning routes */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Rutas de posicionamiento — elegí una</div>
        <div className="space-y-2">
          {POSITIONING_ROUTES.map((route, i) => {
            const isSelected = selectedRoute === i;
            return (
              <div
                key={route.name}
                className="rounded-xl border overflow-hidden cursor-pointer transition-all"
                style={{
                  borderColor: isSelected ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.06)',
                  background: isSelected ? 'rgba(184,255,92,0.04)' : '#16161A',
                }}
                onClick={() => setSelectedRoute(isSelected ? null : i)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: isSelected ? '#B8FF5C' : 'rgba(255,255,255,0.2)' }}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: '#B8FF5C' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-text-90">{route.name}</span>
                    </div>
                    <p className="text-xs text-text-40 truncate">{route.promise}</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="px-4 pb-4 border-t border-border-soft pt-3 grid sm:grid-cols-2 gap-0">
                    <InfoRow label="Cliente" value={route.customer} />
                    <InfoRow label="Prueba necesaria" value={route.proofNeeded} />
                    <InfoRow label="Riesgo" value={route.risk} danger />
                    <InfoRow label="Percepción de precio" value={route.pricePx} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Claim safety */}
      {pos.dangerousPromises.length > 0 && (
        <Card>
          <BulletList
            label="Promesas peligrosas — no usar sin muestra confirmada"
            items={pos.dangerousPromises}
            danger
          />
        </Card>
      )}

      {/* Objection map */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Mapa de objeciones</div>
        <div className="space-y-2">
          {pos.objectionsToOvercome.slice(0, 4).map((obj, i) => (
            <div key={i} className="rounded-lg border border-border-soft bg-bg-3/30 px-3 py-2.5 grid sm:grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] font-mono text-text-20 mb-0.5">Objeción</div>
                <p className="text-xs text-text-60">{obj}</p>
              </div>
              <div>
                <div className="text-[9px] font-mono text-text-20 mb-0.5">Respuesta sugerida</div>
                <p className="text-xs text-text-40">Definir con prueba real o testimonio</p>
              </div>
              <div>
                <div className="text-[9px] font-mono text-text-20 mb-0.5">Sección en landing</div>
                <p className="text-xs text-text-40">{i === 0 ? 'Hero / Above the fold' : i === 1 ? 'Sección de beneficios' : 'FAQ'}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Brand tone */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-4">Tono de marca — posicioná los sliders</div>
        <div className="space-y-4">
          {TONE_AXES.map((axis, i) => (
            <div key={axis.left}>
              <div className="flex items-center justify-between text-[10px] font-mono text-text-40 mb-1.5">
                <span>{axis.left}</span>
                <span>{axis.right}</span>
              </div>
              <input
                type="range" min={1} max={5} step={1}
                value={toneValues[i]}
                onChange={e => {
                  const next = [...toneValues];
                  next[i] = parseInt(e.target.value);
                  setToneValues(next);
                }}
                className="w-full accent-accent h-1"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* User decision note */}
      <Card>
        <EditableTextarea
          label="Ruta de posicionamiento elegida y por qué"
          value={edits.chosenPositioningNote}
          onChange={setPositioningNote}
          placeholder="Ej: Elegí 'Problema directo' porque la audiencia ya busca activamente la solución. El hook más fuerte apunta al dolor, no al producto."
          rows={3}
        />
      </Card>

      <DecisionCheckpoint
        tabId="posicionamiento"
        status={decision.status}
        note={decision.note}
        nextAction="Ir a Ángulos → construir hipótesis creativas basadas en la ruta elegida"
        nextTabLabel="Ángulos"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
