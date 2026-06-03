/**
 * E-Test · Cliente de Gemini
 * ----------------------------------------------------------------------------
 * Usa @google/genai con gemini-2.5-flash. La clave se lee SIEMPRE del entorno
 * (GEMINI_API_KEY) — nunca hardcodeada.
 *
 * Rol de la IA: ESTRUCTURAR EL JUICIO, no inventar datos. Recibe el contexto
 * del producto + señales reales (Google Trends, Mercado Libre, macro del país)
 * y devuelve las puntuaciones 1–5 de las 9 dimensiones en JSON, más ángulos de
 * venta. Tiene instrucción explícita de NO confabular cifras de mercado: si no
 * tiene un dato, lo marca como desconocido en vez de inventarlo.
 *
 * La matemática del score la hace lib/scoring.ts (determinística), no la IA.
 */

import { GoogleGenAI } from '@google/genai';
import type { DimensionScores } from './scoring';

// Primary: best analysis quality (20 RPD free tier)
// Fallbacks: higher quotas for when primary is rate-limited
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

export interface MarketSignals {
  /** Interés de Google Trends 0–100, o null si no se pudo obtener */
  trendsInterest: number | null;
  /** Dirección de la tendencia */
  trendDirection: 'rising' | 'stable' | 'declining' | 'unknown';
  /** Cantidad aproximada de competidores en Mercado Libre (scraping), o null */
  mlCompetitors: number | null;
  /** Rango de precios observado en ML [min, max] o null */
  mlPriceRange: [number, number] | null;
  /** Estimación de listings ML vía Google site: search */
  googleMLEstimate: number | null;
  /** Rango de precios en el país objetivo (ARS/MXN/etc) vía Google Shopping */
  argPriceRange: [number, number] | null;
  argCurrency: string | null;
  /** Precio FOB proveedor en Alibaba [min, max] USD */
  supplierPriceRangeUSD: [number, number] | null;
  /** Cantidad de proveedores en Alibaba */
  supplierCount: number | null;
  /** Mínimo de pedido (MOQ) en Alibaba */
  supplierMOQ: number | null;
  supplierMOQUnit: string | null;
  /** País objetivo (nombre) */
  country: string;
}

export interface ProductContext {
  title: string;
  description?: string;
  category?: string;
  sellPrice: number;
  totalCost: number;
  marginMultiple: number;
}

export interface GeminiAnalysis {
  dimensions: DimensionScores;
  positioning: string;
  keyRisks: string[];
  angles: { hook: string; angle: string; trigger: string }[];
  dataGaps: string[]; // qué datos faltaron — transparencia, en vez de inventar
}

