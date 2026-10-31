import { useEffect, useRef, useState } from 'react';
import { Button, Field } from './ui';
import { useApp } from '../app/context';
import type { ReportReview } from '../domain/model';
import { guidanceNoticeScope } from '../data/device-push';
import type { CitizenLink } from '../data/citizen-links';
import type { CitizenView } from '../domain/citizen';
import { careKey, type CareScope } from '../domain/citizen-care';
import type { PatientGuidance } from '../domain/report-review';
import { shortDate } from '../domain/dates';
import { guidanceInbox } from '../data/citizen-care';
import {
  recordReview,
  recordGuidance,
  sendGuidance,
  syncGuidance,
  confirmGuidanceRead,
  syncReadReceipts,
  type RevisionChange,
} from '../data/report-guidance';

const stamp = (s: string) => new Date(s).toLocaleString('pt-BR');
export function ReviewHistory({
  rows,
  retry,
  busy,
  actorId,
}: {
  rows: ReportReview[];
  actorId?: string;
  retry?: (r: ReportReview, id: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="report-history">
      {[...rows].reverse().map((r) => (
        <article className="care-inset" key={r.id}>
          <strong>Relatório do Dia a dia revisado</strong>
          <p>
            Período de {shortDate(r.from)} a {shortDate(r.to)} · revisão em {stamp(r.reviewedAt)}
          </p>
          <small>
            {r.author} · {r.unit}
          </small>
          {r.messages.map((m) => (
            <div key={m.id}>
              <strong>Orientação ao cidadão</strong>
              <p className="guidance-text">{m.text}</p>
              <small>
                {m.sentAt
                  ? 'Envio confirmado em ' + stamp(m.sentAt)
                  : 'Registrada no prontuário · envio sem confirmação'}
              </small>
              {m.sentAt && (
                <p>
                  <small>
                    {m.readAt
                      ? 'Leitura confirmada em ' + stamp(m.readAt)
                      : 'Aguardando confirmação de leitura'}
                  </small>
                </p>
              )}
              {!m.sentAt && retry && r.actorId === actorId && (
                <Button variant="secondary" disabled={busy} onClick={() => retry(r, m.id)}>
                  Tentar enviar novamente
                </Button>
              )}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
export function ClinicalFollowUp({
  encounterId,
  refId,
  code,
  canReply,
  changed,
}: {
  encounterId: string;
  refId?: string;
  code: string;
  canReply: boolean;
  changed: RevisionChange;
}) {
  const { repository, context, data } = useApp(),
    e = data.encounters.find((e) => e.id === encounterId);
  const rows = data.reportReviews.filter((r) => r.encounterId === encounterId);
  const review = rows.find((r) => r.reportRef === refId && r.actorId === context.sessionId);
  const [text, setText] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const revisionCallback = useRef(changed);
  revisionCallback.current = changed;
  const waiting = rows.some((r) => r.messages.some((m) => m.sentAt && !m.readAt));
  const [receiptError, setReceiptError] = useState('');
  useEffect(() => {
    if (!waiting) return;
    let live = true,
      running = false;
    const refresh = async () => {
      if (!live || running) return;
      running = true;
      try {
        await syncReadReceipts(repository, context, encounterId, (a, b) => {
          if (live) revisionCallback.current(a, b);
        });
        if (live) setReceiptError('');
      } catch {
        if (live)
          setReceiptError('Sem atualização das confirmações de leitura. Tentando novamente.');
      } finally {
        running = false;
      }
    };
    void refresh();
    const t = setInterval(refresh, 6000);
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener('focus', refresh);
    };
  }, [waiting, repository, context, encounterId]);
  const lock = useRef(false),
    request = useRef(crypto.randomUUID());
  const lastRef = useRef(refId);
  useEffect(() => {
    if (refId && refId !== lastRef.current) {
      setText('');
      request.current = crypto.randomUUID();
      setStatus('');
      lastRef.current = refId;
    }
  }, [refId]);
  const act = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const deliver = async (r: ReportReview, id: string) => {
    try {
      await sendGuidance(repository, context, r.id, id, changed);
      setStatus('Envio confirmado para o app do cidadão.');
    } catch (err) {
      setStatus('Orientação salva no prontuário. Envio sem confirmação. ' + (err as Error).message);
    }
  };
  if (!rows.length && !refId) return null;
  return (
    <section className="clinical-followup">
      {refId &&
        (e?.professionalId !== context.sessionId ? (
          <p>
            O médico responsável pelo atendimento pode registrar a revisão. Se a pessoa ainda
            estiver na fila, registre a entrada no consultório.
          </p>
        ) : !review ? (
          <Button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await recordReview(repository, context, encounterId, code, changed);
                setStatus('Revisão registrada no prontuário.');
              })
            }
          >
            Registrar revisão no prontuário
          </Button>
        ) : !canReply ? (
          <p>Peça à pessoa um novo código de compartilhamento para enviar orientações.</p>
        ) : (
          <form
            className="care-form"
            onSubmit={(ev) => {
              ev.preventDefault();
              void act(async () => {
                const id = await recordGuidance(
                  repository,
                  context,
                  review.id,
                  code,
                  request.current,
                  text,
                  changed,
                );
                setText('');
                request.current = crypto.randomUUID();
                await deliver(review, id);
              });
            }}
          >
            <Field label="Orientação para a pessoa">
              <textarea
                rows={3}
                disabled={busy}
                value={text}
                maxLength={3000}
                required
                onChange={(ev) => setText(ev.target.value)}
                placeholder="Escreva o texto que será mostrado no app do cidadão."
              />
            </Field>
            <Button disabled={busy || !text.trim()} type="submit">
              Registrar e enviar orientação
            </Button>
          </form>
        ))}
      {status && <p role="status">{status}</p>}
      {waiting && receiptError && <p role="status">{receiptError}</p>}
      {!!rows.length && (
        <>
          <h3>Registro no prontuário</h3>
          <ReviewHistory
            rows={rows}
            busy={busy}
            actorId={context.sessionId}
            retry={(r, id) => void act(() => deliver(r, id))}
          />
        </>
      )}
    </section>
  );
}
export function CitizenGuidance({
  scope,
  view,
  link,
  target,
  channel,
  notifications,
}: {
  scope: CareScope;
  view?: CitizenView;
  link?: CitizenLink;
  target?: string;
  channel?: string;
  notifications?: React.ReactNode;
}) {
  const [ack, setAck] = useState<Record<string, string>>({}),
    [sending, setSending] = useState(''),
    [ackError, setAckError] = useState('');
  const confirm = async (m: PatientGuidance) => {
    setSending(m.id);
    setAckError('');
    try {
      if (channel && careKey(await guidanceNoticeScope(channel)) !== careKey(scope))
        throw Error('Acesso ao aviso indisponível.');
      const at = await confirmGuidanceRead(scope, m, link);
      setAck((v) => ({ ...v, [m.id]: at }));
    } catch (e) {
      setAckError((e as Error).message);
    } finally {
      setSending('');
    }
  };
  const [rows, setRows] = useState<PatientGuidance[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [tick, refresh] = useState(0);
  const key = careKey(scope);
  useEffect(() => {
    let live = true,
      running = false;
    const cached = async () => {
      const box = await guidanceInbox(scope);
      if (live) {
        setRows(box.messages);
        setAck((v) => ({ ...v, ...box.acknowledged }));
      }
    };
    const update = async () => {
      if (running) return;
      running = true;
      try {
        await cached();
        await syncGuidance(scope);
        if (live) setError('');
        await cached();
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        running = false;
        if (live) setLoading(false);
      }
    };
    void update();
    const timer = setInterval(update, 8000);
    window.addEventListener('online', update);
    window.addEventListener('focus', update);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('focus', update);
    };
  }, [key, tick]);
  const messages = [...new Map([...(view?.guidance ?? []), ...rows].map((m) => [m.id, m])).values()]
    .filter((m) => !target || target === m.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="cit-sheet">
      <span className="cit-kicker">Retorno da consulta</span>
      <h2>{target ? 'Orientação da equipe' : 'Orientações da equipe'}</h2>
      {notifications}
      {ackError && <p role="alert">{ackError}</p>}
      <p>
        Confira as orientações recebidas sobre seu relatório, com a data e a unidade do atendimento.
      </p>
      {error && (
        <p className="cit-notice" role="status">
          {error}
        </p>
      )}
      {messages.length ? (
        <div className="report-history">
          {messages.map((m) => (
            <article className="care-inset" key={m.id}>
              <strong>{m.author}</strong>
              <p>
                {m.unit} · {stamp(m.at)}
              </p>
              <p className="guidance-text">{m.text}</p>
              <small>
                Relatório de {shortDate(m.from)} a {shortDate(m.to)}
              </small>
              {ack[m.id] || m.readAt ? (
                <p role="status">Leitura confirmada em {stamp(ack[m.id] ?? m.readAt!)}</p>
              ) : (
                <Button disabled={!!sending} onClick={() => confirm(m)}>
                  {sending === m.id ? 'Confirmando…' : 'Confirmar que li'}
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p>
          {loading
            ? 'Buscando orientações…'
            : error
              ? 'Nenhuma orientação salva neste aparelho.'
              : 'Nenhuma orientação recebida.'}
        </p>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          setLoading(true);
          refresh((t) => t + 1);
        }}
        disabled={loading}
      >
        Atualizar orientações
      </Button>
    </section>
  );
}

export function GuidanceNoticeEntry({ channel, id }: { channel: string; id: string }) {
  const [scope, setScope] = useState<CareScope | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) {
      setError('Aviso inválido.');
      return;
    }
    const resolve = () => {
      void guidanceNoticeScope(channel)
        .then((s) => {
          if (live) {
            setScope(s);
            setError('');
          }
        })
        .catch((e) => {
          if (live) {
            setScope(null);
            setError((e as Error).message);
          }
        });
    };
    resolve();
    window.addEventListener('storage', resolve);
    window.addEventListener('focus', resolve);
    return () => {
      live = false;
      window.removeEventListener('storage', resolve);
      window.removeEventListener('focus', resolve);
    };
  }, [channel, id]);
  return scope ? (
    <CitizenGuidance scope={scope} target={id} channel={channel} />
  ) : (
    <p role="status">{error || 'Abrindo a orientação…'}</p>
  );
}
