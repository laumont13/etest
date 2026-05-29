/**
 * E-Test · /api/export-pdf  (v3 — premium dark aesthetic)
 * P1: Portada + Score + Semáforo chips + Resumen ejecutivo
 * P2: Margen + Posicionamiento + Público objetivo
 * P3: Riesgos cards (2 col) + Diferenciación + Oferta
 * P4: Checklist + Próximos pasos (timeline) + Alertas
 */

import { NextRequest, NextResponse } from 'next/server';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { GoogleGenAI } from '@google/genai';
import { normalizeReport, type NormalizedRisk } from '@/lib/pdf-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 45;

// ─── Color palette ─────────────────────────────────────────────────────────
const C = {
  bg:      '#080A08',
  card:    '#111411',
  card2:   '#171B17',
  divider: '#1E221E',
  accent:  '#A4FF5C',
  green:   '#4ADE80',
  yellow:  '#FACC15',
  orange:  '#FB923C',
  red:     '#F87171',
  text:    '#F0F0F0',
  textMid: '#888888',
  textDim: '#4A4A50',
  white:   '#FFFFFF',
} as const;

// ─── Styles ────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:      { padding: 44, backgroundColor: C.bg, color: C.text, fontFamily: 'Helvetica', fontSize: 10 },
  row:       { flexDirection: 'row' },
  col:       { flexDirection: 'column' },
  // Typography
  h1:        { fontSize: 26, fontFamily: 'Times-Bold', color: C.white, lineHeight: 1.2 },
  h2:        { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.accent, letterSpacing: 0.3 },
  h3:        { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text },
  meta:      { fontSize: 8, color: C.textMid, letterSpacing: 0.5 },
  label:     { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 },
  body:      { fontSize: 9, color: C.text, lineHeight: 1.6 },
  bodyMid:   { fontSize: 9, color: C.textMid, lineHeight: 1.55 },
  bodySmall: { fontSize: 8, color: C.textMid, lineHeight: 1.5 },
  // Score
  scoreBig:  { fontSize: 64, fontFamily: 'Times-Bold', lineHeight: 1 },
  scoreLabel: { fontSize: 7.5, color: C.textMid, letterSpacing: 1, marginTop: 3 },
  // Card
  card:  { backgroundColor: C.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.divider },
  card2: { backgroundColor: C.card2, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: C.divider },
  // Divider
  divider: { borderBottomWidth: 1, borderBottomColor: C.divider, marginVertical: 14 },
  // Badge / chip
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});

// ─── Element helpers ────────────────────────────────────────────────────────
const e   = React.createElement;
const el  = (type: any, props?: any, ...children: any[]) => e(type, props ?? {}, ...children);
const tx  = (style: any, text: string) => el(Text, { style }, text);
const vw  = (style: any, ...children: any[]) => el(View, { style }, ...children);
const gap = (h: number) => el(View, { style: { height: h } });

// ─── Visual helpers ─────────────────────────────────────────────────────────

function badge(text: string, color: string) {
  return vw(
    { ...S.badge, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '44', alignSelf: 'flex-start' },
    tx({ fontSize: 7, fontFamily: 'Helvetica-Bold', color, letterSpacing: 0.8 }, text.toUpperCase()),
  );
}

function sectionTitle(text: string) {
  return vw({ marginBottom: 12 },
    tx(S.h2, text),
    vw({ height: 1, backgroundColor: C.divider, marginTop: 6 }),
  );
}

function bulletItem(text: string, color = C.textMid) {
  return vw({ flexDirection: 'row', marginBottom: 5 },
    tx({ fontSize: 9, color: C.accent, marginRight: 7, marginTop: 0.5 }, '·'),
    tx({ ...S.body, color, flex: 1 }, text),
  );
}

function infoRow(label: string, value: string, valueColor: string = C.text) {
  return vw({ ...S.row, justifyContent: 'space-between', marginBottom: 5 },
    tx(S.bodyMid, label),
    tx({ fontSize: 9, fontFamily: 'Helvetica-Bold', color: valueColor }, value),
  );
}

function verdictColor(v: string) {
  return v === 'go' ? C.green : v === 'maybe' ? C.yellow : C.red;
}
function verdictLabel(v: string) {
  return v === 'go' ? 'AVANZAR' : v === 'maybe' ? 'INVESTIGAR' : 'DESCARTAR';
}

function levelColor(level: string, invert = false): string {
  const hi = invert ? C.red : C.green;
  const lo = invert ? C.green : C.red;
  if (level === 'alto') return hi;
  if (level === 'medio') return C.yellow;
  if (level === 'bajo') return lo;
  return C.textDim;
}
function levelLabel(level: string) {
  return level === 'alto' ? 'ALTO' : level === 'medio' ? 'MEDIO' : level === 'bajo' ? 'BAJO' : 'N/D';
}

