/**
 * ML OAuth Code Exchange
 *
 * Uso: GET /api/mercadolibre/exchange?code=TG-...
 *
 * Flujo completo:
 * 1. Abrí /api/mercadolibre/authorize → te redirige a ML
 * 2. Iniciá sesión y autorizá la app
 * 3. ML te redirige a Vercel con ?code=TG-...
 * 4. Copiá el parámetro code de la URL
 * 5. Visitá /api/mercadolibre/exchange?code=TG-... (este endpoint)
 * 6. Los tokens quedan guardados localmente
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/ml-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const helpHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:monospace;background:#0a0a0b;color:#e0e0e0;padding:40px;max-width:700px;margin:0 auto}
  h1{color:#b8ff5c}h2{color:#fff;font-size:14px;margin-top:32px}
  .step{background:#1d1d22;border:1px solid #333;border-radius:6px;padding:16px;margin:12px 0}
  .step span{color:#b8ff5c;font-weight:bold;margin-right:8px}
  code{color:#7dd3fc;font-size:12px}
  a{color:#b8ff5c}
  input{background:#1d1d22;border:1px solid #444;color:#e0e0e0;padding:8px;font-family:monospace;font-size:12px;width:100%;box-sizing:border-box;margin-top:4px}
  button{background:#b8ff5c;color:#0a0a0b;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;font-family:monospace;margin-top:8px}
</style>
</head><body>
<h1>ML OAuth — Intercambio de código</h1>

<h2>Cómo conectar Mercado Libre:</h2>

<div class="step"><span>1.</span> <a href="/api/mercadolibre/authorize">Abrí /api/mercadolibre/authorize</a> → te redirige a ML</div>
<div class="step"><span>2.</span> Iniciá sesión con tu cuenta de ML y autorizá la app "etest"</div>
<div class="step"><span>3.</span> ML te redirige a Vercel. Copiá el parámetro <code>?code=...</code> de la URL.<br>La URL se ve así: <code>https://etest-six.vercel.app/api/mercadolibre/callback?code=TG-...</code></div>
<div class="step"><span>4.</span> Pegá el código abajo y hacé clic en "Intercambiar":
<form method="GET" action="/api/mercadolibre/exchange">
  <input type="text" name="code" placeholder="TG-12345..." />
  <button type="submit">Intercambiar y conectar</button>
</form>
</div>

<p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:32px">
  Si la redirección de Vercel da error, igual podés copiar el code de la URL del browser.<br>
  El código expira en ~10 minutos. Usalo rápido.
</p>
</body></html>`;

  if (error) {
    return new NextResponse(helpHtml, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (!code) {
    return new NextResponse(helpHtml, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    // Use the same redirect_uri that was used in the authorization request
    // (the env var, since authorize always uses it)
    const tokens = await exchangeCode(code, process.env.MERCADOLIBRE_REDIRECT_URI);
    const expiresAt = new Date(tokens.expires_at + 300_000).toLocaleString('es-AR');

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:monospace;background:#0a0a0b;color:#e0e0e0;padding:40px;max-width:700px;margin:0 auto}
  h1{color:#4ade80}
  .box{background:#1d1d22;border:1px solid #4ade8033;border-radius:8px;padding:20px;margin-top:16px}
  .label{color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:4px}
  .token{color:#b8ff5c;font-size:12px;word-break:break-all}
  a{color:#b8ff5c}
</style>
</head><body>
<h1>✓ Mercado Libre conectado</h1>
<p>Token guardado en <code>.ml-tokens.json</code>. Expira: <strong>${expiresAt}</strong></p>
<div class="box">
  <div class="label">access_token</div>
  <div class="token">${tokens.access_token}</div>
</div>
<p style="margin-top:24px;color:rgba(255,255,255,0.5)">
  Reiniciá el servidor si está corriendo. Los precios de ML ahora van a funcionar.<br>
  <a href="/">← Volver a la app</a>
</p>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (e) {
    const msg = String(e);
    const isExpired = msg.includes('invalid') || msg.includes('expired') || msg.includes('400');

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:monospace;background:#0a0a0b;color:#e0e0e0;padding:40px}</style>
</head><body>
<h1 style="color:#f87171">✗ Error al intercambiar código</h1>
<pre style="color:#f87171">${msg}</pre>
${isExpired ? '<p style="color:rgba(255,255,255,0.6)">El código expiró. Repetí el proceso desde el inicio.</p>' : ''}
<p><a style="color:#b8ff5c" href="/api/mercadolibre/exchange">← Volver a intentar</a></p>
</body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
