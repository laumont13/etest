// ─────────────────────────────────────────────────────────
// Launch Command — Helpers
// ─────────────────────────────────────────────────────────

import type {
  EconomicsInputs, UserEdits, SectionId, LaunchCommandData,
  ChecklistState, TabStatus,
} from './types';
import { VALIDATION_GATES, REQUIRED_TABS, TAB_ORDER } from './types';

// ─── Economics ────────────────────────────────────────────

export interface EconomicsOutputs {
  landedCost: number;
  grossMargin: number;
  grossMarginPct: number;
  variableCosts: number;
  contributionMargin: number;
  breakEvenCAC: number;
  maxCACForProfit: number;
  roasNeeded: number;
  unitsToBreakEvenOnBudget: number;
  suggestedPriceFloor: number;
  health: 'healthy' | 'tight' | 'dangerous';
  sensitivityCACUp20Cm: number;
  sensitivityPriceDown15Gm: number;
  sensitivityCostUp10Lc: number;
}

export function calculateEconomics(inputs: Partial<EconomicsInputs>): EconomicsOutputs | null {
  const {
    fobCost = 0, freightPerUnit = 0, importDutiesPct = 0, packagingCost = 0,
    processorFeePct = 0.03, platformFeePct = 0.05, fulfillmentCost = 0,
    returnsAllowancePct = 0.05, damagedAllowancePct = 0.02,
    sellingPrice = 0, expectedCAC = 0, monthlyMarketingBudget = 0,
  } = inputs;

  if (!sellingPrice || !fobCost) return null;

  const landedCost = fobCost + freightPerUnit + fobCost * importDutiesPct + packagingCost;
  const grossMargin = sellingPrice - landedCost;
  const grossMarginPct = sellingPrice > 0 ? grossMargin / sellingPrice : 0;
  const variableCosts =
    (processorFeePct + platformFeePct) * sellingPrice + fulfillmentCost +
    returnsAllowancePct * sellingPrice + damagedAllowancePct * landedCost;
  const contributionMargin = grossMargin - variableCosts;
  const breakEvenCAC = Math.max(0, contributionMargin);
  const maxCACForProfit = Math.max(0, contributionMargin * 0.7);
  const roasNeeded = maxCACForProfit > 0 ? sellingPrice / maxCACForProfit : 0;
  const unitsToBreakEvenOnBudget = maxCACForProfit > 0 ? monthlyMarketingBudget / maxCACForProfit : 0;
  const suggestedPriceFloor = landedCost * 1.5;
  const sensitivityCACUp20Cm = contributionMargin - expectedCAC * 0.2;
  const sensitivityPriceDown15Gm = sellingPrice * 0.85 - landedCost;
  const sensitivityCostUp10Lc = landedCost * 1.1;

  let health: 'healthy' | 'tight' | 'dangerous';
  if (grossMarginPct >= 0.6 && contributionMargin > 0 && maxCACForProfit >= 8) health = 'healthy';
  else if (grossMarginPct >= 0.4 && contributionMargin > 0) health = 'tight';
  else health = 'dangerous';

  return {
    landedCost, grossMargin, grossMarginPct, variableCosts, contributionMargin,
    breakEvenCAC, maxCACForProfit, roasNeeded, unitsToBreakEvenOnBudget, suggestedPriceFloor, health,
    sensitivityCACUp20Cm, sensitivityPriceDown15Gm, sensitivityCostUp10Lc,
  };
}

// ─── Checklist ────────────────────────────────────────────

export interface ChecklistProgress {
  completed: number;
  total: number;
  blockedCount: number;
  pct: number;
  requiredDone: number;
  requiredTotal: number;
  canProceed: boolean; // all required items checked
}

export function calculateChecklistProgress(
  items: Array<{ required?: boolean }>,
  state: ChecklistState | undefined
): ChecklistProgress {
  const s = state ?? {};
  const total = items.length;
  let completed = 0;
  let requiredDone = 0;
  let requiredTotal = 0;

  items.forEach((item, i) => {
    const checked = s[String(i)] === true;
    if (checked) completed++;
    if (item.required) {
      requiredTotal++;
      if (checked) requiredDone++;
    }
  });

  return {
    completed,
    total,
    blockedCount: 0,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    requiredDone,
    requiredTotal,
    canProceed: requiredTotal === 0 || requiredDone === requiredTotal,
  };
}

