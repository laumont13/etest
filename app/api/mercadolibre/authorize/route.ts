import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET(req: NextRequest) {
  const clientId = process.env.MERCADOLIBRE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'MERCADOLIBRE_CLIENT_ID no configurado' }, { status: 500 });
  }

  // Build the redirect_uri dynamically from the request's origin so it works
  // on localhost AND on any deployed host (Vercel, etc.) without env changes.
  // Falls back to MERCADOLIBRE_REDIRECT_URI if present (e.g. forced to Vercel URL
  // when localhost isn't registered in the ML Developer Portal).
  const { origin } = new URL(req.url);
  const redirectUri =
    process.env.MERCADOLIBRE_REDIRECT_URI ||
    `${origin}/api/mercadolibre/callback`;

  const authUrl =
    `https://auth.mercadolibre.com.ar/authorization` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log(`[ml-authorize] redirectUri=${redirectUri}`);
  return NextResponse.redirect(authUrl);
}
