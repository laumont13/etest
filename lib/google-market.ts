/**
 * Google-based market signals via ScraperAPI structured endpoint.
 * Runs multiple query variants in parallel and picks the best result.
 *   ML queries:    site:mercadolibre.com.ar {keyword variants}
 *   Price queries: {keyword} precio/comprar {country}
 */
import type { SourceState } from './source-status';

export interface GoogleMarketResult {
  mlEstimatedListings: number | null;
  argPriceRange: [number, number] | null;
  argCurrency: string;
  shoppingItemsFound: number;
  source: SourceState;
  queriesTried: string[];
}

function getApiKey(): string | null {
  if (process.env.SCRAPERAPI_KEY) return process.env.SCRAPERAPI_KEY;
  const proxy = process.env.ML_SCRAPER_PROXY_URL ?? '';
  return proxy.match(/api_key=([^&\s]+)/)?.[1] ?? null;
}

async function structuredSearch(query: string, apiKey: string): Promise<any> {
  const url = new URL('https://api.scraperapi.com/structured/google/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('country_code', 'ar');
  url.searchParams.set('hl', 'es');
  url.searchParams.set('num', '10');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  return res.json();
}

function parseResultCount(text: string): number | null {
  const m = text.replace(/\./g, '').replace(/,/g, '').match(/([\d]+)\s*resultados?/i)
    ?? text.match(/([\d]+)\s*results?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

function parseArsPrice(s: string): number | null {
  const digits = s.replace(/[^\d.,]/g, '');
  const normalized = digits.replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : null;
}

function fmtN(n: number): string {
  return new Intl.NumberFormat('es').format(Math.round(n));
}

/** keyword → up to 3 variants: full, -last word, first word only */
function buildKeywordVariants(keyword: string): string[] {
  const words = keyword.trim().split(/\s+/).filter(Boolean);
  const variants: string[] = [keyword];
  if (words.length >= 3) variants.push(words.slice(0, -1).join(' '));
  if (words.length >= 2) variants.push(words[0]);
  return [...new Set(variants)].slice(0, 3);
}

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'argentina', MX: 'mexico', CO: 'colombia',
  CL: 'chile', PE: 'peru', ES: 'españa',
};

/** Extract prices from a single structured result (shopping + organic fallback) */
function extractPrices(data: any): number[] {
  const shopping: any[] = data?.shopping_results ?? [];
  const fromShopping = shopping
    .map((r: any) => parseArsPrice(r.price ?? ''))
    .filter((p): p is number => p !== null);

  if (fromShopping.length > 0) return fromShopping;

  const snippets = (data?.organic_results ?? [])
    .map((r: any) => r.description ?? '')
    .join(' ');
  return (snippets.match(/\$\s*[\d.,]+/g) ?? [])
    .map(parseArsPrice)
    .filter((p: number | null): p is number => p !== null);
}

export async function fetchGoogleMarketSignals(
  keyword: string,
  countryCode: string,
): Promise<GoogleMarketResult> {
  const apiKey = getApiKey();
  const countryName = COUNTRY_NAMES[countryCode] ?? 'argentina';

  if (!apiKey) {
    return {
      mlEstimatedListings: null, argPriceRange: null, argCurrency: 'ARS',
      shoppingItemsFound: 0,
      source: { status: 'not_configured', reason: 'Sin clave ScraperAPI (ML_SCRAPER_PROXY_URL)' },
      queriesTried: [],
    };
  }

  const variants = buildKeywordVariants(keyword);

  // ML queries: one per variant
  const mlQueries = variants.map(v => `site:mercadolibre.com.ar ${v}`);
  // Price queries: precio + comprar + variant fallback
  const priceQueries = [
    `${keyword} precio ${countryName}`,
    `comprar ${keyword} ${countryName}`,
    variants.length > 1 ? `${variants[1]} precio ${countryName}` : null,
  ].filter((q): q is string => q !== null && q.length > 0);

  const tried = [...mlQueries, ...priceQueries];
  console.log(`[google-market] queries: ML=[${mlQueries.join(' | ')}] price=[${priceQueries.join(' | ')}]`);

  const [mlSettled, priceSettled] = await Promise.all([
    Promise.allSettled(mlQueries.map(q => structuredSearch(q, apiKey))),
    Promise.allSettled(priceQueries.map(q => structuredSearch(q, apiKey))),
  ]);

  // Pick ML result with highest listing count
  let mlEstimatedListings: number | null = null;
  for (let i = 0; i < mlSettled.length; i++) {
    const r = mlSettled[i];
    if (r.status !== 'fulfilled') {
      console.log(`[google-market] ML query[${i}] failed: ${(r as PromiseRejectedResult).reason}`);
      continue;
    }
    const totalStr: string = r.value?.total_results ?? '';
    let count = parseResultCount(totalStr);

    // Secondary: count from organic snippet text
    if (!count) {
      const organic: any[] = r.value?.organic_results ?? [];
      const desc = organic.map((x: any) => x.description ?? '').join(' ');
      const m = desc.match(/([\d.,]+)\s*resultados?/i);
      if (m) count = parseResultCount(m[0]);
    }

    console.log(`[google-market] ML[${i}] total_results="${totalStr}" → ${count}`);
    if (count && (mlEstimatedListings === null || count > mlEstimatedListings)) {
      mlEstimatedListings = count;
    }
  }

  // Pick price result with most prices
  let argPrices: number[] = [];
  let shoppingItemsFound = 0;
  for (let i = 0; i < priceSettled.length; i++) {
    const r = priceSettled[i];
    if (r.status !== 'fulfilled') {
      console.log(`[google-market] price query[${i}] failed: ${(r as PromiseRejectedResult).reason}`);
      continue;
    }
    const prices = extractPrices(r.value);
    const shopping: any[] = r.value?.shopping_results ?? [];
    console.log(`[google-market] price[${i}] shopping=${shopping.length} prices=${prices.length}`);
    if (prices.length > argPrices.length) {
      argPrices = prices;
      shoppingItemsFound = shopping.length;
    }
  }

  const argPriceRange: [number, number] | null = argPrices.length >= 2
    ? [Math.min(...argPrices), Math.max(...argPrices)]
    : argPrices.length === 1
    ? [argPrices[0], argPrices[0]]
    : null;

  const hasData = mlEstimatedListings !== null || argPriceRange !== null;

  return {
    mlEstimatedListings,
    argPriceRange,
    argCurrency: 'ARS',
    shoppingItemsFound,
    source: {
      status: hasData ? 'ok' : 'no_results',
      reason: hasData
        ? [
            mlEstimatedListings != null ? `~${fmtN(mlEstimatedListings)} resultados en ML (vía Google)` : '',
            argPriceRange != null ? `Precios AR: ${fmtN(argPriceRange[0])}–${fmtN(argPriceRange[1])} ARS` : '',
          ].filter(Boolean).join(' · ')
        : 'Sin datos de búsqueda Google para este keyword',
    },
    queriesTried: tried,
  };
}
