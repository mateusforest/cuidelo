import {
  can,
  type Appointment,
  type AppointmentSlot,
  type Context,
  type Database,
  type Patient,
  type PatientRegistration,
  type RecordChange,
} from './model';
import { dateKey, minuteOfDay, validDay, validTime } from './dates';
import { cpfDigits, validCpf } from './identification';
import { identityFor, demoIdentities } from './access';
import { DomainError } from './errors';

function ensure(value: unknown, message: string, code = 'invalid'): asserts value {
  if (!value) throw new DomainError(message, code);
}
const text = (value: unknown, label: string, max: number, optional = false) => {
  ensure(
    typeof value === 'string' && value.length <= max && (optional || value.trim()),
    `Revise ${label}.`,
  );
  return value.trim();
};
export function registrationOf(p: Patient): PatientRegistration {
  return {
    name: p.name,
    socialName: p.socialName,
    birthDate: p.birthDate,
    phone: p.phone,
    cpf: p.cpf ?? '',
  };
}
export function slotOf(a: Appointment): AppointmentSlot {
  return {
    professional: a.professional,
    service: a.service,
    date: a.date,
    time: a.time,
    duration: a.duration,
  };
}
export function validateRegistration(
  values: PatientRegistration,
  today: string,
): PatientRegistration {
  ensure(values && typeof values === 'object', 'Revise o cadastro.');
  const name = text(values.name, 'o nome', 120),
    socialName = text(values.socialName, 'o nome social', 120, true),
    phone = text(values.phone, 'o telefone', 30, true),
    rawCpf = text(values.cpf, 'o CPF', 30, true),
    cpf = cpfDigits(rawCpf);
  ensure(!rawCpf || validCpf(cpf), 'Informe um CPF válido para o cadastro fictício.');
  ensure(
    validDay(values.birthDate) && values.birthDate >= '1850-01-01' && values.birthDate <= today,
    'Informe uma data de nascimento válida.',
  );
  return { name, socialName, birthDate: values.birthDate, phone, cpf };
}
function validSlot(values: AppointmentSlot): AppointmentSlot {
  ensure(values && typeof values === 'object', 'Revise o agendamento.');
  const professional = text(values.professional, 'o profissional', 120),
    service = text(values.service, 'o serviço', 120);
  ensure(validDay(values.date), 'Informe uma data válida.');
  ensure(validTime(values.time), 'Informe um horário válido.');
  ensure(
    Number.isInteger(values.duration) && values.duration >= 5 && values.duration <= 240,
    'Duração inválida.',
  );
  ensure(
    minuteOfDay(values.time) + values.duration <= 1440,
    'O atendimento deve terminar no mesmo dia.',
  );
  return { professional, service, date: values.date, time: values.time, duration: values.duration };
}
export function validateAppointmentSlot(
  db: Database,
  c: Context,
  patientId: string,
  values: AppointmentSlot,
  today: string,
  excludingId?: string,
) {
  const slot = validSlot(values);
  ensure(slot.date >= today, 'Escolha uma data a partir de hoje.');
  const start = minuteOfDay(slot.time),
    end = start + slot.duration;
  const conflicts = db.appointments.filter(
    (a) =>
      a.id !== excludingId &&
      a.organizationId === c.organizationId &&
      a.status !== 'cancelled' &&
      a.date === slot.date &&
      start < minuteOfDay(a.time) + a.duration &&
      end > minuteOfDay(a.time),
  );
  ensure(
    !conflicts.some((a) => a.professional === slot.professional),
    'Este profissional já tem um agendamento que ocupa esse horário.',
    'conflict',
  );
  ensure(
    !conflicts.some((a) => a.patientId === patientId),
    'Esta pessoa já tem um agendamento que ocupa esse horário.',
    'conflict',
  );
  return slot;
}
function change<T>(
  db: Database,
  c: Context,
  before: T,
  after: T,
  reason: string,
  now: Date,
): RecordChange<T> {
  const identity = identityFor(db, c);
  return {
    before,
    after,
    at: now.toISOString(),
    actorId: identity.sessionId,
    author: identity.name,
    unitId: c.unitId,
    reason: text(reason, 'o motivo da alteração', 1000),
  };
}
export function updateRegistration(
  db: Database,
  c: Context,
  command: Extract<import('./model').Command, { type: 'patient.update' }>,
  now: Date,
) {
  ensure(can(c.role, 'patients.write'), 'Este perfil não tem acesso a esta operação.');
  const p = db.patients.find((p) => p.id === command.id && p.organizationId === c.organizationId);
  ensure(p, 'Cadastro não encontrado nesta rede.');
  ensure(
    command.expectedChangeCount === (p.changes?.length ?? 0),
    'O cadastro foi atualizado. Feche e reabra para revisar os dados mais recentes.',
  );
  const values = validateRegistration(command.values, dateKey(now)),
    before = registrationOf(p);
  ensure(
    !values.cpf ||
      !db.patients.some(
        (other) =>
          other.id !== p.id &&
          other.organizationId === c.organizationId &&
          other.cpf === values.cpf,
      ),
    'Já existe um cadastro com este CPF nesta prefeitura.',
  );
  ensure(JSON.stringify(before) !== JSON.stringify(values), 'Nenhum dado cadastral foi alterado.');
  const entry = change(db, c, before, values, command.reason, now);
  p.changes = [...(p.changes ?? []), entry];
  p.name = values.name;
  p.socialName = values.socialName;
  p.birthDate = values.birthDate;
  p.phone = values.phone;
  if (values.cpf) p.cpf = values.cpf;
  else delete p.cpf;
  return p.id;
}
export function rescheduleAppointment(
  db: Database,
  c: Context,
  command: Extract<import('./model').Command, { type: 'appointment.reschedule' }>,
  now: Date,
) {
  ensure(can(c.role, 'schedule'), 'Este perfil não tem acesso a esta operação.');
  const a = db.appointments.find(
    (a) => a.id === command.id && a.organizationId === c.organizationId && a.unitId === c.unitId,
  );
  ensure(a, 'Agendamento não encontrado nesta unidade.');
  ensure(a.status === 'scheduled', 'Somente agendamentos pendentes podem ser remarcados.');
  ensure(
    command.expectedChangeCount === (a.reschedules?.length ?? 0),
    'O agendamento foi atualizado. Feche e reabra para revisar os dados mais recentes.',
  );
  const values = validateAppointmentSlot(db, c, a.patientId, command.values, dateKey(now), a.id),
    before = slotOf(a);
  ensure(
    JSON.stringify(before) !== JSON.stringify(values),
    'Escolha um novo horário, profissional ou serviço.',
  );
  const entry = change(db, c, before, values, command.reason, now);
  a.reschedules = [...(a.reschedules ?? []), entry];
  Object.assign(a, values);
  return a.id;
}

