'use client';

import { useState, useMemo, useEffect, useRef } from 'react';

// ════════════════════════════════════════════════════════
// EXPORTED TYPES
// ════════════════════════════════════════════════════════

export interface BrandTerritory {
  id: string; name: string; commercialPositioning: string; perceivedValue: string;
  bestFor: string; whenToUse: string; whenNotToUse: string; visualDirection: string;
  storeUsage: string; adUsage: string; packagingUsage: string;
  suggestedColors: string[]; colorsToAvoid: string[]; matchingWords: string[];
}
export interface CreativeAngle {
  id: string; name: string; emotion: string; targetAudience: string;
  whyItCouldWork: string; risk: string; recommendedVisual: string;
}
export interface AudienceSegment {
  id: string; name: string; painDesire: string; whyItMatters: string;
  buyingMotivation: string; riskObjection: string;
}
export interface OfferDirection {
  id: string; name: string; offerIdea: string; whyItCouldWork: string;
  marginCaution: string; whenNotToUse: string;
}
export interface BoardCreative {
  id: string; hook: string; angle: string; format: string; mainCopy: string;
  visualDirection: string; cta: string; whyTestThis: string; whatItValidates: string;
  claimRisk: 'low' | 'medium' | 'high'; claimCaution: string;
}
export interface BoardImagePrompt {
  id: string; title: string; objective: string;
  prompt: string; avoid: string; claimSafetyNote: string;
}
export interface BoardShot {
  id: string; priority: 'must-have' | 'nice-to-have'; goal: string;
  setup: string; whatToShow: string; whatToAvoid: string;
}
export interface StoreDirection {
  heroHeadline: string; heroSubheadline: string; cta: string;
  keySections: string[]; topObjections: string[]; shortDescription: string;
  platformSuggestion?: string;
}
export interface FinalActionPlanData {
  launchDirectionSummary: string; isPreliminary: boolean;
  createFirst: string[]; validateFirst: string[];
  claimsToAvoid: string[]; beforeSampleArrives: string[];
  whenSampleArrives: string[]; afterFirstTest: string[];
  successSignals: string[]; stopSignals: string[];
}
export interface LaunchBoardData {
  product: {
    title: string; score: number; verdict: string;
    mainOpportunity: string; mainRisk: string; whyPursue: string; signalsSummary?: string;
  };
  brandTerritories: BrandTerritory[];
  creativeAngles: CreativeAngle[];
  audienceSegments: AudienceSegment[];
  offerDirections: OfferDirection[];
  staticCreatives: BoardCreative[];
  imagePrompts: BoardImagePrompt[];
  storeDirection: StoreDirection;
  shotList: BoardShot[];
  market: { country: string; language: string; currency: string; tone: string };
}

// ════════════════════════════════════════════════════════
// VISUAL DIRECTION TYPES
// ════════════════════════════════════════════════════════

interface VisualDirection {
  positioning: 'premium' | 'accesible' | null;
  style: 'minimalista' | 'llamativa' | null;
  warmth: 'cálida' | 'técnica' | null;
  approach: 'estética' | 'problema-solución' | null;
  format: 'seria' | 'ugc-tiktok' | null;
  gender: 'femenina' | 'neutra' | null;
  tone: 'aspiracional' | 'directa' | null;
  density: 'clean' | 'comercial' | null;
}

interface VisualAdvice {
  profileName: string; why: string; storeUsage: string; adUsage: string;
  colorsToConsider: string[]; colorsToAvoid: string[]; mistakeToAvoid: string;
}

interface ChatMessage { role: 'user' | 'assistant'; text: string; ts: number; }

// ════════════════════════════════════════════════════════
// BOARD STATE
// ════════════════════════════════════════════════════════

interface BoardSelections {
  visualDirection: VisualDirection;
  mainAngleId: string | null;
  secondaryAngleId: string | null;
  audienceId: string | null;
  offerId: string | null;
  creativeIds: string[];
  promptIds: string[];
  shotIds: string[];
  storeSelected: boolean;
  refinedHooks: Record<string, string>; // cardId → refined hook text
}

const EMPTY_VD: VisualDirection = {
  positioning: null, style: null, warmth: null, approach: null,
  format: null, gender: null, tone: null, density: null,
};

const INITIAL_SEL: BoardSelections = {
  visualDirection: EMPTY_VD,
  mainAngleId: null, secondaryAngleId: null,
  audienceId: null, offerId: null,
  creativeIds: [], promptIds: [], shotIds: [],
  storeSelected: false, refinedHooks: {},
};

const MAX_CREATIVES = 3;
const MAX_PROMPTS   = 3;
const MAX_SHOTS     = 5;
const DEFAULT_VIS   = 6;
const BOARD_LS_KEY  = 'etest_board_v2';

// ════════════════════════════════════════════════════════
// VISUAL DIRECTION AXES
// ════════════════════════════════════════════════════════

const VD_AXES: Array<{ key: keyof VisualDirection; left: string; right: string }> = [
  { key: 'positioning', left: 'Premium',           right: 'Accesible'         },
  { key: 'style',       left: 'Minimalista',        right: 'Llamativa'         },
  { key: 'warmth',      left: 'Cálida',             right: 'Técnica'           },
  { key: 'approach',    left: 'Estética',           right: 'Problema-solución' },
  { key: 'format',      left: 'Marca seria',        right: 'UGC / TikTok'      },
  { key: 'gender',      left: 'Más femenina',       right: 'Más neutra'        },
  { key: 'tone',        left: 'Aspiracional',       right: 'Directa'           },
  { key: 'density',     left: 'Clean',              right: 'Comercial'         },
];