// Semáforo chip pill
function semChip(label: string, level: string, invert = false) {
  const c = levelColor(level, invert);
  return vw({
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: c + '16', borderWidth: 1, borderColor: c + '36',
    marginRight: 6, marginBottom: 6,
  },
    vw({ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c, marginRight: 5 }),
    tx({ fontSize: 7.5, color: C.textMid, marginRight: 4 }, label),
    tx({ fontSize: 7, fontFamily: 'Helvetica-Bold', color: c, letterSpacing: 0.5 }, levelLabel(level)),
  );
}

function stockChip(rec: string) {
  const c = rec === 'comprar muestra' ? C.green : rec === 'comprar poco' ? C.yellow : C.red;
  return badge(rec.toUpperCase(), c);
}

// Risk card — 2-column layout
function riskCard(risk: NormalizedRisk) {
  const c = levelColor(risk.level, true); // inverted: alto = bad
  return vw({
    width: '49%',
    backgroundColor: C.card2,
    borderRadius: 12,
    borderTopWidth: 1, borderTopColor: C.divider,
    borderRightWidth: 1, borderRightColor: C.divider,
    borderBottomWidth: 1, borderBottomColor: C.divider,
    borderLeftWidth: 3, borderLeftColor: c,
    padding: 14, marginBottom: 8,
  },
    vw({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
      tx({ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.text, flex: 1, lineHeight: 1.3, marginRight: 6 }, risk.risk),
      vw({ ...S.badge, backgroundColor: c + '22', borderWidth: 1, borderColor: c + '44', alignSelf: 'flex-start' },
        tx({ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: c, letterSpacing: 0.7 }, levelLabel(risk.level)),
      ),
    ),
    tx({ fontSize: 7.5, color: C.textMid, lineHeight: 1.45, marginBottom: 8 }, risk.whyImportant),
    vw({ flexDirection: 'row' },
      vw({ flex: 1, marginRight: 5 },
        tx({ ...S.label, color: c, marginBottom: 3 }, 'VALIDAR'),
        tx({ fontSize: 7, color: C.textMid, lineHeight: 1.45 }, risk.howToValidate),
      ),
      vw({ flex: 1 },
        tx({ ...S.label, color: C.accent, marginBottom: 3 }, 'REDUCIR'),
        tx({ fontSize: 7, color: C.textMid, lineHeight: 1.45 }, risk.howToReduce),
      ),
    ),
  );
}

// Timeline step for next-steps
function timelineStep(step: string, i: number, vColor: string, isLast: boolean) {
  return vw({ flexDirection: 'row', marginBottom: isLast ? 0 : 10, alignItems: 'flex-start' },
    vw({
      width: 22, height: 22, borderRadius: 11, flexShrink: 0,
      backgroundColor: vColor + '20', borderWidth: 1, borderColor: vColor + '55',
      alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1,
    },
      tx({ fontSize: 8, fontFamily: 'Helvetica-Bold', color: vColor }, String(i + 1)),
    ),
    tx({ ...S.body, flex: 1, lineHeight: 1.55 }, step),
  );
}

function alertItem(text: string) {
  return vw({ flexDirection: 'row', marginBottom: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.orange + '10', borderWidth: 1, borderColor: C.orange + '28' },
    tx({ fontSize: 9, color: C.orange, marginRight: 7 }, '⚠'),
    tx({ fontSize: 9, color: C.text, flex: 1, lineHeight: 1.55 }, text),
  );
}

function checklistItem(text: string) {
  return vw({ flexDirection: 'row', marginBottom: 6 },
    vw({ width: 10, height: 10, borderWidth: 1, borderColor: C.divider, borderRadius: 2, marginRight: 8, marginTop: 1, flexShrink: 0 }),
    tx({ ...S.body, flex: 1 }, text),
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return 'N/D';
  return new Intl.NumberFormat('es').format(Math.round(n));
}

// ─── Semáforo derivation ────────────────────────────────────────────────────
interface Semaforo {
  salePotential: string; margin: string; saturation: string;
  qualityRisk: string; easeExplain: string; metaAds: string; stockRec: string;
}

function deriveSemaforo(data: any): Semaforo {
  const multiple    = data.margin?.multiple ?? 0;
  const trends      = data.signals?.trendsInterest ?? null;
  const competitors = data.signals?.mlCompetitors ?? data.signals?.googleMLEstimate ?? null;
  const sellability = data.result?.filters?.sellability ?? 50;
  const worthwhile  = data.result?.filters?.worthwhile ?? 50;
  const breakdown: any[] = data.result?.breakdown ?? [];
  const riskDim     = breakdown.find((b: any) => b.key === 'risks')?.raw ?? 3;
  const adDim       = breakdown.find((b: any) => b.key === 'adPotential')?.raw ?? 3;
  const verdict     = data.result?.verdict ?? 'kill';

  return {
    salePotential: trends !== null
      ? (trends > 60 ? 'alto' : trends > 30 ? 'medio' : 'bajo')
      : (worthwhile > 70 ? 'alto' : worthwhile > 40 ? 'medio' : 'bajo'),
    margin:      multiple >= 5 ? 'alto' : multiple >= 3 ? 'medio' : 'bajo',
    saturation:  competitors !== null ? (competitors > 8000 ? 'alto' : competitors > 2000 ? 'medio' : 'bajo') : 'medio',
    qualityRisk: riskDim >= 4 ? 'alto' : riskDim >= 3 ? 'medio' : 'bajo',
    easeExplain: sellability > 70 ? 'alto' : sellability > 40 ? 'medio' : 'bajo',
    metaAds:     adDim >= 4 ? 'alto' : adDim >= 3 ? 'medio' : 'bajo',
    stockRec:    verdict === 'go' ? 'comprar muestra' : verdict === 'maybe' ? 'no comprar aún' : 'no comprar',
  };
}

// ─── Smart alerts ───────────────────────────────────────────────────────────
function deriveAlerts(data: any): string[] {
  const alerts: string[] = [];
  const score       = data.result?.adjustedScore ?? data.result?.score ?? 0;
  const verdict     = data.result?.verdict ?? 'kill';
  const multiple    = data.margin?.multiple ?? 0;
  const competitors = data.signals?.mlCompetitors ?? data.signals?.googleMLEstimate ?? null;
  const breakdown: any[] = data.result?.breakdown ?? [];
  const riskDim     = breakdown.find((b: any) => b.key === 'risks')?.raw ?? 3;
  const adDim       = breakdown.find((b: any) => b.key === 'adPotential')?.raw ?? 3;
  const confidence  = data.result?.confidence ?? 'high';
  const penalty     = data.result?.dataPenalty ?? 0;
  const totalCost   = data.margin?.totalCost ?? 0;

  if (score >= 70 && verdict !== 'go') alerts.push('Score alto no significa comprar stock. El veredicto final pondera riesgos que el número no captura por sí solo.');
  if (multiple >= 6) alerts.push('Margen muy atractivo. Verificá que incluye envío, impuestos de importación, packaging, comisiones de plataforma y devoluciones.');
  if (totalCost === 0) alerts.push('No se cargaron costos completos. El margen mostrado puede estar incompleto — sumá envío, fees e impuestos antes de decidir.');
  if (competitors !== null && competitors > 5000) alerts.push('Mercado saturado (' + fmt(competitors) + ' competidores). Necesitás diferenciación fuerte o nicho específico para destacar.');
  if (riskDim >= 4) alerts.push('Producto con riesgo de calidad o logístico alto. Pedí muestra y probala en condiciones reales antes de comprar volumen.');
  if (adDim <= 2) alerts.push('Baja potencial de demostración visual. Si el producto no se entiende en 3 segundos, invertí en creativos de explicación antes de escalar.');
  if (confidence === 'low' || penalty >= 10) alerts.push('Análisis con datos limitados (' + (data.analysis?.dataGaps?.length ?? 0) + ' fuentes sin datos). Validá con investigación manual antes de comprometer capital.');
  if (verdict === 'go' && !data.signals?.mlCompetitors && !data.signals?.googleMLEstimate) alerts.push('No hay datos de competencia disponibles. Revisá Mercado Libre manualmente antes de avanzar.');

  return alerts.slice(0, 5);
}

// ─── Gemini enrichment ──────────────────────────────────────────────────────
interface EnhancedRisk {
  risk: string; level: 'alto' | 'medio' | 'bajo';
  whyImportant: string; howToValidate: string; howToReduce: string;
}

interface PdfEnrichment {
  executiveSummary: string; verdictPhrase: string;
  howToSell: string; howNotToSell: string;
  positioningPhrase: string; positioningVariants: string[];
  primaryBuyer: string; secondaryBuyer: string;
  usageSituations: string[]; emotionalMotive: string;
  suggestedOffer: string; altOffer: string; bundleSuggestion: string;
  differentiationAngles: string[]; enhancedRisks: EnhancedRisk[];
}

function fallbackEnrichment(data: any): PdfEnrichment {
  const verdict = data.result?.verdict ?? 'kill';
  const risks: string[] = data.analysis?.keyRisks ?? [];
  const angles: any[] = data.analysis?.angles ?? [];
  const positioning: string = data.analysis?.positioning ?? '';
  const nextStepMap: Record<string, string> = {
    go: 'Avanzar a test con pauta baja. Validar calidad con muestra antes de comprar volumen.',
    maybe: 'Investigar más antes de pautar. Revisar competencia y validar precio con público.',
    kill: 'No avanzar con este producto. Guardar aprendizajes y explorar variante o categoría diferente.',
  };
  return {
    executiveSummary: (data.result?.reason ?? '') + ' ' + nextStepMap[verdict],
    verdictPhrase: ({ go: 'Producto apto para test creativo — no compres stock grande todavía.', maybe: 'Producto con potencial, pero requiere validación antes de invertir.', kill: 'Producto con señales de alerta — explorá alternativas antes de avanzar.' } as Record<string, string>)[verdict] ?? '',
    howToSell: positioning ? positioning.split('.')[0] + '.' : 'Vendé destacando el beneficio principal y el diferenciador de tu oferta.',
    howNotToSell: risks[0] ? `Evitá posicionar el producto como solución genérica — el riesgo de ${risks[0].toLowerCase().split(' ').slice(0, 4).join(' ')} debilita la propuesta.` : 'Evitá competir solo por precio frente a marcas consolidadas.',
    positioningPhrase: positioning.slice(0, 80) || 'Solución premium para un problema concreto.',
    positioningVariants: angles.slice(0, 3).map((a: any) => a.hook || '').filter(Boolean),
    primaryBuyer: 'Compradores que buscan activamente una solución a este problema en mercado online.',
    secondaryBuyer: 'Personas que descubren el producto por recomendación o publicidad en redes.',
    usageSituations: angles.slice(0, 4).map((a: any) => a.trigger || '').filter(Boolean),
    emotionalMotive: angles[0] ? `Impulso emocional: ${angles[0].trigger ?? 'deseo de solución inmediata'}.` : 'Deseo de resolver un problema concreto con mínima fricción.',
    suggestedOffer: angles[0] ? `"${angles[0].hook}" — ${angles[0].angle ?? 'pack de inicio con muestra y garantía.'}` : 'Oferta de prueba con garantía de satisfacción y envío rápido.',
    altOffer: angles[1] ? `"${angles[1].hook}"` : 'Pack mensual con descuento para compradores recurrentes.',
    bundleSuggestion: 'Pack de inicio: producto principal + guía de uso + packaging discreto.',
    differentiationAngles: angles.map((a: any) => a.trigger || a.hook || '').filter(Boolean).slice(0, 4),
    enhancedRisks: risks.map((r: string) => ({
      risk: r.split(':')[0].split(' ').slice(0, 5).join(' '),
      level: 'medio' as const,
      whyImportant: r,
      howToValidate: 'Pedir muestra y probar en condiciones reales.',
      howToReduce: 'Elegir proveedor con mejores reviews y comunicar bien las instrucciones de uso.',
    })),
  };
}

async function enrichForPdf(data: any): Promise<PdfEnrichment> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackEnrichment(data);

  const verdict = data.result?.verdict ?? 'kill';
  const prompt = `Sos un consultor experto de ecommerce en LATAM. Generá contenido enriquecido para un reporte PDF de decisión de producto.

ANÁLISIS:
Producto: "${data.product?.title ?? ''}"
País: ${data.product?.country ?? ''}
Score: ${data.result?.adjustedScore ?? data.result?.score ?? 0}/100 · Veredicto: ${verdictLabel(verdict)}
Múltiplo margen: ${data.margin?.multiple ?? 0}x
Posicionamiento actual: "${data.analysis?.positioning ?? ''}"
Riesgos actuales: ${(data.analysis?.keyRisks ?? []).join('; ')}
Ángulos de venta: ${(data.analysis?.angles ?? []).map((a: any) => a.hook).join('; ')}
ML competitors: ${data.signals?.mlCompetitors ?? data.signals?.googleMLEstimate ?? 'N/D'}
Trends: ${data.signals?.trendsInterest ?? 'N/D'}/100

Devolvé SOLO JSON válido, sin markdown, con estas claves exactas:
{
  "executiveSummary": "2-3 frases: potencial, por qué puede fallar, acción concreta recomendada",
  "verdictPhrase": "Frase corta de diagnóstico (máx 15 palabras)",
  "howToSell": "Cómo SÍ venderlo — 1 frase específica al producto",
  "howNotToSell": "Cómo NO venderlo — 1 frase específica",
  "positioningPhrase": "Frase de posicionamiento premium final (máx 10 palabras)",
  "positioningVariants": ["variante 1", "variante 2", "variante 3"],
  "primaryBuyer": "Comprador principal: descripción concreta (1-2 frases)",
  "secondaryBuyer": "Comprador secundario: descripción (1 frase)",
  "usageSituations": ["situación 1", "situación 2", "situación 3", "situación 4"],
  "emotionalMotive": "Motivo emocional principal de compra (1 frase directa)",
  "suggestedOffer": "Oferta principal recomendada con nombre y contenido concreto (1-2 frases)",
  "altOffer": "Oferta alternativa diferente (1 frase)",
  "bundleSuggestion": "Bundle o pack recomendado específico (1 frase)",
  "differentiationAngles": ["diferenciador 1", "diferenciador 2", "diferenciador 3"],
  "enhancedRisks": [
    {
      "risk": "nombre corto del riesgo (máx 5 palabras)",
      "level": "alto|medio|bajo",
      "whyImportant": "por qué importa — 1 frase directa",
      "howToValidate": "cómo validarlo — 1 frase corta y accionable",
      "howToReduce": "cómo reducirlo — 1 frase corta y accionable"
    }
  ]
}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let lastErr: unknown;
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0.4, responseMimeType: 'application/json' } });
        const text = (response.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        const arr = (v: any): any[] => Array.isArray(v) ? v : [];
        const str = (v: any, fb = '') => typeof v === 'string' && v.length > 0 ? v : fb;
        const fb = fallbackEnrichment(data);
        return {
          executiveSummary:    str(parsed.executiveSummary,    fb.executiveSummary),
          verdictPhrase:       str(parsed.verdictPhrase,       fb.verdictPhrase),
          howToSell:           str(parsed.howToSell,           fb.howToSell),
          howNotToSell:        str(parsed.howNotToSell,        fb.howNotToSell),
          positioningPhrase:   str(parsed.positioningPhrase,   ''),
          positioningVariants: arr(parsed.positioningVariants).slice(0, 3).map(String),
          primaryBuyer:        str(parsed.primaryBuyer,        ''),
          secondaryBuyer:      str(parsed.secondaryBuyer,      ''),
          usageSituations:     arr(parsed.usageSituations).slice(0, 4).map(String),
          emotionalMotive:     str(parsed.emotionalMotive,     ''),
          suggestedOffer:      str(parsed.suggestedOffer,      ''),
          altOffer:            str(parsed.altOffer,            ''),
          bundleSuggestion:    str(parsed.bundleSuggestion,    ''),
          differentiationAngles: arr(parsed.differentiationAngles).slice(0, 4).map(String),
          enhancedRisks: arr(parsed.enhancedRisks).slice(0, 5).map((r: any) => ({
            risk:          str(r?.risk, 'Riesgo no especificado'),
            level:         (['alto', 'medio', 'bajo'].includes(r?.level) ? r.level : 'medio') as 'alto' | 'medio' | 'bajo',
            whyImportant:  str(r?.whyImportant, ''),
            howToValidate: str(r?.howToValidate, ''),
            howToReduce:   str(r?.howToReduce, ''),
          })),
        };
      } catch (err) {
        if (!String(err).includes('429') && !String(err).includes('RESOURCE_EXHAUSTED')) break;
        lastErr = err;
        console.log(`[pdf-export] ${model} rate-limited`);
      }
    }
    void lastErr;
  } catch { /* fall through */ }

  return fallbackEnrichment(data);
}

// ─── Page builders ──────────────────────────────────────────────────────────

function page1(data: any, sem: Semaforo, nr: ReturnType<typeof normalizeReport>) {
  const r      = data.result;
  const verdict = r?.verdict ?? 'kill';
  const vColor  = verdictColor(verdict);
  const score   = nr.score;
  const date    = new Date(data.generatedAt ?? Date.now()).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

  return el(Page, { size: 'A4', style: S.page },

    // ── Header card
    vw({ ...S.card, marginBottom: 20 },
      vw({ ...S.row, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
        tx({ ...S.meta, textTransform: 'uppercase', letterSpacing: 1 }, 'E-Test · Análisis de Producto'),
        tx(S.meta, `${data.product?.country ?? ''} · ${date}`),
      ),
      tx(S.h1, nr.title),
      gap(12),
      // Score row
      vw({ ...S.row, alignItems: 'flex-end', justifyContent: 'space-between' },
        vw({ flexDirection: 'column' },
          tx({ ...S.scoreBig, color: vColor }, String(score)),
          tx(S.scoreLabel, 'SCORE / 100'),
          r?.dataPenalty > 0
            ? tx({ fontSize: 7, color: C.textDim, marginTop: 3 }, `base ${r.score} − ${r.dataPenalty} pts por datos faltantes`)
            : null,
        ),
        vw({ alignItems: 'flex-end' },
          badge(verdictLabel(verdict), vColor),
          gap(6),
          nr.verdictPhrase.length > 0
            ? tx({ fontSize: 8, color: C.textMid, textAlign: 'right', maxWidth: 200, lineHeight: 1.45 }, nr.verdictPhrase)
            : null,
        ),
      ),
      vw(S.divider),
      vw({ ...S.row, justifyContent: 'space-between' },
        tx(S.bodySmall, `Confianza: ${r?.confidenceLabel ?? 'Alta'}`),
        tx(S.bodySmall, `Dimensiones evaluadas: ${(r?.breakdown ?? []).length}`),
      ),
    ),

    // ── Semáforo chips
    vw({ marginBottom: 20 },
      sectionTitle('Semáforo de decisión'),
      vw({ ...S.card, paddingBottom: 14 },
        vw({ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
          semChip('Potencial de venta',    sem.salePotential, false),
          semChip('Margen',                sem.margin,        false),
          semChip('Saturación mercado',    sem.saturation,    true),
          semChip('Riesgo calidad',        sem.qualityRisk,   true),
          semChip('Facilidad explicar',    sem.easeExplain,   false),
          semChip('Potencial Meta Ads',    sem.metaAds,       false),
        ),
        vw({ ...S.row, alignItems: 'center', justifyContent: 'space-between' },
          tx({ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.text }, 'Recomendación de stock'),
          stockChip(sem.stockRec),
        ),
      ),
    ),

    // ── Resumen ejecutivo
    vw({},
      sectionTitle('Resumen ejecutivo'),
      vw(S.card,
        tx({ ...S.body, lineHeight: 1.65, marginBottom: 10 }, nr.executiveSummary),
        vw(S.divider),
        tx({ ...S.label, color: C.textDim, marginBottom: 6 }, 'FILTROS DE DECISIÓN'),
        vw({ ...S.row, gap: 12 },
          tx({ fontSize: 9, color: C.text }, `Negocio: ${r?.filters?.business ?? '–'}`),
          tx({ fontSize: 9, color: C.textMid }, '·'),
          tx({ fontSize: 9, color: C.text }, `Vendibilidad: ${r?.filters?.sellability ?? '–'}`),
          tx({ fontSize: 9, color: C.textMid }, '·'),
          tx({ fontSize: 9, color: C.text }, `Escala: ${r?.filters?.worthwhile ?? '–'}`),
        ),
      ),
    ),
  );
}

function page2(data: any, nr: ReturnType<typeof normalizeReport>) {
  const m = data.margin;
  const multiple     = m?.multiple ?? 0;
  const marginColor  = multiple >= 5 ? C.green : multiple >= 3 ? C.yellow : C.red;
  const marginInterp = multiple >= 6
    ? 'Margen muy atractivo. Verificá costo final con envío, impuestos, packaging y comisiones antes de decidir.'
    : multiple >= 4.5
    ? 'Margen sólido. Confirmá que el costo incluye todos los gastos para validar la rentabilidad real.'
    : multiple >= 3
    ? 'Margen mínimo aceptable. Cualquier costo adicional puede afectar la viabilidad — validá con números reales.'
    : 'Margen ajustado. Revisá estructura de costos antes de comprometer capital.';

  return el(Page, { size: 'A4', style: S.page },

    // ── Margen
    sectionTitle('Margen y números'),
    vw({ ...S.card, marginBottom: 20 },
      vw({ ...S.row, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
        tx({ fontSize: 28, fontFamily: 'Times-Bold', color: marginColor }, `${multiple}x`),
        tx({ fontSize: 8.5, color: C.textMid, maxWidth: 240, lineHeight: 1.5, textAlign: 'right' }, marginInterp),
      ),
      vw(S.divider),
      infoRow('Costo total estimado', m?.totalCost ? `$${m.totalCost.toLocaleString('es')}` : 'No cargado', m?.totalCost ? C.text : C.textDim),
      infoRow('Precio de venta estimado', m?.totalCost && m?.multiple ? `~$${Math.round(m.totalCost * m.multiple).toLocaleString('es')}` : 'No calculado', C.text),
      infoRow('Ganancia bruta estimada', m?.grossProfit ? `$${m.grossProfit.toLocaleString('es')}` : 'N/D', C.text),
      infoRow('Margen sobre venta', m?.marginPct ? `${Math.round(m.marginPct * 100)}%` : 'N/D', C.text),
      gap(6),
      tx({ fontSize: 7.5, color: C.textDim, lineHeight: 1.5 }, '* No incluye automáticamente: impuestos de importación, aranceles, seguros, envío al cliente, comisiones de plataforma ni devoluciones.'),
    ),

    // ── Posicionamiento
    sectionTitle('Posicionamiento recomendado'),
    vw({ ...S.row, marginBottom: 10 },
      vw({ flex: 1, ...S.card, borderColor: C.red + '33' },
        tx({ ...S.label, color: C.red, marginBottom: 6 }, 'NO VENDERLO COMO'),
        tx({ ...S.body, lineHeight: 1.55 }, nr.howNotToSell),
      ),
      vw({ width: 10 }),
      vw({ flex: 1, ...S.card, borderColor: C.green + '33' },
        tx({ ...S.label, color: C.green, marginBottom: 6 }, 'SÍ VENDERLO COMO'),
        tx({ ...S.body, lineHeight: 1.55 }, nr.howToSell),
      ),
    ),
    vw({ ...S.card2, marginBottom: 20 },
      tx({ ...S.label, color: C.textDim, marginBottom: 6 }, 'FRASE DE POSICIONAMIENTO FINAL'),
      tx({ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.accent, lineHeight: 1.4, marginBottom: nr.positioningVariants.length > 0 ? 10 : 0 }, `"${nr.positioningPhrase}"`),
      nr.positioningVariants.length > 0 ? vw({},
        tx({ ...S.label, color: C.textDim, marginBottom: 5 }, 'VARIANTES'),
        ...nr.positioningVariants.map((v, i) => bulletItem(`${i + 1}. ${v}`)),
      ) : null,
    ),

    // ── Público objetivo
    sectionTitle('Público objetivo'),
    vw({ ...S.card },
      vw({ ...S.row, marginBottom: 12 },
        vw({ flex: 1 },
          tx({ ...S.label, color: C.accent, marginBottom: 5 }, 'COMPRADOR PRINCIPAL'),
          tx({ ...S.body, lineHeight: 1.55 }, nr.primaryBuyer),
        ),
        vw({ width: 14 }),
        vw({ flex: 1 },
          tx({ ...S.label, color: C.textMid, marginBottom: 5 }, 'COMPRADOR SECUNDARIO'),
          tx({ ...S.bodyMid, lineHeight: 1.55 }, nr.secondaryBuyer),
        ),
      ),
      vw(S.divider),
      vw({ ...S.row },
        vw({ flex: 1 },
          tx({ ...S.label, color: C.textDim, marginBottom: 6 }, 'SITUACIONES DE USO'),
          ...nr.usageSituations.map(s => bulletItem(s)),
        ),
        vw({ width: 14 }),
        vw({ flex: 1 },
          tx({ ...S.label, color: C.textDim, marginBottom: 6 }, 'MOTIVO EMOCIONAL'),
          tx({ fontSize: 9, color: C.yellow, lineHeight: 1.6, fontStyle: 'italic' }, nr.emotionalMotive),
        ),
      ),
    ),
  );
}

function page3(data: any, nr: ReturnType<typeof normalizeReport>) {
  return el(Page, { size: 'A4', style: S.page },

    // ── Riesgos cards
    sectionTitle('Riesgos clave y cómo manejarlos'),
    nr.risks.length > 0
      ? vw({ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6 },
          ...nr.risks.map(r => riskCard(r)),
          nr.risks.length % 2 === 1 ? vw({ width: '49%' }) : null,
        )
      : vw({ ...S.card2, marginBottom: 12 },
          tx(S.bodyMid, 'No se identificaron riesgos específicos para este producto.'),
        ),

    gap(14),

    // ── Diferenciación
    sectionTitle('Diferenciación recomendada'),
    vw({ ...S.card, marginBottom: 20 },
      nr.differentiationAngles.length > 0
        ? vw({}, ...nr.differentiationAngles.map(a => bulletItem(a)))
        : tx(S.bodyMid, 'Diferenciá por packaging, garantía extendida o contenido especializado.'),
    ),

    // ── Oferta sugerida
    sectionTitle('Oferta sugerida'),
    vw({ ...S.row },
      vw({ flex: 3, ...S.card },
        tx({ ...S.label, color: C.accent, marginBottom: 6 }, 'OFERTA PRINCIPAL'),
        tx({ ...S.body, lineHeight: 1.6, marginBottom: 12 }, nr.suggestedOffer),
        vw(S.divider),
        tx({ ...S.label, color: C.textDim, marginBottom: 5 }, 'BUNDLE RECOMENDADO'),
        tx({ ...S.bodyMid, lineHeight: 1.5 }, nr.bundleSuggestion),
      ),
      vw({ width: 10 }),
      vw({ flex: 2, ...S.card },
        tx({ ...S.label, color: C.textDim, marginBottom: 5 }, 'OFERTA ALTERNATIVA'),
        tx({ ...S.bodyMid, lineHeight: 1.55, marginBottom: 12 }, nr.altOffer),
        vw(S.divider),
        tx({ ...S.label, color: C.textDim, marginBottom: 5 }, 'SEÑALES DE ML'),
        infoRow('Competidores', fmt(data.signals?.mlCompetitors ?? data.signals?.googleMLEstimate)),
        data.signals?.mlPriceRange ? infoRow('Rango precios', `${fmt(data.signals.mlPriceRange[0])} – ${fmt(data.signals.mlPriceRange[1])}`) : null,
        data.signals?.supplierPriceRangeUSD ? infoRow('FOB proveedor', `$${data.signals.supplierPriceRangeUSD[0]}–$${data.signals.supplierPriceRangeUSD[1]} USD`) : null,
      ),
    ),
  );
}

function page4(data: any, alerts: string[]) {
  const verdict = data.result?.verdict ?? 'kill';
  const vColor  = verdictColor(verdict);

  const nextSteps: Record<string, string[]> = {
    go: [
      'Pedí muestra al proveedor — probá calidad real antes de comprar volumen',
      'Creá 5-10 creativos con distintos ángulos (demo, problema, testimonial)',
      'Lanzá test con pauta baja (USD 10-20/día durante 3-5 días)',
      'Medí CTR, CPC y costo por conversión — no escales sin datos reales',
      'No compres stock grande hasta validar el creativo ganador',
    ],
    maybe: [
      'Revisá los 5 primeros competidores en Mercado Libre — estudiá reseñas',
      'Validá el precio objetivo con 3-5 proveedores alternativos',
      'Buscá un ángulo de diferenciación que los competidores no están usando',
      'Comparar calidad entre al menos 2 proveedores antes de decidir',
      'No pautas todavía — definí primero el posicionamiento y la oferta',
    ],
    kill: [
      'No comprés stock de este producto',
      'Registrá los aprendizajes: qué señales lo descartaron',
      'Buscá un producto de la misma categoría con menor competencia',
      'Revisá si hay una variante del problema con menos jugadores',
      'Usá el análisis como base para entender qué buscar en el próximo',
    ],
  };
  const steps = nextSteps[verdict] ?? nextSteps['maybe'];

  const checklist = [
    'Pedir muestra al proveedor y validar calidad',
    'Probar duración y funcionamiento en condiciones reales',
    'Revisar packaging y presentación del producto',
    'Calcular costo final con envío, impuestos y comisiones',
    'Revisar al menos 5 competidores activos en Mercado Libre',
    'Analizar reseñas negativas de la competencia',
    'Crear y testear creativos antes de importar volumen',
    'Definir política de devolución y reclamos',
    'Confirmar proveedor alternativo de backup',
    'Validar interés real antes de comprometer stock',
  ];

  return el(Page, { size: 'A4', style: S.page },

    // ── Checklist
    sectionTitle('Checklist antes de comprar stock'),
    vw({ ...S.card, marginBottom: 20 },
      vw({ flexDirection: 'row', flexWrap: 'wrap' },
        ...checklist.map(item =>
          vw({ width: '50%', paddingRight: 8, marginBottom: 2 }, checklistItem(item)),
        ),
      ),
    ),

    // ── Timeline próximos pasos
    sectionTitle('Qué hacer ahora'),
    vw({ ...S.card, borderColor: vColor + '30', backgroundColor: vColor + '05', marginBottom: 20 },
      vw({ ...S.row, alignItems: 'center', marginBottom: 14 },
        badge(verdictLabel(verdict), vColor),
        tx({ fontSize: 8.5, color: C.textMid, marginLeft: 8 }, `Plan de acción — veredicto ${verdictLabel(verdict).toLowerCase()}`),
      ),
      ...steps.map((step, i) => timelineStep(step, i, vColor, i === steps.length - 1)),
    ),

    alerts.length > 0 ? vw({},
      sectionTitle('Alertas inteligentes'),
      vw({}, ...alerts.map(a => alertItem(a))),
    ) : null,

    // ── Footer
    vw({ position: 'absolute', bottom: 20, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between' },
      tx({ fontSize: 7, color: C.textDim }, 'E-Test · Reporte de decisión de producto ecommerce'),
      tx({ fontSize: 7, color: C.textDim }, `Generado ${new Date().toLocaleDateString('es')} · No substituye validación real con público.`),
    ),
  );
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let data: any;
  try { data = await req.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido' }, { status: 400 }); }

  if (!data?.result) return NextResponse.json({ error: 'Falta result' }, { status: 400 });

  const [enrichment, sem, alerts] = await Promise.all([
    enrichForPdf(data),
    Promise.resolve(deriveSemaforo(data)),
    Promise.resolve(deriveAlerts(data)),
  ]);

  const nr = normalizeReport(data, enrichment);

  const doc = el(
    Document,
    { title: nr.title, author: 'E-Test' },
    page1(data, sem, nr),
    page2(data, nr),
    page3(data, nr),
    page4(data, alerts),
  );

  const buffer = await renderToBuffer(doc as any);

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="etest-${slug(nr.title)}.pdf"`,
    },
  });
}

function slug(s?: string): string {
  return (s ?? 'analisis')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
