// TEMPORARY DEVELOPMENT BYPASS
// Set TEMP_AI_BYPASS=true in .env.local to skip all AI calls and return mock data.
// Set TEMP_AI_BYPASS=false or remove the variable to restore the original Gemini flow.
// The original Gemini functions remain unchanged in lib/gemini.ts.

import {
  analyzeProduct as analyzeWithGemini,
  extractSearchTerm as extractSearchTermGemini,
  type ProductContext,
  type MarketSignals,
  type GeminiAnalysis,
  type SearchTermResult,
} from './gemini';
import { createMockAnalysis, createMockSearchTerm } from './mock-analysis';

export { AI_BYPASS_WARNING } from './mock-analysis';

export function isBypassEnabled(): boolean {
  return process.env.TEMP_AI_BYPASS === 'true';
}

export async function extractSearchTermWithBypass(
  title: string,
  description?: string,
): Promise<SearchTermResult> {
  if (isBypassEnabled()) {
    return createMockSearchTerm(title);
  }
  return extractSearchTermGemini(title, description);
}

export async function analyzeProductWithBypass(
  product: ProductContext,
  signals: MarketSignals,
): Promise<GeminiAnalysis> {
  if (isBypassEnabled()) {
    return createMockAnalysis(product, signals);
  }
  return analyzeWithGemini(product, signals);
}
