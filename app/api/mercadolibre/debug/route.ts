import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const UAs = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  curl: 'curl/8.4.0',
};

async function probe(url: string, ua: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, Accept: 'text/html', 'Accept-Language': 'es-AR,es;q=0.9' },
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
    };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET(_req: NextRequest) {
  const url = 'https://listado.mercadolibre.com.ar/masajeador-cervical';

  const [googlebot, chrome, curlUA] = await Promise.all([
    probe(url, UAs.googlebot),
    probe(url, UAs.chrome),
    probe(url, UAs.curl),
  ]);

  return NextResponse.json({ url, googlebot, chrome, curl: curlUA });
}
