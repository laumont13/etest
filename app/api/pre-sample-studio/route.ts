import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Locale map ─────────────────────────────────────────────────────────────
const LOCALE: Record<string, { language: string; currency: string; tone: string }> = {
  AR: { language: 'Español rioplatense', currency: 'ARS', tone: 'Directo, vos, informal pero profesional' },
  MX: { language: 'Español mexicano', currency: 'MXN', tone: 'Cercano, ustedes, cálido y práctico' },
  ES: { language: 'Español de España', currency: 'EUR', tone: 'Directo, tú, profesional y claro' },
  US: { language: 'English (US)', currency: 'USD', tone: 'Direct, confident, conversion-focused' },
  BR: { language: 'Português brasileiro', currency: 'BRL', tone: 'Próximo, você, informal e profissional' },
  CO: { language: 'Español colombiano', currency: 'COP', tone: 'Cálido, tú/usted, profesional' },
  CL: { language: 'Español chileno', currency: 'CLP', tone: 'Directo, tú, moderno y práctico' },
  PE: { language: 'Español peruano', currency: 'PEN', tone: 'Profesional, cercano, tú/usted' },
};
function getLocale(c: string) {
  return LOCALE[c] ?? { language: 'Español neutro internacional', currency: 'USD', tone: 'Claro, práctico y directo' };
}

// ─── Format winner + battle context for prompt ───────────────────────────────
function formatWinnerContext(winnerData: any, battleCtx: any): string {
  const a = winnerData.analysis ?? {};
  const r = winnerData.result ?? {};
  const s = winnerData.signals ?? {};
  const m = winnerData.margin ?? {};
  return [
    `PRODUCTO GANADOR: "${winnerData.product?.title ?? ''}"`,
    `País: ${winnerData.product?.country ?? ''}`,
    `Score: ${r.adjustedScore ?? r.score ?? 0}/100  Veredicto: ${(r.verdict ?? '').toUpperCase()}`,
    `Margen: ${m.multiple ?? 0}x  Ganancia bruta: $${m.grossProfit ?? 0}  Margen %: ${Math.round((m.marginPct ?? 0) * 100)}%`,
    `Costo total: $${m.totalCost ?? 0}`,
    `Razón del veredicto: ${r.reason ?? ''}`,
    `Posicionamiento: ${a.positioning ?? ''}`,
    `Riesgos clave: ${(a.keyRisks ?? []).join(' | ')}`,
    `Ángulos de venta identificados: ${(a.angles ?? []).map((x: any) => `"${x.hook}" (${x.trigger})`).join(' | ')}`,
    `Google Trends: ${s.trendsInterest ?? 'N/D'}/100 (${s.trendDirection ?? ''})`,
    `Competidores ML: ${s.mlCompetitors ?? s.googleMLEstimate ?? 'N/D'}`,
    `Rango precios ML: ${s.mlPriceRange ? `${s.mlPriceRange[0]}–${s.mlPriceRange[1]}` : 'N/D'}`,
    `Proveedor precio USD: ${s.supplierPriceRangeUSD ? `$${s.supplierPriceRangeUSD[0]}–$${s.supplierPriceRangeUSD[1]}` : 'N/D'}`,
    `MOQ: ${s.supplierMOQ ?? 'N/D'} ${s.supplierMOQUnit ?? ''}`,
    '',
    `CONTEXTO DE BATALLA:`,
    `Venció a: "${battleCtx?.opponent ?? ''}"`,
    `Por qué ganó: ${battleCtx?.whyWon ?? battleCtx?.reason ?? ''}`,
    `Diferencia clave: ${battleCtx?.keyDifference ?? ''}`,
    `Recomendación estratégica: ${battleCtx?.recommendation ?? ''}`,
    `Confianza IA: ${battleCtx?.confidence ?? 75}%`,
  ].filter(Boolean).join('\n');
}