function computeVisualAdvice(vd: VisualDirection): VisualAdvice | null {
  const count = Object.values(vd).filter(Boolean).length;
  if (count < 2) return null;

  const isPremium   = vd.positioning === 'premium';
  const isAccesible = vd.positioning === 'accesible';
  const isMinimal   = vd.style === 'minimalista';
  const isLlamativa = vd.style === 'llamativa';
  const isUGC       = vd.format === 'ugc-tiktok';
  const isProblema  = vd.approach === 'problema-solución';
  const isDirecta   = vd.tone === 'directa';
  const isAspir     = vd.tone === 'aspiracional';

  if (isPremium && isMinimal) return {
    profileName: 'Marca Premium Limpia',
    why: 'Espacio en blanco, tipografía bold, fotografía limpia. Proyecta calidad sin decirlo explícitamente.',
    storeUsage: 'Hero con mucho aire, headline corto y poderoso, imagen de producto sobre fondo blanco o gris claro.',
    adUsage: 'Creativos de producto sobre blanco, close-up de detalles, paleta de 2 colores máximo.',
    colorsToConsider: ['#FFFFFF', '#1A1A1A', '#C9A96E', '#E8E8E8'],
    colorsToAvoid: ['#FF6B00', '#FFCC00', '#00FF00', '#FF00FF'],
    mistakeToAvoid: 'Usar muchos elementos en la misma pieza. El espacio en blanco es diseño, no error.',
  };
  if (isPremium && isAspir) return {
    profileName: 'Lifestyle Aspiracional',
    why: 'No vendés el producto — vendés la vida que representa. El comprador se proyecta en el estilo.',
    storeUsage: 'Fotografía lifestyle dominante, headline de identidad ("Para los que..."), precio discreto.',
    adUsage: 'Ambiente cuidado, personas reales en contextos deseables, poca copy con mucha imagen.',
    colorsToConsider: ['#1C1C1E', '#C9A96E', '#F5F0E8', '#2C2C2E'],
    colorsToAvoid: ['#FF0000', '#00FF00', '#FFFF00'],
    mistakeToAvoid: 'Mostrar el producto antes que el contexto. La vida que vende el producto debe aparecer primero.',
  };
  if (isAccesible && isDirecta && isProblema) return {
    profileName: 'Conversión Directa',
    why: 'Precio claro, beneficio obvio, compra fácil. Para compradores que deciden rápido.',
    storeUsage: 'Precio visible arriba, botón de compra prominente, bullet points de beneficios, sin adornos.',
    adUsage: 'Headline del problema, imagen clara del producto, precio y CTA directo. Sin metáforas.',
    colorsToConsider: ['#0057B7', '#FFD700', '#FFFFFF', '#2C3E50'],
    colorsToAvoid: ['#808080', '#DDDDDD', '#FFCCCC'],
    mistakeToAvoid: 'Esconder el precio o el CTA. En conversión directa, toda fricción mata la venta.',
  };
  if (isUGC && isProblema) return {
    profileName: 'Contenido Auténtico / Social',
    why: 'La autenticidad convierte mejor que la producción en redes sociales. Conecta con el problema primero.',
    storeUsage: 'Fotos reales de clientes, testimoniales con cara visible, menos "estudio" y más vida real.',
    adUsage: 'Videos verticales sin filtros, manos usando el producto, texto overlay simple, formato TikTok/Reels.',
    colorsToConsider: ['#F5F5DC', '#2ECC71', '#ECF0F1', '#E67E22'],
    colorsToAvoid: ['#000080', '#4B0082', '#C0C0C0'],
    mistakeToAvoid: 'Sobre-producir el contenido. Si se ve muy pulido, pierde la autenticidad que lo hace efectivo.',
  };
  if (isLlamativa && isProblema) return {
    profileName: 'Impacto Visual + Problema',
    why: 'Alto contraste para detener el scroll, mensaje de problema claro para generar relevancia inmediata.',
    storeUsage: 'Banner con color de acento fuerte, headline del problema en grande, CTA que contrasta.',
    adUsage: 'Fondo de color sólido intenso, texto grande, producto centrado, menos de 5 palabras en el hook.',
    colorsToConsider: ['#FF4136', '#FFDC00', '#001F3F', '#FFFFFF'],
    colorsToAvoid: ['#CCCCCC', '#808080', '#F5F5DC'],
    mistakeToAvoid: 'Mezclar demasiados colores vivos. Uno o dos de impacto + blanco/negro es suficiente.',
  };
  if (isUGC && isAccesible) return {
    profileName: 'Social Commerce',
    why: 'Combina accesibilidad de precio con contenido auténtico. Ideal para ventas directas en redes.',
    storeUsage: 'Precio prominente, reviews/UGC embebidos, botón de compra en cada sección.',
    adUsage: 'Reels cortos mostrando el producto en uso, con precio en pantalla y CTA directo.',
    colorsToConsider: ['#FE2C55', '#FFFFFF', '#25F4EE', '#000000'],
    colorsToAvoid: ['#4B0082', '#8B0000'],
    mistakeToAvoid: 'Parecer una tienda anticuada. El formato TikTok espera frescura y velocidad.',
  };
  return {
    profileName: 'Dirección Mixta',
    why: 'La combinación elegida sugiere un enfoque equilibrado entre credibilidad y accesibilidad.',
    storeUsage: 'Fotografía de producto limpia + beneficios claros + precio visible y garantía destacada.',
    adUsage: 'Creativos de producto con beneficio principal en el hook, CTA directo.',
    colorsToConsider: ['#2C3E50', '#FFFFFF', '#27AE60', '#ECF0F1'],
    colorsToAvoid: ['#FF69B4', '#800080'],
    mistakeToAvoid: 'No tomar ninguna dirección definida. La indecisión visual se percibe como falta de confianza.',
  };
}

// ════════════════════════════════════════════════════════
// MOCK BOARD REFINEMENT
// ════════════════════════════════════════════════════════

function getMockRefinement(message: string, productTitle: string): string {
  const m = message.toLowerCase();
  const short = productTitle.split(' ').slice(0, 3).join(' ');

  if (m.includes('genérico') || m.includes('vendible') || m.includes('mejor hook') || m.includes('hook')) {
    return `Hooks más específicos para ${short}:\n\n1. "¿Por qué el 73% lo hace diferente ahora?"\n2. "Lo que nadie te dice sobre [problema] — hasta hoy."\n3. "No busques más. Ya lo encontraste."\n\nClave: eliminá lo genérico siendo específico sobre el problema real, no sobre el producto.`;
  }
  if (m.includes('meta') || m.includes('ads') || m.includes('agresivo') || m.includes('facebook') || m.includes('instagram')) {
    return `Hooks para Meta Ads (detención de scroll):\n\n1. "Stop. Leé esto antes de comprar lo de siempre."\n2. "Todos lo usan. Vos todavía no."\n3. "Esta semana llegó ${short}."\n4. "¿Sabías que [problema] tiene solución en un paso?"\n\nKey: las primeras 3 palabras detienen el scroll. Empezá con pregunta, número o comando directo.`;
  }
  if (m.includes('premium') || m.includes('caro') || m.includes('lujo') || m.includes('sofisticado')) {
    return `Para sonar más premium con ${short}:\n\n- Eliminá: "barato", "económico", "oferta", "sale"\n- Usá: "diseñado para", "seleccionado con criterio", "sin compromisos"\n- Hook: "${short}. Para los que ya saben la diferencia."\n- Evitá: exclamaciones, CAPS LOCK, emojis de fuego\n- Copy: menos palabras, más confianza`;
  }
  if (m.includes('accesible') || m.includes('precio') || m.includes('económico') || m.includes('barato')) {
    return `Para sonar accesible sin sonar barato:\n\n- Enfocate en el valor, no en el precio bajo\n- Hook: "La misma calidad. Sin pagar de más."\n- Mostrá el valor con comparación: "Lo que pagás vs lo que recibís"\n- Garantía de devolución prominente — reduce el riesgo percibido\n- Evitá: "precio de fábrica", "directo del fabricante" — suena a mercado viejo`;
  }
  if (m.includes('mujer') || m.includes('femenin') || m.includes('25') || m.includes('40') || m.includes('mujeres')) {
    return `Para público femenino 25-40 con ${short}:\n\n- Ángulo: solución que se integra a su rutina actual\n- Hook: "Para los que hacen todo — y todavía buscan hacer más."\n- Visual: lifestyle real, ambiente cálido, personas genuinas (no modelos)\n- Evitá: estereotipos obvios, rosas "de mujer", "para ella" explícito\n- Usá: "Diseñado para tu ritmo", "Sin complicarte la vida"`;
  }
  if (m.includes('emocional') || m.includes('emoción') || m.includes('sentimiento') || m.includes('corazón')) {
    return `Hooks emocionales para ${short}:\n\n1. "Porque merecés que funcione de verdad."\n2. "Hay cosas que simplemente tienen que estar bien."\n3. "Para vos. No para impresionar a nadie."\n\nLa emoción viene del reconocimiento: el comprador tiene que verse reflejado, no vendido. Evitá la emoción exagerada — suena falso.`;
  }
  if (m.includes('humano') || m.includes('natural') || m.includes('robot') || m.includes('corporativo') || m.includes('ia')) {
    return `Para sonar más humano con ${short}:\n\n- Quitá: "solución integral", "experiencia optimizada", "calidad superior"\n- Poné: "funciona", "lo usás y ya", "sin instrucciones de 10 páginas"\n- Hook: "Probalo. Si no te convence, te devolvemos la plata. Sin drama."\n- Tono: como si se lo contaras a un amigo, no a un cliente`;
  }
  if (m.includes('problema') || m.includes('directo') || m.includes('solución') || m.includes('problema-solución')) {
    return `Enfoque problema-solución para ${short}:\n\n1. Abrí con el problema: "¿Cuántas veces [frustración relacionada]?"\n2. Mostrá el dolor sin el producto primero\n3. Luego: "Hay una forma más fácil."\n4. Presentá el producto como la salida natural\n\nHook directo: "El problema que todos tienen. La solución que nadie conocía."`;
  }
  if (m.includes('color') || m.includes('paleta') || m.includes('visual') || m.includes('diseño') || m.includes('clean')) {
    return `Dirección visual para ${short}:\n\nSi querés clean + confiable: blanco (#FFFFFF) + oscuro (#1A1A2E) + un color de acento único.\n\nRegla del 3: un color dominante (60%), uno de contraste (30%), uno de acento para CTAs (10%).\n\nColores que convierten bien en ecommerce: azul (#0057B7), verde (#27AE60), naranja (#E67E22).\n\nEvitá: más de 3 colores, degradados complejos, tipografías decorativas.`;
  }
  if (m.includes('tienda') || m.includes('store') || m.includes('landing') || m.includes('shopify') || m.includes('tiendanube')) {
    return `Para mejorar la tienda de ${short}:\n\n1. Hero: headline del problema/beneficio + imagen del producto + CTA visible sin scrollear\n2. Pricing: precio prominente, cuotas si aplica, tachado del "precio anterior" solo si es honesto\n3. Trust: fotos reales, reviews, política de devolución en la página del producto\n4. Velocidad: máximo 3 clicks del home a la compra completada\n\n¿Querés que profundice en alguna sección?`;
  }

  return `Entendido. Para "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}" con ${short}:\n\nRecomiendo revisar el ángulo desde el problema específico del comprador, no desde el producto. ¿Cuál es la frustración concreta que ${short} resuelve? Eso es el hook real. El producto es la solución, no el inicio del mensaje.\n\nSi querés ser más específico (Meta Ads, tienda, email, shot list), decime el contexto exacto.`;
}

