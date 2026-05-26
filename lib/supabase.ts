/**
 * E-Test · Cliente de Supabase
 * ----------------------------------------------------------------------------
 * Persistencia del historial de análisis por sesión (sin login).
 * El cliente del servidor usa la service role key; el del browser, la anon key.
 * Todas las claves se leen del entorno.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/** Cliente para uso en el browser (anon key, RLS aplica). */
export function getBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null; // app funciona sin DB; historial deshabilitado
  if (!browserClient) browserClient = createClient(url, anon);
  return browserClient;
}

/** Cliente para uso en el servidor (service role, bypassa RLS). */
export function getServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}

export interface SavedAnalysis {
  id?: string;
  session_id: string;
  product_title: string;
  source_url: string | null;
  country: string;
  score: number;
  verdict: string;
  margin_multiple: number;
  payload: unknown; // resultado completo serializado
  created_at?: string;
}

export async function saveAnalysis(row: SavedAnalysis): Promise<void> {
  const db = getServerClient();
  if (!db) return; // sin DB, no persistimos — la app sigue andando
  await db.from('analyses').insert(row);
}

export async function listAnalyses(sessionId: string): Promise<SavedAnalysis[]> {
  const db = getServerClient();
  if (!db) return [];
  const { data } = await db
    .from('analyses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as SavedAnalysis[]) ?? [];
}
