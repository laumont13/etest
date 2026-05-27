import { load } from 'cheerio';
import { createHash } from 'crypto';

export interface MLScrapedResult {
  competitors: number | null;
  priceRange: [number, number] | null;
  avgPrice: number | null;
  currency: string;
  topResults: Array<{
    title: string;
    price: number;
    rating: number | null;
    reviews: number | null;
  }>;
}

const SITE_DOMAINS: Record<string, string> = {
  MLA: 'listado.mercadolibre.com.ar',
  MLM: 'listado.mercadolibre.com.mx',
  MCO: 'listado.mercadolibre.com.co',
  MLC: 'listado.mercadolibre.cl',
  MPE: 'listado.mercadolibre.com.pe',
};

// In-memory rate limiter (per-site, min 3s between requests)
const lastFetchMs: Record<string, number> = {};
const MIN_INTERVAL_MS = 3000;

// ML serves full SSR to crawlers — Googlebot UA bypasses bot-protection
const UA_GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Fallback browser UA for PoW-challenge bypass path
const UA_BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function crawlerHeaders(domain: string): Record<string, string> {
  return {
    'User-Agent': UA_GOOGLEBOT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Host: domain,
  };
}

function browserHeaders(domain: string): Record<string, string> {
  return {
    'User-Agent': UA_BROWSER,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.7,en;q=0.6',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1',
    Host: domain,
  };
}

function toSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function solveBmPoW(bmstate: string): Promise<string> {
  const decoded = decodeURIComponent(bmstate);
  const parts = decoded.split(';');
  const hash = parts[0];
  const difficulty = parseInt(parts[1] ?? '0', 10);

  if (!difficulty) return `${hash};0`;

  const prefix = '0'.repeat(difficulty);
  for (let i = 0; i < 5_000_000; i++) {
    const digest = createHash('sha256').update(`${hash}${i}`).digest('hex');
    if (digest.startsWith(prefix)) return `${hash};${i}`;
  }
  return `${hash};0`;
}

