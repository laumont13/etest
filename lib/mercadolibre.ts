import type { SourceState } from './source-status';
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

function empty(source: SourceState, tried: string[] = []): MLResult {
  return { competitors: null, priceRange: null, currency: null, source, queriesTried: tried };
}

function buildVariants(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string) => {
    const t = v.trim();
    if (t.length >= 2 && !seen.has(t)) { seen.add(t); out.push(t); }
  };
  add(query);
  if (words.length >= 3) add(words.slice(0, 2).join(' '));
  if (words.length >= 2) add(words[0]);
  return out.slice(0, 2); // max 2 — avoid cumulative timeout
}

/**
 * Market-check via public ML scraping only.
 * No OAuth, no API tokens. Best-effort signal: ok → no_results → blocked → not_configured.
 */
export async function fetchMercadoLibreSignals(
  query: string,
  countryCode: string,
): Promise<MLResult> {
  const site = SITE_BY_COUNTRY[countryCode];

  if (!site) {
    return empty({ status: 'not_configured', reason: `País ${countryCode} sin cobertura ML` });
  }
  if (site === 'MES') {
    return empty({ status: 'not_configured', reason: 'ML no opera en España' });
  }

  const variants = buildVariants(query);
  const tried: string[] = [];

  for (const q of variants) {
    tried.push(q);
    console.log(`[ml] scraping site=${site} q="${q}"`);

    let scraped: Awaited<ReturnType<typeof scrapeMercadoLibre>>;
    try {
      scraped = await scrapeMercadoLibre(q, site);
    } catch (err) {
      console.error(`[ml] scrape error for "${q}": ${err}`);
      continue;
    }

    if (!scraped) {
      console.log(`[ml] null result for "${q}" — trying next variant`);
      continue;
    }

    if (scraped.topResults.length === 0) {
      // Explicit "no results" page — try broader query
      if (scraped.competitors === 0) {
        console.log(`[ml] 0 resultados para "${q}" — trying next`);
        continue;
      }
      // scrape returned empty results but not 0-page — treat as blocked
      console.log(`[ml] empty results (not 0-page) for "${q}" — treating as blocked`);
      break;
    }

    const fmtN = (n: number) => new Intl.NumberFormat('es').format(Math.round(n));

    console.log(
      `[ml] ok site=${site} q="${q}" competitors=${scraped.competitors} ` +
      `items=${scraped.topResults.length} avg=${scraped.avgPrice} currency=${scraped.currency}`,
    );

    return {
      competitors: scraped.competitors,
      priceRange: scraped.priceRange,
      currency: scraped.currency,
      source: {
        status: 'ok',
        reason: scraped.competitors
          ? `${fmtN(scraped.competitors)} publicaciones en ML ${site} — precio promedio ${scraped.currency} ${fmtN(scraped.avgPrice ?? 0)}`
          : `${scraped.topResults.length} publicaciones encontradas en ML ${site}`,
      },
      queriesTried: tried,
    };
  }

  // All variants tried — nothing found or blocked
  const lastWasEmpty = tried.length > 0;
  console.log(`[ml] sin datos tras ${tried.length} queries: ${tried.join(' | ')}`);

  return empty({
    status: lastWasEmpty ? 'blocked' : 'not_configured',
    reason: lastWasEmpty
      ? `ML sin respuesta para ${tried.length} búsqueda(s) — bot protection activa en IPs de datacenter`
      : 'ML no disponible',
  }, tried);
}
