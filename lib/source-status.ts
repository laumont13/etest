export type SourceStatus =
  | 'ok'
  | 'no_results'
  | 'low_volume'
  | 'blocked'
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
  ok: 'Disponible',
  no_results: 'Sin resultados',
  low_volume: 'Volumen bajo',
  blocked: 'Sin respuesta',
  rate_limited: 'Límite alcanzado',
  not_configured: 'No disponible',
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
