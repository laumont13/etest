# E-Test

> Validá productos de Alibaba antes de importarlos.

Pegá un producto y obtené en segundos un veredicto de viabilidad para tu país. **El margen filtra primero, gratis e instantáneo**: solo los productos que superan el gate de 3x llegan al análisis profundo con IA. Score 0–100, competencia real, riesgos priorizados y ángulos de venta accionables.

**Stack:** Next.js 14 · TypeScript · Tailwind · Supabase · **Gemini 2.5 Flash** · pytrends · @react-pdf/renderer.

---

## Cómo funciona (las 3 capas)

1. **Gate de margen (cliente, instantáneo, gratis).** Calcula el múltiplo precio/costo en vivo mientras tipeás. Si no llega a 3x, el producto muere acá sin gastar un token de IA. Esto mata la mayoría de los perdedores en segundos.
2. **Análisis profundo (servidor, solo si pasa el gate).** Dispara señales reales en paralelo —Google Trends + Mercado Libre—, y Gemini puntúa las 9 dimensiones del framework **sin inventar cifras**: si falta un dato, lo marca como faltante.
3. **Scoring determinístico (servidor).** La matemática del score y el veredicto la hace código puro, no la IA. El mismo producto siempre da el mismo resultado.

Las 9 dimensiones, agrupadas en 3 filtros: **¿Existe el negocio?** (demanda, competencia) · **¿Se vende con pauta?** (potencial publicitario, factor wow, fuerza de oferta) · **¿Vale el esfuerzo?** (branding, riesgos, escalabilidad). Margen y potencial publicitario pesan doble.

---

## Quick start

```bash
npm install
cp .env.example .env.local
# completar variables (mínimo: GEMINI_API_KEY)
npm run dev
```

Abrir http://localhost:3000

La app funciona sin Supabase (se desactiva el historial) y sin pytrends (Trends queda como dato faltante). Lo único imprescindible es GEMINI_API_KEY.

---

## Variables de entorno

| Variable | Requerida | Para qué |
|---|---|---|
| GEMINI_API_KEY | Sí | Análisis de las 9 dimensiones |
| NEXT_PUBLIC_SUPABASE_URL | No | Historial por sesión |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | No | Historial (browser) |
| SUPABASE_SERVICE_ROLE_KEY | No | Historial (server) |
| PYTHON_FUNCTION_BASE_URL | No | Trends en local |
| FX_API_KEY | No | Tipo de cambio en vivo (si no, usa fallback) |

---

## Lo que hace, lo que no hace

Hace:
- Gate de margen instantáneo en el cliente (filtra antes de gastar IA)
- Lee metadatos básicos de URLs de Alibaba/AliExpress
- Combina Google Trends + Mercado Libre + tus inputs
- Gemini puntúa las 9 dimensiones sin inventar cifras
- Score determinístico ponderado + veredicto (avanzar/dudoso/descartar)
- PDF exportable · Historial por sesión (sin login)

No hace (por ahora):
- Scraping agresivo de Alibaba (frágil, contra ToS)
- Datos de TikTok/Instagram/Amazon (sin APIs viables)
- Meta Ads Library · Comparación cross-country · Login

---

## Países soportados

🇦🇷 Argentina · 🇲🇽 México · 🇨🇴 Colombia · 🇨🇱 Chile · 🇵🇪 Perú · 🇪🇸 España

---

## Filosofía

E-Test es una herramienta de **asistencia a la decisión, no un oráculo**. Filtra rápido lo malo para que no pierdas tiempo. La validación final siempre se hace con público real, anuncios y métricas. La IA no fabrica estadísticas: cuando le falta un dato, lo dice.
