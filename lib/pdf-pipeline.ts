// Data quality pipeline for PDF export

export function cleanText(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function isUsefulText(value: unknown): boolean {
  const s = cleanText(value);
  if (s.length < 8) return false;
  if (/^(n\/a|nd|n\/d|sin datos?|no disponible|null|undefined|0)$/i.test(s)) return false;
  const alphaRatio = (s.match(/[a-záéíóúñüA-Z]/g) ?? []).length / s.length;
  return alphaRatio >= 0.3;
}

export function looksIncompleteSentence(text: string): boolean {
  const t = text.trim();
  if (t.length < 15) return true;
  if (!/[.!?…]$/.test(t)) return true;
  if (/^[a-záéíóú]/.test(t)) return true;
  return false;
}

export function deduplicateList(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function textQualityScore(text: string): number {
  if (!isUsefulText(text)) return 0;
  let score = 40;
  if (text.length > 40) score += 20;
  if (text.length > 100) score += 20;
  if (!looksIncompleteSentence(text)) score += 20;
  return Math.min(score, 100);
}

export type RiskCategory =
  | 'saturation' | 'quality' | 'logistics' | 'differentiation'
  | 'price' | 'demand' | 'regulatory' | 'supplier'
  | 'margin' | 'trust' | 'usability' | 'general';

const RISK_KEYWORDS: Record<RiskCategory, string[]> = {
  saturation:      ['saturad', 'competencia', 'competitor', 'vendedor', 'jugador'],
  quality:         ['calidad', 'durabilidad', 'defecto', 'material', 'rotura', 'falla'],
  logistics:       ['logíst', 'envío', 'entrega', 'import', 'aduana', 'almacén', 'stock'],
  differentiation: ['diferencia', 'marca', 'branding', 'commodity', 'genéric'],
  price:           ['precio', 'caro', 'barato', 'descuento'],
  demand:          ['demanda', 'tendencia', 'estacional', 'mercado', 'interés'],
  regulatory:      ['regulat', 'legal', 'certificado', 'permiso', 'arancel', 'prohibid'],
  supplier:        ['proveedor', 'supplier', 'fábrica', 'china', 'alibaba', 'moq'],
  margin:          ['margen', 'ganancia', 'rentabilidad', 'costo', 'profitable'],
  trust:           ['confianza', 'reputación', 'reviews', 'reseña', 'scam', 'garantía'],
  usability:       ['uso', 'instrucción', 'complejidad', 'difícil', 'aprendizaje'],
  general:         [],
};

export function classifyRisk(riskText: string): RiskCategory {
  const lower = riskText.toLowerCase();
  for (const [cat, keywords] of Object.entries(RISK_KEYWORDS)) {
    if (cat === 'general') continue;
    if ((keywords as string[]).some(k => lower.includes(k))) return cat as RiskCategory;
  }
  return 'general';
}

export interface RiskHints { validate: string; reduce: string; }

const RISK_HINTS: Record<RiskCategory, RiskHints> = {
  saturation:      { validate: 'Revisá las 20 primeras páginas de ML y contá vendedores activos.', reduce: 'Elegí un nicho específico dentro de la categoría o diferenciá el packaging.' },
  quality:         { validate: 'Pedí muestra y probala en condiciones reales durante al menos 2 semanas.', reduce: 'Exigí certificado de calidad al proveedor y documentá las fallas posibles.' },
  logistics:       { validate: 'Consultá tiempos reales con tu agente de carga antes de vender.', reduce: 'Trabajá con un agente aduanero y mantené stock de seguridad local.' },
  differentiation: { validate: 'Buscá si hay competidores con marca propia en la categoría.', reduce: 'Creá nombre, packaging y storytelling únicos para el producto.' },
  price:           { validate: 'Relevá precio promedio de los 10 competidores más vendidos.', reduce: 'Ofrecé bundle o garantía extendida para justificar un precio mayor.' },
  demand:          { validate: 'Chequeá Google Trends en tu país por al menos 12 meses.', reduce: 'Diversificá con productos complementarios para suavizar la estacionalidad.' },
  regulatory:      { validate: 'Consultá con un despachante sobre aranceles y restricciones.', reduce: 'Obtené los certificados necesarios antes de hacer stock grande.' },
  supplier:        { validate: 'Pedí muestra de al menos 2 proveedores distintos y comparalas.', reduce: 'Negociá con al menos 2 proveedores para no quedar rehén de uno solo.' },
  margin:          { validate: 'Calculá el margen real incluyendo envío, fees de ML y devoluciones.', reduce: 'Buscá reducir el costo logístico o aumentar el ticket con upsell.' },
  trust:           { validate: 'Leé las 20 reseñas negativas de los competidores principales.', reduce: 'Ofrecé garantía de devolución sin preguntas y comunicalo claramente.' },
  usability:       { validate: 'Mostrá el producto a 5 personas sin explicar y medí si lo entienden.', reduce: 'Incluí guía visual de uso y creá contenido demostrativo antes de escalar.' },
  general:         { validate: 'Validá el supuesto principal con datos o muestra real de mercado.', reduce: 'Documentá el riesgo y definí un umbral de decisión claro antes de avanzar.' },
};

export function getRiskHints(category: RiskCategory): RiskHints {
  return RISK_HINTS[category];
}

export interface NormalizedRisk {
  risk: string;
  level: 'alto' | 'medio' | 'bajo';
  whyImportant: string;
  howToValidate: string;
  howToReduce: string;
  category: RiskCategory;
}

export interface NormalizedReport {
  title: string;
  score: number;
  verdict: string;
  executiveSummary: string;
  verdictPhrase: string;
  positioningPhrase: string;
  positioningVariants: string[];
  howToSell: string;
  howNotToSell: string;
  primaryBuyer: string;
  secondaryBuyer: string;
  usageSituations: string[];
  emotionalMotive: string;
  suggestedOffer: string;
  altOffer: string;
  bundleSuggestion: string;
  differentiationAngles: string[];
  risks: NormalizedRisk[];
}

export function normalizeReport(data: any, enrichment: any): NormalizedReport {
  const clean = (v: unknown, fb = '') => {
    const s = cleanText(v);
    return isUsefulText(s) ? s : fb;
  };
  const cleanList = (arr: unknown[], fb: string[] = []): string[] => {
    if (!Array.isArray(arr)) return fb;
    const cleaned = deduplicateList(arr.map(v => cleanText(v)).filter(isUsefulText));
    return cleaned.length > 0 ? cleaned : fb;
  };

  const risks: NormalizedRisk[] = (Array.isArray(enrichment.enhancedRisks) ? enrichment.enhancedRisks : [])
    .map((r: any) => {
      const category = classifyRisk((r.risk ?? '') + ' ' + (r.whyImportant ?? ''));
      const hints = getRiskHints(category);
      return {
        risk: clean(r.risk, 'Riesgo no especificado'),
        level: (['alto', 'medio', 'bajo'].includes(r?.level) ? r.level : 'medio') as 'alto' | 'medio' | 'bajo',
        whyImportant: clean(r.whyImportant, hints.validate),
        howToValidate: clean(r.howToValidate, hints.validate),
        howToReduce: clean(r.howToReduce, hints.reduce),
        category,
      };
    });

  if (risks.length === 0 && Array.isArray(data.analysis?.keyRisks)) {
    (data.analysis.keyRisks as string[]).slice(0, 5).forEach((r: string) => {
      const category = classifyRisk(r);
      const hints = getRiskHints(category);
      risks.push({
        risk: r.split(' ').slice(0, 5).join(' '),
        level: 'medio',
        whyImportant: clean(r, hints.validate),
        howToValidate: hints.validate,
        howToReduce: hints.reduce,
        category,
      });
    });
  }

  return {
    title: clean(data.product?.title, 'Producto sin título'),
    score: data.result?.adjustedScore ?? data.result?.score ?? 0,
    verdict: data.result?.verdict ?? 'kill',
    executiveSummary: clean(enrichment.executiveSummary, data.result?.reason ?? ''),
    verdictPhrase: clean(enrichment.verdictPhrase, ''),
    positioningPhrase: clean(enrichment.positioningPhrase, ''),
    positioningVariants: cleanList(enrichment.positioningVariants ?? []),
    howToSell: clean(enrichment.howToSell, ''),
    howNotToSell: clean(enrichment.howNotToSell, ''),
    primaryBuyer: clean(enrichment.primaryBuyer, ''),
    secondaryBuyer: clean(enrichment.secondaryBuyer, ''),
    usageSituations: cleanList(enrichment.usageSituations ?? []),
    emotionalMotive: clean(enrichment.emotionalMotive, ''),
    suggestedOffer: clean(enrichment.suggestedOffer, ''),
    altOffer: clean(enrichment.altOffer, ''),
    bundleSuggestion: clean(enrichment.bundleSuggestion, ''),
    differentiationAngles: cleanList(enrichment.differentiationAngles ?? []),
    risks,
  };
}
