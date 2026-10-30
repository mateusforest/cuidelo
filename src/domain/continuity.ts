import {
  can,
  type Command,
  type Context,
  type Database,
  type ReferralSchedule,
  type RecallContact,
} from './model';
import { dateKey, validDay, validTime } from './dates';
import { demoIdentities, identityFor } from './access';
import { DomainError } from './errors';
import type { ClinicalDocument } from './clinical-documents';

export const contactLabels: Record<RecallContact['outcome'], string> = {
  reached: 'Orientações repassadas',
  unanswered: 'Sem resposta',
  unavailable: 'Contato não localizado',
};
function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new DomainError(message);
}
function required(value: string, label: string, limit: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new DomainError(`Preencha ${label}, com até ${limit} caracteres.`);
  return value.trim();
}
export function lastExamSchedule(doc: ClinicalDocument, itemId: string) {
  return doc.examEvents.filter((e) => e.itemId === itemId && e.kind === 'scheduled').at(-1);
}
export function examDateOverdue(doc: ClinicalDocument, itemId: string, today: string) {
  const last = doc.examEvents.filter((e) => e.itemId === itemId).at(-1);
  return doc.status === 'issued' && last?.kind === 'scheduled' && last.date < today;
}
export function rescheduleReferral(
  db: Database,
  c: Context,
  cmd: Extract<Command, { type: 'referral.reschedule' }>,
  now: Date,
) {
  ensure(can(c.role, 'regulation'), 'Este perfil não pode reagendar encaminhamentos.');
  const r = db.referrals.find(
    (r) => r.id === cmd.id && r.organizationId === c.organizationId && r.unitId === c.unitId,
  );
  ensure(r, 'Encaminhamento não encontrado nesta unidade.');
  ensure(r.status === 'scheduled', 'Somente encaminhamentos agendados podem ser reagendados.');
  ensure(
    (r.history?.length ?? 0) === cmd.expectedHistoryCount,
    'O encaminhamento mudou. Reabra o formulário com os dados atuais.',
  );
  ensure(
    validDay(cmd.date) && cmd.date >= dateKey(now) && validTime(cmd.time),
    'Informe data e horário válidos a partir de hoje.',
  );
  const destination = required(cmd.destination, 'o destino', 160),
    note = required(cmd.reason, 'o motivo do reagendamento', 1000);
  const before: ReferralSchedule = {
    date: r.appointmentDate!,
    time: r.appointmentTime!,
    destination: r.destination,
  };
  const after = { date: cmd.date, time: cmd.time, destination };
  ensure(
    before.date !== after.date ||
      before.time !== after.time ||
      before.destination !== after.destination,
    'Altere data, horário ou destino.',
  );
  (r.history ??= []).push({
    at: now.toISOString(),
    actorId: c.sessionId,
    action: 'rescheduled',
    note,
    previousAppointment: before,
    appointment: after,
  });
  r.appointmentDate = after.date;
  r.appointmentTime = after.time;
  r.destination = after.destination;
  return r.id;
}
export function recordRecallContact(
  db: Database,
  c: Context,
  cmd: Extract<Command, { type: 'vaccine.recall.contact' }>,
  now: Date,
  newId: () => string,
) {
  ensure(can(c.role, 'vaccination'), 'Este perfil não registra contatos de vacinação.');
  const r = db.vaccineRecalls.find(
    (r) => r.id === cmd.id && r.organizationId === c.organizationId && r.unitId === c.unitId,
  );
  ensure(r, 'Aprazamento não encontrado nesta unidade.');
  ensure(r.status === 'scheduled', 'Somente retornos pendentes recebem novos contatos.');
  ensure(
    (r.contacts?.length ?? 0) === cmd.expectedContacts && r.events.length === cmd.expectedEvents,
    'O retorno mudou. Reabra o formulário com os dados atuais.',
  );
  ensure(Object.hasOwn(contactLabels, cmd.outcome), 'Escolha um resultado de contato válido.');
  const note = required(cmd.note, 'o registro do contato', 1000),
    author = identityFor(db, c).name;
  (r.contacts ??= []).push({
    id: newId(),
    at: now.toISOString(),
    actorId: c.sessionId,
    author,
    outcome: cmd.outcome,
    note,
  });
  return r.id;
}
export function validateContinuity(db: Database) {
  const identities = demoIdentities(db),
    ids = new Set<string>();
  const instant = (s: string) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  const slot = (v: ReferralSchedule | undefined) =>
    !!v &&
    validDay(v.date) &&
    validTime(v.time) &&
    typeof v.destination === 'string' &&
    !!v.destination.trim() &&
    v.destination.length <= 160;
  const same = (a: ReferralSchedule, b: ReferralSchedule) =>
    a.date === b.date && a.time === b.time && a.destination === b.destination;
  for (const r of db.referrals) {
    let previous: ReferralSchedule | undefined;
    for (const h of r.history ?? []) {
      if (h.action === 'rescheduled') {
        ensure(
          slot(h.previousAppointment) &&
            slot(h.appointment) &&
            !!h.note.trim() &&
            h.note.length <= 1000,
          'Histórico de reagendamento inválido.',
        );
        ensure(!same(h.previousAppointment!, h.appointment!), 'Reagendamento sem alteração.');
        ensure(
          !previous || same(previous, h.previousAppointment!),
          'Sequência de reagendamentos inválida.',
        );
      }
      if (h.appointment !== undefined) {
        ensure(
          ['scheduled', 'rescheduled'].includes(h.action) && slot(h.appointment),
          'Agendamento no histórico inválido.',
        );
        previous = h.appointment;
      }
      ensure(
        h.action === 'rescheduled' || h.previousAppointment === undefined,
        'Origem do reagendamento inválida.',
      );
    }
    if (previous)
      ensure(
        same(previous, {
          date: r.appointmentDate!,
          time: r.appointmentTime!,
          destination: r.destination,
        }),
        'Agendamento atual difere do histórico.',
      );
  }
  for (const r of db.vaccineRecalls) {
    if (r.contacts === undefined) continue;
    ensure(Array.isArray(r.contacts), 'Histórico de contato inválido.');
    let previous = '';
    for (const c of r.contacts) {
      ensure(
        c &&
          typeof c.id === 'string' &&
          !!c.id &&
          !ids.has(c.id) &&
          instant(c.at) &&
          c.at >= previous &&
          Object.hasOwn(contactLabels, c.outcome),
        'Registro de contato inválido.',
      );
      ensure(
        typeof c.note === 'string' && !!c.note.trim() && c.note.length <= 1000,
        'Nota de contato inválida.',
      );
      ensure(
        identities.some(
          (i) =>
            i.sessionId === c.actorId &&
            i.name === c.author &&
            i.organizationId === r.organizationId &&
            i.unitId === r.unitId &&
            can(i.role, 'vaccination'),
        ),
        'Autoria de contato inválida.',
      );
      ids.add(c.id);
      previous = c.at;
    }
  }
}
