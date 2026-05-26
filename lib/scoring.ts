/**
 * E-Test · Motor de scoring determinístico
 * ----------------------------------------------------------------------------
 * Toda la matemática de validación vive acá. NO usa IA: es lógica pura sobre
 * los inputs del usuario. Esto garantiza consistencia y velocidad — el mismo
 * producto siempre da el mismo score, y el cálculo es instantáneo y gratis.
 *
 * Filosofía (de la conversación con el growth operator):
 *   - Filtro 1 (¿Existe el negocio?): margen, demanda, competencia.
 *   - Filtro 2 (¿Se puede vender con pauta?): potencial publicitario, wow, oferta.
 *   - Filtro 3 (¿Vale la pena?): branding, riesgos, escalabilidad.
 *
 * El GATE DE MARGEN corre primero y es eliminatorio: si no pasa el múltiplo
 * mínimo, el producto muere acá sin gastar un token de IA.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Verdict = 'kill' | 'maybe' | 'go';

export interface MarginInput {
  /** Costo del producto puesto (FOB o unitario) en la moneda de venta */
  unitCost: number;
  /** Costo de envío/importación por unidad */
  shippingCost: number;
  /** Fees de plataforma/pasarela por unidad (estimado) */
  fees: number;
  /** Precio de venta objetivo al consumidor */
  sellPrice: number;
}

export interface MarginResult {
  totalCost: number;
  grossProfit: number;
  /** Múltiplo precio/costo. Ej: 3.0 = precio es 3x el costo total */
  multiple: number;
  /** Margen sobre precio de venta, 0–1 */
  marginPct: number;
  /** ¿Pasa el gate mínimo? */
  passesGate: boolean;
  /** Mensaje legible del resultado del gate */
  gateMessage: string;
}

/** Las 12 dimensiones del framework, puntuadas 1–5 por el usuario/IA */
export interface DimensionScores {
  // Filtro 1 — ¿Existe el negocio?
  demand: number;
  competition: number; // ojo: se invierte (mucha competencia mediocre = oportunidad)
  // Filtro 2 — ¿Se puede vender con pauta?
  adPotential: number;
  wowFactor: number;
  offerStrength: number;
  // Filtro 3 — ¿Vale la pena?
  branding: number;
  risks: number; // se invierte (más riesgo = peor)
  scalability: number;
  seasonality: number; // timing: ¿la tendencia está en alza o ya pasó el pico?
  logistics: number; // se invierte: complejidad logística (peso, fragilidad, aduana)
  ltv: number; // potencial de recompra / lifetime value
}

export interface ScoreResult {
  /** Score base 0–100 (solo dimensiones del producto) */
  score: number;
  /** Score ajustado después de penalización por datos faltantes */
  adjustedScore: number;
  /** Penalización aplicada por falta de datos de mercado */
  dataPenalty: number;
  /** Confianza del análisis según disponibilidad de fuentes */
  confidence: 'high' | 'medium' | 'low';
  confidenceLabel: string;
  verdict: Verdict;
  /** Desglose por filtro, 0–100 cada uno */
  filters: {
    business: number;
    sellability: number;
    worthwhile: number;
  };
  /** Contribución ponderada de cada dimensión, para mostrar en UI */
  breakdown: { key: keyof DimensionScores; label: string; weighted: number; raw: number }[];
  /** Razón corta del veredicto */
  reason: string;
}

// ---------------------------------------------------------------------------
// Configuración del gate de margen
// ---------------------------------------------------------------------------

/** Múltiplo mínimo precio/costo para que un producto sea viable con pauta. */
export const MIN_MARGIN_MULTIPLE = 3.0;

/** Múltiplo cómodo — por encima de esto el margen es saludable. */
export const HEALTHY_MARGIN_MULTIPLE = 3.5;

// ---------------------------------------------------------------------------
// Pesos de las dimensiones
// Margen y potencial publicitario pesan doble: son los que más predicen el
// resultado real según el framework.
// ---------------------------------------------------------------------------

