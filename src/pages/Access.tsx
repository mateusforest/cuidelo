import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Stethoscope, ArrowRight, ShieldCheck } from 'lucide-react';
import { demoIdentities } from '../domain/access';
import { can, roleNames, type Permission } from '../domain/model';
import { useApp } from '../app/context';
import { Button, Field, Notice, PageHeader } from '../components/ui';

export function Access() {
  const { repository, chooseSession, context } = useApp(),
    navigate = useNavigate();
  const directory = repository.directory();
  const initialOrg = context.role === 'business' ? 'aurora' : context.organizationId;
  const [org, setOrg] = useState(initialOrg),
    [unit, setUnit] = useState(
      context.unitId === 'all' || context.role === 'business'
        ? directory.units.find((u) => u.organizationId === initialOrg)!.id
        : context.unitId,
    );
  const identities = demoIdentities(directory)
    .filter(
      (i) =>
        i.role === 'business' ||
        (i.organizationId === org && (i.role === 'manager' || i.unitId === unit)),
    )
    .sort((a, b) => Number(a.role === 'business') - Number(b.role === 'business'));
  return (
    <main className="access-page">
      <header>
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <Link to="/">Voltar ao ambiente</Link>
      </header>
      <div className="access-intro">
        <span className="eyebrow">AMBIENTE DE DEMONSTRAÇÃO</span>
        <h1>Cada pessoa com o acesso certo.</h1>
        <p>Escolha uma sessão fictícia para testar os percursos da equipe e da prefeitura.</p>
      </div>
      <Notice>
        Este seletor é um laboratório de perfis, sem autenticação real. Dados e acessos ainda são
        locais neste navegador.
      </Notice>
      <div className="access-filters">
        <Field label="Prefeitura de demonstração">
          <select
            value={org}
            onChange={(e) => {
              setOrg(e.target.value);
              setUnit(directory.units.find((u) => u.organizationId === e.target.value)!.id);
            }}
          >
            {directory.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.shortName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unidade da sessão">
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {directory.units
              .filter((u) => u.organizationId === org)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <div className="identity-grid">
        {identities.map((i) => (
          <article key={i.sessionId} className="identity-card">
            {i.role === 'manager' || i.role === 'business' ? (
              <Building2 size={28} />
            ) : i.role === 'admin' ? (
              <ShieldCheck size={28} />
            ) : (
              <Stethoscope size={28} />
            )}
            <h2>{roleNames[i.role]}</h2>
            <p>{i.name}</p>
            <small>
              {i.role === 'business'
                ? 'Empresa Cuidelo · carteira comercial, sem prontuários'
                : i.role === 'manager'
                  ? 'Todas as unidades desta prefeitura · indicadores e gestão'
                  : i.role === 'admin'
                    ? 'Gestão operacional desta unidade · sem edição clínica'
                    : 'Operação nesta unidade · acesso conforme a função'}
            </small>
            <Button
              data-session={i.sessionId}
              onClick={() => {
                chooseSession(i.sessionId);
                navigate(
                  i.role === 'clinical' ? '/consultorio' : i.role === 'nursing' ? '/escuta' : '/',
                );
              }}
            >
              Entrar nesta sessão <ArrowRight size={17} />
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}
const shortcuts: { path: string; title: string; detail: string; permission: Permission }[] = [
  {
    path: '/recepcao',
    title: 'Recepção',
    detail: 'Identificar chegadas, conferir senhas e acompanhar a fila.',
    permission: 'queue',
  },
  {
    path: '/consultorio',
    title: 'Meu consultório',
    detail: 'Chamar na TV e registrar o início e fim de cada consulta.',
    permission: 'clinical',
  },
  {
    path: '/exames',
    title: 'Exames e resultados',
    detail: 'Acompanhar pedidos, resultados recebidos e revisão médica.',
    permission: 'clinical',
  },
  {
    path: '/escuta',
    title: 'Escuta e sinais vitais',
    detail: 'Registrar o acolhimento antes da consulta.',
    permission: 'clinical',
  },
  {
    path: '/agenda',
    title: 'Agenda',
    detail: 'Marcar horários e confirmar chegadas.',
    permission: 'schedule',
  },
  {
    path: '/hospital',
    title: 'Internação e leitos',
    detail: 'Acompanhar admissões, saídas e disponibilidade.',
    permission: 'beds',
  },
  {
    path: '/vacinacao',
    title: 'Vacinação',
    detail: 'Aplicações, caderneta e retornos.',
    permission: 'vaccination',
  },
  {
    path: '/farmacia',
    title: 'Farmácia',
    detail: 'Consultar lotes e registrar movimentações.',
    permission: 'stock',
  },
  {
    path: '/regulacao',
    title: 'Regulação',
    detail: 'Solicitações e encaminhamentos da unidade.',
    permission: 'regulation',
  },
  {
    path: '/desempenho',
    title: 'Tempos e desempenho',
    detail: 'Espera, escuta e tempo em consultório.',
    permission: 'performance',
  },
  {
    path: '/dispositivos',
    title: 'Totem e TV',
    detail: 'Abrir as telas públicas desta unidade.',
    permission: 'devices',
  },
];
export function WorkspaceHome() {
  const { context, data, summary } = useApp();
  return (
    <>
      <PageHeader
        eyebrow={roleNames[context.role]}
        title={data.units.find((u) => u.id === context.unitId)?.name ?? 'Minha unidade'}
        description="Seu espaço de trabalho. As operações ficam vinculadas a esta unidade."
      />
      <div className="flow-stats">
        <article>
          <small>Chegadas hoje</small>
          <strong>{summary.today}</strong>
        </article>
        <article>
          <small>Aguardando</small>
          <strong>{summary.waiting}</strong>
        </article>
        <article>
          <small>Em cuidado</small>
          <strong>{summary.inCare}</strong>
        </article>
      </div>
      <div className="identity-grid">
        {shortcuts
          .filter((s) => can(context.role, s.permission))
          .map((s) => (
            <Link className="identity-card workspace-link" to={s.path} key={s.path}>
              <h2>{s.title}</h2>
              <p>{s.detail}</p>
              <ArrowRight size={22} />
            </Link>
          ))}
      </div>
      <Link to="/modulos" className="button secondary">
        Abrir módulos e acompanhamentos
      </Link>
      {can(context.role, 'clinical') && (
        <Notice>
          O histórico clínico reúne as unidades desta prefeitura. As chamadas, os registros e as
          filas pertencem à sua unidade atual.
        </Notice>
      )}
    </>
  );
}
