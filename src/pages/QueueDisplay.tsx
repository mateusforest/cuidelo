import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Monitor,
  Play,
  RotateCcw,
  CheckCircle2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../app/context';
import { displayRoute, externalRoute, isPortable } from '../app/links';
import { dateKey, clockTime } from '../domain/dates';
import { roomsForUnit, type DisplayFeed, type DisplayCall } from '../domain/queue';
import {
  Button,
  PageHeader,
  Panel,
  Field,
  Notice,
  UnitRequired,
  EmptyState,
  Badge,
} from '../components/ui';
import '../styles/queue-display.css';

function exampleFeed(unitName: string, organizationName: string, sequence: number): DisplayFeed {
  const rooms = ['Consultório 02', 'Sala 01', 'Guichê 01', 'Consultório 01', 'Farmácia'];
  const now = new Date();
  const example = (n: number): DisplayCall => ({
    id: 'example-' + n,
    ticket: `A-${String(n).padStart(3, '0')}`,
    room: rooms[Math.abs(n - 23) % rooms.length],
    direction: 'Corredor principal · lado direito',
    calledAt: new Date(now.getTime() - (sequence - n) * 120000).toISOString(),
  });
  return {
    unitName,
    organizationName,
    current: example(sequence),
    recent: [1, 2, 3, 4].map((n) => example(sequence - n)),
  };
}

function TVCanvas({
  feed,
  preview,
  sound,
}: {
  feed: DisplayFeed;
  preview: boolean;
  sound: boolean;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = feed.current;
  return (
    <div className="tv-canvas" aria-label="Painel de senhas da sala de espera">
      <header className="tv-header">
        <div className="tv-brand">
          <img src="/brand/marca-negativa.svg" alt="Cuidelo" />
          <span className="tv-brand-divider" />
          <div>
            <strong>{feed.unitName}</strong>
            <span>{feed.organizationName}</span>
          </div>
        </div>
        <div className="tv-clock">
          <time>
            {now.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}
          </time>
          <span>
            {now.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone: 'America/Sao_Paulo',
            })}
          </span>
        </div>
      </header>
      <main className="tv-board">
        <section className="tv-current" aria-label="Chamada atual">
          {current ? (
            <div className="tv-call" key={current.id}>
              <div className="tv-eyebrow">
                <span className="tv-live-dot" />
                SENHA CHAMADA
              </div>
              <div className="tv-ticket" data-testid="current-ticket">
                {current.ticket}
              </div>
              <div className="tv-destination">
                <div className="tv-destination-label">POR FAVOR, DIRIJA-SE AO LOCAL</div>
                <div className="tv-room">
                  <strong>{current.room}</strong>
                  <ArrowRight aria-hidden="true" />
                </div>
                <p>{current.direction}</p>
              </div>
            </div>
          ) : (
            <div className="tv-empty">
              <Monitor />
              <span>SEJA BEM-VINDO</span>
              <h1>Aguarde sua senha.</h1>
              <p>A próxima chamada aparecerá aqui.</p>
            </div>
          )}
        </section>
        <aside className="tv-history">
          <div className="tv-history-heading">
            <h2>Últimas chamadas</h2>
            <span>
              SENHA <span>LOCAL</span>
            </span>
          </div>
          <ol>
            {feed.recent.map((call) => (
              <li key={call.id}>
                <strong>{call.ticket}</strong>
                <div>
                  <span>{call.room}</span>
                  <small>{clockTime(call.calledAt)}</small>
                </div>
              </li>
            ))}
          </ol>
          {!feed.recent.length && (
            <p className="tv-history-empty">As chamadas anteriores aparecerão aqui.</p>
          )}
          <div className="tv-history-note">
            <Radio />
            <span>Acompanhe a senha e o local indicados no painel.</span>
          </div>
        </aside>
      </main>
      <footer className="tv-footer">
        <div className="tv-guidance">
          <CheckCircle2 />
          <span>Mantenha sua senha em mãos. Em caso de dúvida, procure a recepção.</span>
        </div>
        <div className="tv-status">
          {sound ? <Volume2 /> : <VolumeX />}
          <span>
            {preview ? 'Prévia visual · dados fictícios' : 'Demonstração local · dados fictícios'}
          </span>
        </div>
      </footer>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {current
          ? `Senha ${current.ticket}. Dirija-se a ${current.room}. ${current.direction}.`
          : 'Aguardando uma chamada.'}
      </span>
    </div>
  );
}

