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

const MODEL = 'gemini-2.5-flash';

export interface MarketSignals {
  /** Interés de Google Trends 0–100, o null si no se pudo obtener */
  trendsInterest: number | null;
  /** Dirección de la tendencia */
  trendDirection: 'rising' | 'stable' | 'declining' | 'unknown';
  /** Cantidad aproximada de competidores en Mercado Libre, o null */
  mlCompetitors: number | null;
  /** Rango de precios observado en ML [min, max] o null */
  mlPriceRange: [number, number] | null;
  /** País objetivo (código) */
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
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.1, responseMimeType: 'application/json' },
    });
    const clean = (response.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const term = String(parsed.searchTerm ?? '').trim();
    return {
      searchTerm: term.length >= 2 ? term.slice(0, 60) : fallbackTerm(title),
      category: String(parsed.category ?? '').trim().slice(0, 40) || 'general',
    };
  } catch {
    // Respaldo por código si Gemini falla: primeras 3 palabras del título.
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

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.4, // bajo: queremos consistencia, no creatividad en el scoring
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '';
  return parseAnalysis(text);
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
  lines.push(
    `- Google Trends: ${
      signals.trendsInterest !== null
        ? `${signals.trendsInterest}/100, tendencia ${signals.trendDirection}`
        : 'NO DISPONIBLE'
    }`,
  );
  lines.push(
    `- Competidores en Mercado Libre: ${
      signals.mlCompetitors !== null ? signals.mlCompetitors : 'NO DISPONIBLE'
    }`,
  );
  lines.push(
    `- Rango de precios en ML: ${
      signals.mlPriceRange ? `${signals.mlPriceRange[0]}–${signals.mlPriceRange[1]}` : 'NO DISPONIBLE'
    }`,
  );
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
