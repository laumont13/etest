'use client';

import { useMemo } from 'react';
import { Card, SectionHeader, DecisionCheckpoint } from '../ui';
import { calculateTabCompletion, getMissingInputs, canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

type PlanQuality = 'orientation' | 'preliminary' | 'execution';

const CRITICAL_PATH = [
  'Confirmar proveedor + MOQ antes de cualquier otro gasto',
  'Calcular economía con números reales (no estimados del proveedor)',
  'Preparar landing antes de lanzar pauta — nunca al revés',
  'Testear con presupuesto mínimo antes de comprometer stock',
  'Muestra física antes de pedir stock completo',
];

const DO_NOT_WASTE_TIME = [
  'Diseñar logo o branding antes de tener ventas',
  'Construir tienda compleja antes de validar la demanda',
  'Producir videos elaborados antes de tener ángulo ganador',
  'Hablar con muchos proveedores en paralelo antes de definir el producto',
  'Optimizar SEO antes de tener tracción orgánica',
  'Investigar estrategias de escala antes de tener el CAC bajo control',
];

const DECISION_AT_14 = [
  { id: 'import', label: 'Importar', desc: 'CAC dentro del rango, ROAS > objetivo, muestra aprobada', color: '#4ADE80' },
  { id: 'retest', label: 'Retestear', desc: 'Señal débil pero no negativa — cambiar ángulo o landing', color: '#FACC15' },
  { id: 'change-angle', label: 'Cambiar ángulo', desc: 'El ángulo no resonó pero el producto tiene potencial', color: '#60A5FA' },
  { id: 'negotiate', label: 'Negociar proveedor', desc: 'El CAC es viable pero el costo necesita bajar para escalar', color: '#FB923C' },
  { id: 'kill', label: 'Archivar', desc: 'Ninguna señal positiva — el mercado no quiere esto ahora', color: '#F87171' },
];

export default function Plan14DTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const decision = edits.tabDecisions.plan ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('plan', data, edits);

  const { completion, quality, missing } = useMemo(() => {
    const comp = calculateTabCompletion(data, edits);
    const avg = Object.values(comp).reduce((a, b) => a + b, 0) / 9;
    const q: PlanQuality = avg < 30 ? 'orientation' : avg < 65 ? 'preliminary' : 'execution';
    const m = getMissingInputs(data, edits);
    return { completion: comp, quality: q, missing: m };
  }, [data, edits]);

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, plan: d }, lastUpdated: new Date().toISOString() });
  }

  const qualityLabel = {
    orientation: { label: 'Plan de orientación', color: '#FACC15', desc: 'Completá más tabs para generar un plan de ejecución específico.' },
    preliminary: { label: 'Plan preliminar', color: '#60A5FA', desc: 'Plan funcional con gaps. Los bloqueadores están marcados.' },
    execution: { label: 'Plan de ejecución', color: '#4ADE80', desc: 'Suficiente contexto para ejecutar. Seguí el plan al pie de la letra.' },
  }[quality];

  const plan = data.launchPlan;

  // Dynamic blockers per period
  function getBlocker(periodIndex: number): string | null {
    switch (periodIndex) {
      case 0: return !edits.validationGates.supplier || edits.validationGates.supplier === 'not-started'
        ? 'Proveedor no confirmado — empezá por aquí'
        : null;
      case 1: return !edits.economicsInputs.fobCost
        ? 'Economía incompleta — completá Tab 03 antes de definir precio'
        : null;
      case 2: return edits.selectedAngles.length < 3
        ? 'Ángulos no seleccionados — elegí los 3 en Tab 05 primero'
        : null;
      case 3: return edits.validationGates.sample !== 'passed'
        ? 'Muestra no aprobada — no avanzar a pauta sin probarla'
        : null;
      case 4: return edits.tabDecisions.landing?.status !== 'ready'
        ? 'Landing no validada — riesgo de pauta desperdiciada'
        : null;
      default: return null;
    }
  }

  const overallCompletion = Math.round(
    Object.values(completion).reduce((a, b) => a + b, 0) / 9
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        number="09"
        title="Plan 14 Días"
        sub="Sprint de ejecución día a día. El plan se adapta según el estado del board y los bloqueadores detectados."
      />

      {/* Plan quality indicator */}
      <div
        className="rounded-xl border px-4 py-3 flex items-center justify-between gap-4"
        style={{ borderColor: `${qualityLabel.color}25`, background: `${qualityLabel.color}07` }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.1em]" style={{ color: qualityLabel.color }}>
              {qualityLabel.label}
            </span>
            <span className="text-[10px] font-mono text-text-30">· Board completado al {overallCompletion}%</span>
          </div>
          <p className="text-xs text-text-40">{qualityLabel.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl tabular-nums" style={{ color: qualityLabel.color }}>{overallCompletion}%</div>
          <div className="text-[9px] font-mono text-text-20">completado</div>
        </div>
      </div>

      {/* Missing blockers */}
      {missing.length > 0 && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.04)' }}>
          <div className="text-[10px] uppercase tracking-[0.12em] font-mono mb-2" style={{ color: '#FACC15' }}>Bloqueadores activos — resolver primero</div>
          <ul className="space-y-1">
            {missing.map((m, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: '#FACC15' }}>
                <span className="shrink-0 mt-0.5 text-[10px]" style={{ color: 'rgba(250,204,21,0.5)' }}>!</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day-by-day plan */}
      <div className="space-y-3">
        {plan.map((p, i) => {
          const blocker = getBlocker(i);
          const hasBlocker = !!blocker;
          return (
            <div key={i} className="rounded-xl border border-border-soft overflow-hidden">
              {/* Period header */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b border-border-soft"
                style={{ background: hasBlocker ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)' }}
              >
                <div
                  className="w-14 text-[10px] font-mono shrink-0 text-center py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {p.period}
                </div>
                <span className="text-sm font-medium text-text-80 flex-1">{p.focus}</span>
                {hasBlocker && (
                  <span className="text-[9px] font-mono uppercase tracking-[0.1em]" style={{ color: '#F87171' }}>Bloqueado</span>
                )}
              </div>

              <div className="px-4 py-3">
                {/* Blocker alert */}
                {blocker && (
                  <div className="mb-3 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.04)' }}>
                    <p className="text-xs" style={{ color: '#F87171' }}>{blocker}</p>
                  </div>
                )}

                {/* Tasks */}
                <ul className="space-y-2 mb-3">
                  {p.tasks.filter(Boolean).map((task, j) => (
                    <li key={j} className="flex gap-2.5 items-start text-sm text-text-60">
                      <span className="shrink-0 mt-0.5 text-text-20 text-[10px] font-mono">{j + 1}.</span>
                      {task}
                    </li>
                  ))}
                </ul>

                {/* Why it matters (derived) */}
                <div className="rounded-lg border border-border-soft bg-bg-3/40 px-3 py-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-30">Por qué importa · </span>
                  <span className="text-xs text-text-40">
                    {i === 0 && 'Sin proveedor confirmado, todo lo que hagás después puede ser teoría.'}
                    {i === 1 && 'El precio y la oferta definen el margen de maniobra del funnel. Fijarlo tarde destruye trabajo previo.'}
                    {i === 2 && 'Los creativos son la hipótesis que testea si el mercado quiere lo que vendés.'}
                    {i === 3 && 'La muestra es la única validación real antes de comprometer capital en stock.'}
                    {i === 4 && 'El test de pauta convierte hipótesis en datos reales. Es el momento de aprender, no de escalar.'}
                    {i >= 5 && 'Ejecutar con los aprendizajes de las etapas anteriores.'}
                  </span>
                </div>

                {/* Checkpoint */}
                {p.checkpoint && (
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(184,255,92,0.15)', background: 'rgba(184,255,92,0.03)' }}>
                    <span className="text-[10px] font-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(184,255,92,0.6)' }}>Checkpoint binario · </span>
                    <span className="text-xs text-text-60">{p.checkpoint}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical path */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Camino crítico — nunca omitir</div>
        <ol className="space-y-2">
          {CRITICAL_PATH.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono shrink-0 mt-0.5"
                style={{ background: 'rgba(184,255,92,0.1)', color: '#B8FF5C' }}
              >
                {i + 1}
              </span>
              <span className="text-sm text-text-70">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Do not waste time */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">No perder tiempo en esto todavía</div>
        <ul className="space-y-1.5">
          {DO_NOT_WASTE_TIME.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-40">
              <span className="shrink-0 mt-0.5 text-[10px]" style={{ color: 'rgba(248,113,113,0.5)' }}>✕</span>
              {item}
            </li>
          ))}
        </ul>
      </Card>

      {/* Decision at day 14 */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Decisión al día 14</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {DECISION_AT_14.map(opt => (
            <div
              key={opt.id}
              className="rounded-lg border px-3 py-3"
              style={{ borderColor: `${opt.color}20`, background: `${opt.color}05` }}
            >
              <div className="text-sm font-medium mb-0.5" style={{ color: opt.color }}>{opt.label}</div>
              <p className="text-xs text-text-40 leading-relaxed">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <DecisionCheckpoint
        tabId="plan"
        status={decision.status}
        note={decision.note}
        nextAction="Ejecutar el plan — revisá el board diariamente y actualizá los gates de validación"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