// ─── Fallback generator ───────────────────────────────────────────────────────
function buildFallback(winnerData: any, battleCtx: any): any {
  const country = winnerData.product?.country ?? 'AR';
  const locale  = getLocale(country);
  const title   = winnerData.product?.title ?? 'Producto';
  const score   = winnerData.result?.adjustedScore ?? winnerData.result?.score ?? 0;
  const verdict = winnerData.result?.verdict ?? 'maybe';
  const risks   = (winnerData.analysis?.keyRisks ?? []) as string[];
  const angles  = (winnerData.analysis?.angles ?? []) as any[];
  const m       = winnerData.margin ?? {};
  const short   = title.split(' ').slice(0, 3).join(' ');
  const opponent = battleCtx?.opponent ?? 'producto rival';

  return {
    product: { title, score, verdict, country, marginMultiple: m.multiple ?? 0 },
    battle: {
      opponent,
      whyWon: battleCtx?.whyWon ?? battleCtx?.reason ?? `Score superior y mejor margen.`,
      keyDifference: battleCtx?.keyDifference ?? `Mejor potencial publicitario y margen sostenible.`,
      confidence: battleCtx?.confidence ?? 75,
      recommendation: battleCtx?.recommendation ?? `Avanzar con ${short} como producto principal de testeo.`,
    },
    market: { country, language: locale.language, currency: locale.currency, tone: locale.tone },
    winnerSnapshot: {
      battleAdvantage: `${short} superó a "${opponent}" en margen sostenible y potencial de escalado con pauta.`,
      mainRisks: risks.slice(0, 3).length > 0 ? risks.slice(0, 3) : ['Saturación de mercado posible', 'Logística puede complicarse'],
      missingValidations: ['Confirmar calidad real con muestra física', 'Validar que el proveedor puede cumplir MOQ y tiempos', 'Testear ángulo principal con pauta antes de comprar stock'],
    },
    strategicDecision: {
      whyLaunch: `${short} tiene margen viable (${m.multiple ?? 0}x) y venció en batalla directa. La señal de demanda justifica un test controlado antes de comprometer stock.`,
      functionalProblem: angles[0]?.trigger ? `Problema ligado a ${angles[0].trigger.toLowerCase()}` : 'Problema funcional concreto sin resolver bien en el mercado actual',
      emotionalProblem: 'Frustración acumulada por alternativas que no cumplen lo prometido',
      mainDesire: `Resolver el problema rápido, sin drama, con un producto que realmente funcione`,
      alternativeReplaced: `Opciones baratas de baja calidad o productos más caros sin diferenciación real`,
      mainHypothesis: angles[0]?.hook ? `"${angles[0].hook}" convertirá a costo por venta aceptable en ${country}` : `El ángulo de problema-solución convertirá mejor que lifestyle en el mercado objetivo`,
      killRisk: risks[0] ?? 'Si el proveedor no puede mantener calidad consistente en pedidos repetidos',
    },
    unitEconomics: {
      suggestedRetailPrice: `Calcular entre ${m.multiple ?? 3}x–${(m.multiple ?? 3) + 0.5}x el costo total`,
      estimatedLandedCost: m.totalCost ? `$${m.totalCost} USD por unidad (suma de producto + importación + fees)` : 'Confirmar con cotización del proveedor + agente aduanero',
      grossMarginUSD: m.grossProfit ? `$${m.grossProfit} USD por unidad` : 'Depende del precio final de venta',
      grossMarginPct: m.marginPct ? `${Math.round(m.marginPct * 100)}% sobre precio de venta` : 'Objetivo mínimo: 60% sobre precio de venta',
      maxCACRecommendation: m.grossProfit ? `Máximo $${Math.round(m.grossProfit * 0.35)} USD (35% del margen bruto) para escalar con pauta` : 'Máximo 35% del margen bruto calculado',
      breakEvenLogic: `Con CAC = margen bruto, break-even es la primera venta. Con CAC < 30% margen, cada venta es rentable`,
      recommendedOffer: `Precio directo de lanzamiento, sin descuentos en la primera campaña de testeo`,
      bundleIdea: `Evaluar incluir accesorio de bajo costo o garantía extendida para subir AOV sin bajar precio`,
      discountLimit: `No más de 10–15% de descuento. Por debajo de eso se destruye margen sin ganar más conversiones`,
    },
    positioning: {
      categoryFraming: `${short} como [categoría funcional] para [audiencia principal]`,
      oneLiner: angles[0]?.hook ? `"${angles[0].hook}"` : `${short}: el producto que resuelve [problema] sin compromiso`,
      mainPromise: `Resolver [problema específico] de forma confiable, en el primer uso, sin necesidad de configuración compleja`,
      dangerousPromises: ['Garantizar resultados que dependen del usuario', 'Claims médicos o de salud sin respaldo', 'Comparaciones directas con marcas conocidas'],
      primaryAudience: `Compradores de 25–45 años en ${country} con intención de compra activa`,
      secondaryAudience: `Compradores de regalo para [ocasión relevante] en el mismo rango etario`,
      useCases: [`Uso cotidiano en [contexto principal]`, `Solución de urgencia cuando el problema aparece`, `Regalo para [perfil de receptor]`],
      objectionsToOvercome: [`¿Funciona de verdad o se ve bien solo en la foto?`, `¿Vale lo que cuesta comparado con alternativas?`, `¿Cómo sé que llega bien y en tiempo?`],
    },
    creativeAngles: angles.slice(0, 4).map((a: any, i: number) => ({
      id: `ca_0${i + 1}`,
      name: a.angle ?? `Ángulo ${i + 1}`,
      emotion: a.trigger ?? 'Relevancia inmediata',
      hook: a.hook ?? `Hook del ángulo ${i + 1}`,
      visualDirection: 'Mostrar el producto en uso real en el contexto del problema',
      objectionAttacked: i === 0 ? '¿Funciona de verdad?' : i === 1 ? '¿Vale lo que cuesta?' : '¿Llega bien?',
      hypothesis: `Este hook activa a compradores con intención y reduce el CAC en ${country}`,
      risk: 'Si la audiencia no reconoce el problema, el copy no conecta',
      confidence: i === 0 ? 'high' : i === 1 ? 'high' : 'medium',
    })),
    creativeTestingPlan: {
      staticAds: [
        {
          id: 'sa_01',
          concept: 'Problema directo con solución',
          hook: angles[0]?.hook ?? `¿Cansado de [problema]?`,
          copy: `[Nombre del problema]. ${short} lo resuelve en el primer uso. Sin complicaciones.`,
          whatItTests: 'Relevancia del problema con la audiencia objetivo',
          winSignal: 'CTR > 2% y CPC < umbral de CAC objetivo',
          winAction: 'Escalar presupuesto y testear variación con precio visible',
        },
        {
          id: 'sa_02',
          concept: 'Calidad percibida / prueba social',
          hook: `Lo que todos están probando en ${country}`,
          copy: `${short}. [Beneficio principal]. [Beneficio secundario]. Envío en [X] días.`,
          whatItTests: 'Peso de la prueba social vs. el argumento funcional',
          winSignal: 'ROAS > 2x en los primeros 3 días de pauta',
          winAction: 'Agregar testimoniales reales y escalar con video',
        },
      ],
      ugcBriefs: [
        {
          id: 'ugc_01',
          hook: `"No esperaba que funcionara así de bien"`,
          brief: `Video de 15-30 segundos. Persona real mostrando el producto en su entorno. Narración honesta sin guión memorizado. Mostrar el resultado al final.`,
          whatItTests: 'Autenticidad vs. producción pulida para conversión',
          winSignal: 'Watch-through > 60% y comentarios positivos orgánicos',
        },
      ],
      hookVariations: [
        angles[0]?.hook ?? `El problema que nadie resuelve bien`,
        `Por qué el 80% lo hace diferente ahora`,
        `Antes de comprar el genérico, leé esto`,
        `Lo probamos. Acá el resultado honesto`,
      ],
    },
    storeLanding: {
      headline: angles[0]?.hook ?? `${short}: [beneficio principal] sin [objeción principal]`,
      subheadline: `Para quienes quieren [resultado] sin [complicación]. Entrega en ${country} en [X] días.`,
      heroCopy: `${short} resuelve [problema funcional]. Sin instrucciones de 10 páginas. Sin promesas vacías. Solo funciona.`,
      benefits: [`[Beneficio 1 — funcional y medible]`, `[Beneficio 2 — emocional o de conveniencia]`, `[Beneficio 3 — reducción de riesgo]`],
      problemStatement: `Si todavía usás [alternativa inferior], ya sabés cómo termina. ${short} existe para eso.`,
      solutionStatement: `${short} [verbo de acción] [resultado] en [timeframe real]. Sin exageraciones.`,
      howItWorks: [`Paso 1: [acción simple]`, `Paso 2: [acción simple]`, `Paso 3: [resultado observable]`],
      objectionsFAQ: [
        { q: '¿Funciona de verdad o es otro producto mediocre?', a: '[Respuesta honesta con prueba o garantía]' },
        { q: '¿Cuándo llega?', a: `Entrega en [X–Y] días hábiles en ${country}.` },
        { q: '¿Qué pasa si no me gusta?', a: '[Política de devolución clara y sin drama]' },
      ],
      cta: 'Comprar ahora',
      shortDescription: `${short}: [beneficio principal] para [audiencia]. [Característica clave]. Entrega en ${country}.`,
      longDescription: `${short} fue desarrollado para [persona con problema X]. A diferencia de [alternativa], ${short} [diferenciador real]. Ideal para [caso de uso 1] y [caso de uso 2]. [Garantía o respaldo].`,
      blockOrder: ['Hero (headline + CTA + imagen principal)', 'Problema / Por qué existe', 'Solución / Cómo funciona', 'Beneficios (3 bullets)', 'Prueba visual / Demo', 'Objeciones / FAQ', 'CTA final + envío y devolución'],
    },
    preImportValidation: {
      supplierQuestions: [
        '¿Podés enviar muestras antes del pedido bulk? ¿Costo y tiempo?',
        '¿Cuál es el MOQ real y qué pasa si el primer pedido es menor?',
        '¿Cómo manejan defectos? ¿Qué % de reposición garantizan?',
        '¿Qué certificaciones tiene el producto (CE, RoHS, FDA, etc.)?',
        '¿Tienes packaging personalizable? ¿Desde qué cantidad?',
      ],
      mediaToRequest: [
        'Fotos HD del producto real (no render) en 5 ángulos mínimo',
        'Video corto mostrando el producto en uso (30–60 segundos)',
        'Foto del packaging real (exterior e interior)',
        'Foto comparativa de escala con objeto de referencia',
      ],
      certificationsToVerify: [
        'Certificación de seguridad según el destino (CE para EU, FDA para US)',
        'Declaración de conformidad del proveedor',
        'Hoja técnica con especificaciones reales (materiales, medidas, peso)',
      ],
      sampleTests: [
        'Probar el producto como lo usaría el comprador final (primer uso real)',
        'Comparar con la descripción y fotos del proveedor — ¿coincide?',
        'Evaluar empaque: ¿sobrevive el transporte? ¿se ve bien en unboxing?',
        'Tomar fotos y video propios para comparar con material del proveedor',
        'Si aplica: test de resistencia, durabilidad o resultado prometido',
      ],
      killConditions: [
        'El producto no coincide con las fotos enviadas por el proveedor',
        'El defecto rate supera el 5% en la muestra',
        'El proveedor no puede certificar el producto para el mercado destino',
        risks[0] ? `Riesgo específico detectado: ${risks[0]}` : 'Calidad real por debajo de lo que el precio al consumidor justifica',
      ],
      firstStockRecommendation: `Empezar con el MOQ mínimo o entre 50–100 unidades para el test. No comprar stock completo hasta tener al menos 10 ventas reales y confirmar la tasa de devolución.`,
    },
    launchPlan: [
      { period: 'Días 1–3', focus: 'Validación del proveedor', tasks: ['Contactar al proveedor y confirmar disponibilidad', 'Solicitar muestra y tiempo de entrega', 'Cotizar flete + aduana con agente local'], checkpoint: '¿El proveedor puede cumplir calidad, tiempo y MOQ?' },
      { period: 'Días 4–6', focus: 'Preparación de oferta y landing', tasks: ['Definir precio de venta final', 'Redactar headline, copy y descripción', 'Seleccionar o preparar imágenes de producto'], checkpoint: '¿La oferta tiene sentido en el mercado y se puede comunicar en 1 frase?' },
      { period: 'Días 7–9', focus: 'Configuración técnica', tasks: ['Crear listing o página de producto', 'Instalar píxel y configurar eventos de conversión', 'Preparar 2 creativos de testeo (estático + video o UGC)'], checkpoint: '¿El funnel técnico funciona de punta a punta?' },
      { period: 'Días 10–11', focus: 'Muestra física', tasks: ['Recibir muestra del proveedor', 'Evaluar calidad vs. promesa', 'Tomar fotos y video propios del producto real'], checkpoint: '¿La muestra pasa el test de calidad? ¿Amerita avanzar?' },
      { period: 'Días 12–14', focus: 'Test de pauta', tasks: ['Lanzar campaña con presupuesto mínimo ($15–20/día)', 'Testear 2 ángulos creativos en simultáneo', 'Monitorear CTR, CPC y primeras conversiones'], checkpoint: '¿Algún ángulo muestra señal de conversión rentable? → Decidir: escalar o ajustar' },
    ],
  };
}