// ════════════════════════════════════════════════════════
// PROGRESS CALCULATOR
// ════════════════════════════════════════════════════════

function computeProgress(sel: BoardSelections): number {
  let done = 0;
  const vdCount = Object.values(sel.visualDirection).filter(Boolean).length;
  if (vdCount >= 2) done++;
  if (sel.mainAngleId) done++;
  if (sel.audienceId) done++;
  if (sel.offerId) done++;
  if (sel.creativeIds.length >= 1) done++;
  if (sel.promptIds.length >= 1) done++;
  if (sel.shotIds.length >= 1) done++;
  return Math.round((done / 7) * 100);
}

function planLabel(pct: number): { label: string; color: string; preliminary: boolean } {
  if (pct < 30)  return { label: 'Plan muy preliminar', color: '#F87171', preliminary: true };
  if (pct < 60)  return { label: 'Plan preliminar', color: '#FACC15', preliminary: true };
  if (pct < 85)  return { label: 'Plan en progreso', color: '#B8FF5C', preliminary: false };
  return { label: 'Plan completo', color: '#4ADE80', preliminary: false };
}

// ════════════════════════════════════════════════════════
// PLAN GENERATOR
// ════════════════════════════════════════════════════════

function generatePlan(data: LaunchBoardData, sel: BoardSelections): FinalActionPlanData {
  const pct = computeProgress(sel);
  const { preliminary } = planLabel(pct);
  const advice = computeVisualAdvice(sel.visualDirection);

  const mainAngle  = data.creativeAngles.find(a => a.id === sel.mainAngleId);
  const secAngle   = data.creativeAngles.find(a => a.id === sel.secondaryAngleId);
  const audience   = data.audienceSegments.find(a => a.id === sel.audienceId);
  const offer      = data.offerDirections.find(o => o.id === sel.offerId);
  const creatives  = data.staticCreatives.filter(c => sel.creativeIds.includes(c.id));
  const prompts    = data.imagePrompts.filter(p => sel.promptIds.includes(p.id));
  const shots      = data.shotList.filter(s => sel.shotIds.includes(s.id));
  const mustShots  = shots.filter(s => s.priority === 'must-have');

  const clip = (s: string, n = 45) => s.length > n ? s.slice(0, n) + '…' : s;

  const summaryParts = [
    advice ? `Territorio: ${advice.profileName}` : null,
    mainAngle ? `Ángulo: ${mainAngle.name}` : null,
    audience ? `Público: ${audience.name}` : null,
    offer ? `Oferta: ${offer.name}` : null,
  ].filter(Boolean);

  return {
    isPreliminary: preliminary,
    launchDirectionSummary: summaryParts.length ? summaryParts.join(' · ') : 'Board incompleto — plan orientativo',

    createFirst: [
      creatives.length > 0
        ? `Generá los ${creatives.length} creativos elegidos: ${creatives.map(c => `"${clip(sel.refinedHooks[c.id] ?? c.hook, 32)}"`).join(', ')}`
        : `Seleccioná al menos 1 creativo en el Board para priorizar producción`,
      prompts.length > 0
        ? `Producí los ${prompts.length} prompts de imagen elegidos (Midjourney, DALL-E o Canva AI)`
        : `Elegí prompts de imagen en el Board`,
      sel.storeSelected || data.storeDirection
        ? `Armá la tienda con: "${clip(data.storeDirection?.heroHeadline ?? '', 40)}"`
        : `Creá la landing antes de recibir la muestra`,
    ],

    validateFirst: [
      mainAngle ? `Validar si el ángulo "${mainAngle.name}" resuena con ${audience?.name ?? 'el público objetivo'}` : `Elegir un ángulo creativo para definir qué validar primero`,
      offer ? `Testear la oferta "${clip(offer.offerIdea, 50)}" con 3-5 días de pauta antes de escalar` : `Definir la oferta de lanzamiento`,
      `Medir CTR y costo por click antes de comprar stock mayor`,
    ].filter(Boolean),

    claimsToAvoid: [
      ...creatives.filter(c => c.claimRisk !== 'low').map(c => c.claimCaution).filter(Boolean),
      `No publicar especificaciones técnicas exactas hasta verificar con muestra física`,
      `No prometer resultados concretos sin tests confirmados`,
    ].filter(Boolean),

    beforeSampleArrives: [
      advice ? `Aplicar dirección "${advice.profileName}": ${advice.adUsage}` : `Definir la dirección visual antes de crear contenido`,
      `Crear los creativos estáticos con imágenes IA — no esperés la muestra`,
      `Configurar tienda con hero, descripción y FAQs`,
      offer ? `Configurar oferta: ${clip(offer.offerIdea, 50)}` : `Definir el precio y estructura de la oferta de test`,
      mustShots.length > 0
        ? `Preparar shot list: ${mustShots.length} shots críticos identificados para cuando llegue la muestra`
        : `Preparar la shot list antes de que llegue la muestra`,
    ],

    whenSampleArrives: [
      ...shots.map(s => `${s.goal}: ${s.setup}`),
      `Comparar muestra real con creativos IA — ajustar si hay diferencias de aspecto o calidad`,
      `Verificar materiales, empaque y calidad contra lo prometido por el proveedor`,
    ],

    afterFirstTest: [
      `Si CTR > 1.5% en frío: escalá el creativo ganador con variantes del mismo ángulo`,
      `Si hay clicks pero sin conversión: revisá precio, oferta y percepción en tienda`,
      secAngle
        ? `Si el ángulo principal no rinde: testear ángulo secundario "${secAngle.name}"`
        : `Si ningún ángulo funciona: revisá si el problema que resuelve el producto es urgente para el público`,
      `Si convierte bien: pedí stock mayor y construí marca con el ángulo ganador`,
    ],

    successSignals: [
      'CTR > 1.5% en audiencia fría',
      'CPA < 2x el margen bruto del producto',
      'Tasa de conversión en tienda > 1%',
      'Mensajes o consultas orgánicas sin pauta activa',
      'Recompra o recomendación espontánea en los primeros 30 días',
    ],

    stopSignals: [
      'CPA > 3x el margen bruto después de probar 3+ creativos distintos',
      'Cero conversiones con $50-100 de pauta en múltiples ángulos',
      mainAngle ? `Riesgo del ángulo principal confirmado: ${mainAngle.risk}` : `Alta fricción en la decisión de compra`,
      'Muestra física no cumple con la calidad prometida por el proveedor',
      offer?.marginCaution ? `Margen con la oferta elegida: ${offer.marginCaution}` : '',
    ].filter(Boolean),
  };
}

// ════════════════════════════════════════════════════════
// SMALL HELPERS
// ════════════════════════════════════════════════════════

