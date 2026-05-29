/**
 * Alibaba supplier signals via ScraperAPI.
 * Tries multiple queries (Spanish + English translations) in parallel.
 * Returns: FOB price range (USD), supplier count, MOQ.
 */
import { load } from 'cheerio';
import type { SourceState } from './source-status';

export interface SupplierResult {
  priceRangeUSD: [number, number] | null;
  supplierCount: number | null;
  moqMin: number | null;
  moqUnit: string | null;
  source: SourceState;
}

function getApiKey(): string | null {
  if (process.env.SCRAPERAPI_KEY) return process.env.SCRAPERAPI_KEY;
  const proxy = process.env.ML_SCRAPER_PROXY_URL ?? '';
  return proxy.match(/api_key=([^&\s]+)/)?.[1] ?? null;
}

function parsePriceRange(text: string): [number, number] | null {
  const nums = (text.match(/[\d.]+/g) ?? []).map(Number).filter(n => n > 0 && n < 100_000);
  if (nums.length >= 2) return [Math.min(...nums), Math.max(...nums)];
  if (nums.length === 1) return [nums[0], nums[0]];
  return null;
}

function parseMOQ(text: string): { count: number; unit: string } | null {
  const m = text.match(/([\d,]+)\s*(?:\/)?\s*(piece|unit|pcs?|set|lot|pair|pack|bag|box|roll|meter|kg|g)s?/i);
  if (!m) return null;
  const count = parseInt(m[1].replace(/,/g, ''), 10);
  return count > 0 ? { count, unit: m[2].toLowerCase() } : null;
}

