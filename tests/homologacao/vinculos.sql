-- Cenário fictício e reversível. Aplicar somente ao ambiente descartável de testes.
begin;
create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.identidade(pessoa int, sessao int, nivel text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id(pessoa),'session_id',pg_temp.id(sessao),'aal',nivel,
    'user_metadata',jsonb_build_object('funcao','manager','organizacao','outra-prefeitura'))::text,true);
$$;
create function pg_temp.exigir(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falha de isolamento: %', caso; end if;
end;
$$;
insert into auth.users (id,is_anonymous) values (pg_temp.id(1),false),(pg_temp.id(2),false),(pg_temp.id(3),false);
insert into auth.sessions (id,user_id,aal,created_at) values
 (pg_temp.id(31),pg_temp.id(1),'aal2',now()),(pg_temp.id(32),pg_temp.id(2),'aal2',now()),(pg_temp.id(33),pg_temp.id(3),'aal2',now());
insert into cuidelo_privado.organizacoes values (pg_temp.id(11),'Prefeitura A'),(pg_temp.id(12),'Prefeitura B');
insert into cuidelo_privado.unidades values
 (pg_temp.id(21),pg_temp.id(11),'UBS A1'),(pg_temp.id(22),pg_temp.id(11),'UPA A2'),(pg_temp.id(23),pg_temp.id(12),'UBS B1');
insert into cuidelo_privado.vinculos(usuario_id,organizacao_id,unidade_id,funcao) values
 (pg_temp.id(1),pg_temp.id(11),pg_temp.id(21),'clinical'), (pg_temp.id(2),pg_temp.id(12),pg_temp.id(23),'admin'),
 (pg_temp.id(3),pg_temp.id(11),null,'manager');
do $$ begin
  begin
    insert into cuidelo_privado.vinculos(usuario_id,organizacao_id,unidade_id,funcao)
    values(pg_temp.id(1),pg_temp.id(11),pg_temp.id(23),'admin');
    raise exception 'Unidade fora da prefeitura aceita';
  exception when foreign_key_violation then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.cuidelo_meus_acessos(); raise exception 'Acesso anônimo aceito';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select pg_temp.identidade(1,31,'aal1');
select pg_temp.exigir(count(*)=0,'sem segundo fator') from public.cuidelo_meus_acessos();
select pg_temp.identidade(1,32,'aal2');
select pg_temp.exigir(count(*)=0,'sessão pertence a outra pessoa') from public.cuidelo_meus_acessos();
select pg_temp.identidade(1,31,'aal2');
select pg_temp.exigir(count(*)=1 and bool_and(unidade='UBS A1' and funcao='clinical'),'médico restrito ao vínculo, metadados não elevam perfil') from public.cuidelo_meus_acessos();
select pg_temp.exigir(count(*)=1,'RLS na leitura direta de unidades') from cuidelo_privado.unidades;
select pg_temp.exigir(count(*)=1,'RLS na leitura direta de vínculos') from cuidelo_privado.vinculos;
do $$ begin
  begin update cuidelo_privado.vinculos set funcao='admin'; raise exception 'Alteração de função permitida';
  exception when insufficient_privilege then null; end;
  begin insert into cuidelo_privado.vinculos(usuario_id,organizacao_id,funcao) values(pg_temp.id(1),pg_temp.id(12),'manager'); raise exception 'Autoatribuição permitida';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.identidade(2,32,'aal2');
select pg_temp.exigir(count(*)=1 and bool_and(unidade='UBS B1' and funcao='admin'),'administração local') from public.cuidelo_meus_acessos();
select pg_temp.identidade(3,33,'aal2');
select pg_temp.exigir(count(*)=2 and bool_and(organizacao='Prefeitura A' and funcao='manager'),'prefeitura só vê a própria rede') from public.cuidelo_meus_acessos();
reset role;
update cuidelo_privado.vinculos set revogado_em=now() where usuario_id=pg_temp.id(1);
set local role authenticated;
select pg_temp.identidade(1,31,'aal2');
select pg_temp.exigir(count(*)=0,'revogação de vínculo com o mesmo token') from public.cuidelo_meus_acessos();
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id=pg_temp.id(32);
set local role authenticated;
select pg_temp.identidade(2,32,'aal2');
select pg_temp.exigir(count(*)=0,'sessão expirada') from public.cuidelo_meus_acessos();
reset role;
delete from auth.sessions where id=pg_temp.id(33);
set local role authenticated;
select pg_temp.identidade(3,33,'aal2');
select pg_temp.exigir(count(*)=0,'token antigo após encerramento da sessão') from public.cuidelo_meus_acessos();
rollback;