function isValidHex(s: string) { return /^#([0-9A-Fa-f]{3,6})$/.test((s ?? '').trim()); }

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const map = {
    low:    { label: 'riesgo bajo',  color: '#4ADE80', bg: 'rgba(74,222,128,0.10)' },
    medium: { label: 'riesgo medio', color: '#FACC15', bg: 'rgba(250,204,21,0.10)' },
    high:   { label: 'riesgo alto',  color: '#F87171', bg: 'rgba(248,113,113,0.10)' },
  };
  const s = map[risk];
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

function SectionTitle({
  title, badge, count, minCount, collapsed, onToggle,
}: {
  title: string; badge?: string; count?: number; minCount?: number;
  collapsed: boolean; onToggle: () => void;
}) {
  const done = count !== undefined && minCount !== undefined && count >= minCount;
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-border-soft bg-bg-1/60 hover:border-border-mid transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-text-80">{title}</span>
        {badge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-[0.1em]" style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C' }}>
            {badge}
          </span>
        )}
        {count !== undefined && (
          <span className="text-[10px] font-mono bg-bg-3 px-1.5 py-0.5 rounded" style={{ color: done ? '#4ADE80' : 'rgba(255,255,255,0.3)' }}>
            {count}{minCount !== undefined ? `/${minCount}+` : ''}
          </span>
        )}
      </div>
      <span className="text-text-40 text-xs" style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
    </button>
  );
}

