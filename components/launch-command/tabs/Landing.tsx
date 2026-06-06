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

type CheckItem = { label: string; group: string };

const TRUST_CHECKLIST: CheckItem[] = [
  { label: 'Precio claro visible above the fold', group: 'Precio y oferta' },
  { label: 'Oferta y urgencia (si aplica)', group: 'Precio y oferta' },
  { label: 'Promesa de entrega con fecha estimada', group: 'Logística' },
  { label: 'Política de devolución en lenguaje simple', group: 'Logística' },
  { label: 'Métodos de pago visibles (íconos)', group: 'Confianza' },
  { label: 'Garantía o respaldo del producto', group: 'Confianza' },
  { label: 'Especificaciones técnicas del producto', group: 'Producto' },
  { label: 'Imágenes reales (no solo renders)', group: 'Producto' },
  { label: 'Reviews o prueba social (placeholder ok para test)', group: 'Prueba social' },
  { label: 'Datos de contacto o soporte visibles', group: 'Soporte' },
];

const GOOGLE_MERCHANT_CHECKLIST: CheckItem[] = [
  { label: 'Título de producto optimizado (< 150 caracteres, keyword incluida)', group: 'Google/Feed' },
  { label: 'Descripción con atributos relevantes', group: 'Google/Feed' },
  { label: 'Categoría de producto definida', group: 'Google/Feed' },
  { label: 'Imágenes >= 800x800px, fondo blanco o neutro', group: 'Google/Feed' },
  { label: 'Precio consistente entre feed y landing', group: 'Google/Feed' },
  { label: 'Disponibilidad explícita (in stock)', group: 'Google/Feed' },
  { label: 'SKU o ID de producto único', group: 'Google/Feed' },
];

const MOBILE_CHECKLIST: CheckItem[] = [
  { label: 'CTA visible sin hacer scroll en móvil', group: 'Mobile' },
  { label: 'Imágenes optimizadas para carga rápida', group: 'Mobile' },
  { label: 'Formulario de checkout en < 3 pasos', group: 'Mobile' },
  { label: 'Tipografía legible a 16px mínimo', group: 'Mobile' },
  { label: 'Secciones colapsables (FAQs accordion)', group: 'Mobile' },
];

const PAGE_BLOCKS = [
  'Hero (headline + imagen + CTA)',
  'Problema / Por qué existe',
  'Solución / Cómo funciona',
  'Beneficios clave (3-5 bullets)',
  'Prueba visual / Demo',
  'Prueba social / Testimonios',
  'Comparativa vs alternativas',
  'Especificaciones del producto',
  'Bundle / Oferta',
  'Envío y devoluciones',
  'FAQ',
  'CTA final',
];