// ─── Tab completion (used for overall % display) ──────────

export function calculateTabCompletion(
  data: LaunchCommandData,
  edits: UserEdits
): Record<SectionId, number> {
  const td = edits.tabDecisions;
  const ec = edits.economicsInputs;
  const ecKeys = Object.keys(ec).filter(k => (ec as Record<string, number>)[k] > 0);
  const gatesPassed = Object.values(edits.validationGates).filter(s => s === 'passed').length;

  const isReady = (id: SectionId) => td[id]?.status === 'ready';
  const isStarted = (id: SectionId) => td[id]?.status === 'in-progress' || td[id]?.status === 'blocked';

  return {
    snapshot: isReady('snapshot') ? 100 : isStarted('snapshot') ? 50 : 0,
    estrategia: isReady('estrategia') ? 100 : (edits.checkpoints.estrategia ? 60 : isStarted('estrategia') ? 30 : 0),
    economia: isReady('economia') ? 100 : ecKeys.length >= 8 ? 80 : ecKeys.length >= 5 ? 55 : ecKeys.length > 0 ? 25 : 0,
    posicionamiento: isReady('posicionamiento') ? 100 : (edits.chosenPositioningNote ? 60 : isStarted('posicionamiento') ? 30 : 0),
    angulos: isReady('angulos') ? 100 : edits.selectedAngles.length >= 3 ? 80 : Math.round(edits.selectedAngles.length * 26),
    creativos: isReady('creativos') ? 100 : isStarted('creativos') ? 50 : edits.selectedAngles.length > 0 ? 20 : 0,
    landing: isReady('landing') ? 100 : (edits.landingNotes ? 55 : isStarted('landing') ? 25 : 0),
    validacion: isReady('validacion') ? 100 : gatesPassed >= 3 ? 75 : gatesPassed >= 1 ? Math.round(gatesPassed / 7 * 100) : 0,
    plan: isReady('plan') ? 100 : isStarted('plan') ? 30 : 0,
  };
}

// ─── canMarkTabReady ──────────────────────────────────────

export function canMarkTabReady(
  id: SectionId,
  data: LaunchCommandData,
  edits: UserEdits
): { canMark: boolean; reason: string } {
  const ec = edits.economicsInputs;

  switch (id) {
    case 'snapshot':
      return { canMark: true, reason: '' };
    case 'estrategia':
      return edits.checkpoints.estrategia
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Completá el campo "El producto gana si..." para marcar como listo' };
    case 'economia':
      return ec.fobCost && ec.sellingPrice
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Ingresá el costo FOB y el precio de venta para activar la calculadora' };
    case 'posicionamiento':
      return edits.chosenPositioningNote.trim().length >= 20
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Describí la ruta de posicionamiento elegida (mínimo 20 caracteres)' };
    case 'angulos':
      return edits.selectedAngles.length >= 1
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Seleccioná al menos 1 ángulo creativo para el primer batch' };
    case 'creativos':
      return edits.selectedAngles.length >= 1
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Seleccioná ángulos en Tab 05 primero' };
    case 'landing':
      return { canMark: true, reason: '' };
    case 'validacion': {
      const hasStarted = Object.values(edits.validationGates).some(s => s && s !== 'not-started');
      return hasStarted
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: 'Avanzá al menos un gate de validación para marcar este paso como listo' };
    }
    case 'plan': {
      const requiredReady = REQUIRED_TABS.filter(t => edits.tabDecisions[t]?.status === 'ready').length;
      return requiredReady >= 3
        ? { canMark: true, reason: '' }
        : { canMark: false, reason: `Necesitás ${3 - requiredReady} paso(s) requerido(s) más marcados como Listo` };
    }
    default:
      return { canMark: true, reason: '' };
  }
}

// ─── Next available step ──────────────────────────────────

export function getNextAvailableStep(edits: UserEdits): SectionId | null {
  for (const id of TAB_ORDER) {
    if (edits.tabDecisions[id]?.status !== 'ready') return id;
  }
  return null;
}

// ─── Board completion ─────────────────────────────────────