/** Resultado del paso de limpieza: término canónico para buscar en APIs */
export interface SearchTermResult {
  /** Término corto, corregido y canónico para Mercado Libre / Trends */
  searchTerm: string;
  /** Categoría inferida del producto */
  category: string;
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en el entorno.');
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const SYSTEM_INSTRUCTION = `Sos un growth operator de ecommerce de élite analizando un producto para importar y vender con Meta Ads en LATAM/España.

REGLA CRÍTICA: NO inventés datos de mercado. Si no tenés una cifra (volumen de búsqueda, número de competidores, precios), NO la inventes — usá las señales reales que te paso y declarás explícitamente qué falta en "dataGaps". Tu trabajo es aplicar criterio experto de forma consistente, no fabricar estadísticas.

Puntuá CADA dimensión de 1 a 5 (entero), donde 5 es lo mejor para el negocio:
- demand: ¿hay demanda existente? (5 = dolor claro y buscado; 1 = nadie lo busca)
- competition: ¿la competencia valida el mercado pero es superable? (5 = competencia mediocre y batible; 1 = saturado e imposible, O cero competencia = sin demanda)
- adPotential: ¿tiene "momento demo" de 3 segundos? (5 = transformación visible obvia; 1 = imposible de mostrar)
- wowFactor: ¿la gente lo compartiría/comentaría? (5 = altamente viral; 1 = aburrido)
- offerStrength: ¿se puede construir una oferta fuerte y multi-ángulo? (5 = muchos ángulos; 1 = uno solo débil)
- branding: ¿se puede hacer premium y diferenciado? (5 = marca premium posible; 1 = solo compite por precio)
- risks: NIVEL de riesgo logístico/calidad/saturación (5 = MUY riesgoso; 1 = sin riesgos) — ojo, acá 5 es MALO
- scalability: ¿da para una marca con LTV, no un one-hit? (5 = escalable; 1 = producto único)
- seasonality: timing del mercado. ¿la tendencia está en alza o ya pasó el pico? (5 = en alza o estable todo el año; 1 = pico ya pasado o muy estacional)
- logistics: NIVEL de complejidad logística para importar (peso, volumen, fragilidad, aduana, batería) (5 = MUY complejo; 1 = simple y liviano) — ojo, acá 5 es MALO
- ltv: potencial de recompra / lifetime value (5 = consumible o con catálogo complementario; 1 = compra única sin recompra)

Devolvé SOLO un objeto JSON válido, sin markdown, sin backticks, con esta forma exacta:
{
  "dimensions": { "demand": n, "competition": n, "adPotential": n, "wowFactor": n, "offerStrength": n, "branding": n, "risks": n, "scalability": n, "seasonality": n, "logistics": n, "ltv": n },
  "positioning": "1-2 frases del mejor posicionamiento premium",
  "keyRisks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "angles": [ { "hook": "...", "angle": "...", "trigger": "dolor|deseo|identidad|urgencia|regalo" } ],
  "dataGaps": ["qué dato real faltó para una evaluación más precisa"]
}`;

/**
 * Paso 1: Gemini convierte el título crudo (posiblemente con typos o adjetivos
 * de relleno) en un término de búsqueda canónico para Mercado Libre y Trends.
 * Ej: "aefitadora portatil recargable USB" → "afeitadora portátil".
 * Es una llamada chica y rápida; corre antes de consultar las APIs externas.
 */
export async function extractSearchTerm(
  title: string,
  description?: string,
): Promise<SearchTermResult> {
  const prompt = `Producto (título crudo de Alibaba): "${title}"${
    description ? `\nDescripción: ${description.slice(0, 300)}` : ''
  }

Devolvé SOLO JSON, sin markdown:
{
  "searchTerm": "término corto y canónico para buscar en Mercado Libre (2-4 palabras, sin marca, corregí typos, en español, sin adjetivos de relleno como 'recargable USB portátil')",
  "category": "categoría del producto en 1-3 palabras"
}

Ejemplo: "aefitadora portatil recargable" → {"searchTerm":"afeitadora eléctrica","category":"cuidado personal"}`;

  try {
    const ai = getClient();
    let lastErr: unknown;
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0.1, responseMimeType: 'application/json' } });
        const clean = (response.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        const term = String(parsed.searchTerm ?? '').trim();
        return {
          searchTerm: term.length >= 2 ? term.slice(0, 60) : fallbackTerm(title),
          category: String(parsed.category ?? '').trim().slice(0, 40) || 'general',
        };
      } catch (err) {
        const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
        if (!is429) throw err;
        console.log(`[gemini] ${model} rate-limited — trying next model`);
        lastErr = err;
      }
    }
    throw lastErr;
  } catch {
    return { searchTerm: fallbackTerm(title), category: 'general' };
  }
}

/** Respaldo simple: limpia y toma las primeras palabras significativas. */
function fallbackTerm(title: string): string {
  const stop = new Set(['de', 'para', 'con', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o']);
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))
    .slice(0, 3)
    .join(' ')
    .trim() || title.slice(0, 40);
}

export async function analyzeProduct(
  product: ProductContext,
  signals: MarketSignals,
): Promise<GeminiAnalysis> {
  const ai = getClient();
  const userPrompt = buildPrompt(product, signals);

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });
      console.log(`[gemini] analyzeProduct used model=${model}`);
      return parseAnalysis(response.text ?? '');
    } catch (err) {
      const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
      if (!is429) throw err;
      console.log(`[gemini] ${model} rate-limited — trying next model`);
      lastErr = err;
    }
  }
  throw lastErr;
}

