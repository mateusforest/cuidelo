import { Bell, Check, Clock3 } from 'lucide-react';
import { Button, Field } from './ui';
import {
  alarmStatus,
  effectiveTaken,
  milestoneNames,
  sameAlarm,
  type CareCommand,
  type Diary,
} from '../domain/citizen-care';
import { shortDate } from '../domain/dates';
import type { CitizenView } from '../domain/citizen';
import type { DeviceNotice } from '../data/device-push';

export function CitizenAlarm({
  notice,
  d,
  view,
  busy,
  run,
  openDiary,
}: {
  notice: DeviceNotice;
  d: Diary;
  view: CitizenView;
  busy: boolean;
  run: (cmd: CareCommand) => Promise<boolean>;
  openDiary: () => void;
}) {
  return (
    <section className="care-workspace care-alarm">
      <span className="cit-kicker">
        <Bell size={15} /> Aviso do Dia a dia
      </span>
      <h1>{notice.items.length === 1 ? 'Seu lembrete' : 'Lembretes deste horário'}</h1>
      <p>
        {view.person} · {new Date(notice.due).toLocaleString('pt-BR')}
      </p>
      {notice.items.map((t) => {
        const plan = d.plans.find((p) => p.id === t.planId),
          status = alarmStatus(d, view, t);
        const postponed = d.postponements?.filter((s) => sameAlarm(s, t)).at(-1);
        const alreadyLater =
          !!postponed && (postponed.noticeId === notice.id || postponed.until > notice.due);
        const dose = d.doses.find((x) => x.planId === t.planId && x.slot === t.when);
        const verb =
          t.kind === 'dose'
            ? 'Marcar que tomei'
            : t.kind === 'pickup'
              ? 'Confirmar retirada'
              : 'Confirmar renovação';
        const base = {
          type: 'respond',
          target: t,
          noticeId: notice.id,
          due: notice.due,
          zone: notice.zone,
        } as const;
        return (
          <article className="cit-sheet" key={t.planId + t.kind + t.when}>
            <span className="cit-kicker">
              {t.kind === 'dose' ? 'Horário do remédio' : milestoneNames[t.kind]}
            </span>
            <h2>{status === 'unavailable' ? 'Lembrete indisponível' : plan?.medicine}</h2>
            <p>
              {t.kind === 'dose' ? 'Dose prevista para ' : 'Data prevista · '}
              {shortDate(t.when.slice(0, 10))}
              {t.kind === 'dose' ? ' às ' + t.when.slice(11) : ''}
            </p>
            {status === 'unavailable' ? (
              <p>O plano foi alterado, encerrado ou a receita deixou de estar disponível.</p>
            ) : status === 'done' ? (
              <p role="status">
                <Check size={16} />{' '}
                {t.kind === 'dose'
                  ? dose && effectiveTaken(dose)
                    ? 'Registrado no Dia a dia · tomei.'
                    : 'Registrado no Dia a dia · não tomei.'
                  : 'Confirmação registrada no Dia a dia.'}
              </p>
            ) : (
              <>
                {alreadyLater && (
                  <p role="status">
                    Aviso adiado para {new Date(postponed.until).toLocaleString('pt-BR')}.
                  </p>
                )}
                <form
                  className="care-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const next = String(new FormData(e.currentTarget).get('next') ?? '');
                    void run({ ...base, action: 'confirm', next });
                  }}
                >
                  {t.kind !== 'dose' && (
                    <Field label="Próxima data informada (opcional)">
                      <input type="date" name="next" />
                    </Field>
                  )}
                  <Button disabled={busy} type="submit">
                    <Check size={16} />
                    {verb}
                  </Button>
                </form>
                {!alreadyLater && (
                  <form
                    className="care-actions"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const minutes = Number(new FormData(e.currentTarget).get('minutes'));
                      void run({ ...base, action: 'later', minutes });
                    }}
                  >
                    <Field label="Lembrar novamente em">
                      <select name="minutes" defaultValue={10}>
                        <option value={1}>1 minuto</option>
                        <option value={10}>10 minutos</option>
                        <option value={30}>30 minutos</option>
                      </select>
                    </Field>
                    <Button variant="secondary" disabled={busy} type="submit">
                      <Clock3 size={16} />
                      Adiar lembrete
                    </Button>
                  </form>
                )}
              </>
            )}
          </article>
        );
      })}
      <Button variant="secondary" onClick={openDiary}>
        Ver meu Dia a dia
      </Button>
    </section>
  );
}
