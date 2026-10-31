import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Stethoscope,
  ArrowRight,
  ShieldCheck,
  ClipboardList,
  HeartPulse,
  Pill,
  ArrowRightLeft,
  MapPin,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Monitor,
  Info,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { demoIdentities } from '../domain/access';
import { can, roleNames, type Role } from '../domain/model';
import { useApp } from '../app/context';
import { Button, Field, PageHeader } from '../components/ui';
import { navItems, stations, shortcuts } from '../app/navigation';
import { dateKey } from '../domain/dates';
import { displayRoute } from '../app/links';

const accessRoles: {
  role: Role;
  label: string;
  icon: LucideIcon;
  detail: string;
  route: string;
}[] = [
  {
    role: 'reception',
    label: 'Recepção',
    icon: ClipboardList,
    detail: 'Chegadas, senhas, cadastro e agenda da unidade.',
    route: '/recepcao',
  },
  {
    role: 'clinical',
    label: 'Equipe médica',
    icon: Stethoscope,
    detail: 'Consultório, prontuário, receitas e pedidos de exames.',
    route: '/consultorio',
  },
  {
    role: 'nursing',
    label: 'Enfermagem',
    icon: HeartPulse,
    detail: 'Escuta inicial, sinais vitais e vacinação.',
    route: '/escuta',
  },
  {
    role: 'pharmacy',
    label: 'Farmácia',
    icon: Pill,
    detail: 'Receitas, entregas e controle do estoque por lote.',
    route: '/farmacia',
  },
  {
    role: 'regulation',
    label: 'Regulação',
    icon: ArrowRightLeft,
    detail: 'Encaminhamentos e agendamentos da unidade.',
    route: '/regulacao',
  },
  {
    role: 'acs',
    label: 'Agente de saúde',
    icon: MapPin,
    detail: 'Famílias, território e visitas domiciliares.',
    route: '/modulos',
  },
  {
    role: 'admin',
    label: 'Administração',
    icon: ShieldCheck,
    detail: 'Gestão operacional da unidade e indicadores locais.',
    route: '/',
  },
  {
    role: 'manager',
    label: 'Prefeitura',
    icon: Building2,
    detail: 'Gestão de todas as unidades da mesma prefeitura.',
    route: '/',
  },
  {
    role: 'business',
    label: 'Equipe Cuidelo',
    icon: BriefcaseBusiness,
    detail: 'Implantação, suporte e operação comercial da Cuidelo.',
    route: '/modulos',
  },
];