export function QueueDisplay() {
  const { repository, revision } = useApp();
  const [params, setParams] = useSearchParams();
  const organizationId = params.get('rede') ?? 'aurora',
    unitId = params.get('unidade') ?? 'aurora-centro';
  const preview = params.get('previa') === '1';
  const [sequence, setSequence] = useState(23),
    [sound, setSound] = useState(false),
    [full, setFull] = useState(false),
    [message, setMessage] = useState('');
  const [showTools, setShowTools] = useState(true);
  const hideTools = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealTools = () => {
    setShowTools(true);
    clearTimeout(hideTools.current);
    hideTools.current = setTimeout(() => setShowTools(false), 4500);
  };
  useEffect(() => {
    hideTools.current = setTimeout(() => setShowTools(false), 6500);
    return () => clearTimeout(hideTools.current);
  }, []);
  const audio = useRef<AudioContext | null>(null),
    lastSound = useRef('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      repository.refresh();
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(timer);
  }, [repository]);
  useEffect(() => {
    const update = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  let feed: DisplayFeed | null = null;
  try {
    feed = repository.display(organizationId, unitId);
  } catch {
    /* Invalid scope is shown below. */
  }
  if (feed && preview) feed = exampleFeed(feed.unitName, feed.organizationName, sequence);
  const current = feed?.current;
  const playCall = (call: DisplayCall) => {
    const ctx = audio.current;
    if (ctx && ctx.state === 'running') {
      [660, 880].forEach((frequency, index) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          start = ctx.currentTime + index * 0.22;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    }
    if ('speechSynthesis' in window) {
      const phrase = new SpeechSynthesisUtterance(
        `Senha ${call.ticket.replace('-', ' ')}. Dirija-se a ${call.room}.`,
      );
      phrase.lang = 'pt-BR';
      phrase.rate = 0.88;
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.lang.toLowerCase() === 'pt-br');
      if (voice) phrase.voice = voice;
      phrase.onerror = () =>
        setMessage('A voz não está disponível neste navegador. O aviso visual continua ativo.');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(phrase);
    }
  };
  useEffect(() => {
    if (sound && current && lastSound.current !== current.id) {
      lastSound.current = current.id;
      playCall(current);
    }
  }, [current?.id, sound, revision, tick]);
  useEffect(
    () => () => {
      audio.current?.close().catch(() => {});
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );
  const toggleSound = async () => {
    if (sound) {
      setSound(false);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      lastSound.current = '';
      setSound(true);
      setMessage('Som ativado. A voz depende das vozes instaladas no navegador.');
    } catch {
      setMessage('O navegador não liberou o áudio. A chamada permanece visível na tela.');
    }
  };
  if (!feed)
    return (
      <div className="app-error">
        <h1>Painel não encontrado nesta rede</h1>
        <Link to="/senhas" className="button primary">
          Voltar às senhas
        </Link>
      </div>
    );
  return (
    <div
      className={`tv-page ${showTools ? 'show-tools' : ''}`}
      onPointerMove={revealTools}
      onKeyDown={revealTools}
    >
      <TVCanvas feed={feed} preview={preview} sound={sound} />
      <nav className="tv-tools" aria-label="Controles da demonstração da TV">
        <Link to="/senhas">
          <ArrowLeft />
          Recepção
        </Link>
        {preview ? (
          <button onClick={() => setSequence((n) => n + 1)}>
            <Play />
            Simular chamada
          </button>
        ) : null}
        <button
          onClick={() => {
            const next = new URLSearchParams(params);
            if (preview) next.delete('previa');
            else next.set('previa', '1');
            setParams(next);
          }}
        >
          {preview ? 'Ver chamadas da recepção' : 'Ver chamada de exemplo'}
        </button>
        <button onClick={toggleSound} aria-pressed={sound}>
          {sound ? <VolumeX /> : <Volume2 />}
          {sound ? 'Desativar som' : 'Ativar som'}
        </button>
        <button
          onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else await document.documentElement.requestFullscreen();
            } catch {
              setMessage('Use F11 no navegador para ampliar esta tela.');
            }
          }}
        >
          {full ? <Minimize2 /> : <Maximize2 />}
          {full ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
      </nav>
      {message && (
        <button className="tv-message" onClick={() => setMessage('')}>
          {message} <span>Fechar</span>
        </button>
      )}
    </div>
  );
}

