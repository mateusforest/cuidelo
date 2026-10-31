import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, HeartPulse, Plus } from 'lucide-react';
import { Button, Field } from './ui';
import type { CitizenView } from '../domain/citizen';
import {
  available,
  effectiveTaken,
  careKey,
  dueReminders,
  kinds,
  levels,
  localDay,
  localStamp,
  milestoneNames,
  onDay,
  reminders,
  type CareCommand,
  type CarePlan,
  type CareScope,
  type Diary,
  type Milestone,
} from '../domain/citizen-care';
import { shortDate } from '../domain/dates';
import { readDiary, watchDiary, writeDiary } from '../data/citizen-care';
import { careCalendar } from '../domain/care-calendar';
import {
  subscribePhone,
  syncDevice,
  schedulePushTest,
  pushState,
  type PushState,
} from '../data/device-push';
import { CareReport } from './CareReport';

const url = '/cidadao/dia-a-dia';
type Submit = (cmd: CareCommand) => Promise<boolean>;
const get = (f: FormData, k: string) => String(f.get(k) ?? '');
function Conditions({ d }: { d: Diary }) {
  return (
    <datalist id="care-conditions">
      {d.conditions.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}
function Journal({ d, run, busy, now }: { d: Diary; run: Submit; busy: boolean; now: Date }) {
  const record = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      f = new FormData(form);
    if (
      await run({
        type: 'entry',
        kind: get(f, 'kind') as keyof typeof kinds,
        at: get(f, 'at'),
        condition: get(f, 'condition'),
        intensity: get(f, 'level'),
        duration: get(f, 'duration'),
        text: get(f, 'text'),
      })
    )
      form.reset();
  };
  return (
    <>
      <section className="cit-sheet">
        <h2>Registrar como me senti</h2>
        <p>Conte com suas palavras. O registro fica no diário pessoal deste aparelho.</p>
        <form onSubmit={record} className="care-form">
          <Field label="Tipo de relato">
            <select name="kind">
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quando aconteceu">
            <input
              name="at"
              type="datetime-local"
              defaultValue={localStamp(now)}
              max={localStamp(now)}
              required
            />
          </Field>
          <Field label="Condição relacionada (opcional)">
            <input
              name="condition"
              list="care-conditions"
              placeholder="Ex.: ansiedade"
              maxLength={100}
            />
          </Field>
          <div className="care-two">
            <Field label="Intensidade percebida">
              <select name="level">
                <option value="">Não informar</option>
                {levels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Duração em minutos">
              <input type="number" min="1" max="9999" name="duration" placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Meu relato">
            <textarea
              name="text"
              required
              maxLength={1200}
              rows={3}
              placeholder="O que você percebeu nesse momento?"
            />
          </Field>
          <Button disabled={busy} type="submit">
            Salvar relato
          </Button>
        </form>
      </section>
      <section className="cit-sheet">
        <h2>Condições que acompanho</h2>
        <p>
          {d.conditions.length
            ? d.conditions.join(' · ')
            : 'Você pode incluir uma condição mesmo sem registrar uma crise.'}
        </p>
        <form
          className="care-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (await run({ type: 'condition', name: get(new FormData(form), 'name') }))
              form.reset();
          }}
        >
          <Field label="Nome da condição">
            <input name="name" required maxLength={100} placeholder="Ex.: esclerose múltipla" />
          </Field>
          <Button variant="secondary" disabled={busy}>
            Adicionar condição
          </Button>
        </form>
      </section>
      <section className="cit-sheet">
        <h2>Últimos relatos</h2>
        {d.entries.length ? (
          <ol className="care-timeline">
            {[...d.entries]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 10)
              .map((e) => (
                <li key={e.id}>
                  <small>
                    {shortDate(e.at.slice(0, 10))} · {e.at.slice(11)}
                  </small>
                  <strong>
                    {kinds[e.kind]}
                    {e.condition ? ' · ' + e.condition : ''}
                  </strong>
                  <p>
                    {[e.intensity, e.duration ? e.duration + ' min' : '', e.text]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              ))}
          </ol>
        ) : (
          <p>Seu primeiro relato aparecerá aqui.</p>
        )}
      </section>
    </>
  );
}
function PlanForm({
  view,
  now,
  run,
  busy,
  done,
}: {
  view: CitizenView;
  now: Date;
  run: Submit;
  busy: boolean;
  done: () => void;
}) {
  const options = view.documents.flatMap((doc) =>
    doc.status === 'issued' && doc.content.kind === 'prescription'
      ? doc.content.items.map((item) => ({
          docId: doc.id,
          itemId: item.id,
          name: item.medicine,
          number: doc.number,
        }))
      : [],
  );
  const [choice, choose] = useState('');
  const chosen =
    choice === '' ? undefined : options.find((o) => o.docId + '|' + o.itemId === choice);
  return (
    <form
      className="cit-sheet care-form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        if (
          await run({
            type: 'plan',
            medicine: chosen?.name ?? get(f, 'name'),
            condition: get(f, 'condition'),
            times: get(f, 'times')
              .trim()
              .split(/[\s,;]+/)
              .filter(Boolean),
            start: get(f, 'start'),
            end: get(f, 'end'),
            pickup: get(f, 'pickup'),
            renewal: get(f, 'renewal'),
            advance: Number(get(f, 'advance')),
            source: chosen ? { docId: chosen.docId, itemId: chosen.itemId } : null,
          })
        )
          done();
      }}
    >
      <h2>Novo lembrete de medicação</h2>
      <p>
        Copie os horários combinados com a equipe. Para retirada e renovação, use as datas
        informadas pela unidade ou farmácia.
      </p>
      <Field label="Origem do lembrete">
        <select value={choice} onChange={(e) => choose(e.target.value)}>
          <option value="">Informar manualmente</option>
          {options.map((o) => (
            <option key={o.docId + '|' + o.itemId} value={o.docId + '|' + o.itemId}>
              {o.name} · {o.number}
            </option>
          ))}
        </select>
      </Field>
      {!chosen && (
        <Field label="Nome do medicamento">
          <input name="name" maxLength={200} required />
        </Field>
      )}
      <Field label="Condição relacionada (opcional)">
        <input name="condition" list="care-conditions" maxLength={100} />
      </Field>
      <Field
        label="Horários diários"
        hint="Use o horário local, por exemplo 08:00, 20:00. Deixe vazio para acompanhar somente a farmácia."
      >
        <input name="times" placeholder="08:00, 20:00" maxLength={64} />
      </Field>
      <div className="care-two">
        <Field label="Início dos lembretes">
          <input type="date" name="start" defaultValue={localDay(now)} required />
        </Field>
        <Field label="Último dia (opcional)">
          <input type="date" name="end" />
        </Field>
      </div>
      <h3>Retirada e renovação</h3>
      <div className="care-two">
        <Field label="Próxima retirada">
          <input name="pickup" type="date" />
        </Field>
        <Field label="Próxima renovação">
          <input name="renewal" type="date" />
        </Field>
      </div>
      <Field label="Avisar com quantos dias de antecedência">
        <input type="number" required min="0" max="30" name="advance" defaultValue="3" />
      </Field>
      <div className="care-actions">
        <Button disabled={busy}>Salvar lembrete</Button>
        <Button type="button" variant="secondary" onClick={done}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
