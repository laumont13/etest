/**
 * E-Test · Países soportados (MVP)
 * Datos macro estáticos usados como contexto para el análisis.
 * Las cifras son aproximaciones de referencia, no datos en vivo.
 */

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  /** Sitio de Mercado Libre o equivalente */
  marketplace: string;
  /** Código de región para Google Trends (geo) */
  trendsGeo: string;
  /** Nota de contexto logístico/importación */
  importNote: string;
}

export const COUNTRIES: Record<string, Country> = {
  AR: {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    currency: 'ARS',
    marketplace: 'mercadolibre.com.ar',
    trendsGeo: 'AR',
    importNote: 'Importación restringida y cambiaria; verificar régimen vigente y AFIP.',
  },
  MX: {
    code: 'MX',
    name: 'México',
    flag: '🇲🇽',
    currency: 'MXN',
    marketplace: 'mercadolibre.com.mx',
    trendsGeo: 'MX',
    importNote: 'Mercado grande; logística desde China consolidada.',
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    currency: 'COP',
    marketplace: 'mercadolibre.com.co',
    trendsGeo: 'CO',
    importNote: 'Aranceles e IVA relevantes en la importación.',
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    currency: 'CLP',
    marketplace: 'mercadolibre.cl',
    trendsGeo: 'CL',
    importNote: 'Importación ágil; mercado chico pero de buen poder adquisitivo.',
  },
  PE: {
    code: 'PE',
    name: 'Perú',
    flag: '🇵🇪',
    currency: 'PEN',
    marketplace: 'mercadolibre.com.pe',
    trendsGeo: 'PE',
    importNote: 'Mercado en crecimiento; logística variable.',
  },
  ES: {
    code: 'ES',
    name: 'España',
    flag: '🇪🇸',
    currency: 'EUR',
    marketplace: 'es.wallapop.com / Amazon.es',
    trendsGeo: 'ES',
    importNote: 'UE: IVA y aranceles; competencia con Amazon fuerte.',
  },
};

export const COUNTRY_LIST = Object.values(COUNTRIES);

export function getCountry(code: string): Country {
  return COUNTRIES[code] ?? COUNTRIES.AR;
}