function extractNextData(html: string): any {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function parseNextData(json: any): { prices: number[]; moqs: {count:number;unit:string}[]; total: number | null } {
  const prices: number[] = [];
  const moqs: {count:number;unit:string}[] = [];
  let total: number | null = null;

  try {
    const pageProps = json?.props?.pageProps ?? {};
    const data = pageProps?.initialData?.data ?? pageProps?.data ?? {};

    const tc = data?.pageInfo?.totalCount ?? data?.totalCount ?? data?.total ?? null;
    if (typeof tc === 'number') total = tc;

    const offers: any[] = data?.offerList ?? data?.offers ?? data?.productList ?? [];
    for (const offer of offers.slice(0, 20)) {
      const priceDisplay: string = offer?.price?.priceDisplay ?? offer?.priceInfo?.price ?? '';
      const range = parsePriceRange(priceDisplay);
      if (range) prices.push(...range);

      const moqText: string = offer?.moq?.minOrderQuantity ?? offer?.tradeQuantity ?? '';
      const moqUnit: string = offer?.moq?.moqUnit ?? offer?.unit ?? '';
      if (moqText) {
        const q = parseInt(String(moqText).replace(/,/g, ''), 10);
        if (q > 0) moqs.push({ count: q, unit: moqUnit || 'piece' });
      }
    }
  } catch { /* non-fatal */ }

  return { prices, moqs, total };
}

/** Simple word-by-word ES→EN translation for common product terms */
const WORD_MAP: Record<string, string> = {
  afeitadora: 'shaver', rasuradora: 'shaver', afeitador: 'shaver',
  depiladora: 'hair remover', depilador: 'hair remover',
  mujer: 'women', femenina: 'women', femenino: 'women', dama: 'women', damas: 'women',
  hombre: 'men', masculino: 'men', masculina: 'men',
  electrica: 'electric', eléctrica: 'electric', electrico: 'electric', eléctrico: 'electric',
  portatil: 'portable', portátil: 'portable',
  recargable: 'rechargeable',
  inalambrica: 'wireless', inalámbrica: 'wireless', inalambrico: 'wireless',
  masajeador: 'massager', masajero: 'massager', masaje: 'massage',
  limpiador: 'cleaner', limpiadora: 'cleaner',
  calentador: 'heater', calentadora: 'heater',
  aspiradora: 'vacuum cleaner', aspirador: 'vacuum cleaner',
  plancha: 'flat iron', secadora: 'hair dryer', secador: 'hair dryer',
  cepillo: 'brush', cepilladora: 'brush',
  lampara: 'lamp', lámpara: 'lamp', luz: 'light', luces: 'lights',
  auricular: 'headphone', auriculares: 'headphones',
  audifono: 'headphone', audifonos: 'headphones',
  reloj: 'watch', pulsera: 'bracelet', collar: 'necklace', anillo: 'ring',
  bolso: 'bag', cartera: 'wallet', mochila: 'backpack',
  maquillaje: 'makeup', labial: 'lipstick', mascara: 'mascara',
  perfume: 'perfume', crema: 'cream',
  zapatilla: 'sneaker', zapatillas: 'sneakers', zapato: 'shoe', zapatos: 'shoes',
  ropa: 'clothing', camisa: 'shirt', pantalon: 'pants', vestido: 'dress',
  juguete: 'toy', juguetes: 'toys',
  cocina: 'kitchen', cocinero: 'cooker',
  altavoz: 'speaker', parlante: 'speaker',
  camara: 'camera', cámara: 'camera',
  cargador: 'charger', cable: 'cable',
  funda: 'case', protector: 'protector',
  silla: 'chair', mesa: 'table',
  fitness: 'fitness', deportes: 'sports', deporte: 'sport',
};

function buildAlibabaQueries(esKeyword: string): string[] {
  const words = esKeyword.toLowerCase().split(/\s+/).filter(Boolean);
  const queries: string[] = [esKeyword];

  // Translate word by word
  const translatedWords = words.map(w => WORD_MAP[w] ?? w);
  const enFull = translatedWords.join(' ');
  if (enFull.toLowerCase() !== esKeyword.toLowerCase()) {
    queries.push(enFull);
  }

  // Pure-English variant: only translated words (skip untranslated ones)
  const pureEn = words.map(w => WORD_MAP[w]).filter(Boolean).join(' ');
  if (pureEn.length >= 3 && !queries.includes(pureEn)) {
    queries.push(pureEn);
  }

  return queries.slice(0, 3);
}

interface ParsedSupplierData {
  prices: number[];
  moqs: {count:number;unit:string}[];
  supplierCount: number | null;
}

async function fetchOneAlibabaQuery(keyword: string, apiKey: string): Promise<ParsedSupplierData> {
  const alibabaUrl = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(keyword)}&tab=all&SortType=total_tranpro_desc`;
  const proxyUrl = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(alibabaUrl)}&render=false&country_code=us`;

  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(14_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  console.log(`[supplier] "${keyword}" HTML len=${html.length}`);

  let prices: number[] = [];
  let moqs: {count:number;unit:string}[] = [];
  let supplierCount: number | null = null;

  // Pass 1: __NEXT_DATA__
  const nextData = extractNextData(html);
  if (nextData) {
    const parsed = parseNextData(nextData);
    prices = parsed.prices;
    moqs = parsed.moqs;
    supplierCount = parsed.total;
    console.log(`[supplier] "${keyword}" __NEXT_DATA__ prices=${prices.length} total=${supplierCount}`);
  }

  // Pass 2: Cheerio fallback
  if (prices.length === 0) {
    const $ = load(html);
    const priceSelectors = [
      '[class*="price-range"]', '[class*="price_range"]',
      '[class*="offer-price"]', '[class*="product-price"]',
      '.price', '[data-price]',
    ];
    for (const sel of priceSelectors) {
      $(sel).slice(0, 20).each((_, el) => {
        const t = $(el).text().trim();
        if (t.includes('$') || t.toLowerCase().includes('us')) {
          const r = parsePriceRange(t);
          if (r) prices.push(...r);
        }
      });
      if (prices.length > 0) break;
    }
    const moqSelectors = ['[class*="moq"]', '[class*="min-order"]', '[class*="minimum"]'];
    for (const sel of moqSelectors) {
      $(sel).slice(0, 20).each((_, el) => {
        const parsed = parseMOQ($(el).text().trim());
        if (parsed) moqs.push(parsed);
      });
      if (moqs.length > 0) break;
    }
    if (!supplierCount) {
      const barText = $('[class*="result-num"], [class*="result-bar"], [class*="supplier-num"]').first().text();
      const m = barText.replace(/,/g, '').match(/([\d]+)/);
      if (m) supplierCount = parseInt(m[1], 10);
    }
    console.log(`[supplier] "${keyword}" Cheerio prices=${prices.length} total=${supplierCount}`);
  }

  return { prices, moqs, supplierCount };
}

/** Score a parsed result: higher = more data */
function dataScore(d: ParsedSupplierData): number {
  return (d.prices.length > 0 ? 2 : 0) + (d.supplierCount ? 1 : 0) + d.moqs.length;
}

export async function fetchSupplierSignals(keyword: string): Promise<SupplierResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      priceRangeUSD: null, supplierCount: null, moqMin: null, moqUnit: null,
      source: { status: 'not_configured', reason: 'Sin clave ScraperAPI' },
    };
  }

  const queries = buildAlibabaQueries(keyword);
  console.log(`[supplier] queries: [${queries.join(' | ')}]`);

  const results = await Promise.allSettled(
    queries.map(q => fetchOneAlibabaQuery(q, apiKey))
  );

  // Pick result with most data
  let best: ParsedSupplierData | null = null;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') {
      console.log(`[supplier] query[${i}] "${queries[i]}" failed: ${(r as PromiseRejectedResult).reason}`);
      continue;
    }
    if (!best || dataScore(r.value) > dataScore(best)) {
      best = r.value;
    }
  }

  if (!best) {
    return {
      priceRangeUSD: null, supplierCount: null, moqMin: null, moqUnit: null,
      source: { status: 'blocked', reason: 'Alibaba sin respuesta desde servidor' },
    };
  }

  const { prices, moqs, supplierCount } = best;

  const priceRangeUSD: [number, number] | null = prices.length > 0
    ? [parseFloat(Math.min(...prices).toFixed(2)), parseFloat(Math.max(...prices).toFixed(2))]
    : null;

  const moqMin = moqs.length > 0 ? Math.min(...moqs.map(m => m.count)) : null;
  const moqUnit = moqs.find(m => m.count === moqMin)?.unit ?? null;

  if (!priceRangeUSD && !supplierCount) {
    return {
      priceRangeUSD: null, supplierCount: null, moqMin: null, moqUnit: null,
      source: { status: 'no_results', reason: 'Sin datos de proveedores en Alibaba para este producto' },
    };
  }

  const parts: string[] = [];
  if (priceRangeUSD) parts.push(`USD ${priceRangeUSD[0]}–${priceRangeUSD[1]} / unidad`);
  if (moqMin) parts.push(`MOQ: ${moqMin} ${moqUnit ?? 'uds'}`);
  if (supplierCount) parts.push(`${new Intl.NumberFormat('es').format(supplierCount)} proveedores`);

  console.log(`[supplier] ok — ${parts.join(' · ')}`);

  return {
    priceRangeUSD,
    supplierCount,
    moqMin,
    moqUnit,
    source: { status: 'ok', reason: parts.join(' · ') },
  };
}
