/**
 * E-Test · Tipo de cambio
 * ----------------------------------------------------------------------------
 * Convierte USD (costo típico de Alibaba) a la moneda local para el cálculo de
 * margen. Si hay FX_API_KEY usa una API en vivo; si no, usa tasas de fallback
 * razonables. Las tasas de fallback se actualizan a mano y son aproximadas.
 */

// Tasas de fallback aproximadas USD -> moneda local. Actualizar periódicamente.
const FALLBACK_RATES: Record<string, number> = {
  ARS: 1100,
  MXN: 18.5,
  COP: 4000,
  CLP: 950,
  PEN: 3.75,
  EUR: 0.92,
  USD: 1,
};

export interface FxResult {
  rate: number;
  source: 'live' | 'fallback';
  currency: string;
}

export async function getUsdRate(currency: string): Promise<FxResult> {
  const cur = currency.toUpperCase();
  const apiKey = process.env.FX_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/${cur}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const data: any = await res.json();
        const rate = Number(data?.conversion_rate);
        if (Number.isFinite(rate) && rate > 0) {
          return { rate, source: 'live', currency: cur };
        }
      }
    } catch {
      // cae al fallback
    }
  }

  return {
    rate: FALLBACK_RATES[cur] ?? 1,
    source: 'fallback',
    currency: cur,
  };
}
