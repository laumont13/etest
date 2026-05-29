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

// ─── Fallback generator ──────────────────────────────────────────────────────
function buildFallback(data: any): any {
  const country = data.product?.country ?? 'AR';
  const locale  = getLocale(country);
  const title   = data.product?.title ?? 'Producto';
  const verdict = data.result?.verdict ?? 'maybe';
  const angles  = (data.analysis?.angles ?? []).map((a: any) => a.hook).filter(Boolean) as string[];
  const risks   = (data.analysis?.keyRisks ?? []) as string[];
  const pos     = data.analysis?.positioning ?? '';

  const shortTitle = title.split(' ').slice(0, 3).join(' ');

  const palettes = [
    { name: 'Premium Dark', primary: '#1A1A2E', secondary: '#16213E', background: '#0F3460', accent: '#E94560', text: '#FFFFFF', useCase: 'Marca premium, nocturna, diferenciada' },
    { name: 'Clean Minimal', primary: '#2D3436', secondary: '#FFFFFF', background: '#F5F6FA', accent: '#6C5CE7', text: '#2D3436', useCase: 'Tienda limpia, profesional, confiable' },
    { name: 'Natural Warm', primary: '#6C3483', secondary: '#F39C12', background: '#FDFEFE', accent: '#27AE60', text: '#1C2833', useCase: 'Producto natural, saludable, orgánico' },
  ];

  const imagePrompts = [
    { id: 'ip_01', name: 'Hero producto plano', purpose: 'Imagen principal de tienda', format: '1:1', scene: `${shortTitle} sobre fondo blanco limpio, bien iluminado, centrado`, prompt: `${title} product flat lay on white background, studio lighting, sharp focus, professional product photography, minimalist, no text, no logos`, negativePrompt: 'text, watermark, shadow clutter, dark background, people', safeBecause: 'No muestra características físicas no verificadas' },
    { id: 'ip_02', name: 'Lifestyle uso natural', purpose: 'Mostrar contexto de uso sin claims', format: '4:5', scene: `Persona usando ${shortTitle} en ambiente cotidiano, expresión natural`, prompt: `person naturally using ${title.toLowerCase()}, lifestyle photography, bright ambient light, authentic moment, no text, modern interior`, negativePrompt: 'text, logos, before/after, dramatic claims', safeBecause: 'No promete resultado específico, solo contexto de uso' },
    { id: 'ip_03', name: 'Close-up textura pack', purpose: 'Mostrar empaque y calidad percibida', format: '1:1', scene: `Empaque del producto cerca, detalle de materiales, luz lateral`, prompt: `close up product packaging, soft side lighting, texture detail, premium feel, macro photography, no text visible on product, clean background`, negativePrompt: 'text, blur, dark, grungy', safeBecause: 'Empaque sin claims de funcionamiento' },
    { id: 'ip_04', name: 'Flat lay lifestyle', purpose: 'Contenido de feed Instagram', format: '1:1', scene: `Flat lay con ${shortTitle} y accesorios complementarios en superficie neutra`, prompt: `${title.toLowerCase()} flat lay arrangement, complementary items, neutral linen surface, overhead shot, natural daylight, styled composition, no text`, negativePrompt: 'text, watermark, cluttered, artificial', safeBecause: 'Composición estética sin claims' },
    { id: 'ip_05', name: 'Antes: problema visual', purpose: 'Set-up del problema que resuelve (sin mostrar el producto)', format: '4:5', scene: `Imagen representando el problema que ${shortTitle} resuelve, sin el producto visible`, prompt: `person experiencing frustration or problem related to ${title.toLowerCase()}, candid expression, natural setting, relatable scenario, soft light, no text`, negativePrompt: 'product visible, text, logos, exaggerated expressions', safeBecause: 'Solo muestra el problema, no el resultado del producto' },
    { id: 'ip_06', name: 'Comparación pack', purpose: 'Creativos de valor percibido', format: '4:5', scene: `Dos opciones en escena: ${shortTitle} vs solución alternativa común`, prompt: `side by side comparison shot, ${title.toLowerCase()} versus common alternative solution, clean studio background, product photography, no text overlay needed in image, professional`, negativePrompt: 'text in image, messy, dark', safeBecause: 'Comparación sin claims de performance exacto' },
    { id: 'ip_07', name: 'Detalle uso manos', purpose: 'Mostrar intuitividad de uso', format: '9:16', scene: `Manos sosteniendo o usando ${shortTitle} de forma natural, primer plano`, prompt: `hands using ${title.toLowerCase()}, close up shot, natural light, authentic gesture, skin-tone neutral, no text, editorial style`, negativePrompt: 'text, logos, perfect manicure only, artificial pose', safeBecause: 'No muestra resultado ni promete funcionamiento exacto' },
    { id: 'ip_08', name: 'Ambiente premium tienda', purpose: 'Foto para hero de tienda online', format: '16:9', scene: `${shortTitle} en ambiente elegante, minimalista, bien diseñado`, prompt: `${title.toLowerCase()} in elegant minimalist interior, soft natural light from window, premium lifestyle setting, wide shot, no people, no text`, negativePrompt: 'text, busy background, cluttered, harsh shadows', safeBecause: 'Ambiente aspiracional sin claims de producto' },
    { id: 'ip_09', name: 'Story formato vertical', purpose: 'Instagram/Facebook Stories', format: '9:16', scene: `Vertical, ${shortTitle} destacado, espacio para texto externo`, prompt: `${title.toLowerCase()} vertical product shot, bold composition, gradient background, space at top and bottom for text overlay, vibrant colors, no text in image`, negativePrompt: 'text embedded, horizontal composition, small product', safeBecause: 'Composición lista para agregar texto externo' },
    { id: 'ip_10', name: 'Unboxing primer plano', purpose: 'Crear anticipación de compra', format: '4:5', scene: `Caja o empaque abriéndose, contenido visible, manos naturales, luz cálida`, prompt: `unboxing experience, hands opening packaging of ${title.toLowerCase()}, warm light, close up, excitement without exaggeration, clean background, no text`, negativePrompt: 'text, logos visible, dramatic expressions, fake excitement', safeBecause: 'Proceso de unboxing sin claims de calidad confirmada' },
  ];

  const hooksByAngle = angles.slice(0, 3);
  const defaultHooks = [
    `El ${shortTitle} que cambia el resultado`,
    `Menos esfuerzo. Más resultado.`,
    `Por qué elegir ${shortTitle}`,
  ];
  const finalHooks = hooksByAngle.length > 0 ? hooksByAngle : defaultHooks;

  const staticCreatives = [
    { id: 'sc_01', name: 'Hero imagen problema', angle: 'Problema-solución', hook: finalHooks[0] ?? `¿Cansado del problema que ${shortTitle} resuelve?`, format: '4:5', mainCopy: `Hay una forma más inteligente de hacerlo. ${shortTitle} existe para eso.`, visualConcept: 'Imagen ip_05 (problema) con texto superpuesto exterior', imagePromptId: 'ip_05', cta: 'Ver más', placement: 'Feed Instagram/Facebook', priority: 'alta', whatItValidates: 'Resonancia del problema con el público objetivo' },
    { id: 'sc_02', name: 'Hero producto limpio', angle: 'Credibilidad y calidad', hook: `${shortTitle} — diseñado para durar.`, format: '1:1', mainCopy: 'No improvisamos. Cada detalle importa.', visualConcept: 'Imagen ip_01 sobre fondo blanco, marca en esquina', imagePromptId: 'ip_01', cta: 'Conocer más', placement: 'Feed Instagram', priority: 'alta', whatItValidates: 'Percepción de calidad sin muestra física' },
    { id: 'sc_03', name: 'Lifestyle uso real', angle: 'Aspiracional', hook: 'Así se usa en la vida real.', format: '4:5', mainCopy: 'Sin complicaciones. Sin curva de aprendizaje.', visualConcept: 'Imagen ip_02 con texto limpio', imagePromptId: 'ip_02', cta: 'Descubrir', placement: 'Feed + Stories', priority: 'alta', whatItValidates: 'Atractivo visual y contexto de uso' },
    { id: 'sc_04', name: 'Story urgencia suave', angle: 'Escasez percibida', hook: 'Stock limitado para este lanzamiento.', format: '9:16', mainCopy: 'Solo para los primeros compradores. Sin promesas exageradas — solo un primer lote reducido.', visualConcept: 'Imagen ip_09 (story) con contador o badge "Preventa"', imagePromptId: 'ip_09', cta: 'Reservar el mío', placement: 'Stories Instagram/Facebook', priority: 'alta', whatItValidates: 'Conversión con oferta de lanzamiento' },
    { id: 'sc_05', name: 'Unboxing anticipación', angle: 'Curiosidad y deseo', hook: '¿Qué hay adentro?', format: '4:5', mainCopy: 'La experiencia empieza desde que abrís la caja.', visualConcept: 'Imagen ip_10 (unboxing), formato carrusel start', imagePromptId: 'ip_10', cta: 'Ver proceso', placement: 'Reels/TikTok (estático inicial)', priority: 'media', whatItValidates: 'Curiosidad por el producto sin muestra' },
    { id: 'sc_06', name: 'Detalle calidad pack', angle: 'Trust building', hook: 'La diferencia está en los detalles.', format: '1:1', mainCopy: 'Empaque que cuida el producto. Porque el primero es el que convierte.', visualConcept: 'Imagen ip_03 (empaque close-up)', imagePromptId: 'ip_03', cta: 'Ver producto', placement: 'Feed Instagram', priority: 'media', whatItValidates: 'Percepción de calidad del packaging' },
    { id: 'sc_07', name: 'Flat lay estético', angle: 'Lifestyle aspiracional', hook: 'Parte de tu rutina.', format: '1:1', mainCopy: `${shortTitle}. Simple. Efectivo. Parte de lo que hacés bien.`, visualConcept: 'Imagen ip_04 (flat lay) con texto mínimo', imagePromptId: 'ip_04', cta: 'Ver detalles', placement: 'Feed Instagram/Pinterest', priority: 'media', whatItValidates: 'Fit estético con el público objetivo' },
    { id: 'sc_08', name: 'Hero horizontal web', angle: 'Posicionamiento directo', hook: pos ? pos.split('.')[0] : `${shortTitle}: la elección inteligente.`, format: '16:9', mainCopy: 'Sin exageraciones. Solo lo que necesitás saber para decidir bien.', visualConcept: 'Imagen ip_08 (ambiente premium) con headline superpuesto', imagePromptId: 'ip_08', cta: 'Ver colección', placement: 'Banner web / Hero tienda', priority: 'alta', whatItValidates: 'CTR en tráfico de búsqueda y email' },
    { id: 'sc_09', name: 'Story solución directa', angle: 'Solución específica', hook: finalHooks[1] ?? 'El resultado que buscabas.', format: '9:16', mainCopy: `No prometemos lo que no podemos verificar. Sí prometemos ${shortTitle} y atención real.`, visualConcept: 'Imagen ip_09 (story), texto y CTA centrado', imagePromptId: 'ip_09', cta: 'Probalo ahora', placement: 'Stories + Reels', priority: 'media', whatItValidates: 'Conversión con mensaje de honestidad' },
    { id: 'sc_10', name: 'Comparación valor', angle: 'Precio-valor', hook: '¿Por qué vale lo que vale?', format: '4:5', mainCopy: `Porque ${shortTitle} no es el más barato. Es el que vale lo que pagás.`, visualConcept: 'Imagen ip_06 (comparación), diseño dos columnas', imagePromptId: 'ip_06', cta: 'Comparar opciones', placement: 'Feed + Remarketing', priority: 'media', whatItValidates: 'Sensibilidad al precio y percepción de valor' },
    { id: 'sc_11', name: 'Manos uso detalle', angle: 'Intimidad y confianza', hook: finalHooks[2] ?? 'Tan simple que no necesita manual.', format: '4:5', mainCopy: 'Diseñado para usarse desde el primer día, sin tutoriales.', visualConcept: 'Imagen ip_07 (manos), composición íntima', imagePromptId: 'ip_07', cta: 'Ver cómo funciona', placement: 'Feed + Awareness', priority: 'baja', whatItValidates: 'Percepción de facilidad de uso' },
    { id: 'sc_12', name: 'Feed awareness frío', angle: 'Descubrimiento', hook: `¿Conocés ${shortTitle}?`, format: '1:1', mainCopy: `No para todo el mundo. Pero si estabas buscando algo así — esto es para vos.`, visualConcept: 'Imagen ip_01 (hero producto) con texto introductorio minimalista', imagePromptId: 'ip_01', cta: 'Conocer más', placement: 'Feed Facebook/Instagram — tráfico frío', priority: 'media', whatItValidates: 'Alcance en audiencia nueva sin interés previo' },
  ];

  const carousels = [
    {
      id: 'car_01', title: 'El problema que resolvemos', objective: 'Conectar emocionalmente antes de mostrar el producto',
      slides: [
        { slide: 1, text: '¿Cuántas veces quisiste una solución simple para este problema?', visualSuggestion: 'Imagen de persona frustrada (ip_05), sin producto' },
        { slide: 2, text: 'El problema no es nuevo. Lo que cambia es cómo lo resolvés.', visualSuggestion: 'Fondo oscuro, tipografía grande, sin imagen de producto' },
        { slide: 3, text: `${shortTitle}. Diseñado para hacerlo más simple.`, visualSuggestion: 'Primera aparición del producto (ip_01), limpió y centrado' },
        { slide: 4, text: 'Sin complicaciones. Sin aprendizaje largo. Sin estrés.', visualSuggestion: 'Imagen de uso natural (ip_02), expresión tranquila' },
        { slide: 5, text: '¿Listo para probarlo?', visualSuggestion: 'Imagen hero (ip_08) con CTA claro' },
      ],
      ctaFinal: 'Ver producto →',
    },
    {
      id: 'car_02', title: '5 razones para elegirlo', objective: 'Educación de producto y credibilidad antes de la compra',
      slides: [
        { slide: 1, text: `5 razones para elegir ${shortTitle}`, visualSuggestion: 'Portada: producto (ip_01) sobre fondo de color de paleta primaria' },
        { slide: 2, text: '1. Diseño pensado para el uso real, no para el showroom.', visualSuggestion: 'Detalle producto (ip_03)' },
        { slide: 3, text: '2. Fácil de usar desde el primer momento.', visualSuggestion: 'Manos en uso (ip_07)' },
        { slide: 4, text: '3. Presentación y empaque que cuida cada detalle.', visualSuggestion: 'Unboxing (ip_10)' },
        { slide: 5, text: '4. Para el que busca calidad sin pagar de más.', visualSuggestion: 'Flat lay estético (ip_04)' },
        { slide: 6, text: '5. Soporte real. Devolución sin preguntas.', visualSuggestion: 'Tipografía sobre fondo premium' },
        { slide: 7, text: '¿Cuál te convenció?', visualSuggestion: 'Hero tienda (ip_08) con CTA' },
      ],
      ctaFinal: 'Comprar ahora →',
    },
    {
      id: 'car_03', title: 'Así llega a tu puerta', objective: 'Reducir fricción de compra mostrando el proceso de entrega',
      slides: [
        { slide: 1, text: 'Sabemos que comprar online tiene sus dudas. Acá está el proceso.', visualSuggestion: 'Portada: packaging (ip_03) limpio sobre fondo blanco' },
        { slide: 2, text: 'Pedido procesado en menos de 24h hábiles.', visualSuggestion: 'Ícono o ilustración simple de carrito + check' },
        { slide: 3, text: 'Embalado con protección para que llegue perfecto.', visualSuggestion: 'Unboxing (ip_10), manos abriendo' },
        { slide: 4, text: 'Número de seguimiento en tu email.', visualSuggestion: 'Ícono tracking, diseño minimalista' },
        { slide: 5, text: 'Si no te convence: devolución sin preguntas.', visualSuggestion: 'Garantía visual: checkmark, texto claro' },
        { slide: 6, text: 'Listo para ordenar.', visualSuggestion: 'Producto hero (ip_01) + CTA prominente' },
      ],
      ctaFinal: 'Comprar con confianza →',
    },
  ];

  const benefitBullets = [
    `Solución directa para [problema del público objetivo]`,
    `Diseño pensado para uso real y cotidiano`,
    `Envío rápido y empaque de protección`,
    `Garantía de devolución sin preguntas`,
    `Soporte disponible para cualquier consulta`,
  ];

  const sections = [
    { name: 'Beneficios principales', goal: 'Justificar la compra con argumentos claros', copy: `${shortTitle} resuelve un problema concreto con diseño funcional, sin complicaciones y con respaldo real.`, visualNeeded: 'Iconos o ilustraciones de cada beneficio, fondo limpio' },
    { name: 'Cómo funciona', goal: 'Reducir fricción mostrando la simplicidad', copy: '3 pasos: recibís el producto, lo usás desde el día 1, ves el resultado. Sin manuales largos.', visualNeeded: 'Infografía de 3 pasos, illustración o screenshots' },
    { name: 'Para quién es', goal: 'Segmentar y calificar al comprador', copy: `Para los que buscan [resultado principal] sin complicaciones. No para todo el mundo — para el que entiende el valor.`, visualNeeded: 'Foto lifestyle (ip_02) o avatar del cliente' },
    { name: 'Garantía y confianza', goal: 'Eliminar el riesgo percibido de compra', copy: '30 días de garantía. Si no te gusta, te devolvemos el dinero. Sin preguntas.', visualNeeded: 'Badge de garantía, iconos de seguridad de pago' },
    { name: 'Preguntas frecuentes', goal: 'Manejar objeciones antes de que aparezcan', copy: 'Las preguntas que todos tienen antes de comprar — respondidas de forma honesta.', visualNeeded: 'Acordeón de FAQs, diseño limpio y escaneble' },
  ];

  const faqs = [
    { question: `¿De qué material está hecho ${shortTitle}?`, answer: 'Estamos validando el material con muestra del proveedor. Te actualizamos antes del lanzamiento oficial.' },
    { question: '¿Cuánto tarda en llegar?', answer: 'Entre 5 y 10 días hábiles según tu zona. Recibís el número de seguimiento por email.' },
    { question: '¿Qué pasa si no me convence?', answer: 'Devolución sin preguntas dentro de los 30 días. Solo avisanos y coordinamos.' },
    { question: '¿Lo puedo usar todos los días?', answer: 'Sí, está diseñado para uso frecuente. Validaremos durabilidad con la muestra antes de publicar claims específicos.' },
    { question: '¿Tiene garantía?', answer: '30 días de garantía desde la entrega. Si algo falla, lo reemplazamos o reembolsamos.' },
    { question: '¿Hacen envíos a todo el país?', answer: `Sí, hacemos envíos a todo ${country === 'AR' ? 'Argentina' : country === 'MX' ? 'México' : 'el país'}. Calculá el envío en el checkout.` },
    { question: '¿En cuántos pagos puedo pagar?', answer: 'Aceptamos tarjetas de crédito en cuotas, transferencia y otros medios. Consultá las opciones en el checkout.' },
    { question: `¿${shortTitle} es original o copia?`, answer: 'Es un producto importado directamente de fábrica, no una copia de marca. Calidad verificada con muestra antes del lanzamiento.' },
    { question: '¿Puedo ver fotos del producto real?', answer: 'Las fotos actuales son referencias de pre-lanzamiento. Publicaremos fotos reales cuando llegue la muestra física.' },
    { question: '¿Tienen redes sociales?', answer: 'Sí, seguinos en Instagram para ver novedades, unboxings y ofertas exclusivas.' },
  ];

  const shotList = [
    { id: 'shot_01', shot: 'Hero limpio: producto solo, fondo blanco', purpose: 'Imagen principal de tienda', howToFilm: 'Superficie blanca, luz natural + softbox lateral, cámara cenital o 45°', creativeAngle: 'Credibilidad y profesionalismo', priority: 'alta' },
    { id: 'shot_02', shot: 'Close-up textura y materiales', purpose: 'Mostrar calidad real sin claims', howToFilm: 'Macro o modo retrato, luz raking lateral para resaltar textura', creativeAngle: 'Calidad percibida', priority: 'alta' },
    { id: 'shot_03', shot: 'Uso natural: manos en acción', purpose: 'Credibilidad de uso real', howToFilm: 'Manos naturales sin manicura perfecta, luz ambiente, fondo cotidiano', creativeAngle: 'Autenticidad', priority: 'alta' },
    { id: 'shot_04', shot: 'Unboxing completo (corto)', purpose: 'Contenido de anticipación y curiosidad', howToFilm: '30-60 segundos, plano cenital de manos abriendo, mostrar el interior', creativeAngle: 'Curiosidad y deseo de compra', priority: 'alta' },
    { id: 'shot_05', shot: 'Lifestyle: ambiente cotidiano', purpose: 'Conectar con el contexto de uso real', howToFilm: 'Ambiente del hogar o lugar de uso, iluminación natural, persona real (no modelos)', creativeAngle: 'Aspiracional y relatable', priority: 'alta' },
    { id: 'shot_06', shot: 'Comparación: antes vs después del uso', purpose: 'Validar impacto visible del producto', howToFilm: 'Solo si el resultado es visible y honesto — no exagerar ni editar', creativeAngle: 'Prueba de resultado', priority: 'media' },
    { id: 'shot_07', shot: 'Empaque y detalles de presentación', purpose: 'Elevar percepción de marca y regalo', howToFilm: 'Plano cenital del paquete completo, iluminación suave y pareja', creativeAngle: 'Experiencia de compra premium', priority: 'media' },
    { id: 'shot_08', shot: 'Tamaño real: producto en mano', purpose: 'Establecer escala y proporciones reales', howToFilm: 'Mano adulta sosteniendo el producto, fondo neutro, referencia de escala', creativeAngle: 'Transparencia y confianza', priority: 'media' },
    { id: 'shot_09', shot: 'Prueba de resistencia/durabilidad básica', purpose: 'Validar claim de calidad real', howToFilm: 'Solo grabar si el test es honesto — si falla, no publicar', creativeAngle: 'Trust building', priority: 'baja' },
    { id: 'shot_10', shot: 'Reacción genuina primera vez', purpose: 'UGC orgánico, contenido de prueba social', howToFilm: 'Reacción sin guión al abrir o usar por primera vez, cámara fija', creativeAngle: 'Autenticidad y prueba social', priority: 'baja' },
  ];

  return {
    mode: 'pre_sample_studio',
    goal: 'Preparar marca, tienda y creativos estáticos antes de recibir la muestra física',
    market: {
      country,
      language: locale.language,
      currency: locale.currency,
      tone: locale.tone,
      localizationNotes: [
        `Moneda: ${locale.currency}`,
        `Idioma: ${locale.language}`,
        `Tono: ${locale.tone}`,
        'Adaptá los precios y referencias culturales al mercado local',
      ],
    },
    brandDirection: {
      brandStyle: 'Directo, premium accesible, sin exageraciones',
      tone: locale.tone,
      desiredPerception: 'Producto serio, respaldado, que vale lo que cuesta',
      mainPromise: pos ? pos.split('.')[0] : `${shortTitle} — simple, efectivo, confiable`,
      customerType: 'Comprador online activo, busca calidad sin riesgo, 25-45 años',
      wordsToUse: ['confiable', 'efectivo', 'diseñado para vos', 'simple', 'sin complicaciones', 'real'],
      wordsToAvoid: ['revolucionario', 'mágico', 'increíble', 'imperdible', 'milagro', 'garantizado al 100%'],
      visualKeywords: ['minimal', 'premium', 'clean', 'funcional', 'moderno', 'auténtico'],
    },
    colorPalettes: palettes,
    graphicStyle: {
      typographyDirection: 'Sans-serif moderna: Inter, DM Sans o equivalente. Display en bold para headlines, regular para cuerpo.',
      layoutStyle: 'Minimalista con aire. Máximo 2-3 elementos por pantalla. Grid 12 columnas.',
      photoStyle: 'Luz natural o softbox. Fondos neutros (blanco, gris claro, lino). Personas reales y espontáneas.',
      iconStyle: 'Línea fina, monocromo o en color de acento. Sin sombras. Tamaño mínimo 24px.',
      designRules: [
        'No usar más de 2 tipografías en una pieza',
        'El CTA siempre en color de acento, nunca en gris',
        'Espacio en blanco = respiro = premium percibido',
        'Texto sobre imagen solo si hay suficiente contraste',
        'No incluir texto dentro de las imágenes generadas con IA',
      ],
    },
    imagePrompts,
    staticCreatives,
    carousels,
    storeStructure: {
      platformSuggestion: country === 'AR' || country === 'MX' || country === 'CL' || country === 'CO' ? 'Tiendanube' : country === 'BR' ? 'Nuvemshop' : country === 'US' ? 'Shopify' : 'Tiendanube',
      heroHeadline: pos ? pos.split('.')[0] : `${shortTitle}: la elección que tiene sentido.`,
      heroSubheadline: `Sin exageraciones. Sin promesas vacías. Solo ${shortTitle} y lo que realmente hace.`,
      primaryCTA: 'Comprar ahora',
      benefitBullets,
      productDescriptionShort: `${shortTitle} es la solución para quienes buscan [resultado principal] sin complicaciones. Diseñado para uso real.`,
      productDescriptionLong: `${shortTitle} nació para resolver un problema concreto: [describir problema]. No prometemos lo que no podemos verificar. Sí prometemos un producto diseñado con cuidado, empaque que protege y soporte real.\n\nPara quién es: ${risks.length > 0 ? 'Para el que ya intentó otras alternativas y busca algo más confiable.' : 'Para el que valora la calidad sobre el precio más bajo.'}\n\n¿Qué incluye? Producto principal + guía de uso + garantía de 30 días.\n\nNota: Las fotos actuales son de referencia pre-lanzamiento. Publicaremos fotos reales cuando llegue la muestra física.`,
      sections,
      faqs,
    },
    sampleArrivalShotList: shotList,
    nextActions: [
      `Definir paleta de color y tipografía antes de abrir Canva — la consistencia visual construye marca desde el primer creativo`,
      `Crear la tienda online con el hero, descripción y FAQs usando el contenido generado aquí — no esperes la muestra para esto`,
      `Producir los primeros 3 creativos estáticos (sc_01, sc_02, sc_03) con imágenes IA y Canva para validar estética`,
      `Preparar la shot list para tenerla lista el día que llegue la muestra — grabar en el primer día para no perder tiempo`,
      `Configurar la landing de "preventa" o "próximamente" para capturar emails antes del lanzamiento oficial`,
    ],
  };
}