function buildPrompt(product: ProductContext, signals: MarketSignals): string {
  const lines: string[] = [];
  lines.push(`PRODUCTO: ${product.title}`);
  if (product.category) lines.push(`Categoría: ${product.category}`);
  if (product.description) lines.push(`Descripción: ${product.description.slice(0, 800)}`);
  lines.push(`Precio de venta objetivo: ${product.sellPrice}`);
  lines.push(`Costo total puesto: ${product.totalCost}`);
  lines.push(`Múltiplo de margen: ${product.marginMultiple}x (ya pasó el gate mínimo)`);
  lines.push('');
  lines.push('SEÑALES REALES DE MERCADO (usá solo esto, no inventes):');
  lines.push(`- País objetivo: ${signals.country}`);
  lines.push(`- Google Trends: ${signals.trendsInterest !== null ? `${signals.trendsInterest}/100, tendencia ${signals.trendDirection}` : 'NO DISPONIBLE'}`);
  lines.push(`- Competidores en Mercado Libre (scraping): ${signals.mlCompetitors !== null ? signals.mlCompetitors : 'NO DISPONIBLE'}`);
  if (signals.googleMLEstimate !== null) {
    lines.push(`- Estimación listings ML (vía Google site:): ~${signals.googleMLEstimate.toLocaleString()}`);
  }
  lines.push(`- Rango de precios en ML: ${signals.mlPriceRange ? `${signals.mlPriceRange[0]}–${signals.mlPriceRange[1]}` : 'NO DISPONIBLE'}`);
  lines.push(`- Precios locales vía Google Shopping (${signals.argCurrency ?? 'ARS'}): ${signals.argPriceRange ? `${signals.argPriceRange[0].toLocaleString()}–${signals.argPriceRange[1].toLocaleString()}` : 'NO DISPONIBLE'}`);
  lines.push(`- Precio proveedor Alibaba (FOB USD): ${signals.supplierPriceRangeUSD ? `$${signals.supplierPriceRangeUSD[0]}–$${signals.supplierPriceRangeUSD[1]}` : 'NO DISPONIBLE'}`);
  if (signals.supplierCount !== null) lines.push(`- Proveedores en Alibaba: ${signals.supplierCount.toLocaleString()}`);
  if (signals.supplierMOQ !== null) lines.push(`- MOQ mínimo Alibaba: ${signals.supplierMOQ} ${signals.supplierMOQUnit ?? 'unidades'}`);
  return lines.join('\n');
}

function parseAnalysis(text: string): GeminiAnalysis {
  // Defensa: limpiar posibles fences aunque pedimos JSON puro.
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Gemini no devolvió JSON válido. Reintentar.');
  }

  const d = parsed.dimensions ?? {};
  const dimensions: DimensionScores = {
    demand: int15(d.demand),
    competition: int15(d.competition),
    adPotential: int15(d.adPotential),
    wowFactor: int15(d.wowFactor),
    offerStrength: int15(d.offerStrength),
    branding: int15(d.branding),
    risks: int15(d.risks),
    scalability: int15(d.scalability),
    seasonality: int15(d.seasonality),
    logistics: int15(d.logistics),
    ltv: int15(d.ltv),
  };

  return {
    dimensions,
    positioning: String(parsed.positioning ?? '').slice(0, 400),
    keyRisks: arr(parsed.keyRisks).slice(0, 5),
    angles: arr(parsed.angles)
      .slice(0, 5)
      .map((a: any) => ({
        hook: String(a?.hook ?? '').slice(0, 160),
        angle: String(a?.angle ?? '').slice(0, 200),
        trigger: String(a?.trigger ?? '').slice(0, 40),
      })),
    dataGaps: arr(parsed.dataGaps).slice(0, 5),
  };
}

function int15(v: any): number {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return 3;
  return Math.max(1, Math.min(5, n));
}

function arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

// ---------------------------------------------------------------------------
// Battle mode — comparación IA de dos productos
// ---------------------------------------------------------------------------

export interface BattleResult {
  winner: 'A' | 'B' | 'tie';
  winnerConfidence: number;
  keyDifference: string;
  summary: string;
  recommendation: string;
  winnerByAds: 'A' | 'B' | 'tie';
  winnerBySaturation: 'A' | 'B' | 'tie';
  winnerLongTerm: 'A' | 'B' | 'tie';
  loserRisks: string[];
  smartMove: string;
  dimensionWins: Array<{
    dim: string;
    label: string;
    winner: 'A' | 'B' | 'tie';
    aScore: number;
    bScore: number;
  }>;
  aStrengths: string[];
  bStrengths: string[];
  aWeaknesses: string[];
  bWeaknesses: string[];
  /** Present only when a deterministic test fallback was used instead of real AI */
  testMode?: boolean;
  fallback?: boolean;
  fallbackReason?: string;
}

