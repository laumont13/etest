/**
 * E-Test · /api/analyze
 * ----------------------------------------------------------------------------
 * Orquesta el análisis profundo. SOLO se llama si el producto ya pasó el gate
 * de margen en el cliente (gratis e instantáneo). Acá:
 *   1. Recalcula y reverifica el margen en el server (no confiar en el cliente).
 *   2. Dispara señales reales en paralelo: Google Trends + Mercado Libre.
 *   3. Pasa todo a Gemini, que puntúa las 9 dimensiones (sin inventar datos).
 *   4. Corre el scoring determinístico → score + veredicto.
 *   5. Persiste en Supabase si está configurado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateMargin, computeScore } from '@/lib/scoring';
// TEMPORARY DEVELOPMENT BYPASS — remove TEMP_AI_BYPASS to restore original AI flow.
import {
  extractSearchTermWithBypass as extractSearchTerm,
  analyzeProductWithBypass as analyzeProduct,
  isBypassEnabled,
  AI_BYPASS_WARNING,
} from '@/lib/temp-ai-bypass';
import type { MarketSignals } from '@/lib/gemini';
import { fetchTrends } from '@/lib/trends';
import { fetchMercadoLibreSignals } from '@/lib/mercadolibre';
import { fetchGoogleMarketSignals } from '@/lib/google-market';
import { fetchSupplierSignals } from '@/lib/supplier-signals';
import { getCountry } from '@/lib/countries';
import { saveAnalysis } from '@/lib/supabase';
import { computeConfidence } from '@/lib/source-status';

export const runtime = 'nodejs';
export const maxDuration = 120;
// GRU1 (São Paulo) bypasses ML bot-detection that blocks US datacenter IPs
export const preferredRegion = ['gru1', 'iad1'];

const Body = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(120).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  country: z.string().length(2),
  sessionId: z.string().min(1).max(100),
  margin: z.object({
    unitCost: z.number().nonnegative(),
    shippingCost: z.number().nonnegative(),
    fees: z.number().nonnegative(),
    sellPrice: z.number().positive(),
  }),
});

export async function POST(req: NextRequest) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'Datos inválidos', detail: String(e) }, { status: 400 });
  }

  // 1. Reverificar margen en el server (defensa: no confiar en el gate del cliente)
  const margin = evaluateMargin(body.margin);
  if (!margin.passesGate) {
    return NextResponse.json(
      {
        gateFailed: true,
        margin,
        message: margin.gateMessage,
      },
      { status: 200 },
    );
  }

  const country = getCountry(body.country);

  // 2. Gemini extrae un término de búsqueda limpio (corrige typos, saca relleno).
  const { searchTerm, category } = await extractSearchTerm(body.title, body.description);

  // 3. Señales reales en paralelo. Degradan a null si fallan; siempre devuelven status.
  const [trends, ml, googleMarket, supplier] = await Promise.all([
    fetchTrends(searchTerm, country.trendsGeo, category),
    fetchMercadoLibreSignals(searchTerm, body.country),
    fetchGoogleMarketSignals(searchTerm, body.country),
    fetchSupplierSignals(searchTerm),
  ]);

  console.log(`[analyze] trends.source=${trends.source.status} — ${trends.source.reason}`);
  console.log(`[analyze] ml.source=${ml.source.status} — ${ml.source.reason}`);
  console.log(`[analyze] googleMarket.source=${googleMarket.source.status} — ${googleMarket.source.reason}`);
  console.log(`[analyze] supplier.source=${supplier.source.status} — ${supplier.source.reason}`);
  console.log(`[analyze] trends.keywordsTried=${trends.keywordsTried.join(', ')}`);
  console.log(`[analyze] ml.queriesTried=${ml.queriesTried.join(', ')}`);

  // If ML scraping was blocked, fall back to Google's ML listing estimate silently
  const mlCompetitorsEffective = ml.competitors ?? googleMarket.mlEstimatedListings;
  const mlFallbackUsed = ml.competitors === null && googleMarket.mlEstimatedListings !== null;
  if (mlFallbackUsed) {
    console.log(`[analyze] ML fallback: using Google estimate ${googleMarket.mlEstimatedListings} competitors`);
  }

  const signals: MarketSignals = {
    trendsInterest: trends.interest,
    trendDirection: trends.direction,
    mlCompetitors: mlCompetitorsEffective,
    mlPriceRange: ml.priceRange,
    googleMLEstimate: googleMarket.mlEstimatedListings,
    argPriceRange: googleMarket.argPriceRange,
    argCurrency: googleMarket.argCurrency,
    supplierPriceRangeUSD: supplier.priceRangeUSD,
    supplierCount: supplier.supplierCount,
    supplierMOQ: supplier.moqMin,
    supplierMOQUnit: supplier.moqUnit,
    country: country.name,
  };

  // 4. Gemini puntúa las dimensiones (con reintento simple si el JSON viene mal)
  const productCtx = {
    title: body.title,
    description: body.description,
    category: body.category ?? category,
    sellPrice: body.margin.sellPrice,
    totalCost: margin.totalCost,
    marginMultiple: margin.multiple,
  };
  let analysis;
  try {
    analysis = await analyzeProduct(productCtx, signals);
  } catch {
    try {
      analysis = await analyzeProduct(productCtx, signals);
    } catch (e) {
      return NextResponse.json(
        { error: 'El análisis de IA falló. Reintentá en unos segundos.', detail: String(e) },
        { status: 502 },
      );
    }
  }

  // 5. Scoring determinístico con penalización por datos faltantes
  const confidence = computeConfidence([
    trends.source.status,
    ml.source.status,
    googleMarket.source.status,
    supplier.source.status,
  ]);
  console.log(`[analyze] confidence=${confidence.level} penalty=${confidence.penalty}`);
  const result = computeScore(analysis.dimensions, margin, {
    dataPenalty: confidence.penalty,
    confidence: confidence.level,
    confidenceLabel: confidence.label,
  });

  const sourceStatuses = {
    trends: { ...trends.source, keywordsTried: trends.keywordsTried },
    mercadoLibre: mlFallbackUsed
      ? {
          status: 'ok' as const,
          reason: `~${new Intl.NumberFormat('es').format(googleMarket.mlEstimatedListings!)} publicaciones estimadas vía Google (ML scraping no disponible)`,
          queriesTried: ml.queriesTried,
        }
      : { ...ml.source, queriesTried: ml.queriesTried },
    prices: ml.priceRange !== null
      ? { status: 'ok' as const, reason: `Rango de precios obtenido de ML (${ml.queriesTried.at(-1)})` }
      : { status: googleMarket.argPriceRange ? 'ok' as const : ml.source.status, reason: googleMarket.argPriceRange ? googleMarket.source.reason : ml.source.reason },
    googleMarket: { ...googleMarket.source, queriesTried: googleMarket.queriesTried },
    supplier: supplier.source,
  };

  const payload = {
    product: {
      title: body.title,
      category: body.category ?? category,
      searchTerm,
      sourceUrl: body.sourceUrl ?? null,
      country: country.code,
    },
    margin,
    signals,
    sourceStatuses,
    analysis,
    result,
    generatedAt: new Date().toISOString(),
    ...(isBypassEnabled() && { aiBypassWarning: AI_BYPASS_WARNING }),
  };

  // 5. Persistir (best-effort)
  try {
    await saveAnalysis({
      session_id: body.sessionId,
      product_title: body.title,
      source_url: body.sourceUrl ?? null,
      country: country.code,
      score: result.score,
      verdict: result.verdict,
      margin_multiple: margin.multiple,
      payload,
    });
  } catch {
    // no bloquea la respuesta
  }

  return NextResponse.json(payload, { status: 200 });
}
