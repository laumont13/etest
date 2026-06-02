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

// ─── Format analysis for prompt ─────────────────────────────────────────────
function formatAnalysis(data: any): string {
  const a = data.analysis ?? {};
  const r = data.result ?? {};
  const s = data.signals ?? {};
  const lines = [
    `Producto: ${data.product?.title ?? ''}`,
    `País/mercado: ${data.product?.country ?? ''}`,
    `Score: ${r.adjustedScore ?? r.score ?? 0}/100`,
    `Veredicto: ${r.verdict ?? 'kill'}`,
    `Razón del veredicto: ${r.reason ?? ''}`,
    `Margen múltiplo: ${data.margin?.multiple ?? 0}x`,
    `Posicionamiento sugerido: ${a.positioning ?? ''}`,
    `Riesgos clave: ${(a.keyRisks ?? []).join('; ')}`,
    `Ángulos de venta: ${(a.angles ?? []).map((x: any) => x.hook).filter(Boolean).join('; ')}`,
    `Competidores en ML: ${s.mlCompetitors ?? s.googleMLEstimate ?? 'N/D'}`,
    `Rango precios ML: ${s.mlPriceRange ? `${s.mlPriceRange[0]}–${s.mlPriceRange[1]}` : 'N/D'}`,
    `Google Trends: ${s.trendsInterest ?? 'N/D'}/100`,
    `Proveedor precio USD: ${s.supplierPriceRangeUSD ? `$${s.supplierPriceRangeUSD[0]}–$${s.supplierPriceRangeUSD[1]}` : 'N/D'}`,
    `MOQ proveedor: ${s.supplierMOQ ?? 'N/D'} ${s.supplierMOQUnit ?? ''}`,
  ];
  return lines.filter(l => !l.endsWith(': ') && !l.endsWith(': N/D') && !l.endsWith(': 0')).join('\n');
}