// ─── New Gemini prompt for Launch Command ─────────────────────────────────────
async function generateLaunchCommand(winnerData: any, battleCtx: any): Promise<any> {
  if (process.env.TEMP_AI_BYPASS === 'true') return buildFallback(winnerData, battleCtx);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFallback(winnerData, battleCtx);

  const country = winnerData.product?.country ?? 'AR';
  const locale  = getLocale(country);

  const schema = `{
  "product":{"title":"","score":0,"verdict":"","country":"","marginMultiple":0},
  "battle":{"opponent":"","whyWon":"","keyDifference":"","confidence":0,"recommendation":""},
  "market":{"country":"","language":"","currency":"","tone":""},
  "winnerSnapshot":{"battleAdvantage":"","mainRisks":[""],"missingValidations":[""]},
  "strategicDecision":{"whyLaunch":"","functionalProblem":"","emotionalProblem":"","mainDesire":"","alternativeReplaced":"","mainHypothesis":"","killRisk":""},
  "unitEconomics":{"suggestedRetailPrice":"","estimatedLandedCost":"","grossMarginUSD":"","grossMarginPct":"","maxCACRecommendation":"","breakEvenLogic":"","recommendedOffer":"","bundleIdea":"","discountLimit":""},
  "positioning":{"categoryFraming":"","oneLiner":"","mainPromise":"","dangerousPromises":[""],"primaryAudience":"","secondaryAudience":"","useCases":[""],"objectionsToOvercome":[""]},
  "creativeAngles":[{"id":"ca_01","name":"","emotion":"","hook":"","visualDirection":"","objectionAttacked":"","hypothesis":"","risk":"","confidence":"high"}],
  "creativeTestingPlan":{"staticAds":[{"id":"sa_01","concept":"","hook":"","copy":"","whatItTests":"","winSignal":"","winAction":""}],"ugcBriefs":[{"id":"ugc_01","hook":"","brief":"","whatItTests":"","winSignal":""}],"hookVariations":[""]},
  "storeLanding":{"headline":"","subheadline":"","heroCopy":"","benefits":[""],"problemStatement":"","solutionStatement":"","howItWorks":[""],"objectionsFAQ":[{"q":"","a":""}],"cta":"","shortDescription":"","longDescription":"","blockOrder":[""]},
  "preImportValidation":{"supplierQuestions":[""],"mediaToRequest":[""],"certificationsToVerify":[""],"sampleTests":[""],"killConditions":[""],"firstStockRecommendation":""},
  "launchPlan":[{"period":"Días 1-2","focus":"","tasks":[""],"checkpoint":""}]
}`;

  const prompt = `Sos un growth operator senior y director estratégico de ecommerce en LATAM.

Tu tarea: generar un Launch Command completo para el producto ganador de una comparación directa con otro producto.

El Launch Command es un documento operativo de alta densidad que guía al founder desde la validación del proveedor hasta el primer test de pauta con criterios de decisión claros. Debe ser práctico, honesto y accionable.

${formatWinnerContext(winnerData, battleCtx)}

MERCADO: ${country} · ${locale.language} · ${locale.currency} · Tono: ${locale.tone}

INSTRUCCIONES POR SECCIÓN:

winnerSnapshot: Resume la ventaja táctica del ganador en la batalla. Los riesgos deben ser los 3 más importantes para el lanzamiento específico. Las missingValidations son lo que NO se sabe todavía y es crítico confirmar antes de comprar stock.

strategicDecision: Analizar si realmente vale lanzar. Ser honesto — si los datos muestran dudas, reflejarlas. El killRisk es la única condición que cancela el lanzamiento completamente.

unitEconomics: Usar los datos de margen del análisis para calcular todo. Si el precio de venta no está definido, sugerirlo basándose en el rango de precios ML y el múltiplo de margen. El maxCACRecommendation debe ser un número concreto en USD.

positioning: El oneLiner debe ser usable como headline real. Las dangerousPromises son claims que el producto NO puede sostener sin muestra física confirmada. Los useCases deben ser contextos de uso reales y específicos.

creativeAngles: Mínimo 4, máximo 6. Cada uno debe testear una hipótesis diferente. La confidence debe ser "high", "medium" o "low" exactamente. Los hooks deben estar en ${locale.language} y poder usarse directamente en un anuncio.

creativeTestingPlan: Los staticAds deben ser 3 conceptos distintos con copy real usable. Los ugcBriefs deben ser 2 briefs concretos para grabar sin guión memorizado. Las hookVariations deben ser 6 variantes del hook principal, en tono diferente cada una.

storeLanding: El headline debe funcionar como hero de una landing real. El blockOrder debe seguir el orden de conversión óptimo para el producto y mercado. Los objectionsFAQ deben responder las objeciones reales más frecuentes para este tipo de producto.

preImportValidation: Las supplierQuestions deben ser preguntas reales para hacer por WhatsApp/Alibaba al proveedor. Las killConditions son condiciones concretas que, si se cumplen al recibir la muestra, cancelan la compra de stock.

launchPlan: Plan de 14 días dividido en períodos de 2-3 días. Cada período tiene un foco claro y un checkpoint binario (¿sí o no?) que decide si continuar.

REGLAS:
1. Todo el texto en ${locale.language}, excepto los campos que son inherentemente en inglés.
2. No usar: "revolucionario", "mágico", "increíble", "garantizado 100%", "el mejor".
3. Los hooks deben ser directos, concretos y no genéricos.
4. Los números deben ser coherentes con los datos del análisis.
5. Si un dato no está disponible, indicarlo con "Confirmar con proveedor" — no inventar.
6. Confidence en creativeAngles: exactamente "high", "medium" o "low".

Devolvé ÚNICAMENTE JSON válido con este schema (sin markdown, sin texto fuera del JSON):
${schema}`;

  const ai = new GoogleGenAI({ apiKey });
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model, contents: prompt,
        config: { temperature: 0.65, responseMimeType: 'application/json', maxOutputTokens: 16384 },
      });
      const raw = (res.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.creativeAngles) || !parsed.strategicDecision) throw new Error('invalid shape');
      console.log(`[pre-sample-studio] generated with model=${model}`);
      return parsed;
    } catch (err) {
      const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
      console.log(`[pre-sample-studio] ${model} ${is429 ? 'rate-limited' : 'failed: ' + String(err).slice(0, 100)}`);
      if (!is429) break;
    }
  }

  return buildFallback(winnerData, battleCtx);
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────
function arr(v: unknown): any[] { return Array.isArray(v) ? v : []; }
function str(v: unknown, fallback = ''): string { return typeof v === 'string' && v.trim() ? v.trim() : fallback; }

