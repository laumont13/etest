import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const preferredRegion = ['gru1', 'iad1'];

const UAs = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  curl: 'curl/8.4.0',
};

async function probe(url: string, ua: string, extra?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, Accept: 'text/html', 'Accept-Language': 'es-AR,es;q=0.9', ...extra },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    return {
      status: res.status,
      size: html.length,
      hasProducts: html.includes('ui-search-layout__item'),
      hasJsonLd: html.includes('application/ld+json'),
      hasSuspicious: html.includes('suspicious-traffic'),
      hasChallenge: html.includes('verifyChallenge'),
      title: html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim().slice(0, 80) ?? null,
      priceCount: (html.match(/"price":\d+/g) ?? []).length,
      bodyPreview: html.slice(0, 120),
    };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET(_req: NextRequest) {
  const scrapeUrl = 'https://listado.mercadolibre.com.ar/masajeador-cervical';
  const token = process.env.ML_ACCESS_TOKEN ?? '';

  const [googlebot, chrome, apiNoAuth, apiWithToken] = await Promise.all([
    probe(scrapeUrl, UAs.googlebot),
    probe(scrapeUrl, UAs.chrome),
    // API public (no token) — is it IP-block or open?
    fetch('https://api.mercadolibre.com/sites/MLA/search?q=masajeador&limit=3', {
      headers: { Accept: 'application/json', 'User-Agent': UAs.chrome },
      signal: AbortSignal.timeout(8_000),
    }).then(async r => ({ status: r.status, policyAgent: r.headers.get('x-policy-agent-block-code'), body: (await r.text()).slice(0, 200) })).catch(e => ({ error: String(e) })),
    // API with token
    token ? fetch('https://api.mercadolibre.com/sites/MLA/search?q=masajeador&limit=3', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    }).then(async r => ({ status: r.status, policyAgent: r.headers.get('x-policy-agent-block-code'), body: (await r.text()).slice(0, 200) })).catch(e => ({ error: String(e) })) : { skipped: 'no token' },
  ]);

  return NextResponse.json({ scrapeUrl, googlebot, chrome, apiNoAuth, apiWithToken });
}