export function Access({ resume = false }: { resume?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { repository, chooseSession, context, demoEntered } = useApp();
  const navigate = useNavigate();
  const directory = repository.directory();
  const [params] = useSearchParams();
  const identitiesList = demoIdentities(directory);
  const suggested = resume
    ? undefined
    : identitiesList.find((i) => i.sessionId === params.get('sessao'));
  const initial = suggested ?? context;
  const initialOrg = initial.role === 'business' ? 'aurora' : initial.organizationId;
  const [org, setOrg] = useState(initialOrg);
  const [unit, setUnit] = useState(
    initial.unitId === 'all' || initial.role === 'business'
      ? directory.units.find((u) => u.organizationId === initialOrg)!.id
      : initial.unitId,
  );
  const [role, setRole] = useState<Role>(
    suggested?.role ?? (demoEntered ? context.role : 'reception'),
  );
  const [second, setSecond] = useState(initial.sessionId.endsWith(':2'));
  const roleInfo = accessRoles.find((r) => r.role === role)!;
  const unitChoices = directory.units.filter(
    (u) => u.organizationId === org && (role === 'pharmacy' || u.kind !== 'central'),
  );
  const selectedUnit = unitChoices.find((u) => u.id === unit) ?? unitChoices[0];
  const identities = identitiesList.filter(
    (i) =>
      i.role === role &&
      (role === 'business' ||
        (i.organizationId === org && (role === 'manager' || i.unitId === selectedUnit.id))),
  );
  const selected = identities[role === 'clinical' && second ? 1 : 0];
  const organization = directory.organizations.find((o) => o.id === org)!;
  const scope =
    role === 'business'
      ? 'Operação comercial Cuidelo'
      : role === 'manager'
        ? `Todas as unidades · ${organization.shortName}`
        : selectedUnit.name;
  const Icon = roleInfo.icon;
  return (
    <main className="access-screen">
      <a
        className="skip-link"
        href="#demo-access-form"
        onClick={(event) => {
          event.preventDefault();
          formRef.current?.focus();
          formRef.current?.scrollIntoView({ block: 'start' });
        }}
      >
        Ir para os acessos
      </a>
      <section className="access-story" aria-label="Cuidelo, saúde conectada">
        <img className="access-brand" src="/brand/marca-negativa.svg" alt="Cuidelo" />
        <div className="access-story-content">
          <span className="access-kicker">TECNOLOGIA A SERVIÇO DO CUIDADO</span>
          <h1>
            Toda a rede.
            <br />
            Mais perto
            <br />
            das pessoas.
          </h1>
          <p>
            Um espaço para conectar equipes, organizar o cuidado e acompanhar cada etapa da saúde
            pública.
          </p>
          <div className="access-network" aria-label="Da chegada à gestão da rede">
            <div className="network-center">
              <img src="/brand/simbolo-negativo.svg" alt="" />
            </div>
            <div className="network-node node-reception">
              <ClipboardList size={19} />
              <span>Recepção</span>
            </div>
            <div className="network-node node-care">
              <HeartPulse size={19} />
              <span>Cuidado</span>
            </div>
            <div className="network-node node-management">
              <Building2 size={19} />
              <span>Gestão</span>
            </div>
          </div>
        </div>
        <footer className="access-story-footer">
          <span>UBS · UPA · HOSPITAIS</span>
          <span>Uma rede de possibilidades.</span>
        </footer>
      </section>
      <section className="access-entry" aria-labelledby="access-title">
        <header className="access-entry-top">
          <img src="/brand/marca.svg" alt="Cuidelo" className="access-mobile-brand" />
          <span className="access-demo-badge">
            <span /> Ambiente demonstrativo
          </span>
          {demoEntered && (
            <Link to="/" className="access-back">
              Voltar ao ambiente <ChevronRight size={14} />
            </Link>
          )}
        </header>
        <div className="access-form-wrap">
          <div className="access-welcome">
            <span className="eyebrow">SEU ESPAÇO DE TRABALHO</span>
            <h2 id="access-title">Bem-vindo ao Cuidelo.</h2>
            <p>Escolha seu acesso e conheça os fluxos da rede.</p>
          </div>
          <form
            id="demo-access-form"
            ref={formRef}
            tabIndex={-1}
            onSubmit={(e) => {
              e.preventDefault();
              chooseSession(selected.sessionId);
              if (!resume) navigate(roleInfo.route);
            }}
          >
            <fieldset className="access-role-fieldset">
              <legend>
                <span>01</span> Qual experiência você quer testar?
              </legend>
              <div className="access-role-grid">
                {accessRoles.map(({ role: key, label, icon: RoleIcon }) => (
                  <button
                    key={key}
                    type="button"
                    className={`access-role ${key === role ? 'selected' : ''}`}
                    aria-pressed={key === role}
                    data-role={key}
                    onClick={() => setRole(key)}
                  >
                    <RoleIcon size={19} />
                    <span>{label}</span>
                    {key === role && <Check size={12} className="access-role-check" />}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="access-context-fieldset">
              <legend>
                <span>02</span> Seu ambiente de demonstração
              </legend>
              <div className="access-context-fields">
                <Field label="Prefeitura de demonstração">
                  <select
                    value={role === 'business' ? 'cuidelo' : org}
                    disabled={role === 'business'}
                    onChange={(e) => {
                      setOrg(e.target.value);
                      setUnit(directory.units.find((u) => u.organizationId === e.target.value)!.id);
                    }}
                  >
                    {role === 'business' ? (
                      <option value="cuidelo">Cuidelo</option>
                    ) : (
                      directory.organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.shortName}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <Field label="Unidade da sessão">
                  <select
                    value={
                      role === 'manager' ? 'all' : role === 'business' ? 'office' : selectedUnit.id
                    }
                    disabled={role === 'business' || role === 'manager'}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {role === 'manager' ? (
                      <option value="all">Todas as unidades</option>
                    ) : role === 'business' ? (
                      <option value="office">Sem unidade assistencial</option>
                    ) : (
                      unitChoices.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
              </div>
              {role === 'manager' && (
                <p className="access-context-note">
                  A prefeitura acessa todas as unidades da própria rede.
                </p>
              )}
              {role === 'business' && (
                <p className="access-context-note">
                  A equipe Cuidelo acessa a operação comercial, sem prontuários.
                </p>
              )}
              {role === 'clinical' && (
                <Field label="Profissional de demonstração">
                  <select
                    value={selected.sessionId}
                    onChange={(e) => setSecond(e.target.value.endsWith(':2'))}
                  >
                    {identities.map((i) => (
                      <option key={i.sessionId} value={i.sessionId}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </fieldset>
            <div className="access-selection" aria-live="polite">
              <span className="access-selection-icon">
                <Icon size={22} />
              </span>
              <div>
                <strong>{roleNames[role]}</strong>
                <span>{scope}</span>
                <small>{roleInfo.detail}</small>
              </div>
            </div>
            <Button type="submit" className="access-submit" data-session={selected.sessionId}>
              Entrar na demonstração <ArrowRight size={18} />
            </Button>
            <p className="access-disclaimer">
              <Info size={15} />
              <span>
                Acessos predefinidos, sem senha ou autenticação real.
                <br />
                Use apenas dados fictícios. As alterações ficam neste navegador.
              </span>
            </p>
          </form>
          <div className="access-preview-links">
            <span>Explore também</span>
            <Link to="/cidadao">
              <UserRound size={15} /> App do cidadão
            </Link>
            {selectedUnit.kind !== 'central' && (
              <>
                <Link to={'/totem?' + new URLSearchParams({ rede: org, unidade: selectedUnit.id })}>
                  <UserRound size={15} /> Totem
                </Link>
                <Link to={displayRoute(org, selectedUnit.id, true)}>
                  <Monitor size={15} /> Painel da TV
                </Link>
              </>
            )}
          </div>
        </div>
        <footer className="access-entry-footer">
          <span>Cuidelo © {new Date().getFullYear()}</span>
          <span>Desenvolvimento · 0.27</span>
        </footer>
      </section>
    </main>
  );
}
export function WorkspaceHome() {
  const { context, data, summary } = useApp();
  const actions = shortcuts
    .filter((s) => can(context.role, s.permission))
    .sort((a, b) => {
      const priority = (path: string) => {
        const i = stations[context.role].indexOf(path);
        return i < 0 ? 100 : i;
      };
      return priority(a.path) - priority(b.path);
    });
  const primary = actions.find((s) => s.path === stations[context.role][0]) ?? actions[0];
  const central = data.units.find((u) => u.id === context.unitId)?.kind === 'central';
  const metrics = central
    ? [
        ['Lotes cadastrados', data.lots.length],
        [
          'Lotes com material segregado',
          data.lots.filter((l) => (l.segregatedQuantity ?? 0) > 0).length,
        ],
        ['Lotes em atenção', summary.stockAlerts],
      ]
    : context.role === 'pharmacy'
      ? [
          ['Receitas da unidade', data.pharmacyPrescriptions.length],
          ['Dispensações registradas', data.dispensations.length],
          ['Lotes em atenção', summary.stockAlerts],
        ]
      : context.role === 'regulation'
        ? [
            ['Encaminhamentos', data.referrals.length],
            ['Pendentes', summary.pendingReferrals],
            ['Agendamentos de hoje', data.appointments.filter((a) => a.date === dateKey()).length],
          ]
        : [
            ['Chegadas hoje', summary.today],
            ['Aguardando', summary.waiting],
            ['Em cuidado', summary.inCare],
          ];
  return (
    <div className="station-home">
      <PageHeader
        eyebrow={roleNames[context.role]}
        title={data.units.find((u) => u.id === context.unitId)?.name ?? 'Minha unidade'}
        description="Ações e indicadores da sua estação de trabalho."
      />
      {primary && (
        <section className="station-lead">
          <div>
            <span className="station-label">Área principal</span>
            <h2>{primary.title}</h2>
            <p>{primary.detail}</p>
          </div>
          <Link className="button primary" to={primary.path}>
            Abrir {primary.title}
            <ArrowRight size={17} />
          </Link>
        </section>
      )}
      <div className="station-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="catalog-section">
        <div className="section-caption">
          <h2>Outras áreas da unidade</h2>
          <Link to="/modulos">
            Ver catálogo <ChevronRight size={15} />
          </Link>
        </div>
        <div className="catalog-grid">
          {actions
            .filter((s) => s !== primary)
            .map((s) => {
              const Icon = navItems.find((x) => x.path === s.path)?.icon ?? ClipboardList;
              return (
                <Link className="catalog-tile" to={s.path} key={s.path}>
                  <span className="catalog-icon">
                    <Icon size={19} />
                  </span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.detail}</small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