function Medication({
  view,
  d,
  now,
  run,
  busy,
  message,
  push,
  toggle,
  testPush,
}: {
  view: CitizenView;
  d: Diary;
  now: Date;
  run: Submit;
  busy: boolean;
  message: (s: string) => void;
  push: PushState;
  toggle: () => void;
  testPush: () => void;
}) {
  const [adding, setAdding] = useState(false),
    [step, setStep] = useState<{ p: string; kind: Milestone } | null>(null);
  const calendar = (p: CarePlan) => {
    try {
      const text = careCalendar(p, view, new Date()),
        href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = href;
      a.download = 'Cuidelo-lembretes.ics';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30000);
      message(
        'Arquivo de calendário gerado. Importe-o e confira os alertas no calendário do aparelho.',
      );
    } catch (e) {
      message((e as Error).message);
    }
  };
  return (
    <>
      <section className="cit-sheet">
        <h2>Meus medicamentos</h2>
        <p>Organize o horário de uso e as próximas idas à farmácia.</p>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Novo lembrete
          </Button>
        )}
      </section>
      {adding && (
        <PlanForm view={view} now={now} run={run} busy={busy} done={() => setAdding(false)} />
      )}
      {d.plans.length === 0 && !adding && <p className="cit-empty">Nenhum lembrete cadastrado.</p>}
      {[...d.plans].reverse().map((p) => {
        const enabled = available(p, view);
        return (
          <section key={p.id} className="cit-sheet care-med">
            <span className="cit-kicker">
              {p.closedAt
                ? 'Lembrete encerrado'
                : !enabled
                  ? 'Receita indisponível · lembretes suspensos'
                  : p.source
                    ? 'Vinculado à receita da unidade'
                    : 'Informado pela pessoa'}
            </span>
            <h3>{p.medicine}</h3>
            <p>
              {p.times.join(' · ') || 'Somente datas da farmácia'} · desde {shortDate(p.start)}
              {p.end ? ' até ' + shortDate(p.end) : ''}
              {p.condition ? ' · ' + p.condition : ''}
            </p>
            <p>
              Retirada: {p.pickup ? shortDate(p.pickup) : 'sem data'} · Renovação:{' '}
              {p.renewal ? shortDate(p.renewal) : 'sem data'}.
            </p>
            {enabled && (
              <>
                <div className="care-actions">
                  {(['pickup', 'renewal'] as const).map((k) => (
                    <Button
                      key={k}
                      variant="secondary"
                      onClick={() => setStep({ p: p.id, kind: k })}
                    >
                      Registrar {milestoneNames[k].toLowerCase()}
                    </Button>
                  ))}
                </div>
                {step?.p === p.id && (
                  <form
                    className="care-form care-inset"
                    key={step.kind}
                    onSubmit={async (ev) => {
                      ev.preventDefault();
                      const f = new FormData(ev.currentTarget);
                      if (
                        await run({
                          type: 'step',
                          planId: p.id,
                          kind: step.kind,
                          date: get(f, 'date'),
                          next: get(f, 'next'),
                        })
                      )
                        setStep(null);
                    }}
                  >
                    <h3>{milestoneNames[step.kind]} informada pela pessoa</h3>
                    <Field label="Data em que ocorreu">
                      <input
                        type="date"
                        name="date"
                        required
                        defaultValue={localDay(now)}
                        max={localDay(now)}
                      />
                    </Field>
                    <Field label="Próxima data informada (opcional)">
                      <input name="next" type="date" />
                    </Field>
                    <div className="care-actions">
                      <Button disabled={busy}>Salvar registro</Button>
                      <Button type="button" variant="secondary" onClick={() => setStep(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
                <details>
                  <summary>Exportar para calendário (opcional)</summary>
                  <p>
                    Adicione estes eventos ao calendário do celular. O arquivo inclui o nome do
                    medicamento. Confira a importação e os alarmes no calendário escolhido. Se o
                    lembrete mudar, atualize ou remova os eventos já importados.
                  </p>
                  <Button variant="secondary" onClick={() => calendar(p)}>
                    <CalendarDays size={16} /> Baixar para o calendário
                  </Button>
                </details>
              </>
            )}
            {!p.closedAt && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Encerrar os lembretes deste medicamento no Cuidelo? O histórico será preservado.',
                    )
                  )
                    void run({ type: 'close', planId: p.id });
                }}
              >
                Encerrar lembrete
              </button>
            )}
          </section>
        );
      })}
      <section className="cit-sheet">
        <h2>Avisos com o app fechado</h2>
        <p>
          Autorize este aparelho para receber avisos nos horários de medicação e às 9h nas datas de
          retirada e renovação, incluindo a antecedência cadastrada. A agenda usa o fuso deste
          aparelho.
        </p>
        <p>
          O servidor recebe os horários e a inscrição de entrega. A notificação tem texto discreto.
          No iPhone com iOS 16.4 ou posterior, adicione o app à Tela de Início e abra-o pelo ícone.
        </p>
        {push.wanted && !push.pending && (
          <p>
            Inscrição ativa neste aparelho.
            {push.shownAt
              ? ' Último aviso apresentado pelo navegador em ' +
                new Date(push.shownAt).toLocaleString('pt-BR') +
                '.'
              : ''}
          </p>
        )}
        {d.notifications && !push.wanted && (
          <p>Ative novamente os avisos para cadastrar este aparelho no envio em segundo plano.</p>
        )}
        {push.pending && (
          <p className="cit-notice">
            Sincronização pendente. A última agenda confirmada pode continuar ativa até este
            aparelho se conectar.
          </p>
        )}
        <div className="care-actions">
          <Button variant="secondary" disabled={busy} onClick={toggle}>
            <Bell size={16} />
            {push.wanted
              ? 'Desativar avisos'
              : push.pending
                ? 'Confirmar desativação'
                : 'Ativar avisos do aparelho'}
          </Button>
          {push.wanted && !push.pending && (
            <Button variant="secondary" disabled={busy} onClick={testPush}>
              Testar em 1 minuto
            </Button>
          )}
        </div>
        {push.wanted && push.testAt && push.testAt > Date.now() && (
          <p>
            Teste agendado para {new Date(push.testAt).toLocaleTimeString('pt-BR')}. Feche o app e
            aguarde o aviso neste aparelho.
          </p>
        )}
      </section>
    </>
  );
}
function Today({
  d,
  view,
  now,
  run,
  busy,
}: {
  d: Diary;
  view: CitizenView;
  now: Date;
  run: Submit;
  busy: boolean;
}) {
  const [correction, setCorrection] = useState<{
    slot: string;
    planId: string;
    count: number;
  } | null>(null);
  const today = localDay(now),
    stamp = localStamp(now),
    steps = reminders(d, view, now).filter((r) => r.kind !== 'dose');
  const slots = d.plans
    .filter((p) => available(p, view) && onDay(p, today))
    .flatMap((p) => p.times.map((t) => ({ p, t, slot: today + 'T' + t })))
    .sort((a, b) => a.t.localeCompare(b.t));
  return (
    <>
      <div className="care-shortcuts">
        <Link to={url + '/diario'}>
          <HeartPulse /> Registrar crise ou sintoma
        </Link>
        <Link to={url + '/medicacao'}>
          <Bell /> Organizar medicação
        </Link>
      </div>
      <section className="cit-sheet">
        <h2>Horários de hoje</h2>
        <p>{shortDate(today)} · horário deste aparelho</p>
        {slots.length ? (
          slots.map(({ p, t, slot }) => {
            const log = d.doses.find((l) => l.planId === p.id && l.slot === slot);
            return (
              <div className="care-slot" key={p.id + slot}>
                <div>
                  <strong>
                    {t} · {p.medicine}
                  </strong>
                  <small>
                    {log
                      ? effectiveTaken(log)
                        ? 'Registrado: tomei'
                        : 'Registrado: não tomei'
                      : slot > stamp
                        ? 'Programado'
                        : 'Sem registro'}
                  </small>
                </div>
                {log && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setCorrection({ planId: p.id, slot, count: log.corrections?.length ?? 0 })
                    }
                  >
                    Corrigir registro
                  </button>
                )}
                {correction?.slot === slot && correction.planId === p.id && log && (
                  <form
                    className="care-form care-inset"
                    onSubmit={async (ev) => {
                      ev.preventDefault();
                      if (
                        await run({
                          type: 'correct-dose',
                          ...correction,
                          reason: get(new FormData(ev.currentTarget), 'reason'),
                        })
                      )
                        setCorrection(null);
                    }}
                  >
                    <strong>Corrigir para “{effectiveTaken(log) ? 'não tomei' : 'tomei'}”</strong>
                    <Field label="Motivo da correção">
                      <input name="reason" required maxLength={500} />
                    </Field>
                    <div className="care-actions">
                      <Button disabled={busy}>Confirmar correção</Button>
                      <Button type="button" variant="secondary" onClick={() => setCorrection(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
                {!log && slot <= stamp && (
                  <div className="care-actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run({ type: 'dose', planId: p.id, slot, taken: true })}
                    >
                      Tomei
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run({ type: 'dose', planId: p.id, slot, taken: false })}
                    >
                      Não tomei
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p>Nenhum horário programado para hoje.</p>
        )}
      </section>
      <section className="cit-sheet">
        <h2>Avisos da farmácia</h2>
        {steps.length ? (
          steps.map((r) => (
            <p key={r.key}>
              <strong>
                {r.kind === 'pickup' ? 'Retirada' : 'Renovação'} · {shortDate(r.when)}
              </strong>
              <br />
              {d.plans.find((p) => p.id === r.planId)?.medicine} ·{' '}
              {r.when === today
                ? 'hoje'
                : r.when < today
                  ? 'data passou · confira o registro'
                  : 'data se aproximando'}
            </p>
          ))
        ) : (
          <p>Os avisos de retirada e renovação aparecem aqui conforme a antecedência cadastrada.</p>
        )}
      </section>
    </>
  );
}
export function CitizenDaily({
  scope,
  view,
  path,
  children,
}: {
  scope: CareScope;
  view: CitizenView;
  path: string;
  children: ReactNode;
}) {
  const [diary, setDiary] = useState<Diary | null>(null),
    [now, setNow] = useState(() => new Date()),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const key = careKey(scope);
  useEffect(() => {
    let active = true;
    const read = () => {
      void readDiary(scope)
        .then((d) => {
          if (active) setDiary(d);
        })
        .catch(() => {
          if (active) {
            setDiary(null);
            setMessage(
              'Armazenamento indisponível. Não foi possível abrir o diário deste aparelho.',
            );
          }
        });
    };
    const stop = watchDiary(scope, read);
    read();
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => {
      active = false;
      stop();
      clearInterval(timer);
    };
  }, [key]);
  const [push, setPush] = useState(() => pushState(scope));
  const refreshPush = () => setPush(pushState(scope));
  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        await syncDevice(scope, view);
      } catch (e) {
        if (active) setMessage((e as Error).message);
      } finally {
        if (active) refreshPush();
      }
    };
    void sync();
    const timer = setInterval(sync, 60000);
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
    };
  }, [key, diary, view]);
  const toggle = async () => {
    setBusy(true);
    try {
      const state = pushState(scope),
        enable = !state.wanted && !state.pending;
      const sub = enable ? await subscribePhone() : undefined;
      await syncDevice(scope, view, enable ? 'enable' : 'stop', sub);
      await writeDiary(scope, { type: 'notifications', enabled: enable }, view);
      setMessage(
        enable
          ? 'Inscrição confirmada. Os avisos podem chegar com o app fechado.'
          : 'Avisos desativados para esta pessoa neste aparelho.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      refreshPush();
      setBusy(false);
    }
  };
  const testPush = async () => {
    setBusy(true);
    try {
      await schedulePushTest(scope);
      setMessage('Teste confirmado pelo servidor. Feche o app agora.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      refreshPush();
      setBusy(false);
    }
  };
  const run: Submit = async (cmd) => {
    setBusy(true);
    setMessage('');
    try {
      await writeDiary(scope, cmd, view);
      if (['plan', 'close', 'step', 'dose', 'correct-dose'].includes(cmd.type)) {
        try {
          await syncDevice(scope, view);
        } catch (e) {
          setMessage('Registro salvo no aparelho. ' + (e as Error).message);
          refreshPush();
          return true;
        }
        refreshPush();
      }
      setMessage(
        cmd.type === 'notifications'
          ? cmd.enabled
            ? 'Avisos ativados.'
            : 'Avisos desativados.'
          : 'Registro salvo neste aparelho.',
      );
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const due = diary ? dueReminders(diary, view, now) : [];
  const [section, tab = '', extra] = path.split('/');
  if (section !== 'dia-a-dia')
    return (
      <>
        {due.length > 0 && (
          <Link className="cit-notice care-alert" to={url}>
            Você tem {due.length} lembrete(s) para conferir
          </Link>
        )}
        {children}
      </>
    );
  const tabs = { '': 'Hoje', diario: 'Diário', medicacao: 'Medicação', relatorio: 'Relatório' };
  return (
    <div className="care-workspace">
      <span className="cit-kicker">Acompanhamento pessoal</span>
      <h1>Meu dia a dia</h1>
      <p className="care-explain">
        Use dados fictícios. Seu diário fica neste aparelho e não é enviado à equipe de saúde.
      </p>
      <nav className="care-tabs" aria-label="Áreas do acompanhamento">
        {Object.entries(tabs).map(([k, v]) => (
          <Link key={k} to={url + (k ? '/' + k : '')} aria-current={k === tab ? 'page' : undefined}>
            {v}
          </Link>
        ))}
      </nav>
      {message && (
        <p className="cit-notice" role="status">
          {message}
        </p>
      )}
      {!diary ? (
        !message && <p>Carregando diário…</p>
      ) : (
        <>
          <Conditions d={diary} />
          {extra || !Object.hasOwn(tabs, tab) ? (
            <p>Seção indisponível.</p>
          ) : tab === 'relatorio' ? (
            <CareReport diary={diary} view={view} />
          ) : tab === 'diario' ? (
            <Journal d={diary} now={now} run={run} busy={busy} />
          ) : tab === 'medicacao' ? (
            <Medication
              view={view}
              d={diary}
              now={now}
              run={run}
              busy={busy}
              message={setMessage}
              push={push}
              toggle={toggle}
              testPush={testPush}
            />
          ) : (
            <Today d={diary} view={view} now={now} run={run} busy={busy} />
          )}
        </>
      )}
    </div>
  );
}
