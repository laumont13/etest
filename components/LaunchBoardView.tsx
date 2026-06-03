'use client';

import { useState } from 'react';

// ════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════

export interface BattleContext {
  opponent: string;
  reason: string;
  keyDifference: string;
  recommendation: string;
}

export interface LaunchCommandData {
  product: { title: string; score: number; verdict: string; country: string; marginMultiple: number };
  battle: { opponent: string; whyWon: string; keyDifference: string; confidence: number; recommendation: string };
  market: { country: string; language: string; currency: string; tone: string };
  winnerSnapshot: { battleAdvantage: string; mainRisks: string[]; missingValidations: string[] };
  strategicDecision: { whyLaunch: string; functionalProblem: string; emotionalProblem: string; mainDesire: string; alternativeReplaced: string; mainHypothesis: string; killRisk: string };
  unitEconomics: { suggestedRetailPrice: string; estimatedLandedCost: string; grossMarginUSD: string; grossMarginPct: string; maxCACRecommendation: string; breakEvenLogic: string; recommendedOffer: string; bundleIdea: string; discountLimit: string };
  positioning: { categoryFraming: string; oneLiner: string; mainPromise: string; dangerousPromises: string[]; primaryAudience: string; secondaryAudience: string; useCases: string[]; objectionsToOvercome: string[] };
  creativeAngles: Array<{ id: string; name: string; emotion: string; hook: string; visualDirection: string; objectionAttacked: string; hypothesis: string; risk: string; confidence: 'high' | 'medium' | 'low' }>;
  creativeTestingPlan: { staticAds: Array<{ id: string; concept: string; hook: string; copy: string; whatItTests: string; winSignal: string; winAction: string }>; ugcBriefs: Array<{ id: string; hook: string; brief: string; whatItTests: string; winSignal: string }>; hookVariations: string[] };
  storeLanding: { headline: string; subheadline: string; heroCopy: string; benefits: string[]; problemStatement: string; solutionStatement: string; howItWorks: string[]; objectionsFAQ: Array<{ q: string; a: string }>; cta: string; shortDescription: string; longDescription: string; blockOrder: string[] };
  preImportValidation: { supplierQuestions: string[]; mediaToRequest: string[]; certificationsToVerify: string[]; sampleTests: string[]; killConditions: string[]; firstStockRecommendation: string };
  launchPlan: Array<{ period: string; focus: string; tasks: string[]; checkpoint: string }>;
}

// Backward compat alias
export type LaunchBoardData = LaunchCommandData;

type SectionId = 'snapshot' | 'estrategia' | 'economia' | 'posicionamiento' | 'angulos' | 'creativos' | 'landing' | 'validacion' | 'plan';

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function confidenceColor(c: string): string {
  return c === 'high' ? '#4ADE80' : c === 'medium' ? '#FACC15' : '#F87171';
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border-soft last:border-0">
      <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">{label}</span>
      <span className="text-sm text-text-80 leading-relaxed" style={danger ? { color: '#F87171' } : undefined}>{value}</span>
    </div>
  );
}