export interface BoardCompletion {
  pct: number;
  readyTabs: number;
  totalTabs: number;
  requiredReady: number;
  requiredTotal: number;
  allRequiredReady: boolean;
}

export function getBoardCompletion(data: LaunchCommandData, edits: UserEdits): BoardCompletion {
  const readyTabs = TAB_ORDER.filter(id => edits.tabDecisions[id]?.status === 'ready').length;
  const comp = calculateTabCompletion(data, edits);
  const avg = Math.round(Object.values(comp).reduce((a, b) => a + b, 0) / TAB_ORDER.length);
  const requiredReady = REQUIRED_TABS.filter(id => edits.tabDecisions[id]?.status === 'ready').length;

  return {
    pct: avg,
    readyTabs,
    totalTabs: TAB_ORDER.length,
    requiredReady,
    requiredTotal: REQUIRED_TABS.length,
    allRequiredReady: requiredReady >= REQUIRED_TABS.length,
  };
}

// ─── Final launch conclusion ──────────────────────────────

export interface FinalConclusion {
  statusLabel: string;
  statusColor: string;
  strengths: string[];
  risks: string[];
  validated: string[];
  stillNeeded: string[];
  nextMove: string;
}

const TAB_LABELS: Record<SectionId, string> = {
  snapshot: 'Visión del producto',
  estrategia: 'Estrategia',
  economia: 'Economía validada',
  posicionamiento: 'Posicionamiento',
  angulos: 'Ángulos creativos',
  creativos: 'Creativos',
  landing: 'Landing / Página de producto',
  validacion: 'Validación',
  plan: 'Plan de ejecución',
};

export function getFinalLaunchConclusion(
  data: LaunchCommandData,
  edits: UserEdits
): FinalConclusion {
  const ec = edits.economicsInputs;
  const econ = ec.fobCost && ec.sellingPrice ? calculateEconomics(ec) : null;
  const gatesPassed = VALIDATION_GATES.filter(g => edits.validationGates[g.id] === 'passed').length;
  const requiredGatesPassed = VALIDATION_GATES.filter(g => g.required && edits.validationGates[g.id] === 'passed').length;
  const readyTabs = TAB_ORDER.filter(id => edits.tabDecisions[id]?.status === 'ready');
  const pendingTabs = TAB_ORDER.filter(id => edits.tabDecisions[id]?.status !== 'ready');

  // Status determination
  let statusLabel: string;
  let statusColor: string;

  const supplierPassed = edits.validationGates.supplier === 'passed';
  const economicsPassed = edits.tabDecisions.economia?.status === 'ready' && econ?.health !== 'dangerous';
  const creativePassed = edits.tabDecisions.angulos?.status === 'ready';
  const landingPassed = edits.tabDecisions.landing?.status === 'ready';
  const samplePassed = edits.validationGates.sample === 'passed';

  if (econ?.health === 'dangerous') {
    statusLabel = 'Bloqueado por economía';
    statusColor = '#F87171';
  } else if (!supplierPassed && !samplePassed) {
    statusLabel = 'Listo para fase de proveedor / muestra';
    statusColor = '#60A5FA';
  } else if (supplierPassed && !samplePassed) {
    statusLabel = 'Listo para solicitar muestra';
    statusColor = '#60A5FA';
  } else if (samplePassed && !creativePassed) {
    statusLabel = 'Listo para test creativo';
    statusColor = '#FACC15';
  } else if (creativePassed && !landingPassed) {
    statusLabel = 'Listo para test de landing';
    statusColor = '#B8FF5C';
  } else if (landingPassed && requiredGatesPassed >= 2) {
    statusLabel = 'Listo para pequeño lote de importación';
    statusColor = '#4ADE80';
  } else {
    statusLabel = 'Necesita más validación';
    statusColor = '#FB923C';
  }

  const strengths: string[] = [];
  if (econ && econ.health !== 'dangerous') strengths.push(`Economía ${econ.health === 'healthy' ? 'saludable' : 'ajustada'} con margen ${Math.round(econ.grossMarginPct * 100)}%`);
  if (edits.selectedAngles.length >= 3) strengths.push(`${edits.selectedAngles.length} ángulos creativos identificados`);
  if (gatesPassed >= 1) strengths.push(`${gatesPassed} de ${VALIDATION_GATES.length} gates de validación aprobados`);
  if (data.product.marginMultiple >= 4) strengths.push(`Margen de ${data.product.marginMultiple}x sobre costo`);
  if (edits.chosenPositioningNote) strengths.push('Posicionamiento definido');

  const risks: string[] = [...data.winnerSnapshot.mainRisks.slice(0, 2)];
  if (econ?.health === 'tight') risks.push('Economía ajustada — el CAC real es determinante');
  if (!samplePassed) risks.push('Sin muestra física aprobada — calidad real no confirmada');
  if (gatesPassed < 3) risks.push('Menos de la mitad de los gates de validación aprobados');

  const validated: string[] = readyTabs.map(id => TAB_LABELS[id]);
  if (gatesPassed > 0) validated.push(`${gatesPassed} gate(s) de validación`);

  const stillNeeded: string[] = pendingTabs.filter(id => id !== 'plan').map(id => TAB_LABELS[id]);
  if (!samplePassed) stillNeeded.push('Muestra física aprobada');
  if (!ec.expectedCAC) stillNeeded.push('CAC real validado con pauta');

  const nextMove = statusLabel.includes('proveedor')
    ? 'Contactar proveedor, solicitar muestra y confirmar MOQ y lead time'
    : statusLabel.includes('muestra')
    ? 'Recibir muestra, testearla y completar el gate de validación'
    : statusLabel.includes('creativo')
    ? 'Producir y lanzar primer batch de creativos con presupuesto mínimo'
    : statusLabel.includes('landing')
    ? 'Publicar la landing, configurar tracking y hacer una compra de prueba'
    : statusLabel.includes('lote')
    ? 'Pedir el primer lote pequeño (MOQ mínimo) y validar con ventas reales'
    : 'Completar los pasos pendientes antes de comprometer capital en stock';

  return { statusLabel, statusColor, strengths, risks, validated, stillNeeded, nextMove };
}

