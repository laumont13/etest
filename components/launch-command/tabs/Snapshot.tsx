'use client';

import { Card, SectionHeader, CopyButton, DecisionCheckpoint } from '../ui';
import { canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

function verdictLabel(v: string): { label: string; color: string } {
  if (v === 'go')    return { label: 'IMPORTAR', color: '#4ADE80' };
  if (v === 'maybe') return { label: 'TESTEAR PRIMERO', color: '#FACC15' };
  return              { label: 'HOLD', color: '#FB923C' };
}

function marginColor(m: number): string {
  if (m >= 4) return '#4ADE80';
  if (m >= 3) return '#FACC15';
  return '#F87171';
}

export default function SnapshotTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const { product, battle, winnerSnapshot, strategicDecision } = data;
  const vd = verdictLabel(product.verdict);
  const decision = edits.tabDecisions.snapshot ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('snapshot', data, edits);

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, snapshot: d }, lastUpdated: new Date().toISOString() });
  }

  const snapshotText = [
    `Producto: ${product.title}`,
    `País: ${product.country} | Score: ${product.score}/100 | Margen: ${product.marginMultiple}x`,
    `Veredicto: ${vd.label}`,
    `Priorizado por: ${winnerSnapshot.battleAdvantage || battle.whyWon}`,
    `Riesgos principales: ${winnerSnapshot.mainRisks.join(', ')}`,
    `Validaciones pendientes: ${winnerSnapshot.missingValidations.join(', ')}`,
  ].join('\n');

  const margin = product.marginMultiple;
  const confidence = battle.confidence;

  return (
    <div className="space-y-4">
      <SectionHeader
        number="01"
        title="Snapshot del Producto"
        sub="Visión ejecutiva en una pantalla. Veredicto claro, razones de priorización y validaciones reales pendientes."
      />

      {/* Verdict banner */}
      <div
        className="rounded-xl border px-5 py-4 flex items-center justify-between gap-4"
        style={{ borderColor: `${vd.color}30`, background: `${vd.color}08` }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-0.5">Veredicto IA</div>
          <div className="font-display text-2xl" style={{ color: vd.color }}>{vd.label}</div>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-center">
            <div className="font-display text-3xl tabular-nums" style={{ color: vd.color }}>{product.score}</div>
            <div className="text-[9px] font-mono text-text-30">/100</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl tabular-nums" style={{ color: marginColor(margin) }}>{margin}x</div>
            <div className="text-[9px] font-mono text-text-30">margen</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl tabular-nums" style={{ color: confidence >= 80 ? '#4ADE80' : '#FACC15' }}>{confidence}%</div>
            <div className="text-[9px] font-mono text-text-30">IA conf.</div>
          </div>
        </div>
      </div>

      {/* Internal prioritization — honest framing */}
      <div
        className="rounded-xl border px-4 py-4"
        style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-0.5" style={{ color: '#60A5FA' }}>
              Priorización interna — Resultado del Battle Mode
            </div>
            <p className="text-[10px] text-text-30 leading-relaxed">
              Este producto fue elegido en la comparación interna. Eso no equivale a validación de mercado.
            </p>
          </div>
          <CopyButton text={snapshotText} label="Copiar" />
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-[10px] font-mono text-text-30">Por qué fue priorizado · </span>
            <span className="text-sm text-text-70">{winnerSnapshot.battleAdvantage || battle.whyWon}</span>
          </div>
          <div>
            <span className="text-[10px] font-mono text-text-30">Diferencia clave vs {battle.opponent} · </span>
            <span className="text-sm text-text-70">{battle.keyDifference}</span>
          </div>
        </div>
        <div
          className="mt-3 pt-3 border-t rounded-lg px-3 py-2"
          style={{ borderColor: 'rgba(96,165,250,0.15)', background: 'rgba(96,165,250,0.06)' }}
        >
          <p className="text-[11px] leading-relaxed" style={{ color: '#93C5FD' }}>
            La ventaja en el Battle Mode es una comparación interna de potencial — no prueba demanda real.
            Muestra suficiente promesa para pasar a validación estructurada, pero requiere evidencia real antes de comprometer capital.
          </p>
        </div>
      </div>

      {/* Risks and unknowns */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-3" style={{ color: '#FACC15' }}>Riesgos principales</div>
          <ul className="space-y-2">
            {winnerSnapshot.mainRisks.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: '#FACC15' }}>
                <span className="shrink-0 font-mono text-[10px] mt-0.5" style={{ color: 'rgba(250,204,21,0.5)' }}>!</span>
                {r}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Unknowns críticos</div>
          <ul className="space-y-1.5">
            {winnerSnapshot.missingValidations.slice(0, 4).map((v, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-60">
                <span className="shrink-0 font-mono text-[10px] mt-0.5 text-text-20">?</span>
                {v}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Real validations still pending */}
      <div
        className="rounded-xl border px-4 py-4"
        style={{ borderColor: 'rgba(250,204,21,0.15)', background: 'rgba(250,204,21,0.03)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-3" style={{ color: '#FACC15' }}>
          Validaciones reales pendientes — antes de comprar stock
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {[
            { label: 'Muestra física', desc: 'Recibir y testear en uso real' },
            { label: 'CAC real', desc: 'Test de pauta con presupuesto mínimo' },
            { label: 'Proveedor confirmado', desc: 'MOQ, calidad y tiempos' },
          ].map(v => (
            <div key={v.label} className="rounded-lg border border-border-soft bg-bg-3/40 px-3 py-2">
              <div className="text-[10px] font-mono text-text-40 mb-0.5">{v.label}</div>
              <div className="text-[10px] text-text-30">{v.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic decision context */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Por qué lanzar</div>
          <p className="text-sm text-text-70 leading-relaxed">{strategicDecision.whyLaunch}</p>
        </Card>
        <div
          className="rounded-xl border px-4 py-4"
          style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.04)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-2" style={{ color: '#F87171' }}>Kill criteria</div>
          <p className="text-xs leading-relaxed" style={{ color: '#F87171' }}>
            {strategicDecision.killRisk || 'Definir condición que cancelaría el lanzamiento completamente.'}
          </p>
        </div>
      </div>

      {/* Recommendation */}
      {battle.recommendation && (
        <div
          className="rounded-xl border px-4 py-3 flex items-start justify-between gap-3"
          style={{ borderColor: 'rgba(184,255,92,0.2)', background: 'rgba(184,255,92,0.04)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-mono mb-1" style={{ color: '#B8FF5C' }}>Próxima acción recomendada</div>
            <p className="text-sm leading-relaxed" style={{ color: '#B8FF5C' }}>{battle.recommendation}</p>
          </div>
          <CopyButton text={battle.recommendation} />
        </div>
      )}

      <DecisionCheckpoint
        tabId="snapshot"
        status={decision.status}
        note={decision.note}
        nextAction="Continuar a Estrategia → definir cómo podría ganar este producto en el mercado real"
        nextTabLabel="Estrategia"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
