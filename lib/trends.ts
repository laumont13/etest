import type { SourceState } from './source-status';

export interface TrendsResult {
  interest: number | null;
  direction: 'rising' | 'stable' | 'declining' | 'unknown';
  source: SourceState;
  keywordsTried: string[];
}

// ─── Google Trends inline client ──────────────────────────────────────────────
// Calls Google Trends APIs directly (no self-referential HTTP to /api/py-trends).
// This runs in the same serverless function as the analyze route (GRU1/IAD1).

const TRENDS_HOME = 'https://trends.google.com/trends/explore';
const EXPLORE_URL = 'https://trends.google.com/trends/api/explore';
const MULTILINE_URL = 'https://trends.google.com/trends/api/widgetdata/multiline';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function stripXSSI(text: string): string {
  return text.replace(/^\)\]\}',?\n?/, '').trimStart();
}

function parseCookieHeader(res: Response): string {
  const cookies: string[] = [];
  try {
    const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
    if (sc?.length) {
      cookies.push(...sc.map((c: string) => c.split(';')[0]));
    }
  } catch {
    const sc = res.headers.get('set-cookie');
    if (sc) cookies.push(sc.split(';')[0]);
  }
  return cookies.filter(Boolean).join('; ');
}

async function seedCookies(geo: string): Promise<string> {
  try {
    const res = await fetch(`${TRENDS_HOME}?q=a&geo=${geo}&hl=es`, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9',
      },
      signal: AbortSignal.timeout(6_000),
    });
    const cookies = parseCookieHeader(res);
    console.log(`[trends] seedCookies status=${res.status} cookies="${cookies.slice(0, 80)}"`);
    return cookies;
  } catch (e) {
    console.log(`[trends] seedCookies failed: ${e}`);
    return '';
  }
}

async function fetchTrendData(
  keyword: string,
  geo: string,
  cookie: string,
): Promise<{ interest: number | null; direction: string; softBlocked: boolean }> {
  const hl = 'es';
  const tz = '180';

  const exploreReq = JSON.stringify({
    comparisonItem: [{ keyword, geo: geo || '', time: 'today 12-m' }],
    category: 0,
    property: '',
  });

  const exploreUrl = new URL(EXPLORE_URL);
  exploreUrl.searchParams.set('hl', hl);
  exploreUrl.searchParams.set('tz', tz);
  exploreUrl.searchParams.set('req', exploreReq);
  exploreUrl.searchParams.set('cts', Date.now().toString());

  const baseHeaders: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
    Referer: 'https://trends.google.com/trends/explore',
  };
  if (cookie) baseHeaders['Cookie'] = cookie;

  const exploreRes = await fetch(exploreUrl.toString(), {
    headers: baseHeaders,
    signal: AbortSignal.timeout(10_000),
  });

  console.log(`[trends] explore kw="${keyword}" geo="${geo}" status=${exploreRes.status}`);

  if (exploreRes.status === 429) throw Object.assign(new Error('rate_limited'), { status: 429 });
  if (exploreRes.status === 403) throw Object.assign(new Error('blocked'), { status: 403 });
  if (!exploreRes.ok) throw new Error(`explore HTTP ${exploreRes.status}`);

  const exploreText = await exploreRes.text();
  const exploreCookies = parseCookieHeader(exploreRes);
  const cookieHeader = [cookie, exploreCookies].filter(Boolean).join('; ');

  console.log(`[trends] explore raw length=${exploreText.length} snippet="${exploreText.slice(0, 120).replace(/\n/g, '\\n')}"`);

  let exploreData: any;
  try {
    exploreData = JSON.parse(stripXSSI(exploreText));
  } catch (e) {
    console.log(`[trends] explore JSON parse failed: ${e} — snippet: ${exploreText.slice(0, 200)}`);
    // Could be a consent/block HTML page
    return { interest: null, direction: 'unknown', softBlocked: true };
  }

  const widgets: any[] = exploreData.widgets ?? [];
  console.log(`[trends] widgets count=${widgets.length} ids=${widgets.map((w: any) => w.id).join(',')}`);

  const tsWidget = widgets.find((w: any) => w.id === 'TIMESERIES');
  if (!tsWidget) {
    console.log(`[trends] no TIMESERIES widget — soft-blocked or empty keyword`);
    // If there are NO widgets at all, it's a soft-block. If there are some but no TIMESERIES,
    // it might be a valid "no data" response.
    return { interest: null, direction: 'unknown', softBlocked: widgets.length === 0 };
  }

  const multilineUrl = new URL(MULTILINE_URL);
  multilineUrl.searchParams.set('hl', hl);
  multilineUrl.searchParams.set('tz', tz);
  multilineUrl.searchParams.set('req', JSON.stringify(tsWidget.request));
  multilineUrl.searchParams.set('token', tsWidget.token);
  multilineUrl.searchParams.set('cts', Date.now().toString());

  const mlHeaders: Record<string, string> = { ...baseHeaders };
  if (cookieHeader) mlHeaders['Cookie'] = cookieHeader;

  const mlRes = await fetch(multilineUrl.toString(), {
    headers: mlHeaders,
    signal: AbortSignal.timeout(10_000),
  });

  console.log(`[trends] multiline status=${mlRes.status}`);

  if (!mlRes.ok) throw new Error(`multiline HTTP ${mlRes.status}`);

  const mlText = await mlRes.text();
  console.log(`[trends] multiline raw length=${mlText.length} snippet="${mlText.slice(0, 120).replace(/\n/g, '\\n')}"`);

  let mlData: any;
  try {
    mlData = JSON.parse(stripXSSI(mlText));
  } catch (e) {
    console.log(`[trends] multiline JSON parse failed: ${e}`);
    return { interest: null, direction: 'unknown', softBlocked: false };
  }

  const timelineData: any[] = mlData.default?.timelineData ?? [];
  console.log(`[trends] timelineData length=${timelineData.length}`);

  const values = timelineData
    .map((d: any) => d.value?.[0])
    .filter((v: any): v is number => typeof v === 'number' && v >= 0);

  if (values.length === 0) {
    console.log(`[trends] no values in timeline`);
    return { interest: null, direction: 'unknown', softBlocked: false };
  }

  const avg = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);

  const third = Math.max(1, Math.floor(values.length / 3));
  const firstAvg = values.slice(0, third).reduce((a: number, b: number) => a + b, 0) / third;
  const lastAvg = values.slice(-third).reduce((a: number, b: number) => a + b, 0) / third;

  const direction =
    lastAvg > firstAvg * 1.15 ? 'rising' : lastAvg < firstAvg * 0.85 ? 'declining' : 'stable';

  console.log(`[trends] result kw="${keyword}" interest=${avg} direction=${direction}`);
  return { interest: avg, direction, softBlocked: false };
}

