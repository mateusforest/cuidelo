import { addDays, validDay, validTime } from './dates';
import type { CitizenView } from './citizen';
import { DomainError } from './errors';

export interface CareScope {
  role: 'citizen';
  organization: string;
  unit: 'personal';
  subject: string;
}
export function careKey(c: CareScope) {
  if (
    c?.role !== 'citizen' ||
    c.unit !== 'personal' ||
    !c.organization ||
    !/^(example:(ana|joao)|share:[a-f0-9-]{36})$/.test(c.subject)
  )
    throw new DomainError('Acompanhamento pessoal indisponível.');
  return JSON.stringify([c.role, c.organization, c.unit, c.subject]);
}
export const localDay = (d: Date) =>
  [
    String(d.getFullYear()).padStart(4, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
export const localClock = (d: Date) =>
  [d.getHours(), d.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
export const localStamp = (d: Date) => localDay(d) + 'T' + localClock(d);
export const kinds = { crisis: 'Crise', symptom: 'Sintoma', wellbeing: 'Como me senti' } as const;
export const levels = ['Leve', 'Moderada', 'Intensa'] as const;
export type Milestone = 'pickup' | 'renewal';
export const milestoneNames = { pickup: 'Retirada', renewal: 'Renovação' };
interface Entry {
  id: string;
  at: string;
  recordedAt: string;
  kind: keyof typeof kinds;
  condition: string;
  intensity: string;
  duration: string;
  text: string;
}
export interface RxLink {
  docId: string;
  itemId: string;
}
interface PlanFields {
  medicine: string;
  condition: string;
  times: string[];
  start: string;
  end: string;
  pickup: string;
  renewal: string;
  advance: number;
  source: RxLink | null;
}
export interface CarePlan extends PlanFields {
  id: string;
  createdAt: string;
  closedAt?: string;
}
export interface Dose {
  planId: string;
  slot: string;
  taken: boolean;
  recordedAt: string;
  corrections?: { taken: boolean; reason: string; at: string }[];
}
export const effectiveTaken = (dose: Dose) => dose.corrections?.at(-1)?.taken ?? dose.taken;
interface Step {
  planId: string;
  kind: Milestone;
  date: string;
  previous: string;
  next: string;
  recordedAt: string;
}
export interface Diary {
  version: 1;
  conditions: string[];
  entries: Entry[];
  plans: CarePlan[];
  doses: Dose[];
  steps: Step[];
  notifications: boolean;
  notified: Record<string, string>;
}
export const freshDiary = (): Diary => ({
  version: 1,
  conditions: [],
  entries: [],
  plans: [],
  doses: [],
  steps: [],
  notifications: false,
  notified: {},
});
export type CareCommand =
  | { type: 'condition'; name: string }
  | {
      type: 'entry';
      kind: Entry['kind'];
      at: string;
      condition: string;
      intensity: string;
      duration: string;
      text: string;
    }
  | ({ type: 'plan' } & PlanFields)
  | { type: 'close'; planId: string }
  | { type: 'dose'; planId: string; slot: string; taken: boolean }
  | { type: 'correct-dose'; planId: string; slot: string; count: number; reason: string }
  | { type: 'step'; planId: string; kind: Milestone; date: string; next: string }
  | { type: 'notifications'; enabled: boolean }
  | { type: 'claim' | 'alert-failed'; key: string };
function check(test: unknown, message: string): asserts test {
  if (!test) throw new DomainError(message);
}
function field(s: string, max: number, required = false) {
  check(
    typeof s === 'string' && s.length <= max && (!required || s.trim()),
    'Confira os campos obrigatórios e o tamanho do texto.',
  );
  return s.trim();
}
const clean = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function condition(d: Diary, name: string) {
  if (name && !d.conditions.some((x) => clean(x) === clean(name))) d.conditions.push(name);
}
export function linkedMedicine(view: CitizenView, source: RxLink | null) {
  if (!source) return undefined;
  const doc = view.documents.find((d) => d.id === source.docId && d.status === 'issued');
  return doc?.content.kind === 'prescription'
    ? doc.content.items.find((i) => i.id === source.itemId)?.medicine
    : undefined;
}
export const available = (p: CarePlan, view: CitizenView) =>
  !p.closedAt && (!p.source || !!linkedMedicine(view, p.source));
export const onDay = (p: CarePlan, day: string) => day >= p.start && (!p.end || day <= p.end);
export interface CareReminder {
  key: string;
  planId: string;
  kind: 'dose' | Milestone;
  when: string;
}
export function reminders(d: Diary, view: CitizenView, now: Date): CareReminder[] {
  const day = localDay(now),
    rows: CareReminder[] = [];
  for (const p of d.plans.filter((p) => available(p, view))) {
    if (onDay(p, day))
      for (const time of p.times) {
        const slot = day + 'T' + time;
        if (!d.doses.some((v) => v.planId === p.id && v.slot === slot))
          rows.push({ key: p.id + '/dose/' + slot, planId: p.id, kind: 'dose', when: slot });
      }
    for (const kind of ['pickup', 'renewal'] as const) {
      const target = p[kind];
      if (target && day >= addDays(target, -p.advance))
        rows.push({ key: p.id + '/' + kind + '/' + target, planId: p.id, kind, when: target });
    }
  }
  return rows.sort((a, b) => a.when.localeCompare(b.when));
}
export function dueReminders(d: Diary, view: CitizenView, now: Date) {
  const stamp = localStamp(now),
    day = localDay(now);
  return reminders(d, view, now).filter((r) =>
    r.kind === 'dose'
      ? r.when <= stamp && now.getTime() - new Date(r.when).getTime() < 5 * 60000
      : r.when >= day,
  );
}
export function applyCare(
  scope: CareScope,
  d: Diary,
  cmd: CareCommand,
  view: CitizenView,
  now: Date,
) {
  careKey(scope);
  check(
    scope.subject === view.careScope?.subject && scope.organization === view.careScope.organization,
    'Esta sessão não pertence a este acompanhamento.',
  );
  const stamp = localStamp(now),
    today = localDay(now),
    recordedAt = now.toISOString();
  switch (cmd.type) {
    case 'condition': {
      const name = field(cmd.name, 100, true);
      check(
        !d.conditions.some((n) => clean(n) === clean(name)),
        'Esta condição já está no acompanhamento.',
      );
      condition(d, name);
      break;
    }
    case 'entry': {
      check(
        Object.hasOwn(kinds, cmd.kind) &&
          cmd.at.length === 16 &&
          cmd.at[10] === 'T' &&
          validDay(cmd.at.slice(0, 10)) &&
          validTime(cmd.at.slice(11)) &&
          cmd.at <= stamp,
        'Confira a data e a hora do relato.',
      );
      check(
        cmd.intensity === '' || levels.some((s) => s === cmd.intensity),
        'Intensidade inválida.',
      );
      check(
        cmd.duration === '' || /^[1-9]\d{0,3}$/.test(cmd.duration),
        'Informe a duração em minutos inteiros.',
      );
      const name = field(cmd.condition, 100),
        text = field(cmd.text, 1200, true);
      condition(d, name);
      d.entries.push({
        id: crypto.randomUUID(),
        kind: cmd.kind,
        at: cmd.at,
        condition: name,
        intensity: cmd.intensity,
        duration: cmd.duration,
        text,
        recordedAt,
      });
      break;
    }
    case 'plan': {
      const medicine = field(
          cmd.source ? (linkedMedicine(view, cmd.source) ?? '') : cmd.medicine,
          200,
          true,
        ),
        name = field(cmd.condition, 100);
      check(
        validDay(cmd.start) && (!cmd.end || (validDay(cmd.end) && cmd.end >= cmd.start)),
        'Confira as datas do lembrete.',
      );
      check(
        Array.isArray(cmd.times) &&
          (cmd.times.length > 0 || !!cmd.pickup || !!cmd.renewal) &&
          cmd.times.length <= 8 &&
          cmd.times.every(validTime) &&
          new Set(cmd.times).size === cmd.times.length,
        'Informe horários válidos e diferentes (até oito) ou uma data de retirada ou renovação.',
      );
      check(
        (!cmd.pickup || validDay(cmd.pickup)) &&
          (!cmd.renewal || validDay(cmd.renewal)) &&
          Number.isInteger(cmd.advance) &&
          cmd.advance >= 0 &&
          cmd.advance <= 30,
        'Confira as datas de retirada e renovação e a antecedência.',
      );
      check(
        !d.plans.some(
          (p) =>
            available(p, view) &&
            clean(p.medicine) === clean(medicine) &&
            (!p.end || cmd.start <= p.end) &&
            (!cmd.end || p.start <= cmd.end),
        ),
        'Já existe um lembrete para este medicamento nesse período.',
      );
      condition(d, name);
      d.plans.push({
        id: crypto.randomUUID(),
        medicine,
        condition: name,
        times: [...cmd.times].sort(),
        start: cmd.start,
        end: cmd.end,
        pickup: cmd.pickup,
        renewal: cmd.renewal,
        advance: cmd.advance,
        source: cmd.source ? { ...cmd.source } : null,
        createdAt: recordedAt,
      });
      break;
    }
    case 'close': {
      const p = d.plans.find((p) => p.id === cmd.planId);
      check(p && !p.closedAt, 'Lembrete já encerrado ou indisponível.');
      p.closedAt = recordedAt;
      break;
    }
    case 'dose': {
      const p = d.plans.find((p) => p.id === cmd.planId);
      check(
        p &&
          available(p, view) &&
          cmd.slot.slice(0, 10) === today &&
          onDay(p, today) &&
          p.times.some((t) => cmd.slot === today + 'T' + t) &&
          cmd.slot <= stamp &&
          typeof cmd.taken === 'boolean',
        'Esse horário não está disponível para registro.',
      );
      check(
        !d.doses.some((v) => v.planId === p.id && v.slot === cmd.slot),
        'Este horário já foi registrado.',
      );
      d.doses.push({ planId: p.id, slot: cmd.slot, taken: cmd.taken, recordedAt });
      break;
    }
    case 'correct-dose': {
      const dose = d.doses.find((v) => v.planId === cmd.planId && v.slot === cmd.slot);
      check(
        dose && cmd.count === (dose.corrections?.length ?? 0),
        'O registro mudou. Confira o horário antes de corrigir.',
      );
      const reason = field(cmd.reason, 500, true);
      (dose.corrections ??= []).push({ taken: !effectiveTaken(dose), reason, at: recordedAt });
      break;
    }
    case 'step': {
      const p = d.plans.find((p) => p.id === cmd.planId);
      check(
        p && available(p, view) && Object.hasOwn(milestoneNames, cmd.kind),
        'Lembrete indisponível.',
      );
      check(
        validDay(cmd.date) &&
          cmd.date <= today &&
          (!cmd.next || (validDay(cmd.next) && cmd.next > cmd.date)),
        'Confira o dia ocorrido e a próxima data informada.',
      );
      const last = d.steps.filter((s) => s.planId === p.id && s.kind === cmd.kind).at(-1);
      check(
        !last || cmd.date > last.date,
        'Já existe um registro desta etapa nessa data ou depois dela.',
      );
      d.steps.push({
        planId: p.id,
        kind: cmd.kind,
        date: cmd.date,
        previous: p[cmd.kind],
        next: cmd.next,
        recordedAt,
      });
      p[cmd.kind] = cmd.next;
      break;
    }
    case 'notifications':
      check(typeof cmd.enabled === 'boolean', 'Opção de aviso inválida.');
      d.notifications = cmd.enabled;
      break;
    case 'alert-failed':
      delete d.notified[cmd.key];
      d.notifications = false;
      break;
    case 'claim': {
      if (
        !d.notifications ||
        d.notified[cmd.key] ||
        !dueReminders(d, view, now).some((r) => r.key === cmd.key)
      )
        return false;
      for (const [k, date] of Object.entries(d.notified))
        if (date < addDays(today, -35)) delete d.notified[k];
      d.notified[cmd.key] = today;
      break;
    }
  }
  return true;
}
