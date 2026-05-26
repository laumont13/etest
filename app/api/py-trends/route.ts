/**
 * Google Trends proxy — TypeScript replacement for api/py-trends.py
 * Works in local dev (next dev) and on Vercel Edge/Node.
 * Same response contract as the Python serverless function.
 *
 * Strategy: pre-flight to Trends homepage to seed real session cookies,
 * then two-step API call (explore → multiline) like pytrends does.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TRENDS_HOME = 'https://trends.google.com/trends/explore';
const EXPLORE_URL = 'https://trends.google.com/trends/api/explore';
const MULTILINE_URL = 'https://trends.google.com/trends/api/widgetdata/multiline';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function strip(text: string): string {
  return text.replace(/^\)\]\}',?\n?/, '');
}

function parseCookies(res: Response): string {
  const cookies: string[] = [];
  try {
    const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
    if (sc?.length) cookies.push(...sc.map((c: string) => c.split(';')[0]));
  } catch {
    const sc = res.headers.get('set-cookie');
    if (sc) cookies.push(sc.split(';')[0]);
  }
  return cookies.join('; ');
}

/** Seed a real browser session cookie from the Trends homepage first. */
async function getSessionCookies(geo: string): Promise<string> {
  try {
    const url = `${TRENDS_HOME}?q=test&geo=${geo || 'AR'}&hl=es`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      signal: AbortSignal.timeout(8_000),
    });
    return parseCookies(res);
  } catch {
    return '';
  }
}

async function fetchTrendData(
  keyword: string,
  geo: string,
): Promise<{ interest: number | null; direction: string }> {
  const hl = 'es';
  const tz = '180'; // UTC-3

  // Pre-flight: get real session cookies from trends homepage
  const sessionCookies = await getSessionCookies(geo);

  // ── Step 1: explore (get widget tokens) ────────────────────────────────────
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
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    Referer: 'https://trends.google.com/trends/explore',
  };
  if (sessionCookies) baseHeaders['Cookie'] = sessionCookies;

  const exploreRes = await fetch(exploreUrl.toString(), {
    headers: baseHeaders,
    signal: AbortSignal.timeout(10_000),
  });

  if (exploreRes.status === 429) throw Object.assign(new Error('rate_limited'), { status: 429 });
  if (exploreRes.status === 403) throw Object.assign(new Error('blocked'), { status: 403 });
  if (!exploreRes.ok) throw new Error(`explore HTTP ${exploreRes.status}`);

  const exploreText = await exploreRes.text();

  // Merge new cookies from explore response
  const exploreCookies = parseCookies(exploreRes);
  const cookieHeader = [sessionCookies, exploreCookies].filter(Boolean).join('; ');

  let exploreData: any;
  try {
    exploreData = JSON.parse(strip(exploreText));
  } catch {
    throw new Error(`explore parse error: ${exploreText.slice(0, 120)}`);
  }

  const widgets: any[] = exploreData.widgets ?? [];
  const tsWidget = widgets.find((w: any) => w.id === 'TIMESERIES');
  if (!tsWidget) return { interest: null, direction: 'unknown' };

  // ── Step 2: multiline (actual values) ──────────────────────────────────────
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

  if (!mlRes.ok) throw new Error(`multiline HTTP ${mlRes.status}`);

  const mlText = await mlRes.text();
  let mlData: any;
  try {
    mlData = JSON.parse(strip(mlText));
  } catch {
    throw new Error(`multiline parse error: ${mlText.slice(0, 120)}`);
  }

  const timelineData: any[] = mlData.default?.timelineData ?? [];
  const values = timelineData
    .map((d: any) => d.value?.[0])
    .filter((v: any): v is number => typeof v === 'number' && v >= 0);

  if (values.length === 0) return { interest: null, direction: 'unknown' };

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  const third = Math.max(1, Math.floor(values.length / 3));
  const firstAvg = values.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const lastAvg = values.slice(-third).reduce((a, b) => a + b, 0) / third;

  let direction: string;
  if (lastAvg > firstAvg * 1.15) direction = 'rising';
  else if (lastAvg < firstAvg * 0.85) direction = 'declining';
  else direction = 'stable';

  return { interest: avg, direction };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') ?? '').trim();
  const geo = (searchParams.get('geo') ?? '').trim();

  if (!query) {
    return NextResponse.json({ error: 'missing query param q' }, { status: 400 });
  }

  try {
    const { interest, direction } = await fetchTrendData(query, geo);
    return NextResponse.json(
      { query, geo, interest, direction, available: interest !== null && interest > 0 },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=1800' } },
    );
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.error(`[py-trends] ${msg}`);

    if (err?.status === 429 || msg.includes('rate_limited')) {
      return NextResponse.json(
        { query, geo, interest: null, direction: 'unknown', available: false, error: 'rate_limited' },
        { status: 429 },
      );
    }
    if (err?.status === 403 || msg.includes('blocked')) {
      return NextResponse.json(
        { query, geo, interest: null, direction: 'unknown', available: false, error: 'blocked' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { query, geo, interest: null, direction: 'unknown', available: false },
      { headers: { 'Cache-Control': 's-maxage=60' } },
    );
  }
}