function List({ label, items, danger }: { label: string; items: string[]; danger?: boolean }) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="py-2 border-b border-border-soft last:border-0">
      <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 block mb-2">{label}</span>
      <ul className="space-y-1.5">
        {visible.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm" style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.72)' }}>
            <span className="shrink-0 mt-0.5" style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.24)' }}>·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border-soft bg-bg-2 p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ number, title, sub }: { number: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-border-soft">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-[10px] font-mono text-text-30">{number}</span>
        <h3 className="font-display text-lg text-text-100">{title}</h3>
      </div>
      {sub && <p className="text-xs text-text-40 leading-relaxed">{sub}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ════════════════════════════════════════════════════════

function SecSnapshot({ d }: { d: LaunchCommandData }) {
  const verdictColor = d.product.verdict === 'go' ? '#4ADE80' : d.product.verdict === 'maybe' ? '#FACC15' : '#F87171';
  return (
    <div className="space-y-4">
      <SectionHeader number="01" title="Snapshot del Ganador" sub="Síntesis de por qué este producto ganó la comparación directa y cuál es el punto de partida del lanzamiento." />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">Score</div>
          <div className="font-display text-3xl tabular-nums" style={{ color: verdictColor }}>{d.product.score}</div>
          <div className="text-[10px] font-mono text-text-30">/100</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">Margen</div>
          <div className="font-display text-3xl tabular-nums" style={{ color: d.product.marginMultiple >= 3 ? '#4ADE80' : '#F87171' }}>{d.product.marginMultiple}x</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">Confianza IA</div>
          <div className="font-display text-3xl tabular-nums" style={{ color: d.battle.confidence >= 80 ? '#4ADE80' : '#FACC15' }}>{d.battle.confidence}%</div>
        </Card>
      </div>

      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Ventaja sobre "{d.battle.opponent}"</div>
        <p className="text-sm text-text-80 leading-relaxed">{d.winnerSnapshot.battleAdvantage || d.battle.whyWon}</p>
        {d.battle.keyDifference && (
          <p className="text-xs text-text-50 mt-2 pt-2 border-t border-border-soft">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-30">Diferencia clave · </span>
            {d.battle.keyDifference}
          </p>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <List label="Riesgos principales" items={d.winnerSnapshot.mainRisks} danger />
        </Card>
        <Card>
          <List label="Validaciones pendientes" items={d.winnerSnapshot.missingValidations} />
        </Card>
      </div>

      {d.battle.recommendation && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(184,255,92,0.25)', background: 'rgba(184,255,92,0.04)' }}>
          <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30 mb-1">Recomendación estratégica</div>
          <p className="text-sm leading-relaxed" style={{ color: '#B8FF5C' }}>{d.battle.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function SecEstrategia({ d }: { d: LaunchCommandData }) {
  const sd = d.strategicDecision;
  return (
    <div className="space-y-4">
      <SectionHeader number="02" title="Decisión Estratégica" sub="Diagnóstico de si vale la pena lanzar y bajo qué condiciones." />
      <Card>
        <Row label="Por qué lanzar" value={sd.whyLaunch} />
        <Row label="Problema funcional" value={sd.functionalProblem} />
        <Row label="Problema emocional" value={sd.emotionalProblem} />
        <Row label="Deseo principal" value={sd.mainDesire} />
        <Row label="Alternativa que reemplaza" value={sd.alternativeReplaced} />
      </Card>
      {sd.mainHypothesis && (
        <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1.5">Hipótesis principal a testear</div>
          <p className="text-sm text-text-80 leading-relaxed italic">"{sd.mainHypothesis}"</p>
        </div>
      )}
      {sd.killRisk && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1.5" style={{ color: '#F87171' }}>Kill risk — lo único que cancela el lanzamiento</div>
          <p className="text-sm leading-relaxed" style={{ color: '#F87171' }}>{sd.killRisk}</p>
        </div>
      )}
    </div>
  );
}

function SecEconomia({ d }: { d: LaunchCommandData }) {
  const ue = d.unitEconomics;
  return (
    <div className="space-y-4">
      <SectionHeader number="03" title="Economía de la Unidad y Oferta" sub="Estructura de costos, margen, CAC máximo y lógica de oferta." />
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Precio y costos</div>
          <Row label="Precio de venta sugerido" value={ue.suggestedRetailPrice} />
          <Row label="Costo aterrizado estimado" value={ue.estimatedLandedCost} />
          <Row label="Margen bruto USD" value={ue.grossMarginUSD} />
          <Row label="Margen bruto %" value={ue.grossMarginPct} />
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Pauta y rentabilidad</div>
          <Row label="CAC máximo recomendado" value={ue.maxCACRecommendation} />
          <Row label="Lógica de break-even" value={ue.breakEvenLogic} />
          <Row label="Límite de descuento" value={ue.discountLimit} danger />
        </Card>
      </div>
      <Card>
        <Row label="Oferta recomendada" value={ue.recommendedOffer} />
        <Row label="Idea de bundle o pack" value={ue.bundleIdea} />
      </Card>
    </div>
  );
}

function SecPosicionamiento({ d }: { d: LaunchCommandData }) {
  const p = d.positioning;
  return (
    <div className="space-y-4">
      <SectionHeader number="04" title="Posicionamiento" sub="Cómo comunicar el producto y a quién." />
      {p.oneLiner && (
        <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">One-liner de posicionamiento</div>
          <p className="font-display text-xl text-text-100 leading-snug">"{p.oneLiner}"</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <Row label="Marco de categoría" value={p.categoryFraming} />
          <Row label="Promesa principal" value={p.mainPromise} />
          <Row label="Audiencia primaria" value={p.primaryAudience} />
          <Row label="Audiencia secundaria" value={p.secondaryAudience} />
        </Card>
        <Card>
          <List label="Casos de uso" items={p.useCases} />
          <div className="pt-2">
            <List label="Objeciones a superar" items={p.objectionsToOvercome} />
          </div>
        </Card>
      </div>
      {p.dangerousPromises.length > 0 && (
        <Card>
          <List label="Promesas peligrosas — no usar sin muestra confirmada" items={p.dangerousPromises} danger />
        </Card>
      )}
    </div>
  );
}

function SecAngulos({ d }: { d: LaunchCommandData }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([d.creativeAngles[0]?.id ?? '']));
  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <SectionHeader number="05" title="Ángulos Creativos" sub="Hipótesis de comunicación a testear. Cada ángulo ataca una razón distinta de compra." />
      <div className="space-y-2">
        {d.creativeAngles.map((a) => {
          const isOpen = expanded.has(a.id);
          const cColor = confidenceColor(a.confidence);
          return (
            <div key={a.id} className="rounded-xl border border-border-soft overflow-hidden">
              <button
                onClick={() => toggle(a.id)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-bg-3/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded" style={{ background: `${cColor}18`, color: cColor }}>
                      {a.confidence}
                    </span>
                    <span className="text-xs font-mono text-text-40">{a.emotion}</span>
                  </div>
                  <p className="text-sm font-medium text-text-90 leading-snug">"{a.hook}"</p>
                  <p className="text-xs text-text-40 mt-0.5">{a.name}</p>
                </div>
                <span className="text-text-30 font-mono text-xs shrink-0 pt-1">{isOpen ? '↑' : '↓'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border-soft pt-3 space-y-0 bg-bg-1/40">
                  <Row label="Dirección visual" value={a.visualDirection} />
                  <Row label="Objeción atacada" value={a.objectionAttacked} />
                  <Row label="Hipótesis" value={a.hypothesis} />
                  <Row label="Riesgo del ángulo" value={a.risk} danger />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecCreativos({ d }: { d: LaunchCommandData }) {
  const { staticAds, ugcBriefs, hookVariations } = d.creativeTestingPlan;
  return (
    <div className="space-y-4">
      <SectionHeader number="06" title="Plan de Testeo Creativo" sub="Qué crear, qué testea cada pieza y cómo decidir el ganador." />

      {staticAds.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-2">Anuncios estáticos</div>
          <div className="space-y-3">
            {staticAds.map(ad => (
              <Card key={ad.id}>
                <div className="text-[10px] font-mono text-text-30 mb-2">{ad.id.toUpperCase()}</div>
                <Row label="Concepto" value={ad.concept} />
                <Row label="Hook principal" value={ad.hook} />
                <Row label="Copy" value={ad.copy} />
                <Row label="Qué testea" value={ad.whatItTests} />
                <Row label="Señal de victoria" value={ad.winSignal} />
                <Row label="Si gana, hacer" value={ad.winAction} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {ugcBriefs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40 mb-2">Briefs UGC / Video</div>
          <div className="space-y-3">
            {ugcBriefs.map(u => (
              <Card key={u.id}>
                <div className="text-[10px] font-mono text-text-30 mb-2">{u.id.toUpperCase()}</div>
                <Row label="Hook de apertura" value={u.hook} />
                <Row label="Brief de grabación" value={u.brief} />
                <Row label="Qué testea" value={u.whatItTests} />
                <Row label="Señal de victoria" value={u.winSignal} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {hookVariations.length > 0 && (
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Variaciones de hook</div>
          <div className="space-y-2">
            {hookVariations.filter(Boolean).map((h, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border-soft last:border-0">
                <span className="text-[10px] font-mono text-text-20 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-sm text-text-70">"{h}"</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SecLanding({ d }: { d: LaunchCommandData }) {
  const sl = d.storeLanding;
  return (
    <div className="space-y-4">
      <SectionHeader number="07" title="Estructura de Landing / Tienda" sub="Copy base y arquitectura de la página de producto para lanzamiento." />

      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Copy principal</div>
        <Row label="Headline" value={sl.headline} />
        <Row label="Subheadline" value={sl.subheadline} />
        <Row label="Hero copy" value={sl.heroCopy} />
        <Row label="CTA principal" value={sl.cta} />
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <List label="Beneficios clave" items={sl.benefits} />
          <div className="pt-2"><List label="Cómo funciona" items={sl.howItWorks} /></div>
        </Card>
        <Card>
          <Row label="Declaración del problema" value={sl.problemStatement} />
          <Row label="Declaración de la solución" value={sl.solutionStatement} />
        </Card>
      </div>

      {sl.objectionsFAQ.length > 0 && (
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">FAQ / Objeciones</div>
          <div className="space-y-3">
            {sl.objectionsFAQ.filter(f => f.q).map((f, i) => (
              <div key={i} className="border-b border-border-soft last:border-0 pb-3 last:pb-0">
                <p className="text-xs font-medium text-text-80 mb-1">P: {f.q}</p>
                <p className="text-xs text-text-50 leading-relaxed">R: {f.a}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <Row label="Descripción corta" value={sl.shortDescription} />
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Orden de bloques recomendado</div>
          <ol className="space-y-1.5">
            {sl.blockOrder.filter(Boolean).map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-60">
                <span className="text-[10px] font-mono text-text-20 shrink-0 mt-0.5">{i + 1}.</span>
                {b}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {sl.longDescription && (
        <Card>
          <Row label="Descripción larga" value={sl.longDescription} />
        </Card>
      )}
    </div>
  );
}

function SecValidacion({ d }: { d: LaunchCommandData }) {
  const pv = d.preImportValidation;
  return (
    <div className="space-y-4">
      <SectionHeader number="08" title="Validación Pre-Importación" sub="Qué confirmar antes de comprometer capital en stock." />

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <List label="Preguntas al proveedor" items={pv.supplierQuestions} />
        </Card>
        <Card>
          <List label="Material a solicitar" items={pv.mediaToRequest} />
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <List label="Certificaciones a verificar" items={pv.certificationsToVerify} />
        </Card>
        <Card>
          <List label="Tests al recibir muestra" items={pv.sampleTests} />
        </Card>
      </div>

      {pv.killConditions.length > 0 && (
        <div className="rounded-xl border px-4 py-4" style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' }}>
          <List label="Kill conditions — si alguna se cumple, no comprar stock" items={pv.killConditions} danger />
        </div>
      )}

      {pv.firstStockRecommendation && (
        <Card>
          <Row label="Recomendación de primer stock" value={pv.firstStockRecommendation} />
        </Card>
      )}
    </div>
  );
}

function SecPlan({ d }: { d: LaunchCommandData }) {
  return (
    <div className="space-y-4">
      <SectionHeader number="09" title="Plan de Lanzamiento — 14 Días" sub="Ejecución día a día con checkpoints binarios de decisión." />
      <div className="space-y-3">
        {d.launchPlan.map((p, i) => (
          <div key={i} className="rounded-xl border border-border-soft overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-bg-2 border-b border-border-soft">
              <span className="text-[10px] font-mono text-text-40 w-20 shrink-0">{p.period}</span>
              <span className="text-sm font-medium text-text-80">{p.focus}</span>
            </div>
            <div className="px-4 py-3">
              <ul className="space-y-1.5 mb-3">
                {p.tasks.filter(Boolean).map((t, j) => (
                  <li key={j} className="flex gap-2 text-sm text-text-60">
                    <span className="text-text-20 shrink-0">·</span>
                    {t}
                  </li>
                ))}
              </ul>
              {p.checkpoint && (
                <div className="rounded-lg border border-border-soft bg-bg-3/40 px-3 py-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-text-30">Checkpoint · </span>
                  <span className="text-xs text-text-60">{p.checkpoint}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════

const SECTIONS: { id: SectionId; label: string; short: string }[] = [
  { id: 'snapshot',       label: 'Snapshot',       short: '01' },
  { id: 'estrategia',     label: 'Estrategia',     short: '02' },
  { id: 'economia',       label: 'Economía',       short: '03' },
  { id: 'posicionamiento', label: 'Posicionamiento', short: '04' },
  { id: 'angulos',        label: 'Ángulos',        short: '05' },
  { id: 'creativos',      label: 'Creativos',      short: '06' },
  { id: 'landing',        label: 'Landing',        short: '07' },
  { id: 'validacion',     label: 'Validación',     short: '08' },
  { id: 'plan',           label: 'Plan 14D',       short: '09' },
];

interface Props {
  data: LaunchCommandData;
  onBack: () => void;
}

export default function LaunchBoardView({ data, onBack }: Props) {
  const [active, setActive] = useState<SectionId>('snapshot');

  const contentMap: Record<SectionId, React.ReactNode> = {
    snapshot:        <SecSnapshot d={data} />,
    estrategia:      <SecEstrategia d={data} />,
    economia:        <SecEconomia d={data} />,
    posicionamiento: <SecPosicionamiento d={data} />,
    angulos:         <SecAngulos d={data} />,
    creativos:       <SecCreativos d={data} />,
    landing:         <SecLanding d={data} />,
    validacion:      <SecValidacion d={data} />,
    plan:            <SecPlan d={data} />,
  };

  return (
    <div className="animate-fade-up space-y-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5 shrink-0 mt-0.5"
        >
          ← Battle
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] uppercase tracking-[0.16em] font-mono"
              style={{ color: '#B8FF5C' }}
            >
              Launch Command
            </span>
            <span className="text-[10px] font-mono text-text-20">·</span>
            <span className="text-[10px] font-mono text-text-30">
              vs {data.battle.opponent}
            </span>
          </div>
          <h2 className="font-display text-xl text-text-100 leading-tight truncate">
            {data.product.title}
          </h2>
          <p className="text-xs text-text-30 mt-0.5">
            {data.product.country} · {data.market.currency} · Score {data.product.score}/100
          </p>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 p-1 rounded-xl border border-border-soft bg-bg-2 overflow-x-auto">
        {SECTIONS.map(s => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="flex flex-col items-center flex-1 px-2 py-2 rounded-lg text-center transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                borderBottom: isActive ? '2px solid rgba(184,255,92,0.55)' : '2px solid transparent',
              }}
            >
              <span className="text-[9px] font-mono" style={{ color: isActive ? 'rgba(184,255,92,0.6)' : 'rgba(255,255,255,0.2)' }}>
                {s.short}
              </span>
              <span className="text-[11px] font-mono" style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)' }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div key={active} className="animate-fade-up">
        {contentMap[active]}
      </div>
    </div>
  );
}
