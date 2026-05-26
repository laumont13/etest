# Setup · E-Test

## 1. Requisitos
- Node >= 18.17
- Una API key de Gemini (https://aistudio.google.com/apikey)
- (Opcional) Proyecto de Supabase
- (Opcional) API key de exchangerate-api.com para FX en vivo

## 2. Instalación
```bash
npm install
cp .env.example .env.local
```
Completar al menos GEMINI_API_KEY en .env.local.

## 3. Supabase (opcional, para historial)
Crear un proyecto en supabase.com y pegar este SQL en el SQL Editor:

```sql
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  product_title text not null,
  source_url text,
  country text not null,
  score int not null,
  verdict text not null,
  margin_multiple numeric,
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists analyses_session_idx on public.analyses (session_id, created_at desc);
alter table public.analyses enable row level security;
```

Copiar las claves del proyecto a .env.local.

## 4. Google Trends (pytrends)
La función vive en api/py-trends.py y corre en el runtime Python de Vercel.
En local, definir PYTHON_FUNCTION_BASE_URL=http://localhost:3000 (Vercel CLI
sirve las funciones Python). pytrends es frágil: si Google responde 429, la app
marca Trends como dato faltante en vez de inventar un número.

## 5. Desarrollo
```bash
npm run dev       # http://localhost:3000
npm run build     # build de producción
npm run typecheck # chequeo de tipos
```

## 6. Deploy en Vercel
- Importar el repo en Vercel.
- Cargar las env vars en el dashboard.
- vercel.json ya define los timeouts: analyze 90s, py-trends 30s, extract 15s, pdf 30s.
- La función Python instala pytrends desde api/requirements.txt.

## Roadmap post-MVP
- Meta Ads Library para validar saturación de creativos
- Comparación cross-country del mismo producto
- Login + historial multi-dispositivo
- Caché de Trends/ML por producto para no repetir llamadas
