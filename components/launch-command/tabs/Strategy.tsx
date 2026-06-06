'use client';

import { Card, SectionHeader, InfoRow, CopyButton, DecisionCheckpoint, EditableTextarea, ChecklistModule } from '../ui';
import type { ChecklistItem } from '../ui';
import { canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus, ChecklistState } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

const VALIDATION_LADDER: ChecklistItem[] = [
  { label: '¿El proveedor puede cumplir calidad, MOQ y tiempos?', required: true, help: 'Confirmar por escrito antes de cualquier pedido de stock.' },
  { label: '¿El problema funcional resuena con la audiencia? (validar con creativos)', required: true, help: 'Necesitás al menos un test de pauta con resultados reales — no asumas.' },
  { label: '¿El CAC real está dentro del rango rentable?', required: true, help: 'Calculá el breakeven CAC en la calculadora de economía y comparalo con resultados de test.' },
  { label: '¿La tasa de devolución está por debajo del 8%?', help: 'Validar con muestras y primeros pedidos pequeños antes de escalar.' },
  { label: '¿El producto pasa el test de muestra física?', required: true, help: 'Recibir muestra, usarla como el comprador final, documentar defectos.' },
];

const GTM_ROUTES = ['Pauta pagada (Meta/TikTok)', 'Orgánico (SEO/contenido)', 'UGC / Influencer', 'Marketplace (ML/Shopify)', 'Tienda propia', 'Whatsapp/Social selling'];
const PRODUCT_ROLES = ['Compra por impulso', 'Solucionador de problema', 'Regalo', 'Reemplazo de hábito', 'Conveniencia', 'Estatus', 'Estético'];

export default function StrategyTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const sd = data.strategicDecision;
  const decision = edits.tabDecisions.estrategia ?? { status: 'pending' as TabStatus, note: '' };
  const checkpoint = edits.checkpoints.estrategia ?? '';
  const { canMark, reason } = canMarkTabReady('estrategia', data, edits);

  const checklistState = edits.checklistState['strategy-validation-ladder'];

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, estrategia: d }, lastUpdated: new Date().toISOString() });
  }

  function setCheckpoint(v: string) {
    onEditsChange({ ...edits, checkpoints: { ...edits.checkpoints, estrategia: v }, lastUpdated: new Date().toISOString() });
  }

  function setChecklistState(s: ChecklistState) {
    onEditsChange({
      ...edits,
      checklistState: { ...edits.checklistState, 'strategy-validation-ladder': s },
      lastUpdated: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        number="02"
        title="Estrategia"
        sub="Cómo podría ganar este producto en el mercado. Tesis de entrada, problema del cliente, ángulo de menor fricción."
      />

      {/* Market entry thesis */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Tesis de entrada al mercado</div>
        <InfoRow label="Por qué lanzar" value={sd.whyLaunch} />
        <InfoRow label="Alternativa que reemplaza" value={sd.alternativeReplaced} />
      </Card>

      {/* Customer problem */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Problema del cliente</div>
        <div className="grid sm:grid-cols-2 gap-0">
          <InfoRow label="Problema funcional" value={sd.functionalProblem} />
          <InfoRow label="Problema emocional" value={sd.emotionalProblem} />
          <InfoRow label="Deseo principal" value={sd.mainDesire} />
        </div>
      </Card>

      {/* Role + GTM */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Rol del producto</div>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_ROLES.map(role => (
              <span key={role} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border-soft text-text-40">
                {role}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-text-30 mt-2">Identificá cuál aplica antes de elegir el ángulo creativo.</p>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Ruta GTM</div>
          <div className="flex flex-wrap gap-1.5">
            {GTM_ROUTES.map(route => (
              <span key={route} className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border-soft text-text-40">
                {route}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-text-30 mt-2">¿Por dónde entra al mercado con menor fricción?</p>
        </Card>
      </div>

      {/* Validation ladder as ChecklistModule */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Escalera de validación (antes de comprar stock)</div>
        <ChecklistModule
          id="strategy-validation-ladder"
          items={VALIDATION_LADDER}
          state={checklistState}
          onChange={setChecklistState}
          accentColor="#4ADE80"
        />
      </Card>

      {/* Main hypothesis */}
      {sd.mainHypothesis && (
        <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Hipótesis principal a testear</div>
            <CopyButton text={sd.mainHypothesis} />
          </div>
          <p className="text-sm text-text-80 leading-relaxed italic">"{sd.mainHypothesis}"</p>
        </div>
      )}

      {/* Kill risk */}
      {sd.killRisk && (
        <div
          className="rounded-xl border px-4 py-3"
          style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1.5" style={{ color: '#F87171' }}>Condición de cancelación</div>
          <p className="text-sm leading-relaxed" style={{ color: '#F87171' }}>{sd.killRisk}</p>
        </div>
      )}

      {/* Checkpoint input */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Tu síntesis estratégica</div>
        <EditableTextarea
          label="El producto gana si..."
          value={checkpoint.includes('gana:') ? checkpoint.split('gana:')[1]?.split('\n')[0] ?? '' : ''}
          onChange={v => {
            const fails = checkpoint.includes('falla:') ? checkpoint.split('falla:')[1] ?? '' : '';
            setCheckpoint(`gana:${v}\nfalla:${fails}`);
          }}
          placeholder="Ej: resuelve el problema a precio accesible, el proveedor cumple y el CAC se mantiene < $15"
          rows={2}
        />
        <EditableTextarea
          label="La estrategia falla si..."
          value={checkpoint.includes('falla:') ? checkpoint.split('falla:')[1] ?? '' : ''}
          onChange={v => {
            const wins = checkpoint.includes('gana:') ? checkpoint.split('gana:')[1]?.split('\n')[0] ?? '' : '';
            setCheckpoint(`gana:${wins}\nfalla:${v}`);
          }}
          placeholder="Ej: el CAC supera el margen de contribución o el proveedor no puede mantener calidad"
          rows={2}
        />
      </Card>

      <DecisionCheckpoint
        tabId="estrategia"
        status={decision.status}
        note={decision.note}
        nextAction="Completar la calculadora de economía → confirmar si los números resisten tráfico pagado"
        nextTabLabel="Economía"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
