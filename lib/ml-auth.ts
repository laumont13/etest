/**
 * ML OAuth token manager.
 * Persists tokens to .ml-tokens.json (gitignored) and auto-refreshes before expiry.
 * Works across hot-reloads by reading the file on every cold start.
 */

import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), '.ml-tokens.json');
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

interface MLTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
}

// In-memory cache shared across requests in the same Node process
let cache: MLTokens | null = null;

function loadFromFile(): MLTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(raw) as MLTokens;
  } catch {
    return null;
  }
}

function saveToFile(tokens: MLTokens): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (e) {
    console.error('[ml-auth] Failed to persist tokens:', e);
  }
}

async function refreshToken(refreshToken: string): Promise<MLTokens> {
  const clientId = process.env.MERCADOLIBRE_CLIENT_ID!;
  const clientSecret = process.env.MERCADOLIBRE_CLIENT_SECRET!;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) throw new Error(`ML refresh failed: ${res.status} — ${JSON.stringify(data)}`);

  const tokens: MLTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + (data.expires_in - 300) * 1000, // 5-min buffer
  };
  cache = tokens;
  saveToFile(tokens);
  console.log('[ml-auth] Token refreshed, expires at', new Date(tokens.expires_at).toISOString());
  return tokens;
}

/**
 * @param redirectUri  The exact redirect_uri used in the authorization request.
 *   Defaults to MERCADOLIBRE_REDIRECT_URI env var, but callers should pass the
 *   actual URL of the callback handler so ML's validation always matches.
 */
export async function exchangeCode(code: string, redirectUri?: string): Promise<MLTokens> {
  const clientId = process.env.MERCADOLIBRE_CLIENT_ID!;
  const clientSecret = process.env.MERCADOLIBRE_CLIENT_SECRET!;
  const resolvedRedirectUri = redirectUri ?? process.env.MERCADOLIBRE_REDIRECT_URI!;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: resolvedRedirectUri,
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) throw new Error(`ML code exchange failed: ${res.status} — ${JSON.stringify(data)}`);

  const tokens: MLTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  };
  cache = tokens;
  saveToFile(tokens);
  console.log('[ml-auth] Token obtained, expires at', new Date(tokens.expires_at).toISOString());
  return tokens;
}

/**
 * Returns a valid access token, refreshing if needed. Returns null if not configured.
 *
 * Priority:
 *   1. ML_ACCESS_TOKEN env var (static token — user pastes it after authorizing on Vercel)
 *   2. In-memory cache (hot path)
 *   3. .ml-tokens.json file (persisted after local OAuth)
 */
export async function getMLToken(): Promise<string | null> {
  if (!process.env.MERCADOLIBRE_CLIENT_ID || !process.env.MERCADOLIBRE_CLIENT_SECRET) {
    return null;
  }

  // Static token from env (user copied it from Vercel OAuth callback)
  if (process.env.ML_ACCESS_TOKEN) {
    return process.env.ML_ACCESS_TOKEN;
  }

  // Load from file if cache is cold
  if (!cache) cache = loadFromFile();
  if (!cache) return null;

  // Refresh if expired or expiring soon
  if (Date.now() >= cache.expires_at) {
    try {
      const refreshed = await refreshToken(cache.refresh_token);
      return refreshed.access_token;
    } catch (e) {
      console.error('[ml-auth] Refresh failed:', e);
      cache = null;
      return null;
    }
  }

  return cache.access_token;
}

export function getAuthorizeUrl(): string {
  const clientId = process.env.MERCADOLIBRE_CLIENT_ID!;
  const redirectUri = process.env.MERCADOLIBRE_REDIRECT_URI!;
  return `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}