// ─── Keyword variants ─────────────────────────────────────────────────────────
// Keep it to 3 max: rapid sequential calls trigger Google soft-blocks.

function buildVariants(searchTerm: string, category: string): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (v: string) => {
    const t = v.trim().toLowerCase();
    if (t.length >= 2 && !seen.has(t)) {
      seen.add(t);
      variants.push(v.trim());
    }
  };

  const words = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);

  add(searchTerm);
  if (words.length >= 2) add(words[0]);
  if (category && category !== 'general') add(category);

  return variants.slice(0, 3);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchTrends(
  searchTerm: string,
  geo: string,
  category = 'general',
): Promise<TrendsResult> {
  const variants = buildVariants(searchTerm, category);
  const tried: string[] = [];

  console.log(`[trends] starting — term="${searchTerm}" geo="${geo}" variants=[${variants.join(', ')}]`);

  // Seed cookies once; reuse across all keyword attempts.
  const cookie = await seedCookies(geo);

  // Keep the best result found so far (prefer higher interest / ok over low_volume).
  let best: { interest: number; direction: string; kw: string } | null = null;

  for (const kw of variants) {
    tried.push(kw);

    try {
      const { interest, direction, softBlocked } = await fetchTrendData(kw, geo, cookie);

      if (softBlocked) {
        console.log(`[trends] soft-blocked on kw="${kw}" — stopping variant loop`);
        // If we already have a best, use it; otherwise report block.
        if (best) break;
        return {
          interest: null,
          direction: 'unknown',
          source: { status: 'blocked', reason: 'Google Trends bloqueó la petición desde el servidor (soft-block)' },
          keywordsTried: tried,
        };
      }

      if (interest === null || interest === 0) {
        console.log(`[trends] no data for kw="${kw}" (interest=${interest}) — trying next`);
        continue;
      }

      // Update best if this result is higher.
      if (!best || interest > best.interest) {
        best = { interest, direction, kw };
      }

      // Stop immediately on a strong signal (≥20); otherwise keep trying for better.
      if (interest >= 20) {
        console.log(`[trends] strong signal found — stopping`);
        break;
      }

      console.log(`[trends] low volume (${interest}) — continuing to next variant`);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      console.log(`[trends] error on kw="${kw}": ${msg}`);

      if (err?.status === 429 || msg.includes('rate_limited')) {
        return {
          interest: null,
          direction: 'unknown',
          source: { status: 'rate_limited', reason: 'Google Trends rate-limitó la petición (429)' },
          keywordsTried: tried,
        };
      }
      if (err?.status === 403 || msg.includes('blocked')) {
        return {
          interest: null,
          direction: 'unknown',
          source: { status: 'blocked', reason: 'Google Trends bloqueó la petición (403)' },
          keywordsTried: tried,
        };
      }
      // Network/timeout — continue to next variant
    }
  }

  if (best) {
    const isLowVolume = best.interest < 20;
    const dir = (['rising', 'stable', 'declining'] as const).includes(best.direction as any)
      ? (best.direction as 'rising' | 'stable' | 'declining')
      : 'stable';
    return {
      interest: best.interest,
      direction: dir,
      source: {
        status: isLowVolume ? 'low_volume' : 'ok',
        reason: isLowVolume
          ? `Volumen bajo (${best.interest}/100) — tendencia detectada pero dato insuficiente`
          : `Interés ${best.interest}/100, tendencia ${best.direction} (kw: "${best.kw}")`,
      },
      keywordsTried: tried,
    };
  }

  console.log(`[trends] exhausted all ${tried.length} variants: ${tried.join(', ')}`);
  return {
    interest: null,
    direction: 'unknown',
    source: {
      status: 'no_results',
      reason: `Sin datos de Trends tras ${tried.length} keywords: ${tried.join(', ')}`,
    },
    keywordsTried: tried,
  };
}
