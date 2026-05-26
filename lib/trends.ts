import type { SourceState } from './source-status';

export interface TrendsResult {
  interest: number | null;
  direction: 'rising' | 'stable' | 'declining' | 'unknown';
  source: SourceState;
  keywordsTried: string[];
}

function buildVariants(searchTerm: string, category: string): string[] {
  const words = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (v: string) => {
    const t = v.trim();
    if (t.length >= 2 && !seen.has(t)) { seen.add(t); variants.push(t); }
  };

  add(searchTerm);
  if (words.length >= 3) add(words.slice(0, 2).join(' '));
  if (words.length >= 2) add(words[0]);
  if (category && category !== 'general') {
    add(category);
    add(`${words[0]} ${category}`.trim());
  }
  // Broader single-word fallbacks
  words.slice(1).forEach((w) => add(w));

  return variants.slice(0, 12);
}

export async function fetchTrends(
  searchTerm: string,
  geo: string,
  category = 'general',
): Promise<TrendsResult> {
  const base =
    process.env.PYTHON_FUNCTION_BASE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000';

  const variants = buildVariants(searchTerm, category);
  const tried: string[] = [];

  for (const kw of variants) {
    tried.push(kw);
    const url = `${base}/api/py-trends?q=${encodeURIComponent(kw)}&geo=${encodeURIComponent(geo)}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch (err) {
      console.error(`[trends] Network error for "${kw}": ${err}`);
      // If first keyword errors out, assume endpoint unavailable
      if (tried.length === 1) {
        return {
          interest: null,
          direction: 'unknown',
          source: { status: 'not_configured', reason: 'Endpoint py-trends no disponible (error de red)' },
          keywordsTried: tried,
        };
      }
      continue;
    }

    if (res.status === 404) {
      console.log('[trends] py-trends 404 — función Python no desplegada');
      return {
        interest: null,
        direction: 'unknown',
        source: { status: 'not_configured', reason: 'Función Python no desplegada (/api/py-trends no existe)' },
        keywordsTried: tried,
      };
    }

    if (res.status === 429) {
      console.log('[trends] Rate limited (429)');
      return {
        interest: null,
        direction: 'unknown',
        source: { status: 'rate_limited', reason: 'Demasiadas peticiones a Google Trends — esperá unos minutos' },
        keywordsTried: tried,
      };
    }

    if (res.status === 403) {
      console.log('[trends] Bloqueado (403)');
      return {
        interest: null,
        direction: 'unknown',
        source: { status: 'blocked', reason: 'Google Trends bloqueó la petición (403)' },
        keywordsTried: tried,
      };
    }

    if (!res.ok) {
      console.log(`[trends] HTTP ${res.status} for "${kw}" — probando siguiente variante`);
      continue;
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      console.log(`[trends] JSON parse error for "${kw}"`);
      continue;
    }

    const interest = typeof data?.interest === 'number' ? data.interest : null;

    if (interest === null || interest === 0) {
      console.log(`[trends] Sin datos para "${kw}" (interest=${interest}) — probando siguiente`);
      continue;
    }

    const direction: TrendsResult['direction'] = ['rising', 'stable', 'declining'].includes(data?.direction)
      ? data.direction
      : 'unknown';

    const isLowVolume = interest < 20;
    console.log(`[trends] ok — kw="${kw}" interest=${interest} direction=${direction} geo=${geo}`);

    return {
      interest,
      direction,
      source: {
        status: isLowVolume ? 'low_volume' : 'ok',
        reason: isLowVolume
          ? `Volumen bajo (${interest}/100) — tendencia detectada pero dato insuficiente para señal confiable`
          : `Interés ${interest}/100, tendencia ${direction} (keyword: "${kw}")`,
      },
      keywordsTried: tried,
    };
  }

  console.log(`[trends] Sin datos tras ${tried.length} keywords: ${tried.join(', ')}`);
  return {
    interest: null,
    direction: 'unknown',
    source: {
      status: 'no_results',
      reason: `Sin volumen de búsqueda para las ${tried.length} keywords probadas — producto muy específico o dato insuficiente`,
    },
    keywordsTried: tried,
  };
}
