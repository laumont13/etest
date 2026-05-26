import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/ml-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams, origin, pathname } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // The redirect_uri sent to ML must exactly match what was registered AND what
  // was used in the initial authorization request. We use the real URL of this
  // handler so it works both on Vercel and on localhost (if registered).
  const thisCallbackUrl = `${origin}${pathname}`;

  if (error) {
    return NextResponse.json({ error, description: searchParams.get('error_description') }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: 'Falta el parámetro code' }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code, thisCallbackUrl);
    const expiresAt = new Date(tokens.expires_at + 300_000).toLocaleString('es-AR');

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:monospace;background:#0a0a0b;color:#e0e0e0;padding:40px;max-width:700px;margin:0 auto}
  h1{color:#4ade80;margin-bottom:8px}
  h2{color:#b8ff5c;margin-top:32px;margin-bottom:8px;font-size:14px;text-transform:uppercase;letter-spacing:1px}
  .box{background:#1d1d22;border:1px solid #333;border-radius:8px;padding:20px;margin-top:12px;word-break:break-all}
  .ok{border-color:#4ade8033}
  .token{color:#b8ff5c;font-size:13px;line-height:1.6}
  .label{color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:4px}
  button{background:#b8ff5c;color:#0a0a0b;border:none;border-radius:4px;padding:8px 16px;cursor:pointer;font-size:12px;font-family:monospace;margin-top:8px}
  button:hover{background:#a0ef3c}
  .note{color:rgba(255,255,255,0.4);font-size:12px;margin-top:24px;line-height:1.8}
  .env-block{background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:12px;margin-top:8px;font-size:11px;color:#7dd3fc;line-height:1.8}
</style>
</head><body>
<h1>✓ Mercado Libre autorizado</h1>
<p style="color:rgba(255,255,255,0.6)">Token almacenado. Expira: <strong>${expiresAt}</strong></p>

<h2>Token de acceso</h2>
<div class="box ok">
  <div class="label">access_token</div>
  <div class="token" id="at">${tokens.access_token}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('at').textContent).then(()=>this.textContent='Copiado ✓')">Copiar</button>
</div>

<h2>Refresh token</h2>
<div class="box">
  <div class="label">refresh_token</div>
  <div class="token" id="rt">${tokens.refresh_token}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('rt').textContent).then(()=>this.textContent='Copiado ✓')">Copiar</button>
</div>

<h2>Para desarrollo local (.env.local)</h2>
<p style="color:rgba(255,255,255,0.5);font-size:13px">Si autorizaste desde Vercel, copiá estas líneas a tu <code>.env.local</code>:</p>
<div class="env-block" id="envblock">ML_ACCESS_TOKEN=${tokens.access_token}<br>ML_REFRESH_TOKEN=${tokens.refresh_token}</div>
<button onclick="navigator.clipboard.writeText('ML_ACCESS_TOKEN=${tokens.access_token}\\nML_REFRESH_TOKEN=${tokens.refresh_token}').then(()=>this.textContent='Copiado ✓')" style="margin-top:8px">Copiar bloque .env</button>

<p class="note">
  Token guardado en <code>.ml-tokens.json</code> en este servidor (${origin}).<br>
  Se auto-renueva con el refresh token cada 6h.<br>
  Podés cerrar esta ventana.
</p>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (e) {
    console.error('[ml-callback] Error:', e);
    const msg = String(e);
    const isRedirectMismatch = msg.toLowerCase().includes('redirect') || msg.includes('invalid_grant') || msg.includes('redirect_uri');

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:monospace;background:#0a0a0b;color:#e0e0e0;padding:40px;max-width:700px;margin:0 auto}
  h1{color:#f87171}pre{color:#fca5a5;font-size:12px;overflow-wrap:break-word;white-space:pre-wrap}
  code{color:#7dd3fc}.tip{background:#1d1d22;border:1px solid #333;border-radius:6px;padding:16px;margin-top:16px;font-size:12px;color:rgba(255,255,255,0.6);line-height:1.8}
  a{color:#b8ff5c}
</style>
</head><body>
<h1>✗ Error al autorizar</h1>
<pre>${msg}</pre>
${isRedirectMismatch ? `
<div class="tip">
  <strong>Posible causa: redirect_uri no coincide.</strong><br>
  Este callback fue llamado desde: <code>${thisCallbackUrl}</code><br>
  ML acepta: <code>${process.env.MERCADOLIBRE_REDIRECT_URI ?? '(no configurado)'}</code><br><br>
  Solución: registrá <code>${thisCallbackUrl}</code> en el
  <a href="https://developers.mercadolibre.com.ar" target="_blank">Developer Portal de ML</a>,
  o usá <a href="/api/mercadolibre/exchange">el flujo de intercambio manual</a>.
</div>` : ''}
<p style="margin-top:24px"><a href="/api/mercadolibre/exchange">← Intentar con intercambio manual</a></p>
</body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