// Os históricos são opcionais para preservar bases anteriores, mas novos registros são validados.
export function validateAdministrativeHistory(db: Database) {
  const identities = demoIdentities(db);
  function history<T extends object>(
    items: RecordChange<T>[] | undefined,
    current: T,
    org: string,
    validate: (value: T) => T,
    keys: string[],
    unitId?: string,
  ) {
    if (items === undefined) return;
    ensure(Array.isArray(items), 'Histórico administrativo inválido.');
    let previous: T | undefined;
    let previousAt = '';
    for (const item of items) {
      ensure(
        item &&
          typeof item === 'object' &&
          Number.isFinite(Date.parse(item.at)) &&
          item.at >= previousAt,
        'Data do histórico inválida.',
      );
      ensure(
        db.units.some(
          (u) => u.id === item.unitId && u.organizationId === org && (!unitId || u.id === unitId),
        ),
        'Unidade do histórico inválida.',
      );
      ensure(
        identities.some(
          (i) =>
            i.sessionId === item.actorId &&
            i.organizationId === org &&
            i.unitId === item.unitId &&
            i.name === item.author,
        ),
        'Autoria do histórico inválida.',
      );
      text(item.reason, 'o motivo', 1000);
      for (const value of [item.before, item.after]) {
        ensure(
          value &&
            Object.keys(value).length === keys.length &&
            keys.every((k) => Object.hasOwn(value, k)),
          'Campos do histórico inválidos.',
        );
        ensure(
          JSON.stringify(validate(value)) === JSON.stringify(value),
          'Valores do histórico inválidos.',
        );
      }
      ensure(
        !previous || JSON.stringify(previous) === JSON.stringify(item.before),
        'Sequência do histórico inválida.',
      );
      ensure(JSON.stringify(item.before) !== JSON.stringify(item.after), 'Alteração vazia.');
      previous = item.after;
      previousAt = item.at;
    }
    ensure(
      !previous || JSON.stringify(previous) === JSON.stringify(current),
      'O histórico não corresponde ao cadastro atual.',
    );
  }
  for (const p of db.patients)
    history(
      p.changes,
      registrationOf(p),
      p.organizationId,
      (v) => validateRegistration(v, dateKey()),
      ['name', 'socialName', 'birthDate', 'phone', 'cpf'],
    );
  for (const a of db.appointments)
    history(
      a.reschedules,
      slotOf(a),
      a.organizationId,
      validSlot,
      ['professional', 'service', 'date', 'time', 'duration'],
      a.unitId,
    );
}
