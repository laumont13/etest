/**
 * /api/py-trends — standalone Google Trends debug/cache endpoint.
 * NOT called internally by the analyze flow (that uses lib/trends.ts directly).
 * Useful for: external debugging, browser testing, CDN-cached responses.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
    if (sc?.length) cookies.push(...sc.map((c: string) => c.split(';')[0]));
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
    console.log(`[py-trends] seedCookies status=${res.status} cookies="${cookies.slice(0, 80)}"`);
    return cookies;
  } catch (e) {
    console.log(`[py-trends] seedCookies failed: ${e}`);
    return '';
  }
}

async function fetchTrendData(
  keyword: string,
  geo: string,
): Promise<{ interest: number | null; direction: string }> {
  const hl = 'es';
  const tz = '180';
  const cookie = await seedCookies(geo);

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

  console.log(`[py-trends] explore kw="${keyword}" geo="${geo}" status=${exploreRes.status}`);
  if (exploreRes.status === 429) throw Object.assign(new Error('rate_limited'), { status: 429 });
  if (exploreRes.status === 403) throw Object.assign(new Error('blocked'), { status: 403 });
  if (!exploreRes.ok) throw new Error(`explore HTTP ${exploreRes.status}`);

  const exploreText = await exploreRes.text();
  const exploreCookies = parseCookieHeader(exploreRes);
  const cookieHeader = [cookie, exploreCookies].filter(Boolean).join('; ');

  console.log(`[py-trends] explore raw len=${exploreText.length} snippet="${exploreText.slice(0, 150).replace(/\n/g, '\\n')}"`);

  let exploreData: any;
  try {
    exploreData = JSON.parse(stripXSSI(exploreText));
  } catch (e) {
    console.log(`[py-trends] explore JSON parse failed: ${e}`);
    throw new Error(`explore parse error: ${exploreText.slice(0, 120)}`);
  }

  const widgets: any[] = exploreData.widgets ?? [];
  console.log(`[py-trends] widgets count=${widgets.length} ids=${widgets.map((w: any) => w.id).join(',')}`);

  const tsWidget = widgets.find((w: any) => w.id === 'TIMESERIES');
  if (!tsWidget) {
    console.log(`[py-trends] no TIMESERIES widget`);
    return { interest: null, direction: 'unknown' };
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

  console.log(`[py-trends] multiline status=${mlRes.status}`);
  if (!mlRes.ok) throw new Error(`multiline HTTP ${mlRes.status}`);

  const mlText = await mlRes.text();
  console.log(`[py-trends] multiline raw len=${mlText.length} snippet="${mlText.slice(0, 150).replace(/\n/g, '\\n')}"`);

  let mlData: any;
  try {
    mlData = JSON.parse(stripXSSI(mlText));
  } catch (e) {
    console.log(`[py-trends] multiline JSON parse failed: ${e}`);
    throw new Error(`multiline parse error: ${mlText.slice(0, 120)}`);
  }

  const timelineData: any[] = mlData.default?.timelineData ?? [];
  console.log(`[py-trends] timelineData length=${timelineData.length}`);

  const values = timelineData
    .map((d: any) => d.value?.[0])
    .filter((v: any): v is number => typeof v === 'number' && v >= 0);

  if (values.length === 0) return { interest: null, direction: 'unknown' };

  const avg = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
  const third = Math.max(1, Math.floor(values.length / 3));
  const firstAvg = values.slice(0, third).reduce((a: number, b: number) => a + b, 0) / third;
  const lastAvg = values.slice(-third).reduce((a: number, b: number) => a + b, 0) / third;

  const direction =
    lastAvg > firstAvg * 1.15 ? 'rising' : lastAvg < firstAvg * 0.85 ? 'declining' : 'stable';

  console.log(`[py-trends] result kw="${keyword}" interest=${avg} direction=${direction}`);
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
      { query, geo, interest: null, direction: 'unknown', available: false, error: msg.slice(0, 200) },
      { headers: { 'Cache-Control': 's-maxage=60' } },
    );
  }
}