// ─── Gemini call ─────────────────────────────────────────────────────────────
async function generatePreSample(data: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFallback(data);

  const country = data.product?.country ?? 'AR';
  const locale  = getLocale(country);
  const schema  = `{
  "mode":"pre_sample_studio","goal":"string",
  "market":{"country":"","language":"","currency":"","tone":"","localizationNotes":[]},
  "brandDirection":{"brandStyle":"","tone":"","desiredPerception":"","mainPromise":"","customerType":"","wordsToUse":[],"wordsToAvoid":[],"visualKeywords":[]},
  "colorPalettes":[{"name":"","primary":"#hex","secondary":"#hex","background":"#hex","accent":"#hex","text":"#hex","useCase":""}],
  "graphicStyle":{"typographyDirection":"","layoutStyle":"","photoStyle":"","iconStyle":"","designRules":[]},
  "imagePrompts":[{"id":"ip_01","name":"","purpose":"","format":"1:1","scene":"","prompt":"English prompt for AI image generator","negativePrompt":"","safeBecause":""}],
  "staticCreatives":[{"id":"sc_01","name":"","angle":"","hook":"","format":"","mainCopy":"","visualConcept":"","imagePromptId":"ip_01","cta":"","placement":"","priority":"alta","whatItValidates":""}],
  "carousels":[{"id":"car_01","title":"","objective":"","slides":[{"slide":1,"text":"","visualSuggestion":""}],"ctaFinal":""}],
  "storeStructure":{"platformSuggestion":"","heroHeadline":"","heroSubheadline":"","primaryCTA":"","benefitBullets":[],"productDescriptionShort":"","productDescriptionLong":"","sections":[{"name":"","goal":"","copy":"","visualNeeded":""}],"faqs":[{"question":"","answer":""}]},
  "sampleArrivalShotList":[{"id":"shot_01","shot":"","purpose":"","howToFilm":"","creativeAngle":"","priority":"alta"}],
  "nextActions":[]
}`;

  const prompt = `Actuá como director creativo senior de ecommerce y director de arte especializado en LATAM y ecommerce global.

El usuario todavía NO tiene muestra física del producto. Tu tarea: crear un plan PRE-SAMPLE completo.

ANÁLISIS DEL PRODUCTO:
${formatAnalysis(data)}

MERCADO OBJETIVO: ${country} — ${locale.language} — ${locale.currency} — Tono: ${locale.tone}

REGLAS ESTRICTAS:
1. No inventar textura, tamaño, peso, color real, duración, calidad ni funcionamiento exacto no confirmado.
2. No hacer claims médicos, legales ni técnicos sin confirmación.
3. Adaptar idioma, tono, moneda y estilo al mercado: ${locale.language}.
4. Los "prompt" de imagePrompts deben estar en inglés técnico para generadores de IA (Midjourney/DALL-E/SD).
5. Los prompts de imagen NO deben contener texto visible, palabras escritas ni logos dentro de la imagen.
6. Evitar frases: "revolucionario", "mágico", "imperdible", "increíble", "garantizado al 100%".
7. Todos los copies (hook, mainCopy, heroHeadline, FAQs, etc.) deben estar en ${locale.language}.
8. Creativos producibles con IA de imagen, Canva y assets del proveedor.

CANTIDADES MÍNIMAS OBLIGATORIAS:
- colorPalettes: exactamente 3
- imagePrompts: mínimo 10, máximo 12 (IDs: ip_01 a ip_12)
- staticCreatives: mínimo 12, máximo 15 (IDs: sc_01 a sc_15)
- carousels: exactamente 3 (IDs: car_01, car_02, car_03), cada uno con mínimo 5 slides
- sampleArrivalShotList: mínimo 8, máximo 12 (IDs: shot_01 a shot_12)
- nextActions: exactamente 5 strings
- storeStructure.faqs: mínimo 8, máximo 12
- storeStructure.benefitBullets: mínimo 4, máximo 6
- storeStructure.sections: mínimo 4

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
      // minimal shape check
      if (!parsed.brandDirection || !Array.isArray(parsed.staticCreatives)) throw new Error('shape');
      return parsed;
    } catch (err) {
      const is429 = String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED');
      console.log(`[pre-sample-studio] ${model} ${is429 ? 'rate-limited' : 'failed: ' + String(err).slice(0, 80)}`);
      if (!is429) break;
    }
  }

  return buildFallback(data);
}

// ─── Validation / cleanup ────────────────────────────────────────────────────
function clean(v: unknown, fb = ''): string {
  if (v == null) return fb;
  const s = String(v).trim();
  return s.length > 3 ? s : fb;
}
function cleanArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => clean(x)).filter(Boolean);
}
function sanitize(data: any): any {
  // Ensure arrays exist and are arrays
  data.colorPalettes     = Array.isArray(data.colorPalettes)     ? data.colorPalettes     : [];
  data.imagePrompts      = Array.isArray(data.imagePrompts)      ? data.imagePrompts      : [];
  data.staticCreatives   = Array.isArray(data.staticCreatives)   ? data.staticCreatives   : [];
  data.carousels         = Array.isArray(data.carousels)         ? data.carousels         : [];
  data.sampleArrivalShotList = Array.isArray(data.sampleArrivalShotList) ? data.sampleArrivalShotList : [];
  data.nextActions       = cleanArr(data.nextActions);

  // Filter image prompts that actively request text inside the image
  const requestsTextInImage = /\b(add text|with text|include text|overlay text|text overlay|show text|written text|visible text|con texto|con letras|con palabras|lettering inside|text inside)\b/i;
  data.imagePrompts = data.imagePrompts.filter((p: any) =>
    !requestsTextInImage.test(p.prompt ?? '')
  );

  // Ensure store structure
  if (!data.storeStructure || typeof data.storeStructure !== 'object') {
    data.storeStructure = { platformSuggestion: '', heroHeadline: '', heroSubheadline: '', primaryCTA: '', benefitBullets: [], productDescriptionShort: '', productDescriptionLong: '', sections: [], faqs: [] };
  }
  data.storeStructure.benefitBullets = cleanArr(data.storeStructure.benefitBullets);
  data.storeStructure.faqs = Array.isArray(data.storeStructure.faqs) ? data.storeStructure.faqs : [];
  data.storeStructure.sections = Array.isArray(data.storeStructure.sections) ? data.storeStructure.sections : [];

  // Ensure brand direction arrays
  if (data.brandDirection) {
    data.brandDirection.wordsToUse   = cleanArr(data.brandDirection.wordsToUse);
    data.brandDirection.wordsToAvoid = cleanArr(data.brandDirection.wordsToAvoid);
    data.brandDirection.visualKeywords = cleanArr(data.brandDirection.visualKeywords);
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