const WEIGHTS: Record<keyof DimensionScores, number> = {
  demand: 2,
  competition: 1,
  adPotential: 2, // doble
  wowFactor: 1.5,
  offerStrength: 1.5,
  branding: 1,
  risks: 1,
  scalability: 1,
  seasonality: 1, // timing del mercado
  logistics: 1, // complejidad logística (invertida)
  ltv: 1.5, // recompra: clave para rentabilidad real con CAC alto
};

const LABELS: Record<keyof DimensionScores, string> = {
  demand: 'Demanda',
  competition: 'Competencia',
  adPotential: 'Potencial publicitario',
  wowFactor: 'Factor wow / viralidad',
  offerStrength: 'Fuerza de oferta',
  branding: 'Potencial de branding',
  risks: 'Riesgos',
  scalability: 'Escalabilidad',
  seasonality: 'Timing / estacionalidad',
  logistics: 'Complejidad logística',
  ltv: 'Recompra / LTV',
};

/** Dimensiones donde un valor alto del input es MALO y hay que invertir. */
const INVERTED: Partial<Record<keyof DimensionScores, boolean>> = {
  risks: true, // el usuario punta "nivel de riesgo"; más riesgo = peor score
  logistics: true, // 5 = muy complejo de importar = peor
};

// ---------------------------------------------------------------------------
// Gate de margen — corre primero, eliminatorio
// ---------------------------------------------------------------------------

export function evaluateMargin(input: MarginInput): MarginResult {
  const totalCost = round2(input.unitCost + input.shippingCost + input.fees);
  const grossProfit = round2(input.sellPrice - totalCost);
  const multiple = totalCost > 0 ? round2(input.sellPrice / totalCost) : 0;
  const marginPct = input.sellPrice > 0 ? round2(grossProfit / input.sellPrice) : 0;
  const passesGate = multiple >= MIN_MARGIN_MULTIPLE && grossProfit > 0;

  let gateMessage: string;
  if (!passesGate) {
    gateMessage =
      multiple <= 0
        ? 'Datos insuficientes para calcular el margen.'
        : `Múltiplo ${multiple}x < ${MIN_MARGIN_MULTIPLE}x mínimo. La pauta se come la ganancia. Descartar.`;
  } else if (multiple >= HEALTHY_MARGIN_MULTIPLE) {
    gateMessage = `Múltiplo ${multiple}x — margen saludable. Pasa el gate.`;
  } else {
    gateMessage = `Múltiplo ${multiple}x — pasa justo. Margen ajustado, validar con cuidado.`;
  }

  return { totalCost, grossProfit, multiple, marginPct, passesGate, gateMessage };
}

// ---------------------------------------------------------------------------
// Scoring de las 9 dimensiones
// ---------------------------------------------------------------------------

export function computeScore(
  dims: DimensionScores,
  margin: MarginResult,
  opts: { dataPenalty?: number; confidence?: 'high' | 'medium' | 'low'; confidenceLabel?: string } = {},
): ScoreResult {
  const { dataPenalty = 0, confidence = 'high', confidenceLabel = 'Alta' } = opts;

  if (!margin.passesGate) {
    return {
      score: 0,
      adjustedScore: 0,
      dataPenalty,
      confidence,
      confidenceLabel,
      verdict: 'kill',
      filters: { business: 0, sellability: 0, worthwhile: 0 },
      breakdown: [],
      reason: margin.gateMessage,
    };
  }

  const breakdown = (Object.keys(WEIGHTS) as (keyof DimensionScores)[]).map((key) => {
    const raw = clamp(dims[key], 1, 5);
    const effective = INVERTED[key] ? 6 - raw : raw; // invertir si corresponde
    const weighted = effective * WEIGHTS[key];
    return { key, label: LABELS[key], weighted: round2(weighted), raw };
  });

  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const maxPossible = totalWeight * 5;
  const rawSum = breakdown.reduce((a, b) => a + b.weighted, 0);
  let score = Math.round((rawSum / maxPossible) * 100);

  if (margin.multiple >= HEALTHY_MARGIN_MULTIPLE) score = Math.min(100, score + 3);

  const adjustedScore = Math.max(0, score - dataPenalty);

  const filters = {
    business: filterScore(breakdown, ['demand', 'competition']),
    sellability: filterScore(breakdown, ['adPotential', 'wowFactor', 'offerStrength']),
    worthwhile: filterScore(breakdown, [
      'branding',
      'risks',
      'scalability',
      'seasonality',
      'logistics',
      'ltv',
    ]),
  };

  const verdict = verdictFromScore(adjustedScore, dims, margin);
  const reason = reasonFor(verdict, adjustedScore, dims, margin, filters, confidence);

  return { score, adjustedScore, dataPenalty, confidence, confidenceLabel, verdict, filters, breakdown, reason };
}