// ─── Fallback generator (LaunchBoardData format) ────────────────────────────
function buildFallback(data: any): any {
  const country  = data.product?.country ?? 'AR';
  const locale   = getLocale(country);
  const title    = data.product?.title ?? 'Producto';
  const score    = data.result?.adjustedScore ?? data.result?.score ?? 0;
  const verdict  = data.result?.verdict ?? 'maybe';
  const angles   = (data.analysis?.angles ?? []).map((a: any) => a.hook).filter(Boolean) as string[];
  const risks    = (data.analysis?.keyRisks ?? []) as string[];
  const pos      = data.analysis?.positioning ?? '';

  const shortTitle = title.split(' ').slice(0, 3).join(' ');
  const platform = ['AR','MX','CL','CO'].includes(country) ? 'Tiendanube' : country === 'BR' ? 'Nuvemshop' : country === 'US' ? 'Shopify' : 'Tiendanube';

  // ── product panel ────────────────────────────────────────────────────────
  const product = {
    title,
    score,
    verdict,
    mainOpportunity: pos ? pos.split('.')[0] : `${shortTitle} tiene demanda real con espacio para diferenciarse`,
    mainRisk: risks[0] ?? 'Alta competencia en precio — diferenciación de marca es clave',
    whyPursue: angles[0] ? `El ángulo "${angles[0]}" permite posicionar con claridad y testar rápido` : 'Buen múltiplo de margen y señal de demanda validada',
    signalsSummary: data.signals?.trendsInterest ? `Trends ${data.signals.trendsInterest}/100 · ${data.signals.mlCompetitors ?? '?'} publicaciones ML` : undefined,
  };

  // ── brand territories ────────────────────────────────────────────────────
  const brandTerritories = [
    {
      id: 'bt_01',
      name: 'Premium Accesible',
      commercialPositioning: `${shortTitle} posicionado como la opción de calidad real sin precio de lujo`,
      perceivedValue: 'Producto serio, bien terminado, que vale lo que cuesta',
      bestFor: 'Compradores que investigan antes de comprar y valoran calidad sobre precio mínimo',
      whenToUse: 'Cuando el margen permite precio medio-alto y hay diferenciadores visuales claros',
      whenNotToUse: 'Si el producto es idéntico a opciones más baratas — la promesa no sostendrá',
      visualDirection: 'Fondos oscuros o blancos puros, tipografía sans-serif bold, fotografía profesional limpia',
      storeUsage: 'Hero con headline de posicionamiento + beneficios concretos + garantía visible',
      adUsage: 'Creativos de calidad percibida: close-up del producto, empaque, detalle de materiales',
      packagingUsage: 'Caja o bolsa de color sólido con logo centrado, sin exceso de texto',
      suggestedColors: ['#1A1A2E', '#FFFFFF', '#C9A96E'],
      colorsToAvoid: ['#FF6B00', '#FFCC00'],
      matchingWords: ['calidad', 'diseño', 'duradero', 'confiable', 'vale lo que cuesta'],
    },
    {
      id: 'bt_02',
      name: 'Funcional Directo',
      commercialPositioning: `${shortTitle} posicionado como la solución práctica sin vueltas`,
      perceivedValue: 'Eficiente, sin complicaciones, resuelve el problema en el primer uso',
      bestFor: 'Compradores orientados a la utilidad, que no quieren aprender ni esperar resultados',
      whenToUse: 'Cuando la propuesta es claramente funcional y el tiempo/esfuerzo es el pain principal',
      whenNotToUse: 'Si el producto tiene componente aspiracional fuerte — esta marca se siente mundana',
      visualDirection: 'Colores medios (azul, gris, verde), fotografía de uso real, infografías de pasos simples',
      storeUsage: 'Destacar "cómo funciona" en 3 pasos, FAQs prominentes, precio y envío visibles arriba',
      adUsage: 'Demos de uso, antes/después sin exagerar, comparación con alternativa común',
      packagingUsage: 'Empaque funcional: instrucciones visibles, colores corporativos, sin frivolidades',
      suggestedColors: ['#1E3A5F', '#F0F4F8', '#2ECC71'],
      colorsToAvoid: ['#FF1493', '#800080'],
      matchingWords: ['simple', 'efectivo', 'fácil de usar', 'sin complicaciones', 'resuelve'],
    },
    {
      id: 'bt_03',
      name: 'Estilo Personal',
      commercialPositioning: `${shortTitle} como parte del estilo e identidad del comprador`,
      perceivedValue: 'Dice algo de vos. No es solo un producto — es una elección',
      bestFor: 'Compradores con identidad definida que cuidan la estética de lo que usan o regalan',
      whenToUse: 'Cuando el producto es visible, personalizable o parte de una rutina con carga identitaria',
      whenNotToUse: 'Para productos puramente utilitarios donde nadie pregunta qué usás',
      visualDirection: 'Lifestyle auténtico, personas reales en entornos naturales, paleta cálida o vibrante',
      storeUsage: 'Fotografía lifestyle dominante, testimonios con foto, comunidad y reseñas destacadas',
      adUsage: 'UGC-style, reacciones genuinas, videos cortos de uso en entorno natural',
      packagingUsage: 'Empaque con mensaje inspiracional, tarjeta personalizada, experiencia de unboxing cuidada',
      suggestedColors: ['#F5CBA7', '#2C3E50', '#E74C3C'],
      colorsToAvoid: ['#808080', '#C0C0C0'],
      matchingWords: ['auténtico', 'para vos', 'tu estilo', 'parte de tu rutina', 'lo que elegís'],
    },
  ];

  // ── creative angles ──────────────────────────────────────────────────────
  const creativeAngles = [
    {
      id: 'ca_01',
      name: 'Problema → Solución',
      emotion: 'Alivio y resolución',
      targetAudience: 'Compradores activos que ya sienten el problema',
      whyItCouldWork: 'Conecta primero con la frustración antes de mostrar el producto — alta relevancia',
      risk: 'Si el problema no es universal puede segmentar demasiado',
      recommendedVisual: 'Imagen del problema sin producto, luego producto como resolución',
    },
    {
      id: 'ca_02',
      name: 'Calidad Real Sin Exagerar',
      emotion: 'Confianza y seguridad',
      targetAudience: 'Compradores que ya fueron quemados por productos baratos',
      whyItCouldWork: 'La honestidad es diferencial cuando todos exageran — genera credibilidad instantánea',
      risk: 'Puede sentirse menos emocionante sin un resultado prometido',
      recommendedVisual: 'Close-up de materiales, empaque, detalle de construcción',
    },
    {
      id: 'ca_03',
      name: 'Contexto de Uso Aspiracional',
      emotion: 'Deseo e identificación',
      targetAudience: 'Compradores que se proyectan en el estilo de vida del producto',
      whyItCouldWork: 'Vende el resultado emocional, no el producto — más memorable',
      risk: 'Sin muestra real las imágenes de lifestyle deben ser genéricas — menos auténticas',
      recommendedVisual: 'Lifestyle natural: producto integrado en ambiente cotidiano deseable',
    },
    {
      id: 'ca_04',
      name: 'Precio/Valor Directo',
      emotion: 'Sensación de inteligencia de compra',
      targetAudience: 'Compradores comparadores que justifican la compra con lógica',
      whyItCouldWork: 'En mercados con mucha competencia de precio, explicar el valor es diferencial',
      risk: 'Si el precio no es competitivo este ángulo se vuelve en contra',
      recommendedVisual: 'Comparación visual sin naming de competidores, tabla de características',
    },
    {
      id: 'ca_05',
      name: 'Curiosidad / Unboxing',
      emotion: 'Anticipación y deseo',
      targetAudience: 'Compradores impulsivos y audiencias de descubrimiento (tráfico frío)',
      whyItCouldWork: 'El formato de revelación retiene atención — bueno para awareness',
      risk: 'Baja intención de compra directa — sirve más para tráfico de marca',
      recommendedVisual: 'Manos abriendo caja, producto revelándose gradualmente',
    },
    {
      id: 'ca_06',
      name: 'Escasez / Preventa Honesta',
      emotion: 'Urgencia y exclusividad sin presión falsa',
      targetAudience: 'Compradores ya interesados que necesitan el último empujón',
      whyItCouldWork: 'Para lanzamientos, el "primer lote limitado" es real y creíble sin manipulación',
      risk: 'Si el stock nunca es limitado, la audiencia pierde confianza',
      recommendedVisual: 'Story con badge de "preventa" o "lote inicial", contador opcional',
    },
  ];

  // ── audience segments ────────────────────────────────────────────────────
  const audienceSegments = [
    {
      id: 'as_01',
      name: 'Comprador Investigador',
      painDesire: 'Quiere tomar la mejor decisión posible y no arrepentirse de la compra',
      whyItMatters: 'Compra con más certeza, menor tasa de devolución, deja reseñas detalladas',
      buyingMotivation: 'Comparaciones claras, especificaciones reales, garantía visible',
      riskObjection: '¿Es de calidad real o solo looks bien en la foto?',
    },
    {
      id: 'as_02',
      name: 'Buscador de Comodidad',
      painDesire: 'Quiere resolver el problema ya, sin complicaciones ni aprendizaje',
      whyItMatters: 'Alta velocidad de decisión, menor resistencia de precio si el beneficio es claro',
      buyingMotivation: 'Facilidad de uso, entrega rápida, proceso de compra sin fricción',
      riskObjection: '¿Funciona desde el primer uso o necesita configuración?',
    },
    {
      id: 'as_03',
      name: 'Comprador de Regalo',
      painDesire: 'Quiere regalar algo que impresione sin gastar de más',
      whyItMatters: 'Ticket promedio más alto, menor sensibilidad al precio, valoriza el empaque',
      buyingMotivation: 'Presentación, empaque cuidado, "se ve caro", opción de mensaje personalizado',
      riskObjection: '¿Le va a gustar a quien se lo regalo? ¿Llega bien presentado?',
    },
    {
      id: 'as_04',
      name: 'Early Adopter Local',
      painDesire: 'Quiere estar entre los primeros en tener algo que todavía no es masivo',
      whyItMatters: 'Difunde orgánicamente, tolera imperfecciones de lanzamiento, UGC natural',
      buyingMotivation: 'Novedad, exclusividad de primera oleada, precio de lanzamiento',
      riskObjection: '¿Es algo que realmente no consigo en otro lado o es lo mismo de siempre?',
    },
  ];

  // ── offer directions ─────────────────────────────────────────────────────
  const offerDirections = [
    {
      id: 'od_01',
      name: 'Lanzamiento Estándar',
      offerIdea: `${shortTitle} a precio de introducción por tiempo limitado (10-15% de descuento sobre precio objetivo)`,
      whyItCouldWork: 'Bajo riesgo, directo al punto, fácil de comunicar',
      marginCaution: 'Verificá que el descuento no baje el múltiplo por debajo de tu mínimo',
      whenNotToUse: 'Si el posicionamiento es premium — el descuento puede dañar la percepción de valor',
    },
    {
      id: 'od_02',
      name: 'Bundle de Valor',
      offerIdea: `${shortTitle} + accesorio complementario (estuche, guía, item de bajo costo) al mismo precio`,
      whyItCouldWork: 'Sube el valor percibido sin bajar el precio — mejor AOV y menor comparación directa',
      marginCaution: 'El accesorio debe costar poco — máximo 10-15% del precio del producto principal',
      whenNotToUse: 'Si el accesorio es difícil de conseguir rápido — complica el lanzamiento',
    },
    {
      id: 'od_03',
      name: 'Preventa con Garantía',
      offerIdea: `Reserva anticipada con garantía de devolución total si el producto no cumple expectativas`,
      whyItCouldWork: 'Elimina el riesgo percibido — ideal para compradores que quieren pero dudan',
      marginCaution: 'Asegurate de tener el stock listo para entregar en el plazo prometido',
      whenNotToUse: 'Si el producto ya está disponible — la preventa pierde lógica y credibilidad',
    },
  ];

  // ── static creatives (BoardCreative format) ──────────────────────────────
  const hook0 = angles[0] ?? `¿Cansado del problema que ${shortTitle} resuelve?`;
  const hook1 = angles[1] ?? `${shortTitle} — sin vueltas.`;
  const hook2 = angles[2] ?? `Así se usa en la vida real.`;

  const staticCreatives = [
    {
      id: 'sc_01', hook: hook0, angle: 'Problema-solución',
      format: '4:5', mainCopy: `Hay una forma más inteligente de hacerlo. ${shortTitle} existe para eso.`,
      visualDirection: 'Imagen de problema (sin producto) con texto superpuesto exterior',
      cta: 'Ver más', whyTestThis: 'Conecta con la frustración antes de mostrar el producto',
      whatItValidates: 'Resonancia del problema con el público objetivo',
      claimRisk: 'low' as const, claimCaution: 'No menciona resultado específico — solo el problema',
    },
    {
      id: 'sc_02', hook: `${shortTitle} — diseñado para durar.`, angle: 'Credibilidad',
      format: '1:1', mainCopy: 'No improvisamos. Cada detalle importa.',
      visualDirection: 'Producto solo sobre fondo blanco, luz de estudio',
      cta: 'Conocer más', whyTestThis: 'Construye credibilidad visual sin claims de performance',
      whatItValidates: 'Percepción de calidad antes de tener muestra física',
      claimRisk: 'low' as const, claimCaution: 'Sin promesas de durabilidad hasta validar con muestra',
    },
    {
      id: 'sc_03', hook: hook2, angle: 'Lifestyle aspiracional',
      format: '4:5', mainCopy: 'Sin complicaciones. Sin curva de aprendizaje.',
      visualDirection: 'Lifestyle natural: persona usando en ambiente cotidiano',
      cta: 'Descubrir', whyTestThis: 'Muestra contexto de uso sin claims de resultado',
      whatItValidates: 'Atractivo visual y fit con el público objetivo',
      claimRisk: 'low' as const, claimCaution: 'No promete resultado — solo muestra uso natural',
    },
    {
      id: 'sc_04', hook: 'Stock limitado para este lanzamiento.', angle: 'Escasez de lanzamiento',
      format: '9:16', mainCopy: 'Solo para los primeros compradores. Primer lote reducido, sin promesas exageradas.',
      visualDirection: 'Story vertical con badge "Preventa" o "Lote inicial"',
      cta: 'Reservar el mío', whyTestThis: 'Convierte la escasez real de lanzamiento en urgencia honesta',
      whatItValidates: 'Conversión con oferta de primer lote',
      claimRisk: 'medium' as const, claimCaution: 'Solo si el stock es realmente limitado — si no, daña la confianza',
    },
    {
      id: 'sc_05', hook: '¿Qué hay adentro?', angle: 'Curiosidad / Unboxing',
      format: '4:5', mainCopy: 'La experiencia empieza desde que abrís la caja.',
      visualDirection: 'Manos abriendo empaque, contenido revelándose',
      cta: 'Ver proceso', whyTestThis: 'El formato de revelación retiene atención en frío',
      whatItValidates: 'Curiosidad e interés previo a tener muestra real',
      claimRisk: 'low' as const, claimCaution: 'No hace ningún claim de producto — solo unboxing',
    },
    {
      id: 'sc_06', hook: 'La diferencia está en los detalles.', angle: 'Trust building',
      format: '1:1', mainCopy: 'Empaque que cuida el producto. Porque el primer contacto importa.',
      visualDirection: 'Close-up de empaque, detalles de materiales, luz lateral suave',
      cta: 'Ver producto', whyTestThis: 'Eleva percepción de calidad sin claims de funcionamiento',
      whatItValidates: 'Percepción de calidad del packaging',
      claimRisk: 'low' as const, claimCaution: 'Solo muestra el empaque — sin claims de contenido',
    },
    {
      id: 'sc_07', hook: `Parte de tu rutina.`, angle: 'Identidad / Lifestyle',
      format: '1:1', mainCopy: `${shortTitle}. Simple. Efectivo. Parte de lo que hacés bien.`,
      visualDirection: 'Flat lay con producto y accesorios complementarios sobre superficie neutra',
      cta: 'Ver detalles', whyTestThis: 'Vende estilo de vida, no el producto — más emocional',
      whatItValidates: 'Fit estético e identitario con el público objetivo',
      claimRisk: 'low' as const, claimCaution: 'No menciona resultado físico ni funcionamiento',
    },
    {
      id: 'sc_08', hook: pos ? pos.split('.')[0] : `${shortTitle}: la elección inteligente.`, angle: 'Posicionamiento directo',
      format: '16:9', mainCopy: 'Sin exageraciones. Solo lo que necesitás saber para decidir bien.',
      visualDirection: 'Producto en ambiente elegante y minimalista, hero horizontal para web',
      cta: 'Ver colección', whyTestThis: 'Hero de tienda que posiciona antes que convierte',
      whatItValidates: 'CTR en tráfico de búsqueda y email',
      claimRisk: 'low' as const, claimCaution: 'Sin atributos específicos hasta validar con muestra',
    },
    {
      id: 'sc_09', hook: hook1, angle: 'Solución directa',
      format: '9:16', mainCopy: `No prometemos lo que no podemos verificar. Sí prometemos ${shortTitle} y atención real.`,
      visualDirection: 'Story vertical con texto y CTA centrado, imagen de producto limpia',
      cta: 'Probalo ahora', whyTestThis: 'La honestidad es diferencial cuando todos exageran',
      whatItValidates: 'Conversión con mensaje de credibilidad',
      claimRisk: 'low' as const, claimCaution: 'Explícitamente no hace claims no verificados',
    },
    {
      id: 'sc_10', hook: '¿Por qué vale lo que vale?', angle: 'Precio/Valor',
      format: '4:5', mainCopy: `Porque ${shortTitle} no es el más barato. Es el que vale lo que pagás.`,
      visualDirection: 'Comparación visual en dos columnas sin naming de competidores',
      cta: 'Comparar opciones', whyTestThis: 'En mercados de precio, explicar el valor es diferencial',
      whatItValidates: 'Sensibilidad al precio y percepción de valor',
      claimRisk: 'medium' as const, claimCaution: 'La comparación debe ser honesta — no exagerar diferencias no verificadas',
    },
    {
      id: 'sc_11', hook: 'Tan simple que no necesita manual.', angle: 'Facilidad de uso',
      format: '4:5', mainCopy: 'Diseñado para usarse desde el primer día, sin tutoriales.',
      visualDirection: 'Manos usando el producto de forma natural, primer plano íntimo',
      cta: 'Ver cómo funciona', whyTestThis: 'Reduce la barrera de adopción para compradores cautelosos',
      whatItValidates: 'Percepción de facilidad de uso',
      claimRisk: 'medium' as const, claimCaution: 'Validar que realmente es intuitivo cuando llegue la muestra',
    },
    {
      id: 'sc_12', hook: `¿Conocés ${shortTitle}?`, angle: 'Descubrimiento frío',
      format: '1:1', mainCopy: `No para todo el mundo. Pero si estabas buscando algo así — esto es para vos.`,
      visualDirection: 'Producto hero sobre fondo de acento, texto introductorio mínimo',
      cta: 'Conocer más', whyTestThis: 'Awareness en audiencia nueva sin interés previo declarado',
      whatItValidates: 'Alcance y CPM en tráfico completamente frío',
      claimRisk: 'low' as const, claimCaution: 'Puramente de descubrimiento — sin claims de ningún tipo',
    },
  ];

  // ── image prompts (BoardImagePrompt format) ──────────────────────────────
  const imagePrompts = [
    {
      id: 'ip_01', title: 'Hero producto plano',
      objective: 'Imagen principal de tienda y creativos de producto',
      prompt: `${title} product flat lay on white background, studio lighting, sharp focus, professional product photography, minimalist, no text, no logos`,
      avoid: 'text, watermark, shadow clutter, dark background, people',
      claimSafetyNote: 'No muestra características físicas no verificadas — solo el producto sobre blanco',
    },
    {
      id: 'ip_02', title: 'Lifestyle uso natural',
      objective: 'Mostrar contexto de uso sin claims de resultado',
      prompt: `person naturally using ${title.toLowerCase()}, lifestyle photography, bright ambient light, authentic moment, no text, modern interior`,
      avoid: 'text, logos, before/after, dramatic expressions, exaggerated claims',
      claimSafetyNote: 'No promete resultado — solo contexto de uso auténtico',
    },
    {
      id: 'ip_03', title: 'Close-up textura y empaque',
      objective: 'Elevar percepción de calidad y materiales',
      prompt: `close up product packaging, soft side lighting, texture detail, premium feel, macro photography, no text visible on product, clean background`,
      avoid: 'text on product, blur, dark background, grungy',
      claimSafetyNote: 'Muestra empaque y textura — sin claims de durabilidad o funcionamiento',
    },
    {
      id: 'ip_04', title: 'Flat lay lifestyle',
      objective: 'Contenido de feed estético para redes sociales',
      prompt: `${title.toLowerCase()} flat lay arrangement, complementary items, neutral linen surface, overhead shot, natural daylight, styled composition, no text`,
      avoid: 'text, watermark, cluttered composition, artificial colors',
      claimSafetyNote: 'Composición estética pura — sin claims de producto',
    },
    {
      id: 'ip_05', title: 'Representación del problema',
      objective: 'Set-up emocional del problema que resuelve (sin mostrar el producto)',
      prompt: `person experiencing frustration or challenge related to ${title.toLowerCase()}, candid expression, natural setting, relatable scenario, soft light, no text`,
      avoid: 'product visible, text, logos, exaggerated or fake expressions',
      claimSafetyNote: 'Solo muestra el problema — el producto no aparece, sin claims',
    },
    {
      id: 'ip_06', title: 'Comparación de valor',
      objective: 'Creativos de valor percibido frente a alternativa genérica',
      prompt: `side by side comparison shot, ${title.toLowerCase()} versus common alternative solution, clean studio background, no text overlay needed, professional photography`,
      avoid: 'text in image, messy background, brand names of competitors',
      claimSafetyNote: 'Comparación visual sin claims de performance cuantificado',
    },
    {
      id: 'ip_07', title: 'Detalle de uso: manos',
      objective: 'Mostrar intuitividad y facilidad de uso real',
      prompt: `hands using ${title.toLowerCase()}, close up shot, natural light, authentic gesture, skin-tone neutral, no text, editorial style`,
      avoid: 'text, logos, overly perfect manicure, artificial pose, studio feel',
      claimSafetyNote: 'No muestra resultado — solo el acto de uso natural',
    },
    {
      id: 'ip_08', title: 'Ambiente premium para hero de tienda',
      objective: 'Imagen aspiracional para cabecera de tienda online',
      prompt: `${title.toLowerCase()} in elegant minimalist interior, soft natural light from window, premium lifestyle setting, wide shot, no people, no text`,
      avoid: 'text, busy background, cluttered scene, harsh shadows',
      claimSafetyNote: 'Ambiente aspiracional — sin claims sobre el producto en sí',
    },
    {
      id: 'ip_09', title: 'Story formato vertical',
      objective: 'Imagen para Instagram/Facebook Stories con espacio para texto',
      prompt: `${title.toLowerCase()} vertical product shot, bold composition, gradient background, space at top and bottom for text overlay, vibrant colors, no text in image`,
      avoid: 'text embedded in image, horizontal composition, small or distant product',
      claimSafetyNote: 'Canvas en blanco para agregar copy externo — sin claims embebidos',
    },
    {
      id: 'ip_10', title: 'Unboxing primer plano',
      objective: 'Crear anticipación y deseo de compra',
      prompt: `unboxing experience, hands opening packaging of ${title.toLowerCase()}, warm light, close up, excitement without exaggeration, clean background, no text`,
      avoid: 'text, logos visible, dramatic or fake excitement, staged expressions',
      claimSafetyNote: 'Solo muestra el proceso de apertura — sin claims de calidad del producto',
    },
  ];

  // ── store direction ──────────────────────────────────────────────────────
  const storeDirection: any = {
    heroHeadline: pos ? pos.split('.')[0] : `${shortTitle}: la elección que tiene sentido.`,
    heroSubheadline: `Sin exageraciones. Sin promesas vacías. Solo ${shortTitle} y lo que realmente hace.`,
    cta: 'Comprar ahora',
    keySections: [
      'Hero con headline + CTA principal',
      'Beneficios en 3-4 puntos concretos con íconos',
      'Cómo funciona en 3 pasos simples',
      'Galería de producto (hero + lifestyle + detalle)',
      'Garantía y política de devolución visible',
      'Preguntas frecuentes en acordeón',
    ],
    topObjections: [
      '¿Es de calidad real o se ve bien solo en la foto?',
      '¿Cuánto tarda en llegar y cómo llega embalado?',
      '¿Qué pasa si no me convence o llega roto?',
      '¿Es original o una copia barata?',
    ],
    shortDescription: `${shortTitle} es la solución para quienes buscan [resultado principal] sin complicaciones. Diseñado para uso real, empaque cuidado y garantía de 30 días.`,
    platformSuggestion: platform,
  };

  // ── shot list (BoardShot format) ─────────────────────────────────────────
  const shotList = [
    {
      id: 'shot_01', priority: 'must-have' as const,
      goal: 'Imagen principal de tienda — credibilidad inmediata',
      setup: 'Superficie blanca, luz natural lateral + softbox, cámara a 45° o cenital',
      whatToShow: 'Producto solo, bien encuadrado, sin distorsiones',
      whatToAvoid: 'Sombras duras, fondo sucio, producto fuera de foco',
    },
    {
      id: 'shot_02', priority: 'must-have' as const,
      goal: 'Mostrar calidad de materiales sin claims',
      setup: 'Macro o modo retrato, luz raking lateral para resaltar textura',
      whatToShow: 'Textura, acabado, materiales reales del producto',
      whatToAvoid: 'Filtros que saturen, ángulos que distorsionen tamaño real',
    },
    {
      id: 'shot_03', priority: 'must-have' as const,
      goal: 'Credibilidad de uso real en manos',
      setup: 'Manos naturales sin manicura perfecta, luz ambiente, fondo cotidiano',
      whatToShow: 'Gesto de uso natural, proporciones reales del producto',
      whatToAvoid: 'Poses artificiales, manos demasiado perfectas, fondo de estudio falso',
    },
    {
      id: 'shot_04', priority: 'must-have' as const,
      goal: 'Contenido de anticipación y curiosidad',
      setup: '30-60 segundos, plano cenital de manos abriendo, mostrar interior del empaque',
      whatToShow: 'Proceso de apertura completo, interior del empaque, primera impresión real',
      whatToAvoid: 'Reacciones exageradas, cortes abruptos, empaque sucio o aplastado',
    },
    {
      id: 'shot_05', priority: 'must-have' as const,
      goal: 'Conectar con el contexto de uso en ambiente real',
      setup: 'Ambiente del hogar o lugar de uso, iluminación natural, persona real (no modelo)',
      whatToShow: 'Producto integrado en la vida cotidiana de forma natural',
      whatToAvoid: 'Ambientes demasiado perfectos o staging obvio, personas posando',
    },
    {
      id: 'shot_06', priority: 'nice-to-have' as const,
      goal: 'Validar impacto visible del producto (solo si el resultado es observable)',
      setup: 'Encuadre fijo, mismas condiciones de luz, producto antes y después del uso',
      whatToShow: 'Solo si el resultado es honestamente visible — no editar para exagerar',
      whatToAvoid: 'Edición engañosa, diferencias mínimas artificialmente infladas',
    },
    {
      id: 'shot_07', priority: 'nice-to-have' as const,
      goal: 'Elevar percepción de marca con empaque cuidado',
      setup: 'Plano cenital del paquete completo, iluminación suave y pareja, fondo neutro',
      whatToShow: 'Empaque completo, cualquier inserto o tarjeta incluida',
      whatToAvoid: 'Empaque arrugado, iluminación irregular, fondo con distracciones',
    },
    {
      id: 'shot_08', priority: 'nice-to-have' as const,
      goal: 'Establecer escala y proporciones reales del producto',
      setup: 'Mano adulta sosteniendo el producto, fondo neutro',
      whatToShow: 'Tamaño real del producto en contexto con mano humana',
      whatToAvoid: 'Ángulos que hagan el producto parecer más grande o más pequeño',
    },
    {
      id: 'shot_09', priority: 'nice-to-have' as const,
      goal: 'Prueba de resistencia básica (solo si aplica y es honesta)',
      setup: 'Solo grabar si el test es genuino — si el producto falla, no publicar',
      whatToShow: 'Prueba simple y real que el producto pueda pasar honestamente',
      whatToAvoid: 'Tests que el producto no puede pasar realmente, edición para ocultar fallas',
    },
    {
      id: 'shot_10', priority: 'nice-to-have' as const,
      goal: 'UGC orgánico: reacción genuina al primer uso',
      setup: 'Sin guión, cámara fija, reacción espontánea al abrir o usar por primera vez',
      whatToShow: 'Reacción auténtica — buena o neutral, no forzada',
      whatToAvoid: 'Actuación obvia, guión memorizado, expresiones de sorpresa fake',
    },
  ];

  return {
    product,
    brandTerritories,
    creativeAngles,
    audienceSegments,
    offerDirections,
    staticCreatives,
    imagePrompts,
    storeDirection,
    shotList,
    market: {
      country,
      language: locale.language,
      currency: locale.currency,
      tone: locale.tone,
    },
  };
}

