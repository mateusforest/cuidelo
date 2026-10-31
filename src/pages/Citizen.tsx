import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  Home,
  MapPin,
  Pill,
  Printer,
  LogOut,
} from 'lucide-react';
import { Button } from '../components/ui';
import { DocumentBody } from '../components/ClinicalDocuments';
import { documentNames } from '../domain/clinical-documents';
import { dateKey, clockTime, shortDate } from '../domain/dates';
import { type CitizenAppointment, type CitizenDocument, type CitizenView } from '../domain/citizen';
import { citizenExamples, readCitizenExample, type ExampleId } from '../data/citizen-examples';
import {
  openCitizenLink,
  parseCitizenLink,
  CitizenLinkError,
  type CitizenLink,
} from '../data/citizen-links';
import { CitizenDaily } from '../components/CitizenDaily';
import '../styles/citizen.css';
import '../styles/citizen-care.css';

type Session = { example: ExampleId } | { link: CitizenLink };
const sessionKey = 'cuidelo.citizen.tab.v1',
  base = '/cidadao';
function previous(): Session | null {
  try {
    const value = sessionStorage.getItem(sessionKey);
    if (value === 'ana' || value === 'joao') return { example: value };
    const link = parseCitizenLink(value ?? '');
    return link ? { link } : null;
  } catch {
    return null;
  }
}
const statusNames = {
  scheduled: 'Agendado',
  'checked-in': 'Chegada confirmada',
  cancelled: 'Cancelado',
};
const docIcons = { prescription: Pill, exams: FlaskConical, certificate: FileText };
const kindNames = { prescription: 'Receitas', exams: 'Exames', certificate: 'Atestados' };
function Appointment({ a }: { a: CitizenAppointment }) {
  return (
    <article className="cit-appt">
      <div className="cit-date">
        <span>
          {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
            .format(new Date(a.date + 'T12:00:00Z'))
            .replace('.', '')}
        </span>
        <strong>{a.date.slice(8)}</strong>
      </div>
      <div>
        <h3>{a.service}</h3>
        <p>
          <Clock3 />
          {shortDate(a.date)} às {a.time} · {a.duration} min
        </p>
        <p>
          <MapPin />
          {a.unit}
        </p>
        <small>{a.professional}</small>
        <span className={'cit-tag ' + (a.status === 'cancelled' ? 'warn' : '')}>
          {statusNames[a.status]}
          {a.rescheduled ? ' · remarcado' : ''}
        </span>
      </div>
    </article>
  );
}
function DocCard({ doc }: { doc: CitizenDocument }) {
  const Icon = docIcons[doc.content.kind];
  return (
    <Link className="cit-doc-card" to={base + '/documentos/' + encodeURIComponent(doc.id)}>
      <span className="cit-icon">
        <Icon />
      </span>
      <div>
        <strong>{documentNames[doc.content.kind]}</strong>
        <small>
          {doc.unit} · {shortDate(doc.issuedAt)}
        </small>
        <small>
          {doc.number}
          {doc.status === 'cancelled' ? ' · Cancelado' : ''}
        </small>
      </div>
      <ChevronRight size={18} />
    </Link>
  );
}
function Pages({ view, path }: { view: CitizenView; path: string }) {
  const [agenda, setAgenda] = useState<'next' | 'past'>('next'),
    [filter, setFilter] = useState('all');
  const [area, id, ...extra] = path.split('/');
  const now = new Date(),
    stamp = dateKey(now) + clockTime(now.toISOString());
  const upcoming = (a: CitizenAppointment) => a.status === 'scheduled' && a.date + a.time >= stamp;
  const next = view.appointments.filter(upcoming);
  const previous = view.appointments.filter((a) => !upcoming(a)).reverse();
  if (area === 'documentos' && id && !extra.length) {
    const doc = view.documents.find((d) => d.id === id);
    if (!doc)
      return (
        <>
          <h1>Documento indisponível</h1>
          <p>Este documento não está na sua lista.</p>
          <Link to={base + '/documentos'}>Voltar aos meus documentos</Link>
        </>
      );
    return (
      <>
        <Link className="cit-back" to={base + '/documentos'}>
          <ArrowLeft /> Meus documentos
        </Link>
        <article className="cit-sheet">
          <span className="cit-kicker">Documento do consultório</span>
          <h1>{documentNames[doc.content.kind]}</h1>
          <strong>{doc.person}</strong>
          <p>
            {doc.unit} · {doc.professional}
          </p>
          <p>
            {doc.number} · {shortDate(doc.issuedAt)} às {clockTime(doc.issuedAt)}
          </p>
          <p className="cit-print-warning">
            Demonstração · sem assinatura digital · sem validade clínica
          </p>
          {doc.status === 'cancelled' ? (
            <p className="cit-notice">Documento cancelado pelo consultório.</p>
          ) : (
            <>
              <DocumentBody content={doc.content} />
              <Button className="cit-print" onClick={() => window.print()}>
                <Printer size={17} /> Imprimir ou salvar PDF
              </Button>
            </>
          )}
        </article>
      </>
    );
  }
  if (area === 'agenda' && !id) {
    const list = agenda === 'next' ? next : previous;
    return (
      <>
        <span className="cit-kicker">Meu cuidado</span>
        <h1>Meus agendamentos</h1>
        <p>Confira a data, o horário e a unidade de cada atendimento.</p>
        <div className="cit-filters">
          {(['next', 'past'] as const).map((k) => (
            <button key={k} aria-pressed={agenda === k} onClick={() => setAgenda(k)}>
              {k === 'next' ? 'Próximos' : 'Histórico'}
            </button>
          ))}
        </div>
        {list.length ? (
          list.map((a) => <Appointment key={a.id} a={a} />)
        ) : (
          <p className="cit-empty">
            {agenda === 'next'
              ? 'Você não tem próximos agendamentos.'
              : 'Nenhum agendamento no histórico.'}
          </p>
        )}
      </>
    );
  }
  if (area === 'documentos' && !id) {
    const docs = view.documents.filter((d) => filter === 'all' || d.content.kind === filter);
    return (
      <>
        <span className="cit-kicker">Do consultório</span>
        <h1>Meus documentos</h1>
        <p>Abra um documento para conferir o conteúdo e a unidade emissora.</p>
        <div className="cit-filters">
          {Object.entries({ all: 'Todos', ...kindNames }).map(([key, label]) => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {docs.length ? (
          docs.map((d) => <DocCard key={d.id} doc={d} />)
        ) : (
          <p className="cit-empty">Nenhum documento disponível nesta seleção.</p>
        )}
      </>
    );
  }
  if (area)
    return (
      <>
        <h1>Página indisponível</h1>
        <Link to={base}>Voltar ao início do cidadão</Link>
      </>
    );
  return (
    <>
      <span className="cit-kicker">Minha saúde</span>
      <h1>Olá, {view.person.split(' ')[0]}</h1>
      <p>Sua agenda e seus documentos de saúde em um só lugar.</p>
      <section className="cit-next">
        <div className="cit-next-title">
          <CalendarDays size={20} />
          <h2>Próximo agendamento</h2>
        </div>
        {next[0] ? <Appointment a={next[0]} /> : <p>Você não tem próximos agendamentos.</p>}
        <Link to={base + '/agenda'}>
          Ver minha agenda <ArrowRight size={16} />
        </Link>
      </section>
      <Link className="care-home" to={base + '/dia-a-dia'}>
        <HeartPulse />
        <span>
          <strong>Meu dia a dia</strong>
          <small>Relatos, medicação e datas da farmácia</small>
        </span>
        <ChevronRight size={18} />
      </Link>
      <div className="cit-section-title">
        <h2>Documentos recentes</h2>
        <Link to={base + '/documentos'}>Ver todos</Link>
      </div>
      {view.documents.length ? (
        view.documents.slice(0, 3).map((d) => <DocCard key={d.id} doc={d} />)
      ) : (
        <p className="cit-empty">Nenhum documento do consultório disponível.</p>
      )}
    </>
  );
}
function Reader({ session, path }: { session: Session; path: string }) {
  const sample = 'example' in session ? session.example : null,
    link = 'link' in session ? session.link : null;
  const example = useMemo(() => (sample ? readCitizenExample(sample) : null), [sample]);
  const [view, setView] = useState<CitizenView | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!link) return;
    let disposed = false,
      busy = false,
      ended = false,
      expiry: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (disposed || busy || ended) return;
      busy = true;
      try {
        const result = await openCitizenLink(link);
        if (disposed || ended) return;
        setView(result.view);
        setError('');
        clearTimeout(expiry);
        expiry = setTimeout(
          () => {
            ended = true;
            setView(null);
            setError('Este link expirou. Solicite outro à equipe.');
          },
          Math.max(0, result.expires - Date.now()),
        );
      } catch (e) {
        if (!disposed) {
          setView(null);
          setError((e as Error).message);
          ended = e instanceof CitizenLinkError && e.unavailable;
        }
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => {
      disposed = true;
      clearTimeout(expiry);
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [link, retry]);
  const data = example ?? view;
  if (!data)
    return (
      <section className="cit-sheet" role="status">
        <h1>{error ? 'Acesso indisponível' : 'Abrindo sua cópia…'}</h1>
        {error && (
          <>
            <p>{error}</p>
            <Button onClick={() => setRetry((x) => x + 1)}>Tentar novamente</Button>
          </>
        )}
      </section>
    );
  return (
    <>
      {data.careScope ? (
        <CitizenDaily
          key={data.careScope.organization + ':' + data.careScope.subject}
          scope={{
            role: 'citizen',
            unit: 'personal',
            organization: data.careScope.organization,
            subject: data.careScope.subject,
          }}
          view={data}
          path={path}
        >
          <Pages view={data} path={path} />
        </CitizenDaily>
      ) : path.split('/')[0] === 'dia-a-dia' ? (
        <section className="cit-sheet">
          <h1>Meu dia a dia</h1>
          <p>
            Esta cópia não possui vínculo com o diário. Peça um novo link à equipe ou explore os
            exemplos de demonstração.
          </p>
        </section>
      ) : (
        <Pages view={data} path={path} />
      )}
      <aside className="cit-source">
        <strong>
          {data.person} · {data.organization}
        </strong>
        <span>
          {example
            ? 'Cenário fictício para explorar o aplicativo.'
            : 'Última cópia enviada em ' +
              shortDate(data.asOf) +
              ' às ' +
              clockTime(data.asOf) +
              '. A unidade atualiza a cópia enquanto a estação está conectada.'}
        </span>
      </aside>
    </>
  );
}
export function Citizen() {
  const loc = useLocation(),
    navigate = useNavigate(),
    path = useParams()['*'] ?? '';
  useEffect(() => {
    const previous = document.title;
    document.title = 'Cuidelo Cidadão · Minha saúde';
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const [session, setSession] = useState<Session | null>(previous),
    [invalid, setInvalid] = useState(false);
  const remember = (s: Session | null) => {
    setSession(s);
    try {
      if (!s) sessionStorage.removeItem(sessionKey);
      else
        sessionStorage.setItem(
          sessionKey,
          'example' in s ? s.example : '#v1.' + s.link.reader + '.' + s.link.key,
        );
    } catch {
      /* A leitura ainda funciona nesta página. */
    }
  };
  useEffect(() => {
    if (!loc.hash) return;
    const link = parseCitizenLink(loc.hash);
    setInvalid(!link);
    remember(link ? { link } : null);
    navigate(base, { replace: true });
  }, [loc.hash, navigate]);
  const active = loc.hash ? null : session;
  const leave = () => {
    remember(null);
    setInvalid(false);
    navigate(base, { replace: true });
  };
  const tabs = [
    { to: '', label: 'Início', Icon: Home },
    { to: 'dia-a-dia', label: 'Dia a dia', Icon: HeartPulse },
    { to: 'agenda', label: 'Agenda', Icon: CalendarDays },
    { to: 'documentos', label: 'Documentos', Icon: FolderOpen },
  ];
  return (
    <div className="cit-app">
      <header className="cit-header">
        <div>
          <img src="/brand/marca.svg" alt="Cuidelo" />
          <span>Cidadão</span>
        </div>
        <div>
          <span className="cit-demo">Demonstração</span>
          {active && (
            <button onClick={leave} aria-label="Sair do app do cidadão">
              <LogOut size={17} /> Sair
            </button>
          )}
        </div>
      </header>
      <main
        className="cit-main"
        key={
          active
            ? 'example' in active
              ? active.example
              : active.link.reader + active.link.key
            : 'entry'
        }
      >
        {loc.hash ? (
          <p role="status">Abrindo link…</p>
        ) : active ? (
          <Reader session={active} path={path} />
        ) : (
          <>
            <section className="cit-welcome">
              <span className="cit-welcome-icon">
                <HeartPulse size={31} />
              </span>
              <span className="cit-kicker">App do cidadão</span>
              <h1>Sua saúde no Cuidelo</h1>
              <p>
                Acompanhe seus agendamentos e consulte os documentos emitidos pela equipe da sua
                unidade.
              </p>
            </section>
            {invalid && (
              <p className="cit-notice" role="alert">
                Este link está incompleto. Peça à equipe o endereço completo.
              </p>
            )}
            <section className="cit-entry">
              <h2>Experimente com dados fictícios</h2>
              <p>
                Escolha um exemplo para conhecer o app. Esta seleção serve apenas para demonstração.
              </p>
              {Object.entries(citizenExamples).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => {
                    setInvalid(false);
                    remember({ example: id as ExampleId });
                    navigate(base, { replace: true });
                  }}
                >
                  <span className="cit-initial">
                    {name
                      .split(' ')
                      .map((x) => x[0])
                      .filter((_, i) => i !== 1)
                      .join('')}
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {id === 'ana'
                        ? 'Agenda e três documentos do consultório'
                        : 'Agenda com consulta de enfermagem'}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </section>
            <aside className="cit-source">
              <strong>Recebeu um link da unidade?</strong>
              <span>
                Abra o endereço enviado pela equipe para ver a cópia disponibilizada para você.
              </span>
            </aside>
          </>
        )}
      </main>
      {active && (
        <nav className="cit-nav" aria-label="Navegação do cidadão">
          {tabs.map(({ to, label, Icon }) => (
            <Link
              key={label}
              to={base + (to ? '/' + to : '')}
              aria-current={(path.split('/')[0] || '') === to ? 'page' : undefined}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
