import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import {
  channelState,
  enableChannel,
  formattedCode,
  normalizeCode,
  onChannelChange,
  receiveChannel,
  stopChannel,
} from '../data/tv-channel';
import { type DisplayFeed } from '../domain/queue';
import { can } from '../domain/model';
import { Button, Field, Panel } from './ui';

export function TVPairing() {
  const { context, repository } = useApp(),
    [state, setState] = useState(() => channelState(context)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const update = () => setState(channelState(context));
    update();
    return onChannelChange(update);
  }, [context]);
  if (context.unitId === 'all' || !(can(context.role, 'queue') || context.role === 'pharmacy'))
    return null;
  const address =
    location.protocol === 'file:' ? 'https://cuidelo.vercel.app/tv' : location.origin + '/tv';
  const link = address + '#' + (state.pair ? formattedCode(state.pair.code) : '');
  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (state.pair) await stopChannel(context);
      else await enableChannel(repository, context);
    } catch (e) {
      setError((e as Error).message + ' Verifique a internet e tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="TV em outro equipamento"
      subtitle="Pareie a TV com esta estação para exibir as chamadas da unidade pela internet."
    >
      <div className="panel-body tv-pair-panel">
        {state.pair ? (
          <>
            <p>
              Na TV, abra <strong>{address.replace(/^https?:\/\//, '')}</strong> e digite o código
              desta unidade.
            </p>
            <strong className="tv-pair-code">{formattedCode(state.pair.code)}</strong>
            <p role="status">
              {state.failed
                ? 'Sem conexão com o painel. A estação tentará novamente.'
                : 'Transmissão ativada. Mantenha o sistema desta unidade aberto neste navegador.'}
            </p>
            <div className="row-actions">
              <a className="button secondary" href={link} target="_blank" rel="noreferrer">
                Abrir TV pareada
              </a>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setError('Link copiado.');
                  } catch {
                    setError('Use o endereço e o código mostrados acima.');
                  }
                }}
              >
                Copiar link da TV
              </Button>
              <Button variant="secondary" disabled={busy} onClick={toggle}>
                Encerrar transmissão
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              A TV recebe apenas senha, destino e horário. A ocupação e os atendimentos ficam na
              estação de origem.
            </p>
            <Button disabled={busy} onClick={toggle}>
              {busy ? 'Conectando…' : 'Gerar código para a TV'}
            </Button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </Panel>
  );
}
export function useRemoteTV(active: boolean, repo: ReturnType<typeof useApp>['repository']) {
  const [code, setCode] = useState(() => {
    if (!active) return '';
    const fragment = location.protocol !== 'file:' ? normalizeCode(location.hash.slice(1)) : '';
    if (/^[A-F0-9]{16}$/.test(fragment)) return fragment;
    try {
      return sessionStorage.getItem('cuidelo.tv.reader') ?? '';
    } catch {
      return '';
    }
  });
  const [feed, setFeed] = useState<DisplayFeed | null>(null),
    [status, setStatus] = useState('');
  useEffect(() => {
    if (!active || !code) return;
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      let ok = false;
      try {
        const f = await receiveChannel(repo, code, controller.signal);
        if (!disposed) {
          setFeed(f);
          setStatus('TV conectada');
          ok = true;
        }
      } catch (e) {
        if (!disposed) {
          setFeed(null);
          setStatus((e as Error).message + ' A TV tentará reconectar automaticamente.');
        }
      }
      if (!disposed) timer = setTimeout(poll, ok ? 2700 : 5000);
    };
    setStatus('Conectando à estação…');
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, code, repo]);
  const pair = (value: string) => {
    const next = normalizeCode(value);
    setFeed(null);
    setStatus('');
    setCode(next);
    try {
      sessionStorage.setItem('cuidelo.tv.reader', next);
      if (location.protocol !== 'file:')
        history.replaceState(null, '', location.pathname + (next ? '#' + formattedCode(next) : ''));
    } catch {
      /* sessão temporária */
    }
  };
  return { code, feed, status, pair };
}
export function TVJoin({
  initial,
  status,
  pair,
}: {
  initial: string;
  status: string;
  pair: (v: string) => void;
}) {
  const [input, setInput] = useState(initial),
    [error, setError] = useState('');
  return (
    <main className="tv-join">
      <section>
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <span className="eyebrow">PAINEL DE SENHAS · DEMONSTRAÇÃO</span>
        <h1>Conectar esta TV</h1>
        <p>
          Na estação, abra <strong>Fila e salas</strong> e escolha{' '}
          <strong>Gerar código para a TV</strong>.
        </p>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!/^[A-F0-9]{16}$/.test(normalizeCode(input))) {
              setError('Digite os 16 caracteres do código.');
              return;
            }
            setError('');
            pair(input);
          }}
        >
          <Field label="Código de pareamento">
            <input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={24}
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          </Field>
          <Button type="submit">Conectar ao painel</Button>
        </form>
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
        <Link to="/acesso">Voltar ao acesso de demonstração</Link>
      </section>
    </main>
  );
}
