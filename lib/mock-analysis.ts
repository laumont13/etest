// TEMPORARY DEVELOPMENT BYPASS
// This file provides mock data when TEMP_AI_BYPASS=true.
// Remove or set TEMP_AI_BYPASS=false to restore the original Gemini flow.

import type { GeminiAnalysis, SearchTermResult, ProductContext, MarketSignals } from './gemini';

export const AI_BYPASS_WARNING =
  'TEMPORARY DEVELOPMENT MODE: AI bypass is enabled. No real AI model was called.';

export function createMockSearchTerm(title: string): SearchTermResult {
  const stop = new Set(['de', 'para', 'con', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o']);
  const term =
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w))
      .slice(0, 3)
      .join(' ')
      .trim() || title.slice(0, 40);
  return { searchTerm: term.slice(0, 60), category: 'general' };
}

// djb2 hash — deterministic, no randomness
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

type Scenario = 'strong' | 'medium' | 'weak';

// Keyword overrides let devs force a specific UI state for testing
function pickScenario(title: string): Scenario {
  const t = title.toLowerCase();
  if (t.includes('test strong')) return 'strong';
  if (t.includes('test medium')) return 'medium';
  if (t.includes('test weak')) return 'weak';
  const idx = djb2(t) % 3;
  return (['strong', 'medium', 'weak'] as Scenario[])[idx];
}

// Score estimates are approximate — actual score is computed by lib/scoring.ts
// Strong ~80, medium ~63, weak ~35 (before margin bonus and data penalty)
const SCENARIOS: Record<Scenario, GeminiAnalysis> = {
  strong: {
    dimensions: {
      demand: 5,
      competition: 4, // competitive but beatable — validates the market
      adPotential: 5,
      wowFactor: 4,
      offerStrength: 4,
      branding: 4,
      risks: 2,       // low risk (inverted: good for score)
      scalability: 4,
      seasonality: 4,
      logistics: 2,   // simple to import (inverted: good for score)
      ltv: 4,
    },
    positioning:
      '[MOCK · STRONG] Producto con alto potencial de diferenciación premium. Demanda comprobada, entrada de bajo costo y margen saludable para escalar con pauta.',
    keyRisks: [
      '[MOCK] Posible saturación si competidores copian la oferta rápidamente.',
      '[MOCK] Dependencia de un único proveedor puede impactar plazos de entrega.',
      AI_BYPASS_WARNING,
    ],
    angles: [
      {
        hook: '[MOCK] ¿Cansado de soluciones que no duran?',
        angle: 'Enfocá en durabilidad vs. alternativas baratas del mercado. Antes/después en 3 segundos.',
        trigger: 'dolor',
      },
      {
        hook: '[MOCK] El producto que todos quieren pero pocos conocen',
        angle: 'Viralidad por descubrimiento: creativo de unboxing + reacción genuina.',
        trigger: 'deseo',
      },
      {
        hook: '[MOCK] Regalo perfecto con valor percibido alto',
        angle: 'Temporada de regalos — gift set con empaque premium, precio anclado vs. retail.',
        trigger: 'regalo',
      },
    ],
    dataGaps: ['[MOCK] Señales reales no disponibles (modo bypass activo). ' + AI_BYPASS_WARNING],
  },

  medium: {
    dimensions: {
      demand: 4,
      competition: 3,
      adPotential: 3,
      wowFactor: 3,
      offerStrength: 4,
      branding: 3,
      risks: 3,
      scalability: 3,
      seasonality: 4,
      logistics: 2,   // simple logistics — one bright spot
      ltv: 3,
    },
    positioning:
      '[MOCK · MEDIUM] Producto con demanda moderada y oferta construible. Requiere diferenciación clara para destacar frente a competencia establecida.',
    keyRisks: [
      '[MOCK] Competencia con precio más bajo puede erosionar el margen si no hay diferenciación.',
      '[MOCK] Potencial publicitario limitado — creativos deben educar antes de convertir.',
      '[MOCK] Estacionalidad moderada: validar timing antes de comprometer stock.',
      AI_BYPASS_WARNING,
    ],
    angles: [
      {
        hook: '[MOCK] La versión mejorada que el mercado estaba esperando',
        angle: 'Comparativa directa vs. solución estándar. Diferencia visible en 3 segundos.',
        trigger: 'deseo',
      },
      {
        hook: '[MOCK] Ahorros reales, no promesas',
        angle: 'Ángulo de ahorro de tiempo o dinero con prueba social básica.',
        trigger: 'dolor',
      },
    ],
    dataGaps: ['[MOCK] Señales reales no disponibles (modo bypass activo). ' + AI_BYPASS_WARNING],
  },

  weak: {
    dimensions: {
      demand: 2,
      competition: 2, // saturated + low scores compound each other
      adPotential: 2,
      wowFactor: 1,
      offerStrength: 2,
      branding: 2,
      risks: 4,       // high risk (inverted: bad for score)
      scalability: 2,
      seasonality: 2,
      logistics: 4,   // complex import (inverted: bad for score)
      ltv: 2,
    },
    positioning:
      '[MOCK · WEAK] Diferenciación baja, mercado saturado y logística compleja. Difícil de rentabilizar con pauta sin reformular la oferta.',
    keyRisks: [
      '[MOCK] Alta saturación: muchos competidores con producto idéntico a precio inferior.',
      '[MOCK] Sin "momento demo" claro — creativos genéricos, CAC alto esperado.',
      '[MOCK] Complejidad logística y de importación comprime márgenes.',
      '[MOCK] Recompra nula o muy baja — LTV insuficiente para sostener CAC con pauta.',
      AI_BYPASS_WARNING,
    ],
    angles: [
      {
        hook: '[MOCK] Sin ángulo fuerte identificado',
        angle: 'Ningún vector de diferenciación claro. Requiere reformulación de oferta o cambio de producto.',
        trigger: 'urgencia',
      },
    ],
    dataGaps: ['[MOCK] Señales reales no disponibles (modo bypass activo). ' + AI_BYPASS_WARNING],
  },
};

export function createMockAnalysis(
  product: ProductContext,
  _signals: MarketSignals,
): GeminiAnalysis {
  return SCENARIOS[pickScenario(product.title)];
}