export function QueueControl() {
  const { data, context, repository, revision, notify } = useApp();
  const [room, setRoom] = useState('consultorio-2'),
    [busy, setBusy] = useState('');
  const unit = data.units.find((u) => u.id === context.unitId),
    fallback = unit ?? data.units[0];
  const rooms = unit ? roomsForUnit(unit) : [];
  const feed = unit ? repository.display(context.organizationId, unit.id) : null;
  const calls = data.encounters
    .filter((e) => e.status !== 'completed' && dateKey(new Date(e.arrivedAt)) === dateKey())
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  const openTV = (preview = false) =>
    externalRoute(displayRoute(context.organizationId, fallback.id, preview));
  const call = async (id: string) => {
    setBusy(id);
    try {
      await repository.execute(
        context,
        { type: 'queue.call', encounterId: id, roomId: room },
        revision,
      );
      notify('Senha chamada no painel desta unidade.');
    } catch (error) {
      notify((error as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="SALA DE ESPERA"
        title="Painel de senhas"
        description="Escolha o local e chame a senha. A TV mostra o número e o caminho até a sala."
        action={
          <a className="button primary" href={openTV(true)} target="_blank" rel="noreferrer">
            <Monitor size={18} />
            Ver prévia da TV
            <ExternalLink size={16} />
          </a>
        }
      />
      <div className="queue-presentation">
        <div>
          <span className="eyebrow">FEITO PARA SER VISTO DE LONGE</span>
          <h2>
            Uma chamada clara.
            <br />
            Um caminho simples.
          </h2>
          <p>
            Senha em destaque, sala de destino, últimas chamadas e som opcional. A identificação da
            pessoa fica na recepção.
          </p>
          <a className="button secondary" href={openTV(true)} target="_blank" rel="noreferrer">
            Conhecer a tela da TV
            <ArrowRight size={16} />
          </a>
        </div>
        <a
          href={openTV(true)}
          target="_blank"
          rel="noreferrer"
          className="tv-mini"
          aria-label="Abrir prévia visual da TV"
        >
          <div className="tv-mini-top">
            <img src="/brand/marca-negativa.svg" alt="Cuidelo" />
            <span>{fallback.name}</span>
          </div>
          <div className="tv-mini-body">
            <div>
              <span>SENHA CHAMADA</span>
              <strong>A-023</strong>
              <p>
                Consultório 02 <ArrowRight size={20} />
              </p>
            </div>
            <aside>
              <span>Últimas chamadas</span>
              <b>A-022</b>
              <b>A-021</b>
              <b>A-020</b>
            </aside>
          </div>
        </a>
      </div>
      <UnitRequired>
        <Notice>
          {isPortable()
            ? 'Para testar a ligação, abra a TV pelo botão abaixo e mantenha as duas janelas deste mesmo arquivo no mesmo navegador. '
            : 'A TV e a recepção se atualizam neste navegador. '}
          Esta demonstração não conecta computadores ou TVs de outros dispositivos. A conexão real
          entre dispositivos será implementada com o servidor.
        </Notice>
        <div className="queue-workspace">
          <Panel title="Chamada da unidade" subtitle={unit?.name}>
            <div className="queue-console">
              <Field label="Local para chamar a próxima senha">
                <select value={room} onChange={(e) => setRoom(e.target.value)}>
                  {rooms.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="queue-current-control">
                <span>Última senha chamada</span>
                <strong>{feed?.current?.ticket ?? '—'}</strong>
                <p>{feed?.current?.room ?? 'Nenhuma chamada registrada hoje.'}</p>
              </div>
              <div className="queue-console-actions">
                <Button
                  variant="secondary"
                  disabled={!feed?.current || Boolean(busy)}
                  onClick={async () => {
                    if (!feed?.current) return;
                    setBusy('recall');
                    try {
                      await repository.execute(context, {
                        type: 'queue.recall',
                        callId: feed.current.id,
                      });
                      notify('Senha chamada novamente.');
                    } catch (e) {
                      notify((e as Error).message, 'error');
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  <RotateCcw size={16} />
                  Chamar novamente
                </Button>
                <a className="button primary" href={openTV()} target="_blank" rel="noreferrer">
                  <Monitor size={17} />
                  Abrir TV desta unidade
                  <ExternalLink size={14} />
                </a>
              </div>
              <p className="queue-hint">
                As salas e orientações são exemplos. Chamar a senha não inicia nem conclui o
                registro clínico.
              </p>
            </div>
          </Panel>
          <Panel
            title="Senhas disponíveis"
            subtitle="A equipe escolhe a chamada conforme o fluxo do serviço."
          >
            <div className="table-scroll">
              <table className="queue-tickets-table">
                <thead>
                  <tr>
                    <th>Senha / pessoa</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ação</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((e) => {
                    const p = data.patients.find((p) => p.id === e.patientId);
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong className="queue-ticket-small">{e.ticket}</strong>
                          <small className="cell-secondary">{p?.socialName || p?.name}</small>
                          <span className="queue-mobile-status">
                            {e.status === 'waiting'
                              ? 'Em espera'
                              : e.status === 'observation'
                                ? 'Em observação'
                                : 'Em atendimento'}
                          </span>
                        </td>
                        <td>
                          <Badge tone={e.status === 'waiting' ? 'amber' : 'blue'}>
                            {e.status === 'waiting'
                              ? 'Em espera'
                              : e.status === 'observation'
                                ? 'Em observação'
                                : 'Em atendimento'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            disabled={Boolean(busy)}
                            onClick={() => call(e.id)}
                            aria-label={`Chamar senha ${e.ticket}`}
                          >
                            Chamar
                            <Volume2 size={15} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!calls.length && (
              <EmptyState
                title="Nenhuma senha para chamar"
                description="Registre uma chegada na recepção para emitir uma senha."
                action={
                  <Link className="button secondary" to="/recepcao">
                    Ir à recepção
                  </Link>
                }
              />
            )}
          </Panel>
        </div>
      </UnitRequired>
    </>
  );
}
