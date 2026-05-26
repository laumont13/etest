export type SourceStatus =
  | 'ok'
  | 'no_results'
  | 'low_volume'
  | 'blocked'
  | 'unauthorized'
  | 'rate_limited'
  | 'not_configured'
  | 'error';

export interface SourceState {
  status: SourceStatus;
  reason: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceResult {
  level: ConfidenceLevel;
  label: string;
  penalty: number;
}

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  ok: 'OK',
  no_results: 'Sin resultados',
  low_volume: 'Volumen bajo',
  blocked: 'Bloqueado',
  unauthorized: 'Sin autorización',
  rate_limited: 'Límite de peticiones',
  not_configured: 'No configurado',
  error: 'Error',
};

export function isDataAvailable(status: SourceStatus): boolean {
  return status === 'ok' || status === 'low_volume';
}

export function computeConfidence(statuses: SourceStatus[]): ConfidenceResult {
  const available = statuses.filter(isDataAvailable).length;
  if (available === statuses.length) return { level: 'high', label: 'Alta', penalty: 0 };
  if (available > 0) return { level: 'medium', label: 'Media', penalty: 5 };
  return { level: 'low', label: 'Baja', penalty: 15 };
}