function sanitize(d: any, winnerData: any, battleCtx: any): any {
  const country = winnerData.product?.country ?? 'AR';
  const locale  = getLocale(country);
  const title   = winnerData.product?.title ?? 'Producto';
  const m       = winnerData.margin ?? {};

  d.product = {
    title: str(d.product?.title, title),
    score: Number(d.product?.score) || (winnerData.result?.adjustedScore ?? 0),
    verdict: str(d.product?.verdict, winnerData.result?.verdict ?? 'maybe'),
    country: str(d.product?.country, country),
    marginMultiple: Number(d.product?.marginMultiple) || Number(m.multiple) || 0,
  };

  d.battle = {
    opponent: str(d.battle?.opponent, battleCtx?.opponent ?? ''),
    whyWon: str(d.battle?.whyWon, battleCtx?.whyWon ?? battleCtx?.reason ?? ''),
    keyDifference: str(d.battle?.keyDifference, battleCtx?.keyDifference ?? ''),
    confidence: Math.max(60, Math.min(95, Number(d.battle?.confidence) || Number(battleCtx?.confidence) || 75)),
    recommendation: str(d.battle?.recommendation, battleCtx?.recommendation ?? ''),
  };

  d.market = d.market ?? { country, language: locale.language, currency: locale.currency, tone: locale.tone };

  d.winnerSnapshot = {
    battleAdvantage: str(d.winnerSnapshot?.battleAdvantage),
    mainRisks: arr(d.winnerSnapshot?.mainRisks).slice(0, 4).map(String),
    missingValidations: arr(d.winnerSnapshot?.missingValidations).slice(0, 4).map(String),
  };

  const sd = d.strategicDecision ?? {};
  d.strategicDecision = {
    whyLaunch: str(sd.whyLaunch), functionalProblem: str(sd.functionalProblem),
    emotionalProblem: str(sd.emotionalProblem), mainDesire: str(sd.mainDesire),
    alternativeReplaced: str(sd.alternativeReplaced), mainHypothesis: str(sd.mainHypothesis),
    killRisk: str(sd.killRisk),
  };

  const ue = d.unitEconomics ?? {};
  d.unitEconomics = {
    suggestedRetailPrice: str(ue.suggestedRetailPrice), estimatedLandedCost: str(ue.estimatedLandedCost),
    grossMarginUSD: str(ue.grossMarginUSD), grossMarginPct: str(ue.grossMarginPct),
    maxCACRecommendation: str(ue.maxCACRecommendation), breakEvenLogic: str(ue.breakEvenLogic),
    recommendedOffer: str(ue.recommendedOffer), bundleIdea: str(ue.bundleIdea),
    discountLimit: str(ue.discountLimit),
  };

  const pos = d.positioning ?? {};
  d.positioning = {
    categoryFraming: str(pos.categoryFraming), oneLiner: str(pos.oneLiner),
    mainPromise: str(pos.mainPromise), dangerousPromises: arr(pos.dangerousPromises).map(String),
    primaryAudience: str(pos.primaryAudience), secondaryAudience: str(pos.secondaryAudience),
    useCases: arr(pos.useCases).map(String), objectionsToOvercome: arr(pos.objectionsToOvercome).map(String),
  };

  d.creativeAngles = arr(d.creativeAngles).map((a: any, i: number) => ({
    id: str(a.id, `ca_0${i + 1}`), name: str(a.name), emotion: str(a.emotion),
    hook: str(a.hook), visualDirection: str(a.visualDirection),
    objectionAttacked: str(a.objectionAttacked), hypothesis: str(a.hypothesis),
    risk: str(a.risk), confidence: ['high','medium','low'].includes(a.confidence) ? a.confidence : 'medium',
  }));
  if (d.creativeAngles.length === 0) d.creativeAngles = buildFallback(winnerData, battleCtx).creativeAngles;

  const ctp = d.creativeTestingPlan ?? {};
  d.creativeTestingPlan = {
    staticAds: arr(ctp.staticAds).map((s: any, i: number) => ({
      id: str(s.id, `sa_0${i + 1}`), concept: str(s.concept), hook: str(s.hook),
      copy: str(s.copy), whatItTests: str(s.whatItTests), winSignal: str(s.winSignal), winAction: str(s.winAction),
    })),
    ugcBriefs: arr(ctp.ugcBriefs).map((u: any, i: number) => ({
      id: str(u.id, `ugc_0${i + 1}`), hook: str(u.hook), brief: str(u.brief),
      whatItTests: str(u.whatItTests), winSignal: str(u.winSignal),
    })),
    hookVariations: arr(ctp.hookVariations).map(String),
  };

  const sl = d.storeLanding ?? {};
  d.storeLanding = {
    headline: str(sl.headline), subheadline: str(sl.subheadline), heroCopy: str(sl.heroCopy),
    benefits: arr(sl.benefits).map(String), problemStatement: str(sl.problemStatement),
    solutionStatement: str(sl.solutionStatement), howItWorks: arr(sl.howItWorks).map(String),
    objectionsFAQ: arr(sl.objectionsFAQ).map((f: any) => ({ q: str(f.q), a: str(f.a) })),
    cta: str(sl.cta, 'Comprar ahora'), shortDescription: str(sl.shortDescription),
    longDescription: str(sl.longDescription), blockOrder: arr(sl.blockOrder).map(String),
  };

  const piv = d.preImportValidation ?? {};
  d.preImportValidation = {
    supplierQuestions: arr(piv.supplierQuestions).map(String),
    mediaToRequest: arr(piv.mediaToRequest).map(String),
    certificationsToVerify: arr(piv.certificationsToVerify).map(String),
    sampleTests: arr(piv.sampleTests).map(String),
    killConditions: arr(piv.killConditions).map(String),
    firstStockRecommendation: str(piv.firstStockRecommendation),
  };

  d.launchPlan = arr(d.launchPlan).map((p: any) => ({
    period: str(p.period), focus: str(p.focus),
    tasks: arr(p.tasks).map(String), checkpoint: str(p.checkpoint),
  }));
  if (d.launchPlan.length === 0) d.launchPlan = buildFallback(winnerData, battleCtx).launchPlan;

  return d;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido' }, { status: 400 }); }

  // Accept either new format { winnerData, battleContext } or legacy { ...AnalysisPayload }
  const winnerData = body.winnerData ?? body;
  const battleCtx  = body.battleContext ?? body.battle ?? null;

  if (!winnerData?.result) {
    return NextResponse.json({ error: 'Falta result del análisis del ganador' }, { status: 400 });
  }

  try {
    const raw    = await generateLaunchCommand(winnerData, battleCtx);
    const result = sanitize(raw, winnerData, battleCtx);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[pre-sample-studio] unexpected error:', err);
    const fallback = sanitize(buildFallback(winnerData, battleCtx), winnerData, battleCtx);
    return NextResponse.json(fallback);
  }
}