// ─── Gemini call ─────────────────────────────────────────────────────────────
async function generatePreSample(data: any): Promise<any> {
  if (process.env.TEMP_AI_BYPASS === 'true') return buildFallback(data);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFallback(data);

  const country = data.product?.country ?? 'AR';
  const locale  = getLocale(country);
  const schema  = `{
  "product":{"title":"","score":0,"verdict":"","mainOpportunity":"","mainRisk":"","whyPursue":"","signalsSummary":""},
  "market":{"country":"","language":"","currency":"","tone":""},
  "brandTerritories":[{"id":"bt_01","name":"","commercialPositioning":"","perceivedValue":"","bestFor":"","whenToUse":"","whenNotToUse":"","visualDirection":"","storeUsage":"","adUsage":"","packagingUsage":"","suggestedColors":["#hex"],"colorsToAvoid":["#hex"],"matchingWords":[]}],
  "creativeAngles":[{"id":"ca_01","name":"","emotion":"","targetAudience":"","whyItCouldWork":"","risk":"","recommendedVisual":""}],
  "audienceSegments":[{"id":"as_01","name":"","painDesire":"","whyItMatters":"","buyingMotivation":"","riskObjection":""}],
  "offerDirections":[{"id":"od_01","name":"","offerIdea":"","whyItCouldWork":"","marginCaution":"","whenNotToUse":""}],
  "staticCreatives":[{"id":"sc_01","hook":"","angle":"","format":"","mainCopy":"","visualDirection":"","cta":"","whyTestThis":"","whatItValidates":"","claimRisk":"low","claimCaution":""}],
  "imagePrompts":[{"id":"ip_01","title":"","objective":"","prompt":"English prompt for AI image generator","avoid":"","claimSafetyNote":""}],
  "storeDirection":{"heroHeadline":"","heroSubheadline":"","cta":"","keySections":[],"topObjections":[],"shortDescription":"","platformSuggestion":""},
  "shotList":[{"id":"shot_01","priority":"must-have","goal":"","setup":"","whatToShow":"","whatToAvoid":""}]
}`;

  const prompt = `Actuá como director creativo senior de ecommerce y director de arte especializado en LATAM y ecommerce global.

El usuario todavía NO tiene muestra física del producto. Tu tarea: crear un Launch Board PRE-SAMPLE completo.

ANÁLISIS DEL PRODUCTO:
${formatAnalysis(data)}

MERCADO OBJETIVO: ${country} — ${locale.language} — ${locale.currency} — Tono: ${locale.tone}

REGLAS ESTRICTAS:
1. No inventar textura, tamaño, peso, color real, duración, calidad ni funcionamiento exacto no confirmado.
2. No hacer claims médicos, legales ni técnicos sin confirmación con muestra física.
3. Adaptar idioma, tono, moneda y estilo al mercado: ${locale.language}.
4. Los "prompt" de imagePrompts deben estar en inglés técnico para generadores de IA (Midjourney/DALL-E/SD).
5. Los prompts de imagen NO deben contener texto visible, palabras escritas ni logos dentro de la imagen.
6. Evitar frases: "revolucionario", "mágico", "imperdible", "increíble", "garantizado al 100%".
7. Todos los copies (hook, mainCopy, etc.) deben estar en ${locale.language}.
8. claimRisk debe ser "low", "medium" o "high" exactamente.
9. priority en shotList debe ser "must-have" o "nice-to-have" exactamente.

CANTIDADES MÍNIMAS OBLIGATORIAS:
- brandTerritories: exactamente 3
- creativeAngles: entre 4 y 6
- audienceSegments: entre 3 y 4
- offerDirections: exactamente 3
- staticCreatives: mínimo 10, máximo 12 (IDs: sc_01 a sc_12)
- imagePrompts: mínimo 8, máximo 10 (IDs: ip_01 a ip_10)
- shotList: mínimo 8, máximo 10 — primeros 5 deben ser "must-have", resto "nice-to-have"

Devolvé ÚNICAMENTE JSON válido con este schema (sin markdown, sin explicaciones):
${schema}`;

  const ai = new GoogleGenAI({ apiKey });
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model, contents: prompt,
        config: { temperature: 0.72, responseMimeType: 'application/json', maxOutputTokens: 16384 },
      });
      const raw = (res.text ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.brandTerritories) || !Array.isArray(parsed.staticCreatives)) throw new Error('shape');
      return parsed;
    } catch (err) {
      const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
      console.log(`[pre-sample-studio] ${model} ${is429 ? 'rate-limited' : 'failed: ' + String(err).slice(0, 80)}`);
      if (!is429) break;
    }
  }

  return buildFallback(data);
}