const BATTLE_DIMS = [
  { dim: 'demand', label: 'Demanda', inverted: false },
  { dim: 'adPotential', label: 'Pot. publicitario', inverted: false },
  { dim: 'wowFactor', label: 'Factor wow', inverted: false },
  { dim: 'offerStrength', label: 'Fuerza de oferta', inverted: false },
  { dim: 'risks', label: 'Riesgos', inverted: true },
  { dim: 'scalability', label: 'Escalabilidad', inverted: false },
  { dim: 'logistics', label: 'Logística', inverted: true },
  { dim: 'ltv', label: 'Recompra / LTV', inverted: false },
];

function dimRaw(data: any, dim: string): number {
  const bd: any[] = data?.result?.breakdown ?? [];
  return bd.find((b: any) => b.key === dim)?.raw ?? 3;
}

function computeDimensionWins(a: any, b: any): BattleResult['dimensionWins'] {
  return BATTLE_DIMS.map(({ dim, label, inverted }) => {
    const aRaw = dimRaw(a, dim);
    const bRaw = dimRaw(b, dim);
    const aEff = inverted ? 6 - aRaw : aRaw;
    const bEff = inverted ? 6 - bRaw : bRaw;
    const winner: 'A' | 'B' | 'tie' = aEff > bEff ? 'A' : bEff > aEff ? 'B' : 'tie';
    return { dim, label, winner, aScore: aRaw, bScore: bRaw };
  });
}

function buildBattlePrompt(a: any, b: any): string {
  const f = (v: number | null | undefined) => v != null ? String(v) : 'N/D';
  const dimStr = (data: any) =>
    (data?.result?.breakdown ?? []).map((d: any) => `${d.label}=${d.raw}`).join(', ');

  return `Comparación de dos productos para importar y vender con Meta Ads en LATAM.

PRODUCTO A: "${a.product?.title}"
Score: ${a.result?.adjustedScore ?? a.result?.score ?? 0}/100 · Veredicto: ${(a.result?.verdict ?? '').toUpperCase()} · Margen: ${a.margin?.multiple}x
Filtros: negocio=${a.result?.filters?.business}, vendibilidad=${a.result?.filters?.sellability}, escala=${a.result?.filters?.worthwhile}
Dimensiones: ${dimStr(a)}
ML: ${f(a.signals?.mlCompetitors)} competidores · Trends: ${f(a.signals?.trendsInterest)}/100 (${a.signals?.trendDirection ?? 'N/D'})
Posicionamiento: "${a.analysis?.positioning ?? ''}"
Riesgos: ${(a.analysis?.keyRisks ?? []).join('; ')}

PRODUCTO B: "${b.product?.title}"
Score: ${b.result?.adjustedScore ?? b.result?.score ?? 0}/100 · Veredicto: ${(b.result?.verdict ?? '').toUpperCase()} · Margen: ${b.margin?.multiple}x
Filtros: negocio=${b.result?.filters?.business}, vendibilidad=${b.result?.filters?.sellability}, escala=${b.result?.filters?.worthwhile}
Dimensiones: ${dimStr(b)}
ML: ${f(b.signals?.mlCompetitors)} competidores · Trends: ${f(b.signals?.trendsInterest)}/100 (${b.signals?.trendDirection ?? 'N/D'})
Posicionamiento: "${b.analysis?.positioning ?? ''}"
Riesgos: ${(b.analysis?.keyRisks ?? []).join('; ')}

Determiná el ganador con criterio real: ¿cuál tiene más chances de escalar con pauta? Priorizá adPotential, margen sostenible, y riesgo logístico bajo.

Devolvé SOLO JSON válido, sin markdown:
{
  "winner": "A" o "B" o "tie",
  "winnerConfidence": número entre 60 y 95,
  "keyDifference": "la diferencia que más importa para decidir (1 frase directa y contundente)",
  "summary": "por qué gana — 2-3 frases concretas sin jerga",
  "recommendation": "recomendación final: qué hacer exactamente ahora — 1-2 frases accionables",
  "winnerByAds": "A" o "B" o "tie" — cuál tiene mejor adPotential + margen para aguantar el CAC con pauta,
  "winnerBySaturation": "A" o "B" o "tie" — cuál enfrenta menos saturación y competidores en el mercado,
  "winnerLongTerm": "A" o "B" o "tie" — cuál tiene más potencial de LTV, escalabilidad y construcción de marca,
  "loserRisks": ["por qué el perdedor es riesgoso — max 3 puntos concretos"],
  "smartMove": "qué haría exactamente un ecommerce inteligente con ambos productos — 1-2 frases accionables",
  "aStrengths": ["max 3 fortalezas reales de A"],
  "bStrengths": ["max 3 fortalezas reales de B"],
  "aWeaknesses": ["max 2 debilidades reales de A"],
  "bWeaknesses": ["max 2 debilidades reales de B"]
}`;
}