// ---------------------------------------------------------------------------
// Veredicto
// ---------------------------------------------------------------------------

function verdictFromScore(score: number, dims: DimensionScores, margin: MarginResult): Verdict {
  // Reglas duras que vetan un buen score:
  // - Sin potencial publicitario no escala con pauta, por más que el resto brille.
  if (dims.adPotential <= 1) return 'kill';
  // - Demanda inexistente = no hay mercado.
  if (dims.demand <= 1) return 'kill';

  if (score >= 70) return 'go';
  if (score >= 50) return 'maybe';
  return 'kill';
}

function reasonFor(
  verdict: Verdict,
  score: number,
  dims: DimensionScores,
  margin: MarginResult,
  filters: ScoreResult['filters'],
  confidence: 'high' | 'medium' | 'low',
): string {
  const lowConfidenceSuffix =
    confidence === 'low'
      ? ' Análisis preliminar con baja confianza — requiere validación manual o test publicitario antes de comprometer capital.'
      : confidence === 'medium'
      ? ' Confianza media: algunos datos de mercado no estuvieron disponibles.'
      : '';

  if (verdict === 'go') {
    return `Score ${score}/100 con margen ${margin.multiple}x. Producto fuerte: avanzar a test real con pauta de bajo presupuesto y múltiples ángulos antes de comprar stock.${lowConfidenceSuffix}`;
  }
  if (verdict === 'maybe') {
    const weakest = Object.entries(filters).sort((a, b) => a[1] - b[1])[0][0];
    const map: Record<string, string> = {
      business: 'la base del negocio (demanda/competencia)',
      sellability: 'la capacidad de venderlo con pauta',
      worthwhile: 'el potencial de marca/escala',
    };
    return `Score ${score}/100. Dudoso: el punto débil es ${map[weakest]}. Necesita un test acotado para decidir, no comprometer capital todavía.${lowConfidenceSuffix}`;
  }
  if (dims.adPotential <= 1) {
    return `Descartar: sin "momento demo" claro, los creativos van a sufrir y el CAC se dispara.${lowConfidenceSuffix}`;
  }
  if (dims.demand <= 1) {
    return `Descartar: no hay demanda existente. Tendrías que educar el mercado, lo que es caro y lento.${lowConfidenceSuffix}`;
  }
  return `Score ${score}/100 < 50. No justifica el esfuerzo frente a otras opciones. Descartar y seguir.${lowConfidenceSuffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterScore(
  breakdown: ScoreResult['breakdown'],
  keys: (keyof DimensionScores)[],
): number {
  const items = breakdown.filter((b) => keys.includes(b.key));
  const weight = items.reduce((a, b) => a + WEIGHTS[b.key], 0);
  const max = weight * 5;
  const sum = items.reduce((a, b) => a + b.weighted, 0);
  return max > 0 ? Math.round((sum / max) * 100) : 0;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const DIMENSION_META = (Object.keys(WEIGHTS) as (keyof DimensionScores)[]).map((key) => ({
  key,
  label: LABELS[key],
  weight: WEIGHTS[key],
  inverted: !!INVERTED[key],
}));
