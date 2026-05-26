/**
 * E-Test · /api/extract
 * ----------------------------------------------------------------------------
 * Extrae metadatos BÁSICOS de una URL (título, imagen, descripción) vía Open
 * Graph / meta tags. Deliberadamente liviano: no hace scraping agresivo de
 * Alibaba (frágil y contra ToS, como dice el README). Si no puede leer, el
 * usuario completa el título a mano.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';

export const runtime = 'nodejs';

const Body = z.object({
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  // Validamos que sea un dominio esperado para evitar SSRF a hosts arbitrarios.
  const host = safeHost(parsed.url);
  const allowed = ['alibaba.com', 'aliexpress.com', 'alicdn.com'];
  if (!host || !allowed.some((d) => host.endsWith(d))) {
    return NextResponse.json(
      { error: 'Solo se aceptan URLs de Alibaba / AliExpress.' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(parsed.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; E-Test/1.0; +https://e-test.app) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { title: null, image: null, description: null, note: 'No se pudo leer la página.' },
        { status: 200 },
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      null;
    const image = $('meta[property="og:image"]').attr('content') || null;
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    return NextResponse.json({
      title: title?.trim().slice(0, 200) ?? null,
      image: image ?? null,
      description: description?.trim().slice(0, 600) ?? null,
    });
  } catch {
    return NextResponse.json(
      { title: null, image: null, description: null, note: 'Lectura no disponible; completá a mano.' },
      { status: 200 },
    );
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