const BATTLE_SYSTEM = `Sos un growth operator de ecommerce de élite. Cuando comparás productos aplicás criterio real: margen que aguante el CAC con pauta, "momento demo" en 3 segundos para el creativo, competencia batible. No te quedás solo con el score numérico — analizás qué producto tiene más posibilidades reales en el mercado objetivo. Devolvés SOLO JSON válido.`;

export async function battleProducts(a: any, b: any): Promise<BattleResult> {
  const ai = getClient();
  const prompt = buildBattlePrompt(a, b);
  const dimensionWins = computeDimensionWins(a, b);

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: BATTLE_SYSTEM, temperature: 0.3, responseMimeType: 'application/json' },
      });
      console.log(`[gemini] battleProducts used model=${model}`);
      const text = response.text ?? '';
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);

      const validWinner = (v: any): 'A' | 'B' | 'tie' =>
        ['A', 'B', 'tie'].includes(v) ? v : 'tie';
      return {
        winner: validWinner(parsed.winner),
        winnerConfidence: Math.max(60, Math.min(95, Number(parsed.winnerConfidence) || 75)),
        keyDifference: String(parsed.keyDifference ?? ''),
        summary: String(parsed.summary ?? ''),
        recommendation: String(parsed.recommendation ?? ''),
        winnerByAds: validWinner(parsed.winnerByAds),
        winnerBySaturation: validWinner(parsed.winnerBySaturation),
        winnerLongTerm: validWinner(parsed.winnerLongTerm),
        loserRisks: arr(parsed.loserRisks).slice(0, 3).map(String),
        smartMove: String(parsed.smartMove ?? ''),
        dimensionWins,
        aStrengths: arr(parsed.aStrengths).slice(0, 3).map(String),
        bStrengths: arr(parsed.bStrengths).slice(0, 3).map(String),
        aWeaknesses: arr(parsed.aWeaknesses).slice(0, 2).map(String),
        bWeaknesses: arr(parsed.bWeaknesses).slice(0, 2).map(String),
      };
    } catch (err) {
      const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
      if (!is429) {
        // JSON parse or other error — build deterministic fallback
        const aScore = a?.result?.adjustedScore ?? a?.result?.score ?? 0;
        const bScore = b?.result?.adjustedScore ?? b?.result?.score ?? 0;
        const winner: 'A' | 'B' | 'tie' = aScore > bScore ? 'A' : bScore > aScore ? 'B' : 'tie';
        return {
          winner,
          winnerConfidence: 70,
          keyDifference: `Diferencia de ${Math.abs(aScore - bScore)} puntos en el score final.`,
          summary: winner === 'tie'
            ? 'Scores muy similares. Priorizá el de mayor margen o menor riesgo logístico.'
            : `Score superior (${winner === 'A' ? aScore : bScore} vs ${winner === 'A' ? bScore : aScore} puntos).`,
          recommendation: winner === 'tie'
            ? 'Elegí el de mayor margen para tu primer test con pauta acotada.'
            : `Iniciá con ${winner === 'A' ? a.product?.title : b.product?.title} — score más alto y mejor posición general.`,
          winnerByAds: winner,
          winnerBySaturation: winner,
          winnerLongTerm: winner,
          loserRisks: [],
          smartMove: winner === 'tie'
            ? 'Testá ambos con presupuesto mínimo (USD 20/día, 3 días) y dejá escalar al que mejor CPA muestre.'
            : `Iniciá con el ganador. Si tiene margen para aguantar el CAC, escalá. El perdedor quedá como backup.`,
          dimensionWins,
          aStrengths: [],
          bStrengths: [],
          aWeaknesses: [],
          bWeaknesses: [],
        };
      }
      console.log(`[gemini] ${model} rate-limited for battle — trying next`);
      lastErr = err;
    }
  }
  throw lastErr;
}