async function fetchPage(url: string, domain: string): Promise<string | null> {
  // If a proxy is configured (e.g. ScraperAPI), use it — bypasses cloud IP blocks
  const proxyBase = process.env.ML_SCRAPER_PROXY_URL;
  if (proxyBase) {
    try {
      const proxyUrl = `${proxyBase}${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const html = await res.text();
        if (!html.includes('suspicious-traffic-frontend')) return html;
      }
      console.log('[ml-scrape] proxy returned suspicious page — falling through to direct');
    } catch (err) {
      console.error(`[ml-scrape] proxy fetch error: ${err}`);
    }
  }

  // Primary: Googlebot UA — ML returns full SSR without bot protection (residential IPs only)
  try {
    const res = await fetch(url, {
      headers: crawlerHeaders(domain),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (!html.includes('suspicious-traffic-frontend') && !html.includes('verifyChallenge')) {
        return html;
      }
      console.log('[ml-scrape] Googlebot UA hit challenge — falling back to PoW bypass');
    }
  } catch (err) {
    console.error(`[ml-scrape] Googlebot fetch error: ${err}`);
  }

  // Fallback: browser UA + PoW challenge solver
  let res: Response;
  try {
    res = await fetch(url, {
      headers: browserHeaders(domain),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    console.error(`[ml-scrape] browser fetch error: ${err}`);
    return null;
  }

  const html = await res.text();
  const isChallenge =
    html.includes('suspicious-traffic-frontend') ||
    html.includes('_bmstate') ||
    html.includes('verifyChallenge');

  if (!isChallenge) return res.ok ? html : null;

  console.log('[ml-scrape] bot challenge detected — attempting PoW bypass');

  const cookieHeader = res.headers.get('set-cookie') ?? '';
  const bmstateRaw =
    cookieHeader.match(/_bmstate=([^;,\s]+)/)?.[1] ??
    html.match(/_bmstate=([^;'"&\s]+)/)?.[1];

  if (!bmstateRaw) return null;

  const bmc = await solveBmPoW(bmstateRaw);
  const cookies = [
    `_bm_skipml=true`,
    `_bmstate=${bmstateRaw}`,
    `_bmc=${encodeURIComponent(bmc)}`,
  ].join('; ');

  try {
    const retry = await fetch(url, {
      headers: { ...browserHeaders(domain), Cookie: cookies },
      signal: AbortSignal.timeout(12_000),
    });
    const retryHtml = await retry.text();
    if (retryHtml.includes('suspicious-traffic-frontend')) return null;
    return retryHtml;
  } catch {
    return null;
  }
}

function parseJsonLd(html: string): MLScrapedResult | null {
  const scriptRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());

      // ML uses @graph array of Product items
      const graph: any[] = json?.['@graph'] ?? [];
      const products = graph.filter((n: any) => n?.['@type'] === 'Product');
      if (!products.length) continue;

      const topResults = products
        .slice(0, 10)
        .map((p: any) => ({
          title: String(p.name ?? ''),
          price: Number(p.offers?.price ?? 0),
          rating: p.aggregateRating?.ratingValue
            ? parseFloat(p.aggregateRating.ratingValue)
            : null,
          reviews: p.aggregateRating?.ratingCount
            ? parseInt(p.aggregateRating.ratingCount, 10)
            : null,
        }))
        .filter(r => r.price > 0 && r.title);

      if (!topResults.length) continue;

      // Total count from HTML text "N.NNN resultados"
      const countMatch = html.match(/([\d.,]+)\s*resultados/i);
      const competitors = countMatch
        ? parseInt(countMatch[1].replace(/[.,]/g, ''), 10) || null
        : null;

      const currency = products[0]?.offers?.priceCurrency ?? 'ARS';
      const prices = topResults.map(r => r.price);

      return {
        competitors,
        priceRange: [Math.min(...prices), Math.max(...prices)],
        avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        currency,
        topResults,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function parseHtml(html: string): MLScrapedResult | null {
  const $ = load(html);

  let competitors: number | null = null;
  const countText = $('.ui-search-search-result__quantity-results').first().text();
  if (countText) {
    const n = parseInt(countText.replace(/\D/g, ''), 10);
    if (n > 0) competitors = n;
  }

  const topResults: MLScrapedResult['topResults'] = [];

  $('li.ui-search-layout__item').slice(0, 10).each((_, el) => {
    const title =
      $(el).find('.ui-search-item__title').first().text().trim() ||
      $(el).find('h2').first().text().trim();

    const fraction = $(el)
      .find('.andes-money-amount__fraction')
      .first()
      .text()
      .replace(/\./g, '')
      .replace(/\D/g, '');
    const cents = $(el)
      .find('.andes-money-amount__cents')
      .first()
      .text()
      .replace(/\D/g, '');
    const price = fraction ? parseFloat(`${fraction}.${cents || '00'}`) : 0;

    const ratingText = $(el)
      .find('.ui-search-reviews__rating-number, [class*="rating"]')
      .first()
      .text()
      .trim();
    const rating = ratingText ? parseFloat(ratingText) : null;

    const reviewsRaw = $(el)
      .find('.ui-search-reviews__amount, [class*="reviews__amount"]')
      .first()
      .text()
      .replace(/\D/g, '');
    const reviews = reviewsRaw ? parseInt(reviewsRaw, 10) : null;

    if (title && price > 0) {
      topResults.push({
        title,
        price,
        rating: Number.isFinite(rating) ? rating : null,
        reviews,
      });
    }
  });

  if (!topResults.length) return null;

  const prices = topResults.map(r => r.price);
  return {
    competitors,
    priceRange: [Math.min(...prices), Math.max(...prices)],
    avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    currency: 'ARS',
    topResults,
  };
}

export async function scrapeMercadoLibre(
  query: string,
  site: string,
): Promise<MLScrapedResult | null> {
  const domain = SITE_DOMAINS[site];
  if (!domain) return null;

  // Rate limit
  const now = Date.now();
  const elapsed = now - (lastFetchMs[site] ?? 0);
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastFetchMs[site] = Date.now();

  const slug = toSlug(query);
  const url = `https://${domain}/${slug}`;
  console.log(`[ml-scrape] fetching ${url}`);

  const html = await fetchPage(url, domain);
  if (!html) return null;

  if (
    html.includes('No encontramos publicaciones') ||
    html.includes('0 resultados') ||
    html.includes('no encontramos')
  ) {
    return { competitors: 0, priceRange: null, avgPrice: null, currency: 'ARS', topResults: [] };
  }

  const result = parseJsonLd(html) ?? parseHtml(html);

  if (result) {
    console.log(
      `[ml-scrape] ok — site=${site} q="${query}" competitors=${result.competitors} ` +
      `items=${result.topResults.length} avgPrice=${result.avgPrice} currency=${result.currency}`,
    );
  } else {
    console.log(`[ml-scrape] no data extracted from HTML for "${query}"`);
  }

  return result;
}
