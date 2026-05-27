import type { SourceState } from './source-status';
import { getCountry } from './countries';
import { getMLToken } from './ml-auth';
import { scrapeMercadoLibre } from './ml-scraper';

const SITE_BY_COUNTRY: Record<string, string> = {
  AR: 'MLA',
  MX: 'MLM',
  CO: 'MCO',
  CL: 'MLC',
  PE: 'MPE',
  ES: 'MES',
};

export interface MLResult {
  competitors: number | null;
  priceRange: [number, number] | null;
  currency: string | null;
  source: SourceState;
  queriesTried: string[];
}

function buildQueryVariants(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (v: string) => {
    const t = v.trim();
    if (t.length >= 2 && !seen.has(t)) { seen.add(t); variants.push(t); }
  };

  add(query);
  if (words.length >= 3) add(words.slice(0, 2).join(' '));
  if (words.length >= 2) add(words[0]);

  return variants;
}

export async function fetchMercadoLibreSignals(
  query: string,
  countryCode: string,
): Promise<MLResult> {
  const site = SITE_BY_COUNTRY[countryCode];

  const empty = (source: SourceState, tried: string[] = []): MLResult => ({
    competitors: null,
    priceRange: null,
    currency: null,
    source,
    queriesTried: tried,
  });

  if (!site) {
    return empty({ status: 'not_configured', reason: `País ${countryCode} no tiene cobertura en ML` });
  }
  if (site === 'MES') {
    return empty({ status: 'not_configured', reason: 'Mercado Libre no opera en España (ES)' });
  }

  // Token is optional: public ML search works without auth (lower rate limit, same data)
  const mlToken = await getMLToken();
  if (!mlToken) {
    console.log('[ml] Sin token ML — usando acceso público (sin OAuth). Visitá /api/mercadolibre/authorize para conectar.');
  }

  const variants = buildQueryVariants(query);
  const tried: string[] = [];

  for (const q of variants) {
    tried.push(q);
    const url = `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(q)}&limit=50`;

    const reqHeaders: Record<string, string> = { Accept: 'application/json' };
    if (mlToken) reqHeaders['Authorization'] = `Bearer ${mlToken}`;

    let res: Response;
    let bodyText: string;

    try {
      res = await fetch(url, {
        headers: reqHeaders,
        signal: AbortSignal.timeout(8000),
      });
      bodyText = await res.text();
    } catch (err) {
      const msg = String(err).slice(0, 120);
      console.error(`[ml] Network error — site=${site} q="${q}" err=${msg}`);
      return empty({ status: 'error', reason: `Error de red al conectar con ML: ${msg}` }, tried);
    }

    console.log(`[ml] site=${site} q="${q}" status=${res.status} preview=${bodyText.slice(0, 300)}`);

    if (res.status === 401) {
      // Token expirado o inválido → limpiar y reintentar sin auth en la misma query
      if (mlToken) {
        console.log(`[ml] 401 con token — reintentando sin auth`);
        try {
          const retryRes = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
          if (retryRes.ok) {
            res = retryRes;
            bodyText = await retryRes.text();
            // continue parsing below
          } else {
            return empty({ status: 'unauthorized', reason: `ML devolvió 401 — token inválido. Visitá /api/mercadolibre/authorize` }, tried);
          }
        } catch {
          return empty({ status: 'unauthorized', reason: `ML devolvió 401 — token inválido. Visitá /api/mercadolibre/authorize` }, tried);
        }
      } else {
        return empty({ status: 'unauthorized', reason: `ML devolvió 401 — acceso denegado` }, tried);
      }
    }
    if (res.status === 403) {
      console.log(`[ml] 403 PolicyAgent — activando fallback por scraping para "${q}"`);
      return await scrapeFallback(q, site, tried);
    }
    if (res.status === 429) {
      return empty({ status: 'rate_limited', reason: 'ML devolvió 429 — límite de peticiones alcanzado' }, tried);
    }
    if (res.status === 400) {
      console.log(`[ml] 400 Bad Request para "${q}" — query inválida o demasiado específica, probando más genérica`);
      continue;
    }
    if (!res.ok) {
      console.error(`[ml] HTTP ${res.status} para "${q}" — body: ${bodyText.slice(0, 400)}`);
      continue;
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      console.error(`[ml] JSON parse error para "${q}": ${bodyText.slice(0, 200)}`);
      continue;
    }

    const total: number | null =
      typeof data?.paging?.total === 'number' ? data.paging.total : null;

    if (total !== null && total < 5) {
      console.log(`[ml] "${q}" → ${total} resultados (query demasiado específica) — probando más genérica`);
      continue;
    }

    const prices: number[] = Array.isArray(data?.results)
      ? data.results
          .map((r: any) => Number(r?.price))
          .filter((p: number) => Number.isFinite(p) && p > 0)
      : [];

    const priceRange: [number, number] | null =
      prices.length > 0 ? [Math.min(...prices), Math.max(...prices)] : null;

    const currency: string | null =
      data?.results?.[0]?.currency_id ?? getCountry(countryCode).currency ?? null;

    console.log(`[ml] ok — site=${site} q="${q}" total=${total} prices=${prices.length} range=[${priceRange}] currency=${currency}`);

    return {
      competitors: total,
      priceRange,
      currency,
      source: {
        status: 'ok',
        reason: `${fmtNum(total ?? 0)} publicaciones en ML ${site} (query: "${q}")`,
      },
      queriesTried: tried,
    };
  }

  console.log(`[ml] Sin resultados tras ${tried.length} queries en ${site}: ${tried.join(' | ')}`);
  return empty({
    status: 'no_results',
    reason: `No se encontraron competidores directos en ML ${site} — producto muy específico o sin categoría establecida`,
  }, tried);
}

async function scrapeFallback(
  query: string,
  site: string,
  tried: string[],
): Promise<ReturnType<typeof fetchMercadoLibreSignals>> {
  // Build query variants: specific → generic (mirrors API variant logic)
  const words = query.trim().split(/\s+/);
  const variants = [query];
  if (words.length >= 3) variants.push(words.slice(0, 2).join(' '));
  if (words.length >= 2) variants.push(words[0]);

  for (const q of variants) {
    const scraped = await scrapeMercadoLibre(q, site);
    if (!scraped) continue;
    if (scraped.topResults.length === 0 && scraped.competitors === 0) {
      continue; // zero results — try more generic
    }
    if (scraped.topResults.length === 0) continue;

    return {
      competitors: scraped.competitors,
      priceRange: scraped.priceRange,
      currency: scraped.currency,
      source: {
        status: 'ok',
        reason: `${fmtNum(scraped.competitors ?? scraped.topResults.length)} publicaciones en ML ${site} vía scraping (query: "${q}") — precio promedio: ${scraped.currency} ${fmtNum(scraped.avgPrice ?? 0)}`,
      },
      queriesTried: [...tried, `[scrape] ${q}`],
    };
  }

  return {
    competitors: null,
    priceRange: null,
    currency: null,
    source: {
      status: 'blocked',
      reason: 'ML API (PolicyAgent 403) y scraping bloqueados — app no certificada o bot protection activa',
    },
    queriesTried: tried,
  };
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat('es').format(Math.round(n));
}