function CheckGroup({ title, items, checked, onToggle }: {
  title: string;
  items: CheckItem[];
  checked: boolean[];
  onToggle: (i: number) => void;
}) {
  const done = checked.filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30">{title}</div>
        <span className="text-[9px] font-mono" style={{ color: done === items.length ? '#4ADE80' : 'rgba(255,255,255,0.3)' }}>
          {done}/{items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <label key={i} className="flex items-start gap-2.5 cursor-pointer">
            <button
              onClick={() => onToggle(i)}
              className="w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all"
              style={{
                borderColor: checked[i] ? '#4ADE80' : 'rgba(255,255,255,0.18)',
                background: checked[i] ? 'rgba(74,222,128,0.15)' : 'transparent',
              }}
            >
              {checked[i] && <span className="text-[8px]" style={{ color: '#4ADE80' }}>✓</span>}
            </button>
            <span className="text-sm leading-relaxed" style={{ color: checked[i] ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.72)' }}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function LandingTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const sl = data.storeLanding;
  const decision = edits.tabDecisions.landing ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('landing', data, edits);

  const [trustChecked, setTrustChecked] = useState<boolean[]>(TRUST_CHECKLIST.map(() => false));
  const [merchantChecked, setMerchantChecked] = useState<boolean[]>(GOOGLE_MERCHANT_CHECKLIST.map(() => false));
  const [mobileChecked, setMobileChecked] = useState<boolean[]>(MOBILE_CHECKLIST.map(() => false));

  function toggle(arr: boolean[], setArr: (v: boolean[]) => void, i: number) {
    const n = [...arr];
    n[i] = !n[i];
    setArr(n);
  }

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, landing: d }, lastUpdated: new Date().toISOString() });
  }

  function setLandingNotes(v: string) {
    onEditsChange({ ...edits, landingNotes: v, lastUpdated: new Date().toISOString() });
  }

  const headlineCopyBlock = [
    `HEADLINE: ${sl.headline}`,
    `SUBHEADLINE: ${sl.subheadline}`,
    `HERO COPY: ${sl.heroCopy}`,
    `CTA: ${sl.cta}`,
  ].join('\n');

  const benefitsCopy = sl.benefits.filter(Boolean).map(b => `• ${b}`).join('\n');
  const faqCopy = sl.objectionsFAQ.filter(f => f.q).map(f => `P: ${f.q}\nR: ${f.a}`).join('\n\n');

  const totalChecks = trustChecked.length + merchantChecked.length + mobileChecked.length;
  const doneChecks = [...trustChecked, ...merchantChecked, ...mobileChecked].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        number="07"
        title="Landing / Página de Producto"
        sub="Blueprint completo para la página de producto de lanzamiento. Copy, estructura, trust y merchant readiness."
      />

      {/* Checklist progress */}
      <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-40">Completitud del checklist</span>
          <span className="text-sm font-mono" style={{ color: doneChecks === totalChecks ? '#4ADE80' : '#FACC15' }}>
            {doneChecks}/{totalChecks}
          </span>
        </div>
        <div className="w-32 h-1.5 rounded-full bg-bg-3 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${(doneChecks / totalChecks) * 100}%`, background: doneChecks === totalChecks ? '#4ADE80' : '#FACC15' }} />
        </div>
      </div>

      {/* Above the fold builder */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Above the fold — builder</div>
          <CopyButton text={headlineCopyBlock} label="Copiar copy" />
        </div>
        <div className="grid sm:grid-cols-2 gap-0">
          <InfoRow label="Headline" value={sl.headline} />
          <InfoRow label="Subheadline" value={sl.subheadline} />
          <InfoRow label="Hero copy" value={sl.heroCopy} />
          <InfoRow label="CTA principal" value={sl.cta} />
        </div>
        <div className="mt-2 pt-3 border-t border-border-soft">
          <div className="text-[10px] font-mono text-text-30 mb-1">Primera objeción a manejar above the fold</div>
          <p className="text-xs text-text-50">{data.positioning.objectionsToOvercome[0] ?? 'Definir con datos de clientes'}</p>
        </div>
      </Card>

      {/* Page structure */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Estructura de página recomendada</div>
        <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {(sl.blockOrder.length > 0 ? sl.blockOrder : PAGE_BLOCKS).filter(Boolean).map((block, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="text-[10px] font-mono text-text-20 shrink-0 mt-0.5 w-4">{i + 1}.</span>
              <span className="text-sm text-text-60">{block}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Copy-ready blocks */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Beneficios clave</div>
            <CopyButton text={benefitsCopy} />
          </div>
          <ul className="space-y-2">
            {sl.benefits.filter(Boolean).map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-70">
                <span className="shrink-0 mt-0.5 text-text-20">·</span>
                {b}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Problema / Solución</div>
          <InfoRow label="Declaración del problema" value={sl.problemStatement} />
          <InfoRow label="Declaración de la solución" value={sl.solutionStatement} />
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Cómo funciona</div>
        <ol className="space-y-2">
          {sl.howItWorks.filter(Boolean).map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="w-5 h-5 rounded-full border border-border-soft flex items-center justify-center text-[9px] font-mono text-text-30 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-text-70">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* FAQ */}
      {sl.objectionsFAQ.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">FAQ / Objeciones</div>
            <CopyButton text={faqCopy} label="Copiar FAQ" />
          </div>
          <div className="space-y-3">
            {sl.objectionsFAQ.filter(f => f.q).map((f, i) => (
              <div key={i} className="border-b border-border-soft last:border-0 pb-3 last:pb-0">
                <p className="text-sm font-medium text-text-80 mb-1">P: {f.q}</p>
                <p className="text-sm text-text-50 leading-relaxed">R: {f.a}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Copy-ready: descriptions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Descripción corta</div>
            {sl.shortDescription && <CopyButton text={sl.shortDescription} />}
          </div>
          {sl.shortDescription ? (
            <p className="text-sm text-text-70 leading-relaxed">{sl.shortDescription}</p>
          ) : (
            <p className="text-xs text-text-30">No generada — completar manualmente</p>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Descripción larga</div>
            {sl.longDescription && <CopyButton text={sl.longDescription} />}
          </div>
          {sl.longDescription ? (
            <p className="text-sm text-text-70 leading-relaxed">{sl.longDescription}</p>
          ) : (
            <p className="text-xs text-text-30">No generada — completar manualmente</p>
          )}
        </Card>
      </div>

      {/* Checklists */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CheckGroup
            title="Trust checklist"
            items={TRUST_CHECKLIST}
            checked={trustChecked}
            onToggle={i => toggle(trustChecked, setTrustChecked, i)}
          />
        </Card>
        <Card>
          <CheckGroup
            title="Google Merchant / Feed"
            items={GOOGLE_MERCHANT_CHECKLIST}
            checked={merchantChecked}
            onToggle={i => toggle(merchantChecked, setMerchantChecked, i)}
          />
        </Card>
        <Card>
          <CheckGroup
            title="Mobile-first"
            items={MOBILE_CHECKLIST}
            checked={mobileChecked}
            onToggle={i => toggle(mobileChecked, setMobileChecked, i)}
          />
        </Card>
      </div>

      {/* User notes */}
      <Card>
        <EditableTextarea
          label="Notas y decisiones sobre la landing"
          value={edits.landingNotes}
          onChange={setLandingNotes}
          placeholder="Ej: Usar tienda Shopify ya existente. Imagen hero será foto propia al recibir muestra. Checkout en 2 pasos."
          rows={3}
        />
      </Card>

      <DecisionCheckpoint
        tabId="landing"
        status={decision.status}
        note={decision.note}
        nextAction="Completar el trust checklist antes de lanzar pauta — una landing incompleta destruye el CAC"
        nextTabLabel="Validación"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
