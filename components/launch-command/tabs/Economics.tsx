'use client';

import { useMemo } from 'react';
import { Card, SectionHeader, OutputRow, NumberInput, DecisionCheckpoint, CopyButton } from '../ui';
import { calculateEconomics, fmt, fmtPct, extractFirstNumber, canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, EconomicsInputs, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

function HealthBadge({ health }: { health: 'healthy' | 'tight' | 'dangerous' }) {
  const map = {
    healthy:   { label: 'Saludable',  color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
    tight:     { label: 'Ajustada',   color: '#FACC15', bg: 'rgba(250,204,21,0.1)' },
    dangerous: { label: 'En riesgo',  color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
  };
  const { label, color, bg } = map[health];
  return (
    <span className="text-sm font-mono uppercase tracking-[0.1em] px-3 py-1 rounded-full" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

type InputKey = keyof EconomicsInputs;

export default function EconomicsTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const ue = data.unitEconomics;
  const ec = edits.economicsInputs;
  const decision = edits.tabDecisions.economia ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('economia', data, edits);

  // Pre-populate from AI data on first open (only if field is missing)
  const inputs: Partial<EconomicsInputs> = {
    processorFeePct: 0.03,
    platformFeePct: 0.05,
    returnsAllowancePct: 0.05,
    damagedAllowancePct: 0.02,
    ...ec,
  };

  // Lazy hints from AI text fields
  const aiHints = useMemo(() => ({
    sellingPrice: extractFirstNumber(ue.suggestedRetailPrice) || 0,
    fobCost: extractFirstNumber(ue.estimatedLandedCost) || 0,
  }), [ue]);

  const econ = useMemo(() => calculateEconomics(inputs), [inputs]);

  function setInput(key: InputKey, value: number) {
    onEditsChange({
      ...edits,
      economicsInputs: { ...ec, [key]: value },
      lastUpdated: new Date().toISOString(),
    });
  }

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, economia: d }, lastUpdated: new Date().toISOString() });
  }

  const summaryText = econ
    ? [
        `Costo aterrizado: ${fmt(econ.landedCost)}`,
        `Margen bruto: ${fmt(econ.grossMargin)} (${fmtPct(econ.grossMarginPct)})`,
        `Margen de contribución: ${fmt(econ.contributionMargin)}`,
        `Break-even CAC: ${fmt(econ.breakEvenCAC)}`,
        `CAC máximo para ganancia: ${fmt(econ.maxCACForProfit)}`,
        `ROAS necesario: ${econ.roasNeeded.toFixed(1)}x`,
      ].join('\n')
    : 'Completar inputs para generar el análisis.';

  const healthColor = econ
    ? econ.health === 'healthy' ? '#4ADE80' : econ.health === 'tight' ? '#FACC15' : '#F87171'
    : 'rgba(255,255,255,0.3)';

  return (
    <div className="space-y-4">
      <SectionHeader
        number="03"
        title="Economía de la Unidad"
        sub="Calculadora real de márgenes. Decide si la economía puede sobrevivir tráfico pagado."
      />

      {/* Status strip */}
      {econ ? (
        <div className="rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: `${healthColor}28`, background: `${healthColor}07` }}>
          <div className="flex items-center gap-3">
            <HealthBadge health={econ.health} />
            <span className="text-xs text-text-40">
              {econ.health === 'healthy' && 'Los números resisten pauta pagada.'}
              {econ.health === 'tight' && 'Margen ajustado — el CAC real es crítico.'}
              {econ.health === 'dangerous' && 'Economía en riesgo — revisar precio o costos antes de pauta.'}
            </span>
          </div>
          <CopyButton text={summaryText} label="Copiar resumen" />
        </div>
      ) : (
        <div className="rounded-xl border border-border-soft bg-bg-2 px-4 py-3 text-sm text-text-40">
          Ingresá el costo FOB y el precio de venta para activar la calculadora.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Inputs — Costs */}
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-4">Costos</div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Costo FOB"
              value={inputs.fobCost ?? ''}
              onChange={v => setInput('fobCost', v)}
              prefix="$"
              suffix="USD"
              placeholder={aiHints.fobCost ? String(aiHints.fobCost) : '0'}
              hint="Precio proveedor por unidad"
            />
            <NumberInput
              label="MOQ"
              value={inputs.moq ?? ''}
              onChange={v => setInput('moq', v)}
              suffix="uds"
              hint="Pedido mínimo"
            />
            <NumberInput
              label="Flete por unidad"
              value={inputs.freightPerUnit ?? ''}
              onChange={v => setInput('freightPerUnit', v)}
              prefix="$"
              suffix="USD"
              hint="Estimación"
            />
            <NumberInput
              label="Aduanas / impuestos"
              value={inputs.importDutiesPct !== undefined ? inputs.importDutiesPct * 100 : ''}
              onChange={v => setInput('importDutiesPct', v / 100)}
              suffix="%"
              hint="% del valor FOB"
            />
            <NumberInput
              label="Packaging"
              value={inputs.packagingCost ?? ''}
              onChange={v => setInput('packagingCost', v)}
              prefix="$"
              suffix="USD"
              hint="Por unidad"
            />
          </div>
        </Card>

        {/* Inputs — Revenue + variable */}
        <Card>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-4">Precio y variables</div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Precio de venta"
              value={inputs.sellingPrice ?? ''}
              onChange={v => setInput('sellingPrice', v)}
              prefix="$"
              hint={aiHints.sellingPrice ? `Sugerido: $${aiHints.sellingPrice}` : undefined}
            />
            <NumberInput
              label="Precio con descuento"
              value={inputs.discountPrice ?? ''}
              onChange={v => setInput('discountPrice', v)}
              prefix="$"
              hint="Precio de lanzamiento"
            />
            <NumberInput
              label="Fee procesador"
              value={inputs.processorFeePct !== undefined ? inputs.processorFeePct * 100 : 3}
              onChange={v => setInput('processorFeePct', v / 100)}
              suffix="%"
              hint="Default 3%"
            />
            <NumberInput
              label="Fee plataforma"
              value={inputs.platformFeePct !== undefined ? inputs.platformFeePct * 100 : 5}
              onChange={v => setInput('platformFeePct', v / 100)}
              suffix="%"
              hint="Default 5%"
            />
            <NumberInput
              label="Fulfillment"
              value={inputs.fulfillmentCost ?? ''}
              onChange={v => setInput('fulfillmentCost', v)}
              prefix="$"
              hint="Envío subsidiado"
            />
            <NumberInput
              label="Devoluciones"
              value={inputs.returnsAllowancePct !== undefined ? inputs.returnsAllowancePct * 100 : 5}
              onChange={v => setInput('returnsAllowancePct', v / 100)}
              suffix="%"
              hint="% estimado"
            />
          </div>
        </Card>
      </div>

      {/* Marketing inputs */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-4">Parámetros de pauta</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumberInput
            label="CAC esperado"
            value={inputs.expectedCAC ?? ''}
            onChange={v => setInput('expectedCAC', v)}
            prefix="$"
            suffix="USD"
            hint="Costo por adquisición estimado"
          />
          <NumberInput
            label="Presupuesto mensual"
            value={inputs.monthlyMarketingBudget ?? ''}
            onChange={v => setInput('monthlyMarketingBudget', v)}
            prefix="$"
            suffix="USD"
            hint="Budget de test"
          />
          <NumberInput
            label="Unidades dañadas"
            value={inputs.damagedAllowancePct !== undefined ? inputs.damagedAllowancePct * 100 : 2}
            onChange={v => setInput('damagedAllowancePct', v / 100)}
            suffix="%"
            hint="Default 2%"
          />
        </div>
      </Card>

      {/* Outputs */}
      {econ && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Costos calculados</div>
              <OutputRow label="Costo aterrizado" value={fmt(econ.landedCost)} sub="FOB + flete + aduanas + packaging" />
              <OutputRow label="Margen bruto" value={`${fmt(econ.grossMargin)} · ${fmtPct(econ.grossMarginPct)}`} highlight={econ.grossMarginPct >= 0.55} danger={econ.grossMarginPct < 0.4} />
              <OutputRow label="Costos variables" value={fmt(econ.variableCosts)} sub="Fees + fulfillment + devoluciones" />
              <OutputRow label="Margen de contribución" value={fmt(econ.contributionMargin)} highlight={econ.contributionMargin > 0} danger={econ.contributionMargin <= 0} />
            </Card>
            <Card>
              <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Pauta y rentabilidad</div>
              <OutputRow label="Break-even CAC" value={fmt(econ.breakEvenCAC)} sub="Gasta esto y empatas" />
              <OutputRow label="CAC máximo rentable" value={fmt(econ.maxCACForProfit)} highlight sub="70% del margen de contribución" />
              <OutputRow label="ROAS necesario" value={`${econ.roasNeeded.toFixed(1)}x`} highlight={econ.roasNeeded < 3} danger={econ.roasNeeded > 5} />
              <OutputRow label="Unidades para cubrir budget" value={econ.unitsToBreakEvenOnBudget > 0 ? Math.ceil(econ.unitsToBreakEvenOnBudget).toString() : '-'} sub="Con el presupuesto mensual" />
            </Card>
          </div>

          {/* Sensitivity */}
          <Card>
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Análisis de sensibilidad</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                {
                  label: 'Si CAC sube 20%',
                  value: fmt(econ.sensitivityCACUp20Cm),
                  ok: econ.sensitivityCACUp20Cm > 0,
                  sub: 'Margen de contribución resultante',
                },
                {
                  label: 'Si precio baja 15%',
                  value: fmt(econ.sensitivityPriceDown15Gm),
                  ok: econ.sensitivityPriceDown15Gm > 0,
                  sub: 'Nuevo margen bruto',
                },
                {
                  label: 'Si costo sube 10%',
                  value: fmt(econ.sensitivityCostUp10Lc),
                  ok: true,
                  sub: 'Nuevo costo aterrizado',
                },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border-soft bg-bg-3/40 p-3">
                  <div className="text-[10px] font-mono text-text-30 mb-1.5">{s.label}</div>
                  <div className="font-display text-xl tabular-nums" style={{ color: s.ok ? '#FACC15' : '#F87171' }}>{s.value}</div>
                  <div className="text-[9px] font-mono text-text-20 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Price recommendations */}
          <Card>
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-3">Recomendaciones de precio</div>
            <OutputRow label="Precio piso sugerido" value={fmt(econ.suggestedPriceFloor)} sub="Mínimo para operar (1.5x costo aterrizado)" />
            <OutputRow label="Oferta IA" value={ue.recommendedOffer} />
            <OutputRow label="Límite de descuento" value={ue.discountLimit} danger />
            <OutputRow label="Idea de bundle" value={ue.bundleIdea} />
          </Card>

          {/* What must be true */}
          <div
            className="rounded-xl border px-4 py-3"
            style={{ borderColor: 'rgba(184,255,92,0.15)', background: 'rgba(184,255,92,0.04)' }}
          >
            <div className="text-[10px] uppercase tracking-[0.12em] font-mono mb-2" style={{ color: '#B8FF5C' }}>¿Qué debe ser verdad para que esto funcione?</div>
            <ul className="space-y-1.5">
              {[
                `El CAC real debe ser < ${fmt(econ.maxCACForProfit)} para generar ganancia`,
                `El precio de venta debe mantenerse por encima de ${fmt(econ.suggestedPriceFloor)}`,
                `La tasa de devolución real no debe superar el estimado (${fmtPct((inputs.returnsAllowancePct ?? 0.05))})`,
                `El costo FOB debe estar confirmado por el proveedor — no estimado`,
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: '#B8FF5C' }}>
                  <span className="shrink-0 mt-0.5 text-[10px]" style={{ color: 'rgba(184,255,92,0.4)' }}>→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <DecisionCheckpoint
        tabId="economia"
        status={decision.status}
        note={decision.note}
        nextAction={
          econ?.health === 'dangerous'
            ? 'Revisar precio o negociar costo antes de continuar — los números no cierran con pauta'
            : econ?.health === 'tight'
            ? 'Negociar con proveedor para bajar costo o subir precio de lanzamiento'
            : 'Economía aprobada → continuar con posicionamiento'
        }
        nextTabLabel="Posicionamiento"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
