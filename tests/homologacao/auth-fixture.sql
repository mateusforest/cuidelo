-- Exclusivo do banco descartável usado pelos testes de políticas. Falha se Auth já existir.
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false, banned_until timestamptz, deleted_at timestamptz);
create table auth.sessions (id uuid primary key, user_id uuid not null references auth.users, aal text, not_after timestamptz, created_at timestamptz not null default now());
create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true),'')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt()->>'sub')::uuid;
$$;
