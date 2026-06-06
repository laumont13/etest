'use client';

import { Card, SectionHeader, BulletList, CopyButton, DecisionCheckpoint, ChecklistModule } from '../ui';
import type { ChecklistItem } from '../ui';
import { canMarkTabReady } from '../helpers';
import { VALIDATION_GATES } from '../types';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus, GateStatus, ChecklistState } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

const GATE_STATUS_OPTIONS: { value: GateStatus; label: string; color: string }[] = [
  { value: 'not-started',  label: 'No iniciado',    color: 'rgba(255,255,255,0.3)' },
  { value: 'in-progress',  label: 'En progreso',    color: '#60A5FA' },
  { value: 'passed',       label: 'Aprobado',       color: '#4ADE80' },
  { value: 'blocked',      label: 'Bloqueado',      color: '#FACC15' },
  { value: 'failed',       label: 'Fallido',        color: '#F87171' },
];

const SUPPLIER_CHECKLIST: ChecklistItem[] = [
  { label: '¿Podés enviar muestras antes del pedido bulk? ¿Costo y tiempo de envío?', required: true },
  { label: '¿Cuál es el MOQ real y qué pasa si el primer pedido es menor?', required: true },
  { label: '¿Cómo manejan productos defectuosos? ¿Qué % de reposición garantizan?', required: true },
  { label: '¿Qué certificaciones tiene el producto (CE, RoHS, FDA, etc.)?', help: 'Importante para importar a Argentina sin problemas aduaneros.' },
  { label: '¿Tenés packaging personalizable? ¿Desde qué cantidad?' },
  { label: '¿Podemos colocar nuestra marca en el producto o packaging?' },
  { label: '¿Cuál es el lead time real para un pedido de [MOQ mínimo]?', required: true },
  { label: '¿Aceptan pagos seguros como Trade Assurance o Alibaba Pay?', help: 'Siempre preferir Trade Assurance para el primer pedido.' },
  { label: '¿Tienen otros clientes comprando este producto en [país destino]?' },
  { label: 'Enviar: ficha técnica, HS code, certificados y factura proforma.', required: true },
];

const SAMPLE_CHECKLIST: ChecklistItem[] = [
  { label: 'Probar el producto exactamente como lo usaría el comprador final', required: true },
  { label: 'Comparar con las fotos y descripción del proveedor — ¿coincide?', required: true },
  { label: 'Evaluar el packaging: ¿sobrevive el transporte? ¿se ve bien en unboxing?' },
  { label: 'Tomar fotos y video propios en luz natural (5 ángulos mínimo)', required: true, help: 'Estas fotos son tu contenido real — no uses las del proveedor.' },
  { label: 'Test de durabilidad según el uso prometido' },
  { label: 'Evaluar si el resultado prometido es verificable y demostrable', required: true },
  { label: 'Verificar materiales reales vs descripción del proveedor' },
  { label: 'Confirmar si el packaging tiene información suficiente para el mercado destino' },
];

const COMPLIANCE_CHECKLIST: ChecklistItem[] = [
  { label: 'Consultar posición arancelaria (HS code) con despachante de aduana', required: true, help: 'El HS code determina el arancel y restricciones de importación.' },
  { label: 'Verificar si requiere VUCE (Ventanilla Única de Comercio Exterior)', required: true },
  { label: 'Consultar si aplica licencia de importación automática o no automática' },
  { label: 'Verificar certificaciones requeridas por INAL, SENASA, ANMAT según categoría' },
  { label: 'Si tiene batería: confirmar requisitos especiales de transporte y declaración', help: 'Las baterías Li-ion tienen regulaciones estrictas para transporte aéreo.' },
  { label: 'Pedir al proveedor: hoja técnica, ficha de seguridad si aplica, certificados' },
  { label: 'Confirmar etiquetado requerido en español para el mercado local' },
  { label: 'Obtener invoice y packing list en formato estándar para aduana' },
];

function GateBadge({ status, required }: { status: GateStatus; required?: boolean }) {
  const opt = GATE_STATUS_OPTIONS.find(o => o.value === status) ?? GATE_STATUS_OPTIONS[0];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full" style={{ color: opt.color, background: `${opt.color}15` }}>
        {opt.label}
      </span>
      {required && (
        <span className="text-[8px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full" style={{ color: '#F87171', background: 'rgba(248,113,113,0.12)' }}>
          Req.
        </span>
      )}
    </div>
  );
}

