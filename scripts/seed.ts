/**
 * E-Test · Seed de Supabase
 * ----------------------------------------------------------------------------
 * Crea la tabla `analyses` para el historial por sesión.
 * Ejecutar el SQL de abajo en el editor de Supabase, o correr este script con
 * `npm run db:seed` (requiere las env vars del service role).
 *
 * NOTA: la creación de tablas vía SDK requiere RPC; lo más simple y robusto es
 * pegar este SQL en el panel de Supabase. Lo dejamos documentado acá.
 */

export const SCHEMA_SQL = `
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

-- RLS: el historial es por sesión anónima; el acceso real va por service role
-- desde el server. Si se quiere exponer al browser, definir políticas acá.
alter table public.analyses enable row level security;
`;

async function main() {
  console.log('Pegá este SQL en el SQL Editor de Supabase:\n');
  console.log(SCHEMA_SQL);
}

main();