// ─── Readiness label ──────────────────────────────────────

export function getLaunchReadiness(
  data: LaunchCommandData,
  edits: UserEdits
): { status: string; label: string; color: string } {
  const ec = edits.economicsInputs;
  const econ = ec.fobCost && ec.sellingPrice ? calculateEconomics(ec) : null;
  const comp = getBoardCompletion(data, edits);

  if (econ?.health === 'dangerous') return { status: 'economics-risk', label: 'Economía en riesgo', color: '#F87171' };
  if (comp.readyTabs === 0) return { status: 'not-started', label: 'Sin iniciar', color: 'rgba(255,255,255,0.3)' };
  if (comp.readyTabs < 3) return { status: 'in-progress', label: 'En proceso', color: '#60A5FA' };
  if (comp.allRequiredReady) return { status: 'ready', label: 'Listo para concluir', color: '#4ADE80' };
  if (comp.pct >= 60) return { status: 'advanced', label: 'Avanzado', color: '#B8FF5C' };
  return { status: 'progressing', label: 'En progreso', color: '#FACC15' };
}

// ─── Missing inputs ───────────────────────────────────────

export function getMissingInputs(data: LaunchCommandData, edits: UserEdits): string[] {
  const missing: string[] = [];
  const ec = edits.economicsInputs;
  if (!ec.fobCost) missing.push('Costo FOB del producto');
  if (!ec.sellingPrice) missing.push('Precio de venta confirmado');
  if (!ec.freightPerUnit) missing.push('Flete por unidad');
  if (!ec.expectedCAC) missing.push('CAC esperado');
  if (!edits.selectedAngles.length) missing.push('Ángulos creativos seleccionados (Tab 05)');
  if (!edits.validationGates.supplier || edits.validationGates.supplier === 'not-started') missing.push('Gate de proveedor iniciado');
  if (!edits.validationGates.sample || edits.validationGates.sample === 'not-started') missing.push('Gate de muestra iniciado');
  return missing;
}

// ─── Format helpers ───────────────────────────────────────

export function fmt(n: number, currency = 'USD'): string {
  if (!isFinite(n) || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);
}

export function fmtPct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '-';
  return `${(n * 100).toFixed(1)}%`;
}

export function extractFirstNumber(s: string): number {
  const m = s.match(/[\d,.]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace(',', '.'));
}