function SelectableCard({
  selected, onSelect, disabled, children,
}: {
  selected: boolean; onSelect: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 relative transition-all cursor-pointer"
      style={{
        borderColor: selected ? 'rgba(184,255,92,0.45)' : disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
        background: selected ? 'rgba(184,255,92,0.06)' : 'rgba(255,255,255,0.02)',
        opacity: disabled && !selected ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onClick={disabled ? undefined : onSelect}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
          style={{ background: 'rgba(184,255,92,0.2)', color: '#B8FF5C', border: '1px solid rgba(184,255,92,0.4)' }}>✓</div>
      )}
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// VISUAL DIRECTION PANEL
// ════════════════════════════════════════════════════════

function VisualDirectionPanel({
  vd, onChange,
}: { vd: VisualDirection; onChange: (vd: VisualDirection) => void }) {
  const advice = computeVisualAdvice(vd);
  const selected = Object.values(vd).filter(Boolean).length;

  const toggle = (key: keyof VisualDirection, val: string) => {
    onChange({ ...vd, [key]: vd[key] === val ? null : val } as VisualDirection);
  };

  return (
    <div className="mt-2 space-y-4">
      <p className="text-xs text-text-40 px-1">
        Elegí una dirección para cada eje. Con 2+ selecciones, el board genera una recomendación visual estratégica.
        No son colores decorativos — son decisiones comerciales.
      </p>

      <div className="space-y-2">
        {VD_AXES.map(({ key, left, right }) => {
          const leftVal  = left.toLowerCase().replace(/ \/ /g, '-').replace(/ /g, '-');
          const rightVal = right.toLowerCase().replace(/ \/ /g, '-').replace(/ /g, '-');
          const isLeft   = (vd[key] as string | null) !== null && !(vd[key] as string | null)?.includes(rightVal.split('-')[0]);
          const isRight  = (vd[key] as string | null) !== null && !isLeft;
          const leftStored  = VD_AXES.find(a => a.key === key)?.left === 'Premium'  ? 'premium'
            : VD_AXES.find(a => a.key === key)?.left === 'Minimalista' ? 'minimalista'
            : VD_AXES.find(a => a.key === key)?.left === 'Cálida' ? 'cálida'
            : VD_AXES.find(a => a.key === key)?.left === 'Estética' ? 'estética'
            : VD_AXES.find(a => a.key === key)?.left === 'Marca seria' ? 'seria'
            : VD_AXES.find(a => a.key === key)?.left === 'Más femenina' ? 'femenina'
            : VD_AXES.find(a => a.key === key)?.left === 'Aspiracional' ? 'aspiracional'
            : 'clean';
          const rightStored = VD_AXES.find(a => a.key === key)?.right === 'Accesible' ? 'accesible'
            : VD_AXES.find(a => a.key === key)?.right === 'Llamativa' ? 'llamativa'
            : VD_AXES.find(a => a.key === key)?.right === 'Técnica' ? 'técnica'
            : VD_AXES.find(a => a.key === key)?.right === 'Problema-solución' ? 'problema-solución'
            : VD_AXES.find(a => a.key === key)?.right === 'UGC / TikTok' ? 'ugc-tiktok'
            : VD_AXES.find(a => a.key === key)?.right === 'Más neutra' ? 'neutra'
            : VD_AXES.find(a => a.key === key)?.right === 'Directa' ? 'directa'
            : 'comercial';
          const activeLeft  = vd[key] === leftStored;
          const activeRight = vd[key] === rightStored;

          return (
            <div key={key} className="flex items-center gap-2">
              <button
                onClick={() => onChange({ ...vd, [key]: activeLeft ? null : leftStored } as VisualDirection)}
                className="flex-1 text-right py-1.5 px-3 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: activeLeft ? 'rgba(184,255,92,0.12)' : 'rgba(255,255,255,0.03)',
                  color: activeLeft ? '#B8FF5C' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${activeLeft ? 'rgba(184,255,92,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {left}
              </button>
              <span className="text-[10px] text-text-20 font-mono shrink-0">vs</span>
              <button
                onClick={() => onChange({ ...vd, [key]: activeRight ? null : rightStored } as VisualDirection)}
                className="flex-1 text-left py-1.5 px-3 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: activeRight ? 'rgba(184,255,92,0.12)' : 'rgba(255,255,255,0.03)',
                  color: activeRight ? '#B8FF5C' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${activeRight ? 'rgba(184,255,92,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {right}
              </button>
            </div>
          );
        })}
      </div>

      {selected > 0 && selected < 2 && (
        <p className="text-[11px] text-text-30 px-1">Seleccioná al menos 2 ejes para ver tu recomendación visual estratégica.</p>
      )}

      {advice && (
        <div className="rounded-xl p-4 space-y-3 animate-fade-up" style={{ background: 'rgba(184,255,92,0.04)', border: '1px solid rgba(184,255,92,0.2)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-0.5" style={{ color: '#B8FF5C' }}>Tu perfil visual</div>
            <div className="text-base font-medium text-text-100">{advice.profileName}</div>
            <p className="text-xs text-text-60 mt-1 leading-snug">{advice.why}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1">Tienda</div>
              <p className="text-text-50 leading-snug">{advice.storeUsage}</p>
            </div>
            <div>
              <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1">Publicidad</div>
              <p className="text-text-50 leading-snug">{advice.adUsage}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1.5">Colores a considerar</div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {advice.colorsToConsider.filter(isValidHex).map((hex, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="inline-block w-4 h-4 rounded border border-white/10 shrink-0" style={{ background: hex }} />
                    <span className="text-text-30 text-[10px] font-mono">{hex}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1.5">Colores a evitar</div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {advice.colorsToAvoid.filter(isValidHex).map((hex, i) => (
                  <span key={i} className="inline-block w-4 h-4 rounded border border-white/10 shrink-0 opacity-60" style={{ background: hex }} />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <span className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono">Error común a evitar: </span>
            <span className="text-xs text-text-50">{advice.mistakeToAvoid}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// BOARD CHAT
// ════════════════════════════════════════════════════════

function BoardChat({ productTitle }: { productTitle: string }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    'Dame hooks más agresivos para Meta Ads',
    'Suena muy genérico, mejorá el hook principal',
    'Quiero que suene menos IA y más humano',
    'Quiero un enfoque más problema-solución',
    'Hacelo sonar más premium',
    'Dame una dirección de color clean',
  ];

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', text: text.trim(), ts: Date.now() };
    setMsgs(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const reply = getMockRefinement(text, productTitle);
    setMsgs(p => [...p, { role: 'assistant', text: reply, ts: Date.now() }]);
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-60">Asistente del Board</span>
          <p className="text-xs text-text-30 mt-0.5">Pedí refinamientos, ideas o ángulos alternativos</p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>dev mode</span>
      </div>

      {msgs.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {msgs.map(m => (
            <div key={m.ts} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className="rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap"
                style={{
                  background: m.role === 'user' ? 'rgba(184,255,92,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(184,255,92,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  color: m.role === 'user' ? '#B8FF5C' : 'rgba(255,255,255,0.7)',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-1.5 px-3 py-2">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-30 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send(input))}
          placeholder="Ej: dame hooks más agresivos para Meta Ads..."
          className="flex-1 bg-bg-2 border border-border-mid rounded-lg px-3 py-2 text-xs text-text-100 placeholder:text-text-20 focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
          style={{ background: 'rgba(184,255,92,0.12)', border: '1px solid rgba(184,255,92,0.25)', color: '#B8FF5C' }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// BOARD SUMMARY PANEL
// ════════════════════════════════════════════════════════

function BoardSummaryPanel({
  data, sel, onGenerate, onClose,
}: {
  data: LaunchBoardData; sel: BoardSelections;
  onGenerate: () => void; onClose?: () => void;
}) {
  const pct = computeProgress(sel);
  const { label: planLbl, color: planColor, preliminary } = planLabel(pct);
  const advice = computeVisualAdvice(sel.visualDirection);
  const mainAngle = data.creativeAngles.find(a => a.id === sel.mainAngleId);
  const audience  = data.audienceSegments.find(a => a.id === sel.audienceId);
  const offer     = data.offerDirections.find(o => o.id === sel.offerId);

  const Row = ({ label, value, done }: { label: string; value: string | null; done: boolean }) => (
    <div className="flex items-start gap-2 py-1.5 border-b border-border-soft last:border-0">
      <span className="text-[10px] mt-0.5 shrink-0" style={{ color: done ? '#4ADE80' : 'rgba(255,255,255,0.25)' }}>{done ? '●' : '○'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono">{label}</div>
        {value && <div className="text-xs text-text-60 leading-snug mt-0.5 truncate">{value}</div>}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-60 font-medium">Mi Launch Board</span>
        {onClose && <button onClick={onClose} className="text-text-30 hover:text-text-60 text-xs">✕</button>}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-text-40">Completado</span>
          <span className="text-[11px] font-mono font-medium" style={{ color: planColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: planColor }} />
        </div>
        <div className="text-[10px] text-text-30 mt-1 font-mono">{planLbl}</div>
      </div>

      <div>
        <Row label="Producto" value={data.product.title} done={true} />
        <Row
          label="Dirección visual"
          value={advice ? advice.profileName : null}
          done={Object.values(sel.visualDirection).filter(Boolean).length >= 2}
        />
        <Row label="Ángulo principal" value={mainAngle?.name ?? null} done={!!mainAngle} />
        <Row label="Público" value={audience?.name ?? null} done={!!audience} />
        <Row label="Oferta" value={offer?.name ?? null} done={!!offer} />
        <Row
          label={`Creativos ${sel.creativeIds.length}/${MAX_CREATIVES}`}
          value={sel.creativeIds.length > 0 ? `${sel.creativeIds.length} seleccionados` : null}
          done={sel.creativeIds.length >= 1}
        />
        <Row
          label={`Prompts ${sel.promptIds.length}/${MAX_PROMPTS}`}
          value={sel.promptIds.length > 0 ? `${sel.promptIds.length} seleccionados` : null}
          done={sel.promptIds.length >= 1}
        />
        <Row
          label={`Shots ${sel.shotIds.length}/${MAX_SHOTS}`}
          value={sel.shotIds.length > 0 ? `${sel.shotIds.length} seleccionados` : null}
          done={sel.shotIds.length >= 1}
        />
      </div>

      {pct < 60 && (
        <p className="text-[11px] text-text-30 leading-snug">
          Podés generar un plan preliminar ahora. Será más preciso si completás dirección visual, ángulo y oferta.
        </p>
      )}

      <button
        onClick={onGenerate}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: pct >= 30 ? 'rgba(184,255,92,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${pct >= 30 ? 'rgba(184,255,92,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: pct >= 30 ? '#B8FF5C' : 'rgba(255,255,255,0.3)',
        }}
      >
        {pct < 30 ? 'Generar plan orientativo →' : preliminary ? 'Generar plan preliminar →' : 'Generar plan completo →'}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// FINAL PLAN DISPLAY
// ════════════════════════════════════════════════════════

function FinalPlanDisplay({ plan, onBack, onUpdate }: {
  plan: FinalActionPlanData; onBack: () => void; onUpdate: () => void;
}) {
  const PlanSection = ({ title, items, color = '#B8FF5C' }: { title: string; items: string[]; color?: string }) => {
    const f = items.filter(Boolean);
    if (!f.length) return null;
    return (
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-2" style={{ color }}>{title}</div>
        <ul className="space-y-1.5">
          {f.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-70 leading-snug">
              <span className="shrink-0 mt-0.5" style={{ color }}>·</span>{item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border p-5 sm:p-6 space-y-6" style={{ borderColor: 'rgba(184,255,92,0.3)', background: 'rgba(184,255,92,0.04)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {plan.isPreliminary && (
            <div className="text-[10px] font-mono px-2 py-0.5 rounded inline-block mb-2" style={{ background: 'rgba(250,204,21,0.12)', color: '#FACC15' }}>
              Plan preliminar — completá más decisiones para mayor precisión
            </div>
          )}
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono mb-1.5" style={{ color: '#B8FF5C' }}>
            {plan.isPreliminary ? 'Plan orientativo generado' : 'Plan de acción generado'}
          </div>
          <h3 className="font-display text-2xl text-text-100">Qué hacer ahora</h3>
          <p className="text-xs text-text-40 mt-1 leading-snug">{plan.launchDirectionSummary}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack} className="text-xs text-text-30 hover:text-text-60 transition-colors px-3 py-1.5 rounded-lg border border-border-soft">
            ← Editar board
          </button>
          <button onClick={onUpdate} className="text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'rgba(184,255,92,0.3)', color: '#B8FF5C' }}>
            ↻ Actualizar plan
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <PlanSection title="Crear primero" items={plan.createFirst} />
        <PlanSection title="Validar primero" items={plan.validateFirst} />
        <PlanSection title="Antes de la muestra" items={plan.beforeSampleArrives} />
        <PlanSection title="Cuando llegue la muestra" items={plan.whenSampleArrives} />
        <PlanSection title="Después del primer test" items={plan.afterFirstTest} />
        <div className="space-y-5">
          <PlanSection title="Señales de éxito" items={plan.successSignals} color="#4ADE80" />
          <PlanSection title="Señales de parar" items={plan.stopSignals} color="#F87171" />
        </div>
      </div>

      {plan.claimsToAvoid.filter(Boolean).length > 0 && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: '#F87171' }}>Claims a evitar hasta confirmar con muestra física</div>
          <ul className="space-y-1">
            {plan.claimsToAvoid.filter(Boolean).map((c, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-60">
                <span className="shrink-0" style={{ color: '#F87171' }}>·</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════

interface Props {
  data: LaunchBoardData;
  productTitle?: string;
  onBack: () => void;
}

const REFINE_OPTIONS = [
  { label: 'Más agresivo (Meta)', action: 'meta ads' },
  { label: 'Menos genérico',     action: 'genérico' },
  { label: 'Más emocional',      action: 'emocional' },
  { label: 'Más directo',        action: 'directo' },
];

export default function LaunchBoardView({ data, productTitle, onBack }: Props) {
  const [sel, setSel] = useState<BoardSelections>(INITIAL_SEL);
  const [collapsed, setCollapsed]         = useState<Set<string>>(new Set(['product', 'shots-nice', 'store']));
  const [showAllCreatives, setShowAllCreatives] = useState(false);
  const [showAllPrompts, setShowAllPrompts]     = useState(false);
  const [showFinalPlan, setShowFinalPlan]       = useState(false);
  const [generatedPlan, setGeneratedPlan]       = useState<FinalActionPlanData | null>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [showChat, setShowChat]                 = useState(false);
  const [refiningId, setRefiningId]             = useState<string | null>(null);

  // Persist board selections to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BOARD_LS_KEY);
      if (saved) setSel(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(BOARD_LS_KEY, JSON.stringify(sel)); } catch {}
  }, [sel]);

  const col    = (id: string) => setCollapsed(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isCol  = (id: string) => collapsed.has(id);

  const toggleCreative = (id: string) => setSel(p => {
    if (p.creativeIds.includes(id)) return { ...p, creativeIds: p.creativeIds.filter(x => x !== id) };
    if (p.creativeIds.length >= MAX_CREATIVES) return p;
    return { ...p, creativeIds: [...p.creativeIds, id] };
  });
  const togglePrompt = (id: string) => setSel(p => {
    if (p.promptIds.includes(id)) return { ...p, promptIds: p.promptIds.filter(x => x !== id) };
    if (p.promptIds.length >= MAX_PROMPTS) return p;
    return { ...p, promptIds: [...p.promptIds, id] };
  });
  const toggleShot = (id: string) => setSel(p => {
    if (p.shotIds.includes(id)) return { ...p, shotIds: p.shotIds.filter(x => x !== id) };
    if (p.shotIds.length >= MAX_SHOTS) return p;
    return { ...p, shotIds: [...p.shotIds, id] };
  });

  const applyRefinement = (cardId: string, action: string) => {
    const card = data.staticCreatives.find(c => c.id === cardId);
    if (!card) return;
    const refined = getMockRefinement(action + ' para ' + card.hook, data.product.title);
    const firstLine = refined.split('\n').find(l => l.match(/^\d\.|^"/))?.replace(/^\d\.\s*"?/, '').replace(/"$/, '') ?? card.hook;
    setSel(p => ({ ...p, refinedHooks: { ...p.refinedHooks, [cardId]: firstLine } }));
    setRefiningId(null);
  };

  const pct = computeProgress(sel);

  const handleGeneratePlan = () => {
    setGeneratedPlan(generatePlan(data, sel));
    setShowFinalPlan(true);
    setShowMobileSummary(false);
  };

  const mustHaveShots   = data.shotList.filter(s => s.priority === 'must-have');
  const niceToHaveShots = data.shotList.filter(s => s.priority === 'nice-to-have');
  const visCreatives    = showAllCreatives ? data.staticCreatives : data.staticCreatives.slice(0, DEFAULT_VIS);
  const visPrompts      = showAllPrompts   ? data.imagePrompts    : data.imagePrompts.slice(0, DEFAULT_VIS);

  const verdictColor = (v: string) => v === 'go' ? '#4ADE80' : v === 'maybe' ? '#FACC15' : '#F87171';
  const verdictLabel = (v: string) => v === 'go' ? 'Avanzar' : v === 'maybe' ? 'Dudoso' : 'Descartar';

  return (
    <div className="animate-fade-up">

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="mt-0.5 text-sm text-text-40 hover:text-text-80 transition-colors shrink-0">← Volver</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: '#B8FF5C' }}>Launch Board</span>
            <span className="text-[10px] font-mono text-text-20">·</span>
            <span className="text-[10px] font-mono text-text-30">{data.market.country} · {data.market.language}</span>
          </div>
          <h2 className="font-display text-2xl text-text-100 leading-tight">{productTitle ?? data.product.title}</h2>
          <p className="text-xs text-text-40 mt-1">Workspace de decisiones de lanzamiento. Editá en cualquier orden — el plan se actualiza con tus selecciones.</p>
        </div>
        <button
          onClick={() => setShowMobileSummary(p => !p)}
          className="lg:hidden px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors shrink-0"
          style={{
            borderColor: pct >= 60 ? 'rgba(184,255,92,0.4)' : 'rgba(255,255,255,0.1)',
            color: pct >= 60 ? '#B8FF5C' : 'rgba(255,255,255,0.56)',
          }}
        >
          Board {pct}%
        </button>
      </div>

      <div className="flex gap-6 lg:flex-row flex-col items-start">

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-3">

          {showMobileSummary && (
            <div className="lg:hidden">
              <BoardSummaryPanel data={data} sel={sel} onGenerate={handleGeneratePlan} onClose={() => setShowMobileSummary(false)} />
            </div>
          )}

          {/* Final plan view */}
          {showFinalPlan && generatedPlan ? (
            <FinalPlanDisplay
              plan={generatedPlan}
              onBack={() => setShowFinalPlan(false)}
              onUpdate={() => { setGeneratedPlan(generatePlan(data, sel)); }}
            />
          ) : (
            <>

              {/* 1. Producto */}
              <div>
                <SectionTitle title="Producto seleccionado" badge="Base" collapsed={isCol('product')} onToggle={() => col('product')} />
                {!isCol('product') && (
                  <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-text-100 leading-snug">{data.product.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: `${verdictColor(data.product.verdict)}18`, color: verdictColor(data.product.verdict) }}>
                            {verdictLabel(data.product.verdict)}
                          </span>
                          <span className="font-display text-lg" style={{ color: '#B8FF5C' }}>{data.product.score}</span>
                          <span className="text-xs text-text-30">/ 100</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { label: 'Oportunidad', value: data.product.mainOpportunity, color: '#4ADE80' },
                        { label: 'Riesgo',       value: data.product.mainRisk,        color: '#F87171' },
                        { label: '¿Por qué?',   value: data.product.whyPursue,       color: '#B8FF5C' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}18` }}>
                          <div className="text-[10px] uppercase tracking-[0.1em] font-mono mb-1" style={{ color }}>{label}</div>
                          <p className="text-text-60 leading-snug">{value}</p>
                        </div>
                      ))}
                    </div>
                    {data.product.signalsSummary && (
                      <p className="text-xs text-text-30 italic border-t border-border-soft pt-2">{data.product.signalsSummary}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Dirección visual */}
              <div>
                <SectionTitle
                  title="Dirección visual"
                  badge={Object.values(sel.visualDirection).filter(Boolean).length >= 2 ? computeVisualAdvice(sel.visualDirection)?.profileName : undefined}
                  collapsed={isCol('visual')}
                  onToggle={() => col('visual')}
                />
                {!isCol('visual') && (
                  <VisualDirectionPanel
                    vd={sel.visualDirection}
                    onChange={vd => setSel(p => ({ ...p, visualDirection: vd }))}
                  />
                )}
              </div>

              {/* 3. Ángulos creativos */}
              <div>
                <SectionTitle
                  title="Ángulos creativos"
                  badge={sel.mainAngleId ? (sel.secondaryAngleId ? '2 elegidos' : '1 elegido') : undefined}
                  collapsed={isCol('angles')}
                  onToggle={() => col('angles')}
                />
                {!isCol('angles') && (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-text-40 px-1">El ángulo define cómo comunicar el producto. Elegí uno principal y opcionalmente uno secundario para testear.</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {data.creativeAngles.map(a => {
                        const isMain = sel.mainAngleId === a.id;
                        const isSec  = sel.secondaryAngleId === a.id;
                        return (
                          <div key={a.id} className="rounded-xl border p-4 flex flex-col gap-3 transition-all"
                            style={{
                              borderColor: isMain ? 'rgba(184,255,92,0.45)' : isSec ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.08)',
                              background: isMain ? 'rgba(184,255,92,0.06)' : isSec ? 'rgba(250,204,21,0.04)' : 'rgba(255,255,255,0.02)',
                            }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-text-100">{a.name}</div>
                                <div className="text-[11px] font-mono text-text-40 mt-0.5">Emoción: {a.emotion}</div>
                              </div>
                              {isMain && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(184,255,92,0.15)', color: '#B8FF5C' }}>Principal</span>}
                              {isSec  && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(250,204,21,0.15)', color: '#FACC15' }}>Secundario</span>}
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div><span className="text-text-30">Público: </span><span className="text-text-60">{a.targetAudience}</span></div>
                              <div><span className="text-text-30">Por qué funciona: </span><span className="text-text-60">{a.whyItCouldWork}</span></div>
                              <div><span className="text-text-30">Riesgo: </span><span className="text-text-50">{a.risk}</span></div>
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-border-soft">
                              <button
                                onClick={() => setSel(p => ({
                                  ...p,
                                  mainAngleId: p.mainAngleId === a.id ? null : a.id,
                                  secondaryAngleId: p.secondaryAngleId === a.id ? null : p.secondaryAngleId,
                                }))}
                                className="text-[11px] font-mono transition-colors"
                                style={{ color: isMain ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}
                              >
                                {isMain ? '✓ Principal' : 'Elegir principal'}
                              </button>
                              {!isMain && (
                                <button
                                  onClick={() => setSel(p => ({
                                    ...p,
                                    secondaryAngleId: p.secondaryAngleId === a.id ? null : a.id,
                                  }))}
                                  className="text-[11px] font-mono transition-colors"
                                  style={{ color: isSec ? '#FACC15' : 'rgba(255,255,255,0.25)' }}
                                >
                                  {isSec ? '✓ Secundario' : '+ Secundario'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Público */}
              <div>
                <SectionTitle
                  title="Público prioritario"
                  badge={sel.audienceId ? '1 elegido' : undefined}
                  collapsed={isCol('audience')}
                  onToggle={() => col('audience')}
                />
                {!isCol('audience') && (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-text-40 px-1">¿A quién le vas a hablar primero? El segmento con más chances de comprar en el test inicial.</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {data.audienceSegments.map(a => (
                        <SelectableCard key={a.id} selected={sel.audienceId === a.id} onSelect={() => setSel(p => ({ ...p, audienceId: p.audienceId === a.id ? null : a.id }))}>
                          <div className="text-sm font-medium text-text-100 pr-6">{a.name}</div>
                          <div className="space-y-1.5 text-xs">
                            <div><span className="text-text-30">Dolor / deseo: </span><span className="text-text-60">{a.painDesire}</span></div>
                            <div><span className="text-text-30">Motivación: </span><span className="text-text-60">{a.buyingMotivation}</span></div>
                            <div><span className="text-text-30">Objeción: </span><span className="text-text-50">{a.riskObjection}</span></div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Oferta */}
              <div>
                <SectionTitle
                  title="Dirección de oferta"
                  badge={sel.offerId ? '1 elegida' : undefined}
                  collapsed={isCol('offers')}
                  onToggle={() => col('offers')}
                />
                {!isCol('offers') && (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-text-40 px-1">¿Cómo vas a estructurar la primera venta?</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {data.offerDirections.map(o => (
                        <SelectableCard key={o.id} selected={sel.offerId === o.id} onSelect={() => setSel(p => ({ ...p, offerId: p.offerId === o.id ? null : o.id }))}>
                          <div className="text-sm font-medium text-text-100 pr-6">{o.name}</div>
                          <p className="text-xs text-text-60 leading-snug">{o.offerIdea}</p>
                          {o.marginCaution && (
                            <div className="flex gap-1.5 items-start text-xs">
                              <span style={{ color: '#FACC15' }} className="shrink-0">⚠</span>
                              <span className="text-text-40">{o.marginCaution}</span>
                            </div>
                          )}
                        </SelectableCard>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Creativos */}
              <div>
                <SectionTitle
                  title="Creativos estáticos"
                  count={sel.creativeIds.length}
                  minCount={1}
                  collapsed={isCol('creatives')}
                  onToggle={() => col('creatives')}
                />
                {!isCol('creatives') && (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-text-40">Seleccioná hasta {MAX_CREATIVES} creativos para producir primero.</p>
                      <span className="text-[11px] font-mono" style={{ color: sel.creativeIds.length >= 1 ? '#4ADE80' : 'rgba(255,255,255,0.3)' }}>
                        {sel.creativeIds.length}/{MAX_CREATIVES}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {visCreatives.map(c => {
                        const isSel   = sel.creativeIds.includes(c.id);
                        const atMax   = sel.creativeIds.length >= MAX_CREATIVES;
                        const refined = sel.refinedHooks[c.id];
                        const isRefining = refiningId === c.id;
                        return (
                          <div key={c.id} className="rounded-xl border flex flex-col gap-3 overflow-hidden transition-all"
                            style={{
                              borderColor: isSel ? 'rgba(184,255,92,0.45)' : atMax && !isSel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                              background: isSel ? 'rgba(184,255,92,0.06)' : 'rgba(255,255,255,0.02)',
                              opacity: atMax && !isSel ? 0.5 : 1,
                            }}>
                            <div className="p-4 flex flex-col gap-3">
                              <div className="flex items-start gap-2 flex-wrap">
                                <RiskBadge risk={c.claimRisk} />
                                <span className="text-[10px] font-mono text-text-30 ml-auto">{c.format}</span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-text-100 leading-snug">{refined ?? c.hook}</div>
                                {refined && (
                                  <div className="text-[10px] text-text-30 mt-0.5 line-through">{c.hook}</div>
                                )}
                                <p className="text-xs text-text-50 mt-1 leading-snug">{c.mainCopy}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-text-30">Ángulo: </span><span className="text-text-50">{c.angle}</span></div>
                                <div><span className="text-text-30">CTA: </span><span className="text-text-50">{c.cta}</span></div>
                              </div>
                              {c.claimCaution && (
                                <p className="text-[11px] text-text-30 italic">{c.claimCaution}</p>
                              )}
                            </div>
                            <div className="border-t border-border-soft px-4 py-2.5 flex items-center gap-3 flex-wrap">
                              <button
                                onClick={() => toggleCreative(c.id)}
                                disabled={atMax && !isSel}
                                className="text-[11px] font-mono transition-colors"
                                style={{ color: isSel ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}
                              >
                                {isSel ? '✓ En el board' : '+ Al board'}
                              </button>
                              <div className="ml-auto flex gap-2">
                                <button
                                  onClick={() => setRefiningId(isRefining ? null : c.id)}
                                  className="text-[10px] font-mono px-2 py-1 rounded transition-colors"
                                  style={{ background: isRefining ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)', color: isRefining ? '#FACC15' : 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                  Refinar
                                </button>
                                {refined && (
                                  <button
                                    onClick={() => setSel(p => { const r = { ...p.refinedHooks }; delete r[c.id]; return { ...p, refinedHooks: r }; })}
                                    className="text-[10px] font-mono px-2 py-1 rounded"
                                    style={{ color: 'rgba(248,113,113,0.6)', border: '1px solid rgba(248,113,113,0.15)' }}
                                  >
                                    Restaurar
                                  </button>
                                )}
                              </div>
                            </div>
                            {isRefining && (
                              <div className="border-t border-border-soft px-4 py-3 flex flex-wrap gap-2">
                                {REFINE_OPTIONS.map(opt => (
                                  <button
                                    key={opt.action}
                                    onClick={() => applyRefinement(c.id, opt.action)}
                                    className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg transition-colors"
                                    style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', color: '#FACC15' }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {data.staticCreatives.length > DEFAULT_VIS && (
                      <button
                        onClick={() => setShowAllCreatives(p => !p)}
                        className="w-full py-2.5 rounded-xl text-xs font-mono transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {showAllCreatives ? 'Ver menos' : `Ver todos (${data.staticCreatives.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 7. Prompts de imagen */}
              <div>
                <SectionTitle
                  title="Prompts de imagen IA"
                  count={sel.promptIds.length}
                  minCount={1}
                  collapsed={isCol('prompts')}
                  onToggle={() => col('prompts')}
                />
                {!isCol('prompts') && (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-text-40">Seleccioná hasta {MAX_PROMPTS} prompts para generar primero.</p>
                      <span className="text-[11px] font-mono" style={{ color: sel.promptIds.length >= 1 ? '#4ADE80' : 'rgba(255,255,255,0.3)' }}>
                        {sel.promptIds.length}/{MAX_PROMPTS}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {visPrompts.map(p => {
                        const isSel = sel.promptIds.includes(p.id);
                        const atMax = sel.promptIds.length >= MAX_PROMPTS;
                        return (
                          <div key={p.id} className="rounded-xl border flex flex-col gap-0 overflow-hidden transition-all"
                            style={{
                              borderColor: isSel ? 'rgba(184,255,92,0.45)' : atMax && !isSel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                              background: isSel ? 'rgba(184,255,92,0.06)' : 'rgba(255,255,255,0.02)',
                              opacity: atMax && !isSel ? 0.5 : 1,
                            }}>
                            <div className="p-4 flex flex-col gap-2">
                              <div className="text-sm font-medium text-text-100">{p.title}</div>
                              <p className="text-xs text-text-50 leading-snug">{p.objective}</p>
                              <div className="rounded-lg px-3 py-2 font-mono text-[11px] text-text-40 leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                {p.prompt}
                              </div>
                              {p.claimSafetyNote && (
                                <p className="text-[10px] text-text-30 italic">{p.claimSafetyNote}</p>
                              )}
                            </div>
                            <div className="border-t border-border-soft px-4 py-2.5">
                              <button
                                onClick={() => togglePrompt(p.id)}
                                disabled={atMax && !isSel}
                                className="text-[11px] font-mono transition-colors"
                                style={{ color: isSel ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}
                              >
                                {isSel ? '✓ En el board' : '+ Al board'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {data.imagePrompts.length > DEFAULT_VIS && (
                      <button
                        onClick={() => setShowAllPrompts(p => !p)}
                        className="w-full py-2.5 rounded-xl text-xs font-mono transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {showAllPrompts ? 'Ver menos' : `Ver todos (${data.imagePrompts.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 8. Store */}
              <div>
                <SectionTitle
                  title="Estructura de tienda"
                  badge={sel.storeSelected ? 'Incluida' : undefined}
                  collapsed={isCol('store')}
                  onToggle={() => col('store')}
                />
                {!isCol('store') && (
                  <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1">Hero headline</div>
                        <p className="text-text-80 font-medium leading-snug">{data.storeDirection.heroHeadline}</p>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-1">Subheadline</div>
                        <p className="text-text-60 leading-snug">{data.storeDirection.heroSubheadline}</p>
                      </div>
                    </div>
                    {data.storeDirection.keySections.length > 0 && (
                      <div>
                        <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-2">Secciones recomendadas</div>
                        <ul className="space-y-1">
                          {data.storeDirection.keySections.map((s, i) => (
                            <li key={i} className="flex gap-2 text-xs text-text-50"><span style={{ color: '#B8FF5C' }}>·</span>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.storeDirection.topObjections.length > 0 && (
                      <div>
                        <div className="text-[10px] text-text-30 uppercase tracking-[0.1em] font-mono mb-2">Objeciones a responder</div>
                        <ul className="space-y-1">
                          {data.storeDirection.topObjections.map((o, i) => (
                            <li key={i} className="flex gap-2 text-xs text-text-50"><span style={{ color: '#FACC15' }}>·</span>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.storeDirection.platformSuggestion && (
                      <p className="text-[11px] text-text-30 font-mono">Plataforma recomendada: {data.storeDirection.platformSuggestion}</p>
                    )}
                    <div className="pt-2 border-t border-border-soft">
                      <button
                        onClick={() => setSel(p => ({ ...p, storeSelected: !p.storeSelected }))}
                        className="text-xs font-mono transition-colors"
                        style={{ color: sel.storeSelected ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}
                      >
                        {sel.storeSelected ? '✓ Incluir en mi plan' : '+ Incluir en mi plan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 9. Shot list */}
              <div>
                <SectionTitle
                  title="Shot list — Must-have"
                  count={sel.shotIds.filter(id => mustHaveShots.some(s => s.id === id)).length}
                  minCount={1}
                  collapsed={isCol('shots-must')}
                  onToggle={() => col('shots-must')}
                />
                {!isCol('shots-must') && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-text-40 px-1">Shots críticos para el día que llegue la muestra. Seleccioná los que vas a priorizar.</p>
                    {mustHaveShots.map(s => {
                      const isSel = sel.shotIds.includes(s.id);
                      const atMax = sel.shotIds.length >= MAX_SHOTS;
                      return (
                        <div key={s.id} className="rounded-xl border p-3 flex gap-3 transition-all"
                          style={{
                            borderColor: isSel ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.07)',
                            background: isSel ? 'rgba(184,255,92,0.05)' : 'rgba(255,255,255,0.02)',
                          }}>
                          <div className="flex-1 space-y-1 text-xs">
                            <div className="text-sm font-medium text-text-80 leading-snug">{s.goal}</div>
                            <div><span className="text-text-30">Setup: </span><span className="text-text-50">{s.setup}</span></div>
                            <div><span className="text-text-30">Mostrar: </span><span className="text-text-50">{s.whatToShow}</span></div>
                            <div><span className="text-text-30">Evitar: </span><span className="text-text-40">{s.whatToAvoid}</span></div>
                          </div>
                          <button
                            onClick={() => toggleShot(s.id)}
                            disabled={atMax && !isSel}
                            className="shrink-0 text-[11px] font-mono self-start mt-1 transition-colors"
                            style={{ color: isSel ? '#B8FF5C' : 'rgba(255,255,255,0.35)' }}
                          >
                            {isSel ? '✓' : '+'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <SectionTitle
                  title="Shot list — Nice-to-have"
                  count={sel.shotIds.filter(id => niceToHaveShots.some(s => s.id === id)).length}
                  minCount={0}
                  collapsed={isCol('shots-nice')}
                  onToggle={() => col('shots-nice')}
                />
                {!isCol('shots-nice') && (
                  <div className="mt-2 space-y-2">
                    {niceToHaveShots.map(s => {
                      const isSel = sel.shotIds.includes(s.id);
                      const atMax = sel.shotIds.length >= MAX_SHOTS;
                      return (
                        <div key={s.id} className="rounded-xl border p-3 flex gap-3 transition-all"
                          style={{
                            borderColor: isSel ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.05)',
                            background: isSel ? 'rgba(184,255,92,0.04)' : 'transparent',
                            opacity: atMax && !isSel ? 0.5 : 1,
                          }}>
                          <div className="flex-1 space-y-1 text-xs">
                            <div className="text-sm text-text-70 leading-snug">{s.goal}</div>
                            <div><span className="text-text-30">Setup: </span><span className="text-text-40">{s.setup}</span></div>
                          </div>
                          <button
                            onClick={() => toggleShot(s.id)}
                            disabled={atMax && !isSel}
                            className="shrink-0 text-[11px] font-mono self-start mt-1 transition-colors"
                            style={{ color: isSel ? '#B8FF5C' : 'rgba(255,255,255,0.3)' }}
                          >
                            {isSel ? '✓' : '+'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile generate button */}
              <div className="lg:hidden">
                <button
                  onClick={handleGeneratePlan}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: pct >= 30 ? 'rgba(184,255,92,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${pct >= 30 ? 'rgba(184,255,92,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: pct >= 30 ? '#B8FF5C' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {pct < 30 ? 'Generar plan orientativo →' : pct < 60 ? 'Generar plan preliminar →' : 'Generar plan →'}
                </button>
              </div>

              {/* 10. Asistente del board */}
              <div>
                <button
                  onClick={() => setShowChat(p => !p)}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-border-soft bg-bg-1/60 hover:border-border-mid transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-text-80">Asistente del Board</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>beta</span>
                  </div>
                  <span className="text-text-40 text-xs" style={{ transform: showChat ? undefined : 'rotate(-90deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
                </button>
                {showChat && (
                  <div className="mt-2">
                    <BoardChat productTitle={productTitle ?? data.product.title} />
                  </div>
                )}
              </div>

            </>
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-8">
            <BoardSummaryPanel data={data} sel={sel} onGenerate={handleGeneratePlan} />
          </div>
        </div>

      </div>
    </div>
  );
}
