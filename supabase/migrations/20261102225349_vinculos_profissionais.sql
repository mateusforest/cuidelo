-- Fundação isolada para homologação. Não contém registros clínicos nem usuários iniciais.
create schema cuidelo_privado;
revoke all on schema cuidelo_privado from public, anon, authenticated;
grant usage on schema cuidelo_privado to authenticated;

create table cuidelo_privado.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 180)
);
create table cuidelo_privado.unidades (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references cuidelo_privado.organizacoes(id),
  nome text not null check (length(trim(nome)) between 1 and 180),
  unique (organizacao_id, id)
);
create table cuidelo_privado.vinculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  organizacao_id uuid not null references cuidelo_privado.organizacoes(id),
  unidade_id uuid,
  funcao text not null check (funcao in ('manager','admin','reception','nursing','clinical','pharmacy','regulation','acs')),
  ativo_desde timestamptz not null default now(),
  revogado_em timestamptz,
  foreign key (organizacao_id, unidade_id) references cuidelo_privado.unidades(organizacao_id, id),
  check ((funcao = 'manager') = (unidade_id is null)),
  check (revogado_em is null or revogado_em >= ativo_desde)
);
create unique index vinculo_vigente on cuidelo_privado.vinculos
  (usuario_id, organizacao_id, unidade_id, funcao) nulls not distinct where revogado_em is null;
create index vinculos_por_unidade on cuidelo_privado.vinculos(organizacao_id, unidade_id);

alter table cuidelo_privado.organizacoes enable row level security;
alter table cuidelo_privado.unidades enable row level security;
alter table cuidelo_privado.vinculos enable row level security;
revoke all on all tables in schema cuidelo_privado from public, anon, authenticated;
grant select on all tables in schema cuidelo_privado to authenticated;

-- A API verifica a assinatura do JWT. Esta consulta privada só confirma a própria sessão
-- em auth.sessions; não concede ao profissional acesso às tabelas administrativas do Auth.
create function cuidelo_privado.sessao_profissional_valida() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.user_id = (select auth.uid())
      and s.id = (select (auth.jwt()->>'session_id')::uuid)
      and (select auth.jwt()->>'aal') = 'aal2' and s.aal = 'aal2'
      and u.is_anonymous = false and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and (s.not_after is null or s.not_after > now())
      and s.created_at > now() - interval '8 hours'
  );
$$;
revoke all on function cuidelo_privado.sessao_profissional_valida() from public, anon, authenticated;
grant execute on function cuidelo_privado.sessao_profissional_valida() to authenticated;

create policy vinculo_proprio_ativo on cuidelo_privado.vinculos for select to authenticated
using (usuario_id = (select auth.uid()) and ativo_desde <= now() and revogado_em is null
  and (select cuidelo_privado.sessao_profissional_valida()));
create policy organizacao_com_vinculo on cuidelo_privado.organizacoes for select to authenticated
using (exists (select 1 from cuidelo_privado.vinculos v where v.organizacao_id = organizacoes.id));
create policy unidade_com_vinculo on cuidelo_privado.unidades for select to authenticated
using (exists (select 1 from cuidelo_privado.vinculos v where v.organizacao_id = unidades.organizacao_id
  and (v.funcao = 'manager' or v.unidade_id = unidades.id)));

-- Uma linha por função e unidade disponível. Nenhum parâmetro de prefeitura, perfil ou usuário
-- é recebido do cliente. Cada consulta observa imediatamente revogações de vínculo ou sessão.
create function public.cuidelo_meus_acessos()
returns table(organizacao_id uuid, organizacao text, unidade_id uuid, unidade text, funcao text)
language sql stable security invoker set search_path = '' as $$
  select o.id, o.nome, u.id, u.nome, v.funcao
  from cuidelo_privado.vinculos v
  join cuidelo_privado.organizacoes o on o.id = v.organizacao_id
  join cuidelo_privado.unidades u on u.organizacao_id = o.id and (v.unidade_id is null or v.unidade_id = u.id)
  order by o.nome, u.nome, v.funcao;
$$;
revoke all on function public.cuidelo_meus_acessos() from public, anon, authenticated;
grant execute on function public.cuidelo_meus_acessos() to authenticated;
