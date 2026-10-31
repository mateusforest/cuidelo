import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useBlocker } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  BedDouble,
  Pill,
  ArrowRightLeft,
  Building2,
  ShieldCheck,
  Workflow,
  Cable,
  HelpCircle,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronRight,
  Stethoscope,
  Monitor,
  SearchCheck,
  HeartPulse,
  Syringe,
  Package,
} from 'lucide-react';
import { can, roleNames, type Permission } from '../domain/model';
import { useApp } from './context';
import { Button, Modal, Notice } from '../components/ui';
import { Access } from '../pages/Access';
import { identityFor } from '../domain/access';

const navigation = [
  {
    group: 'Acompanhar',
    items: [
      { path: '/', label: 'Início', icon: LayoutDashboard },
      { path: '/modulos', label: 'Módulos e acompanhamentos', icon: Workflow },
    ],
  },
  {
    group: 'Assistência',
    items: [
      {
        path: '/recepcao',
        label: 'Recepção e atendimento',
        icon: ClipboardList,
        permission: 'queue',
      },
      { path: '/fila', label: 'Fila e salas', icon: Users, permission: 'queue' },
      { path: '/agenda', label: 'Agenda', icon: CalendarDays, permission: 'schedule' },
      { path: '/vacinacao', label: 'Sala de vacinação', icon: Syringe, permission: 'vaccination' },
      {
        path: '/escuta',
        label: 'Escuta e sinais vitais',
        icon: HeartPulse,
        permission: 'clinical',
      },
      { path: '/exames', label: 'Exames e resultados', icon: Stethoscope, permission: 'clinical' },
      { path: '/consultorio', label: 'Meu consultório', icon: Stethoscope, permission: 'clinical' },
      { path: '/senhas', label: 'Painel de senhas', icon: Monitor, permission: 'queue' },
      {
        path: '/pessoas',
        label: 'Pessoas e prontuários',
        icon: Users,
        permission: 'patients.read',
      },
      { path: '/hospital', label: 'Internação e leitos', icon: BedDouble, permission: 'beds' },
    ],
  },
  {
    group: 'Operação',
    items: [
      { path: '/farmacia', label: 'Farmácia e estoque', icon: Pill, permission: 'stock' },
      {
        path: '/vacinas-estoque',
        label: 'Lotes de vacinas',
        icon: Package,
        permission: 'vaccine.stock',
      },
      { path: '/regulacao', label: 'Regulação', icon: ArrowRightLeft, permission: 'regulation' },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { path: '/unidades', label: 'Unidades da rede', icon: Building2, permission: 'network' },
      { path: '/vacinacao-rede', label: 'Vacinação da rede', icon: Syringe, permission: 'manage' },
      {
        path: '/auditoria',
        label: 'Histórico de operações',
        icon: ShieldCheck,
        permission: 'manage',
      },
      {
        path: '/desempenho',
        label: 'Tempos e desempenho',
        icon: LayoutDashboard,
        permission: 'performance',
      },
      { path: '/dispositivos', label: 'Totem e TV', icon: Monitor, permission: 'devices' },
      { path: '/integracoes', label: 'Integrações', icon: Cable },
      { path: '/desenvolvimento', label: 'Plano de entrega', icon: Workflow },
      { path: '/comparacao', label: 'Comparar com Pulso', icon: SearchCheck },
    ],
  },
];
export function Shell() {
  const { context, changeContext, data, repository, toast, dirty, setDirty, demoEntered } =
    useApp();
  const location = useLocation(),
    navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false),
    [help, setHelp] = useState(false),
    [search, setSearch] = useState('');
  const blocker = useBlocker(dirty);
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, demoEntered]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  const current =
    navigation.flatMap((g) => g.items).find((i) => i.path === location.pathname)?.label ??
    (location.pathname.startsWith('/escuta/')
      ? 'Escuta e sinais vitais'
      : location.pathname.startsWith('/modulos/')
        ? 'Módulos e acompanhamentos'
        : location.pathname.startsWith('/paineis/')
          ? 'Acompanhamento'
          : location.pathname.startsWith('/atendimento/')
            ? 'Atendimento'
            : 'Pessoas e prontuários');
  const org = data.organizations.find((o) => o.id === context.organizationId);
  const identity = identityFor(repository.directory(), context);
  if (!demoEntered) return <Access resume={location.pathname !== '/'} />;
  const navContent = (
    <>
      <a
        className="brand-lockup"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
        aria-label="Cuidelo, início"
      >
        <img src="/brand/marca-negativa.svg" alt="Cuidelo" />
        <span>SAÚDE CONECTADA</span>
      </a>
      <div className="sidebar-divider" />
      <nav aria-label="Navegação principal">
        {navigation.map((group) => {
          const items = group.items.filter(
            (item) => !('permission' in item) || can(context.role, item.permission as Permission),
          );
          return (
            items.length > 0 && (
              <div className="nav-group" key={group.group}>
                <p>{group.group}</p>
                {items.map(({ path, label, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            )
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="brand-promise">
          Toda a rede.
          <br />
          <strong>Mais perto das pessoas.</strong>
        </div>
        <button className="nav-item help" onClick={() => setHelp(true)}>
          <HelpCircle size={18} />
          Sobre este ambiente
        </button>
        <span className="version-label">Cuidelo · desenvolvimento 0.14</span>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <aside className="sidebar">{navContent}</aside>
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}>
          <aside className="mobile-sidebar" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-button mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
            {navContent}
          </aside>
        </div>
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>{context.role === 'business' ? 'Cuidelo' : org?.shortName}</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-right">
            {can(context.role, 'patients.read') && (
              <form
                className="global-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/pessoas?q=${encodeURIComponent(search)}`);
                  setSearch('');
                }}
              >
                <Search size={17} />
                <input
                  aria-label="Buscar pessoa na rede"
                  placeholder="Buscar pessoa na rede"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </form>
            )}
            <span className="environment-tag">
              <span />
              Demonstração
            </span>
          </div>
        </header>
        <div className="contextbar">
          <div className="context-selects">
            <div>
              <small>
                {context.role === 'business' ? 'Empresa' : 'Prefeitura / rede vinculada'}
              </small>
              <strong>{context.role === 'business' ? 'Cuidelo' : org?.shortName}</strong>
            </div>
            {context.role === 'manager' ? (
              <label>
                <span>Unidades da sua rede</span>
                <select
                  aria-label="Unidade ativa"
                  value={context.unitId}
                  onChange={(e) => changeContext({ unitId: e.target.value })}
                >
                  <option value="all">Todas as unidades</option>
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <small>
                  {context.role === 'business' ? 'Área vinculada' : 'Unidade vinculada'}
                </small>
                <strong>
                  {context.role === 'business'
                    ? 'Operação comercial'
                    : data.units.find((u) => u.id === context.unitId)?.name}
                </strong>
              </div>
            )}
          </div>
          <div className="session-summary">
            <span className="session-avatar">
              <Stethoscope size={18} />
            </span>
            <div className="session-person">
              <strong>{roleNames[context.role]}</strong>
              <small>{identity.name}</small>
            </div>
            <NavLink className="session-switch" to="/acesso" title="Trocar sessão de demonstração">
              <ArrowRightLeft size={16} />
              <span>Trocar sessão de demonstração</span>
            </NavLink>
          </div>
        </div>
        <div className="demo-strip">
          <span>Dados fictícios para desenvolvimento.</span>{' '}
          {repository.persistent
            ? 'Alterações salvas somente neste navegador.'
            : 'Sessão temporária; alterações não persistem ao fechar.'}
          <button onClick={() => setHelp(true)}>
            Entender o ambiente
            <ChevronRight size={13} />
          </button>
        </div>
        <main id="main-content" tabIndex={-1} className="main-content">
          {repository.recoveryMessage && <Notice tone="amber">{repository.recoveryMessage}</Notice>}
          <Outlet key={`${context.sessionId}:${context.unitId}`} />
        </main>
        <footer className="app-footer">
          <span>Cuidelo · Toda a rede. Mais perto das pessoas.</span>
          <span>Uso demonstrativo · sem integrações clínicas ativas</span>
        </footer>
      </div>
      {toast && (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {toast.kind === 'success' ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
          <span>{toast.message}</span>
        </div>
      )}
      {help && (
        <Modal title="Um ambiente para construir juntos" onClose={() => setHelp(false)}>
          <div className="modal-body">
            <p>
              Esta é a primeira base de desenvolvimento da Cuidelo. Os nomes, pessoas, unidades e
              registros apresentados são fictícios.
            </p>
            <p>
              Você pode testar os fluxos e alternar entre redes e perfis. A entrada por sessões de
              demonstração serve para testar os acessos; ela ainda não é uma autenticação.
            </p>
            <Notice>
              Esta versão não deve receber dados reais nem ser usada para atendimento. Não há
              conexão com Supabase, SUS, assinatura digital ou sistemas hospitalares.
            </Notice>
            <p>
              O escopo de lançamento continua abrangendo toda a rede pública. O plano de entrega
              acompanha o que já foi construído e o que ainda precisa de implementação e validação.
            </p>
          </div>
          <div className="modal-actions">
            <Button
              onClick={() => {
                setHelp(false);
                navigate('/desenvolvimento');
              }}
            >
              Ver plano de entrega
            </Button>
          </div>
        </Modal>
      )}
      {blocker.state === 'blocked' && (
        <Modal title="Salvar seu rascunho primeiro?" onClose={() => blocker.reset()}>
          <div className="modal-body">
            <p>
              Há alterações ainda não salvas neste atendimento. Volte para salvar ou descarte o
              rascunho antes de sair.
            </p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => blocker.reset()}>
              Continuar editando
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDirty(false);
                blocker.proceed();
              }}
            >
              Descartar e sair
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