// ─── Sanitize ────────────────────────────────────────────────────────────────
function cleanArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => (typeof x === 'string' ? x.trim() : String(x ?? ''))).filter(Boolean);
}

function sanitize(data: any): any {
  data.brandTerritories   = Array.isArray(data.brandTerritories)   ? data.brandTerritories   : [];
  data.creativeAngles     = Array.isArray(data.creativeAngles)     ? data.creativeAngles     : [];
  data.audienceSegments   = Array.isArray(data.audienceSegments)   ? data.audienceSegments   : [];
  data.offerDirections    = Array.isArray(data.offerDirections)    ? data.offerDirections    : [];
  data.staticCreatives    = Array.isArray(data.staticCreatives)    ? data.staticCreatives    : [];
  data.shotList           = Array.isArray(data.shotList)           ? data.shotList           : [];

  // Filter image prompts that embed text in the image
  const requestsTextInImage = /\b(add text|with text|include text|overlay text|text overlay|show text|visible text|con texto|con letras|lettering inside|text inside)\b/i;
  data.imagePrompts = Array.isArray(data.imagePrompts)
    ? data.imagePrompts.filter((p: any) => !requestsTextInImage.test(p.prompt ?? ''))
    : [];

  // Clamp claimRisk to valid values
  data.staticCreatives = data.staticCreatives.map((c: any) => ({
    ...c,
    claimRisk: ['low','medium','high'].includes(c.claimRisk) ? c.claimRisk : 'medium',
  }));

  // Clamp shot priorities
  data.shotList = data.shotList.map((s: any) => ({
    ...s,
    priority: ['must-have','nice-to-have'].includes(s.priority) ? s.priority : 'nice-to-have',
  }));

  // Ensure storeDirection
  if (!data.storeDirection || typeof data.storeDirection !== 'object') {
    data.storeDirection = { heroHeadline: '', heroSubheadline: '', cta: 'Comprar ahora', keySections: [], topObjections: [], shortDescription: '' };
  }
  data.storeDirection.keySections   = cleanArr(data.storeDirection.keySections);
  data.storeDirection.topObjections = cleanArr(data.storeDirection.topObjections);

  // Ensure product panel
  if (!data.product || typeof data.product !== 'object') {
    data.product = { title: '', score: 0, verdict: 'maybe', mainOpportunity: '', mainRisk: '', whyPursue: '' };
  }

  // Ensure market
  if (!data.market || typeof data.market !== 'object') {
    data.market = { country: 'AR', language: 'Español rioplatense', currency: 'ARS', tone: 'Directo, vos' };
  }

  return data;
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let data: any;
  try { data = await req.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido' }, { status: 400 }); }

  if (!data?.result) return NextResponse.json({ error: 'Falta result del análisis' }, { status: 400 });

  try {
    const raw = await generatePreSample(data);
    const result = sanitize(raw);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[pre-sample-studio] error:', err);
    const fallback = sanitize(buildFallback(data));
    return NextResponse.json(fallback);
  }
}
