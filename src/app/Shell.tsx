import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useBlocker } from 'react-router-dom';
import {
  ArrowRightLeft,
  HelpCircle,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronRight,
  Stethoscope,
  MapPin,
  Layers3,
} from 'lucide-react';
import {
  navigation,
  navItems,
  stations,
  resources,
  allowedRoute,
  routeInfo,
  scopeLabel,
} from './navigation';
import { can, roleNames } from '../domain/model';
import { useApp } from './context';
import { Button, Modal, Notice } from '../components/ui';
import { Access } from '../pages/Access';
import { identityFor } from '../domain/access';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (mobileOpen) {
      const dialog = menuRef.current;
      dialog?.showModal();
      return () => {
        dialog?.close();
        triggerRef.current?.focus({ preventScroll: true });
      };
    }
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const media = window.matchMedia('(min-width: 901px)');
    const close = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, [mobileOpen]);
  const pageInfo = routeInfo(location.pathname, context.role),
    current = pageInfo.label;
  const daily = stations[context.role].filter((p) => allowedRoute(context.role, p));
  const groups = [
    {
      group: 'Minha rotina',
      items: daily.map(
        (path) =>
          navItems.find((i) => i.path === path) ?? {
            path,
            label: routeInfo(path).label,
            icon: Layers3,
          },
      ),
    },
    ...navigation.map((group) => ({
      ...group,
      items: group.items.filter(
        (i) =>
          !daily.includes(i.path) &&
          !resources.includes(i.path) &&
          allowedRoute(context.role, i.path),
      ),
    })),
  ];
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
        {groups.map((group) => {
          const items = group.items;
          return (
            items.length > 0 && (
              <div className="nav-group" key={group.group}>
                <p>{group.group}</p>
                {items.map(({ path, label, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    end={path === '/'}
                    className={() =>
                      `nav-item ${location.pathname === path || (pageInfo.parent === path && !daily.includes(location.pathname)) ? 'active' : ''}`
                    }
                  >
                    <Icon size={19} />
                    <span>{scopeLabel(path, label, context.role)}</span>
                  </NavLink>
                ))}
              </div>
            )
          );
        })}
        <details
          className="project-tools"
          key={resources.includes(location.pathname) ? 'project' : 'work'}
          open={resources.includes(location.pathname) || undefined}
        >
          <summary>
            <HelpCircle size={16} />
            Sobre o projeto
            <ChevronRight size={14} />
          </summary>
          {navItems
            .filter((i) => resources.includes(i.path))
            .map(({ path, label, icon: Icon }) => (
              <NavLink
                className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
        </details>
      </nav>
      <div className="sidebar-bottom">
        <button
          className="nav-item help"
          onClick={() => {
            setMobileOpen(false);
            setHelp(true);
          }}
        >
          <HelpCircle size={18} />
          Sobre este ambiente
        </button>
        <span className="version-label">Cuidelo · desenvolvimento 0.25</span>
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
        <dialog
          id="station-menu"
          ref={menuRef}
          className="mobile-menu-dialog"
          aria-label="Menu da estação"
          onCancel={(e) => {
            e.preventDefault();
            setMobileOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <aside className="mobile-sidebar">
            <button
              className="icon-button mobile-close"
              aria-label="Fechar menu"
              autoFocus
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
            {navContent}
          </aside>
        </dialog>
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              ref={triggerRef}
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              aria-haspopup="dialog"
              aria-controls={mobileOpen ? 'station-menu' : undefined}
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
            <button
              className="environment-tag"
              onClick={() => setHelp(true)}
              aria-label="Demonstração · detalhes do ambiente"
            >
              <span />
              Demonstração
            </button>
          </div>
        </header>
        <div className="contextbar">
          <div className="context-selects">
            <MapPin className="context-icon" size={17} aria-hidden="true" />
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
            <NavLink
              aria-label="Trocar sessão de demonstração"
              className="session-switch"
              to="/acesso"
              title="Trocar sessão de demonstração"
            >
              <ArrowRightLeft size={16} />
              <span>Trocar sessão</span>
            </NavLink>
          </div>
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
        <Modal title="Sobre a demonstração" onClose={() => setHelp(false)}>
          <div className="modal-body">
            <p>
              Os dados desta estação são fictícios.{' '}
              {repository.persistent
                ? 'O atendimento é salvo neste navegador.'
                : 'O armazenamento local está indisponível nesta sessão.'}{' '}
              TV pareada, relatórios compartilhados, orientações e avisos usam os serviços online da
              demonstração.
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
              Consulte o mapa de cobertura para ver os módulos em desenvolvimento e as dependências
              da implantação.
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