export default function ValidationTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const pv = data.preImportValidation;
  const decision = edits.tabDecisions.validacion ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('validacion', data, edits);

  function setChecklistState(id: string, s: ChecklistState) {
    onEditsChange({
      ...edits,
      checklistState: { ...edits.checklistState, [id]: s },
      lastUpdated: new Date().toISOString(),
    });
  }

  function setGateStatus(id: string, status: GateStatus) {
    onEditsChange({
      ...edits,
      validationGates: { ...edits.validationGates, [id]: status },
      lastUpdated: new Date().toISOString(),
    });
  }

  function setGateNote(id: string, note: string) {
    onEditsChange({
      ...edits,
      validationNotes: { ...edits.validationNotes, [id]: note },
      lastUpdated: new Date().toISOString(),
    });
  }

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, validacion: d }, lastUpdated: new Date().toISOString() });
  }

  const gatesPassed = VALIDATION_GATES.filter(g => edits.validationGates[g.id] === 'passed').length;
  const gatesBlocked = VALIDATION_GATES.filter(g => edits.validationGates[g.id] === 'blocked' || edits.validationGates[g.id] === 'failed').length;

  const supplierQsCopy = SUPPLIER_CHECKLIST.map(i => i.label).join('\n');

  return (
    <div className="space-y-4">
      <SectionHeader
        number="08"
        title="Validación"
        sub="Qué debe estar probado antes de comprometer capital. Gates, proveedor, muestra, cumplimiento y test de pauta."
      />

      {/* Gate dashboard */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Dashboard de gates</div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono" style={{ color: '#4ADE80' }}>{gatesPassed}/{VALIDATION_GATES.length} aprobados</span>
            {gatesBlocked > 0 && (
              <span className="text-xs font-mono" style={{ color: '#F87171' }}>{gatesBlocked} bloqueados</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {VALIDATION_GATES.map(gate => {
            const status = edits.validationGates[gate.id] ?? 'not-started';
            const note = edits.validationNotes[gate.id] ?? '';
            return (
              <div key={gate.id} className="rounded-lg border border-border-soft overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-text-80">{gate.label}</span>
                      <GateBadge status={status} required={gate.required} />
                    </div>
                    <p className="text-xs text-text-40 leading-relaxed">{gate.description}</p>
                    <p className="text-[10px] text-text-20 mt-0.5">Evidencia: {gate.requiredEvidence}</p>
                  </div>
                  <select
                    value={status}
                    onChange={e => setGateStatus(gate.id, e.target.value as GateStatus)}
                    className="shrink-0 bg-bg-3 border border-border-soft rounded-lg px-2 py-1 text-[10px] font-mono text-text-60 focus:outline-none focus:border-accent/40 transition-colors"
                  >
                    {GATE_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} style={{ background: '#111113' }}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {status !== 'not-started' && (
                  <div className="px-3 pb-2 border-t border-border-soft">
                    <input
                      type="text"
                      value={note}
                      onChange={e => setGateNote(gate.id, e.target.value)}
                      placeholder={`Nota sobre ${gate.label.toLowerCase()}`}
                      className="w-full bg-transparent text-[11px] text-text-50 focus:outline-none placeholder:text-text-20 py-1.5"
                    />
                  </div>
                )}
                {(status === 'not-started' || status === 'in-progress') && (
                  <div className="px-3 pb-2">
                    <p className="text-[10px] text-text-30">→ {gate.nextAction}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Supplier checklist */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Preguntas al proveedor</div>
          <CopyButton text={supplierQsCopy} label="Copiar preguntas" />
        </div>
        <ChecklistModule
          id="validation-supplier"
          items={SUPPLIER_CHECKLIST}
          state={edits.checklistState['validation-supplier']}
          onChange={s => setChecklistState('validation-supplier', s)}
          accentColor="#4ADE80"
        />
        {pv.supplierQuestions.filter(Boolean).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-soft">
            <div className="text-[10px] font-mono text-text-30 mb-2">Preguntas adicionales generadas por IA</div>
            <ul className="space-y-1.5">
              {pv.supplierQuestions.filter(Boolean).map((q, i) => (
                <li key={i} className="flex gap-2 text-xs text-text-50">
                  <span className="shrink-0 mt-0.5 text-text-20">·</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Media to request */}
      <Card>
        <BulletList
          label="Material a solicitar al proveedor"
          items={pv.mediaToRequest.length > 0 ? pv.mediaToRequest : [
            'Fotos HD del producto real (5 ángulos mínimo)',
            'Video de uso real de 30-60 segundos',
            'Foto del packaging (exterior e interior)',
            'Foto comparativa de escala',
          ]}
        />
      </Card>

      {/* Argentina compliance */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">Cumplimiento / Importación — Argentina</div>
        <p className="text-[10px] text-text-20 mb-3">
          Esta checklist es orientativa. Consultá con un despachante de aduana antes de importar.
          E-Test no reemplaza asesoramiento legal ni aduanero.
        </p>
        <ChecklistModule
          id="validation-compliance"
          items={COMPLIANCE_CHECKLIST}
          state={edits.checklistState['validation-compliance']}
          onChange={s => setChecklistState('validation-compliance', s)}
          accentColor="#60A5FA"
        />
        {pv.certificationsToVerify.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-soft">
            <BulletList label="Certificaciones específicas detectadas" items={pv.certificationsToVerify} />
          </div>
        )}
      </Card>

      {/* Sample tests */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Tests al recibir la muestra</div>
        <ChecklistModule
          id="validation-sample"
          items={[
            ...SAMPLE_CHECKLIST,
            ...pv.sampleTests.filter(Boolean).map(t => ({ label: t })),
          ]}
          state={edits.checklistState['validation-sample']}
          onChange={s => setChecklistState('validation-sample', s)}
          accentColor="#4ADE80"
        />
      </Card>

      {/* Kill conditions */}
      {pv.killConditions.length > 0 && (
        <div className="rounded-xl border px-4 py-4" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)' }}>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-3" style={{ color: '#F87171' }}>
            Condiciones de cancelación — si alguna se cumple, no comprar stock
          </div>
          <ul className="space-y-2">
            {pv.killConditions.filter(Boolean).map((c, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: '#F87171' }}>
                <span className="shrink-0 mt-0.5 text-[10px]" style={{ color: 'rgba(248,113,113,0.5)' }}>✕</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* First stock recommendation */}
      {pv.firstStockRecommendation && (
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Recomendación de primer stock</div>
          <p className="text-sm text-text-70 leading-relaxed">{pv.firstStockRecommendation}</p>
        </Card>
      )}

      <DecisionCheckpoint
        tabId="validacion"
        status={decision.status}
        note={decision.note}
        nextAction={
          gatesPassed < 3
            ? 'Completar al menos proveedor, economía y muestra antes de comprar stock'
            : gatesPassed < 6
            ? 'Faltan gates clave — no hacer pedido hasta tener creativo y landing aprobados'
            : 'Gates suficientes para pedir muestra y preparar primer test de pauta'
        }
        nextTabLabel="Plan 14D"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
