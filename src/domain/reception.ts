import { activeEncounter } from './model';
import type { Context, Database, Encounter, KioskArrival, Patient, QueueCall } from './model';
import type { PreferenceReason } from './kiosk-options';
import { preferenceReasons, servicesForUnit } from './kiosk-options';
import { cpfDigits, normalizedName, validCpf } from './identification';
import { dateKey } from './dates';
import { DomainError } from './errors';
import { callableRoomsForUnit, roomsForUnit } from './queue';
import { demoIdentities } from './access';

export type ReceptionTarget = { kind: 'arrival' | 'encounter'; id: string };
export interface ReceptionCheck {
  at: string;
  actorId: string;
  identityMethod: 'cpf' | 'name';
  priority: 'routine' | 'priority';
  preferenceReason?: PreferenceReason;
  service: string;
  destination: 'triage' | 'service';
  roomId: string;
  adjustmentReason: string;
}
export type ReceptionCommand =
  | { type: 'reception.close-prior'; id: string; reason: string }
  | { type: 'reception.start'; target: ReceptionTarget }
  | { type: 'reception.absent'; target: ReceptionTarget; reason: string }
  | { type: 'reception.return'; target: ReceptionTarget }
  | { type: 'queue.call-arrival'; arrivalId: string }
  | {
      type: 'reception.complete';
      target: ReceptionTarget;
      patientId: string;
      identity: { kind: 'cpf' | 'name'; value: string; birthDate: string };
      identityConfirmed: boolean;
      preferenceConfirmed: boolean;
      priority: 'routine' | 'priority';
      preferenceReason?: PreferenceReason;
      service: string;
      destination: 'triage' | 'service';
      roomId: string;
      adjustmentReason: string;
      expectedChecks: number;
    };

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new DomainError(message, 'conflict');
}
export const lastReceptionCheck = (e: Encounter) => e.receptionChecks?.at(-1);
export const needsReception = (e: Encounter) => !!e.receptionRequired && !lastReceptionCheck(e);
export function canClosePriorArrival(e: Encounter, today: string) {
  return (
    e.status === 'waiting' &&
    !e.intakeStartedAt &&
    !e.intakeCompletedAt &&
    !e.roomStays?.some((s) => s.enteredAt) &&
    !e.startedAt &&
    !e.professionalId &&
    dateKey(new Date(e.arrivedAt)) < today
  );
}
export function flowStage(e: Encounter) {
  if (e.status === 'closed-without-care') return 'Encerrado sem atendimento';
  if (e.status === 'completed') return 'Concluído';
  if (e.status === 'observation') return 'Em observação';
  if (e.status === 'in-care') return 'Em consulta';
  if (e.receptionHold) return 'Ausente na chamada';
  if (needsReception(e)) return e.receptionStartedAt ? 'Em conferência' : 'Aguardando recepção';
  if (e.intakeStartedAt && !e.intakeCompletedAt) return 'Em triagem';
  if (lastReceptionCheck(e)?.destination === 'triage' && !e.intakeCompletedAt)
    return 'Aguardando triagem';
  if (lastReceptionCheck(e) || e.intakeCompletedAt) return 'Aguardando atendimento';
  return 'Em espera';
}
export function readyForIntake(e: Encounter) {
  return (
    activeEncounter(e) &&
    !e.receptionHold &&
    !needsReception(e) &&
    (!e.receptionRequired || lastReceptionCheck(e)?.destination === 'triage')
  );
}
export function readyForConsultation(e: Encounter) {
  return (
    activeEncounter(e) &&
    !e.receptionHold &&
    !needsReception(e) &&
    !(e.intakeStartedAt && !e.intakeCompletedAt) &&
    !(lastReceptionCheck(e)?.destination === 'triage' && !e.intakeCompletedAt)
  );
}
export function assertCallDestination(e: Encounter, roomId: string) {
  ensure(!e.receptionHold, 'Registre o retorno da pessoa antes de chamar novamente.');
  if (e.intakeStartedAt && !e.intakeCompletedAt)
    ensure(
      roomId === 'escuta-1',
      'A escuta está em andamento. Conclua a triagem antes de chamar para outro setor.',
    );
  if (!e.receptionRequired) return;
  if (roomId === 'recepcao-1') return;
  ensure(!needsReception(e), 'Conclua a conferência da recepção antes de chamar para outro setor.');
  if (lastReceptionCheck(e)?.destination === 'triage' && !e.intakeCompletedAt)
    ensure(roomId === 'escuta-1', 'Esta senha aguarda triagem. Chame para a sala de triagem.');
}
function targetRow(db: Database, c: Context, target: ReceptionTarget): Encounter | KioskArrival {
  ensure(target && ['arrival', 'encounter'].includes(target.kind), 'Selecione uma senha válida.');
  const rows = target.kind === 'arrival' ? db.kioskArrivals : db.encounters;
  const row = rows.find(
    (r) => r.id === target.id && r.organizationId === c.organizationId && r.unitId === c.unitId,
  );
  ensure(row, 'Senha não encontrada nesta unidade.');
  if (target.kind === 'arrival')
    ensure(!(row as KioskArrival).encounterId, 'Esta senha já foi identificada. Atualize a fila.');
  return row;
}
function editable(row: Encounter | KioskArrival, now: Date) {
  ensure(
    dateKey(new Date(row.arrivedAt)) === dateKey(now),
    'A conferência é permitida somente para senhas de hoje.',
  );
  if ('patientId' in row)
    ensure(
      row.status === 'waiting' && !row.intakeStartedAt,
      'A triagem ou o atendimento já começou. A conferência anterior será preservada.',
    );
}
export function checkIdentity(
  patient: Patient,
  identity: Extract<ReceptionCommand, { type: 'reception.complete' }>['identity'],
) {
  ensure(
    identity && ['cpf', 'name'].includes(identity.kind) && typeof identity.value === 'string',
    'Confira a identificação da pessoa.',
  );
  ensure(
    identity.birthDate === patient.birthDate,
    'O nascimento informado não confere com o cadastro selecionado.',
  );
  ensure(
    identity.kind === 'cpf'
      ? validCpf(identity.value) && cpfDigits(identity.value) === patient.cpf
      : [patient.name, patient.socialName]
          .filter(Boolean)
          .some((n) => normalizedName(n) === normalizedName(identity.value)),
    'O CPF ou nome informado não confere com o cadastro selecionado.',
  );
}
export function applyReceptionCommand(
  db: Database,
  c: Context,
  command: ReceptionCommand,
  now: Date,
  newId: () => string,
) {
  ensure(
    c.role === 'reception' || c.role === 'admin',
    'Somente recepção ou administração da unidade pode conferir a chegada.',
  );
  const at = now.toISOString();
  if (command.type === 'reception.close-prior') {
    const e = targetRow(db, c, { kind: 'encounter', id: command.id }) as Encounter;
    ensure(
      canClosePriorArrival(e, dateKey(now)) &&
        !db.intakes.some((r) => r.encounterId === e.id) &&
        !db.queueServiceEvents.some((s) => s.encounterId === e.id && s.action === 'receive') &&
        !db.careSegments.some((s) => s.encounterId === e.id) &&
        !db.notes.some((n) => n.encounterId === e.id),
      'Somente chegadas de dias anteriores sem início de atendimento podem ser encerradas no balcão.',
    );
    ensure(
      typeof command.reason === 'string' && !!command.reason.trim() && command.reason.length <= 500,
      'Informe o motivo do encerramento, com até 500 caracteres.',
    );
    e.closedWithoutCare = { at, actorId: c.sessionId, reason: command.reason.trim() };
    e.status = 'closed-without-care';
    return { entityId: e.id, action: 'Chegada anterior encerrada sem atendimento' };
  }
  if (command.type === 'queue.call-arrival') {
    const a = targetRow(db, c, { kind: 'arrival', id: command.arrivalId }) as KioskArrival;
    editable(a, now);
    ensure(!a.receptionHold, 'Registre o retorno da pessoa antes de chamar novamente.');
    const call: QueueCall = {
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      arrivalId: a.id,
      ticket: a.ticket,
      roomId: 'recepcao-1',
      calledAt: at,
    };
    db.calls.push(call);
    return { entityId: call.id, action: `Senha ${a.ticket} chamada para conferência` };
  }
  const row = targetRow(db, c, command.target);
  editable(row, now);
  if (command.target.kind === 'encounter')
    ensure(
      db.queueServiceEvents.filter((ev) => ev.encounterId === row.id).at(-1)?.action !== 'receive',
      'A pessoa está em atendimento no setor. Registre a devolução antes de alterar a conferência.',
    );
  if (command.type === 'reception.absent') {
    ensure(!row.receptionHold, 'A ausência já foi registrada.');
    ensure(
      typeof command.reason === 'string' && command.reason.trim() && command.reason.length <= 500,
      'Informe o motivo da ausência (até 500 caracteres).',
    );
    ensure(
      db.calls.some(
        (call) =>
          call.organizationId === c.organizationId &&
          call.unitId === c.unitId &&
          (command.target.kind === 'arrival'
            ? call.arrivalId === row.id
            : call.encounterId === row.id ||
              !!(
                call.arrivalId &&
                db.kioskArrivals.some((a) => a.id === call.arrivalId && a.encounterId === row.id)
              )),
      ),
      'Chame a senha antes de registrar ausência.',
    );
    row.receptionHold = { at, actorId: c.sessionId, reason: command.reason.trim() };
    (row.receptionEvents ??= []).push({
      at,
      actorId: c.sessionId,
      kind: 'absent',
      reason: command.reason.trim(),
    });
    return { entityId: row.id, action: 'Ausência na chamada registrada; senha preservada' };
  }
  if (command.type === 'reception.return') {
    ensure(row.receptionHold, 'Esta senha não está marcada como ausente.');
    (row.receptionEvents ??= []).push({
      at,
      actorId: c.sessionId,
      kind: 'returned',
      reason: 'Retorno presencial confirmado',
    });
    delete row.receptionHold;
    return { entityId: row.id, action: 'Retorno à fila registrado; chegada original preservada' };
  }
  ensure(!row.receptionHold, 'Registre o retorno da pessoa antes de conferir a chegada.');
  if (command.type === 'reception.start') {
    ensure(!row.receptionStartedAt, 'A conferência já foi iniciada.');
    row.receptionStartedAt = at;
    row.receptionStartedBy = c.sessionId;
    return { entityId: row.id, action: 'Conferência presencial iniciada na recepção' };
  }
  ensure(
    row.receptionStartedAt,
    'Registre o início da conferência quando a pessoa chegar ao balcão.',
  );
  const patient = db.patients.find(
    (p) => p.id === command.patientId && p.organizationId === c.organizationId,
  );
  ensure(patient, 'Selecione um cadastro desta prefeitura.');
  if ('patientId' in row)
    ensure(row.patientId === patient.id, 'A senha já está vinculada a outra pessoa.');
  checkIdentity(patient, command.identity);
  ensure(
    command.identityConfirmed === true && command.preferenceConfirmed === true,
    'Confirme a identificação e a preferência com a pessoa.',
  );
  ensure(
    ['routine', 'priority'].includes(command.priority),
    'Selecione atendimento comum ou preferencial.',
  );
  ensure(
    command.priority === 'priority'
      ? preferenceReasons.some((r) => r.id === command.preferenceReason)
      : command.preferenceReason === undefined,
    'Confira o motivo da preferência.',
  );
  const unit = db.units.find((u) => u.id === c.unitId && u.organizationId === c.organizationId)!;
  ensure(
    servicesForUnit(unit.kind).some((s) => s.value === command.service),
    'Selecione um serviço oferecido no cenário desta unidade.',
  );
  ensure(['triage', 'service'].includes(command.destination), 'Selecione o encaminhamento.');
  ensure(
    command.destination === 'triage'
      ? command.roomId === 'escuta-1'
      : callableRoomsForUnit(unit).some((r) => r.id === command.roomId && r.id !== 'escuta-1'),
    'Selecione a sala correspondente ao encaminhamento.',
  );
  const checks = 'patientId' in row ? (row.receptionChecks ?? []) : [];
  ensure(
    command.expectedChecks === checks.length,
    'A conferência mudou em outra ação. Reabra a senha antes de salvar.',
  );
  ensure(
    typeof command.adjustmentReason === 'string' && command.adjustmentReason.length <= 500,
    'O motivo do ajuste permite até 500 caracteres.',
  );
  const changed = row.priority !== command.priority || checks.length > 0;
  ensure(
    !changed || command.adjustmentReason.trim(),
    'Explique o ajuste da preferência ou da conferência anterior.',
  );
  if (!('patientId' in row))
    ensure(
      !db.encounters.some(
        (e) =>
          e.organizationId === c.organizationId &&
          e.unitId === c.unitId &&
          e.patientId === patient.id &&
          activeEncounter(e),
      ),
      'Esta pessoa já tem atendimento aberto. Confira a senha existente antes de vincular outra.',
    );
  const check: ReceptionCheck = {
    at,
    actorId: c.sessionId,
    identityMethod: command.identity.kind,
    priority: command.priority,
    ...(command.preferenceReason ? { preferenceReason: command.preferenceReason } : {}),
    service: command.service,
    destination: command.destination,
    roomId: command.roomId,
    adjustmentReason: command.adjustmentReason.trim(),
  };
  let encounter: Encounter;
  if ('patientId' in row) encounter = row;
  else {
    encounter = {
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      patientId: patient.id,
      ticket: row.ticket,
      arrivedAt: row.arrivedAt,
      status: 'waiting',
      source: 'kiosk',
      service: command.service,
      priority: command.priority,
      receptionStartedAt: row.receptionStartedAt,
      receptionStartedBy: row.receptionStartedBy,
      receptionEvents: row.receptionEvents,
    };
    db.encounters.push(encounter);
    row.encounterId = encounter.id;
  }
  encounter.receptionRequired = true;
  encounter.receptionChecks = [...checks, check];
  encounter.service = command.service;
  encounter.priority = command.priority;
  encounter.preferenceReason = command.preferenceReason;
  for (const a of db.kioskArrivals.filter((a) => a.encounterId === encounter.id)) {
    a.priority = command.priority;
    a.preferenceReason = command.preferenceReason;
  }
  return {
    entityId: encounter.id,
    action:
      command.destination === 'triage'
        ? 'Identificação e preferência conferidas; encaminhado à triagem'
        : 'Identificação e preferência conferidas; encaminhado ao serviço',
  };
}

export function validateReceptionDatabase(db: Database) {
  const identities = demoIdentities(db);
  const validAt = (value: unknown): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));
  for (const row of [...db.encounters, ...db.kioskArrivals]) {
    const actor = (id: unknown) =>
      identities.some(
        (i) =>
          i.sessionId === id &&
          i.organizationId === row.organizationId &&
          i.unitId === row.unitId &&
          ['reception', 'admin'].includes(i.role),
      );
    if ('patientId' in row) {
      const close = row.closedWithoutCare;
      ensure(
        (row.status === 'closed-without-care') === (close !== undefined),
        'Invalid administrative closure',
      );
      if (close)
        ensure(
          validAt(close.at) &&
            actor(close.actorId) &&
            dateKey(new Date(close.at)) > dateKey(new Date(row.arrivedAt)) &&
            typeof close.reason === 'string' &&
            !!close.reason.trim() &&
            close.reason.length <= 500 &&
            !row.startedAt &&
            !row.intakeStartedAt &&
            !row.intakeCompletedAt &&
            !row.professionalId &&
            !row.completedAt &&
            !db.intakes.some((i) => i.encounterId === row.id) &&
            !db.notes.some((n) => n.encounterId === row.id) &&
            !db.careSegments.some((s) => s.encounterId === row.id),
          'Invalid administrative closure history',
        );
    }
    if (row.receptionRequired !== undefined)
      ensure(typeof row.receptionRequired === 'boolean', 'Invalid reception requirement');
    if (row.receptionStartedAt !== undefined)
      ensure(
        validAt(row.receptionStartedAt) &&
          row.receptionStartedAt >= row.arrivedAt &&
          actor(row.receptionStartedBy),
        'Invalid reception start',
      );
    if (row.receptionHold)
      ensure(
        validAt(row.receptionHold.at) &&
          row.receptionHold.at >= row.arrivedAt &&
          actor(row.receptionHold.actorId) &&
          typeof row.receptionHold.reason === 'string' &&
          !!row.receptionHold.reason.trim() &&
          row.receptionHold.reason.length <= 500,
        'Invalid reception hold',
      );
    if (row.receptionEvents !== undefined) {
      ensure(Array.isArray(row.receptionEvents), 'Invalid reception events');
      for (const event of row.receptionEvents)
        ensure(
          validAt(event.at) &&
            event.at >= row.arrivedAt &&
            actor(event.actorId) &&
            ['absent', 'returned'].includes(event.kind) &&
            typeof event.reason === 'string' &&
            event.reason.length <= 500,
          'Invalid reception event',
        );
    }
    if (row.receptionChecks !== undefined) {
      ensure(Array.isArray(row.receptionChecks) && 'patientId' in row, 'Invalid reception checks');
      let previous = row.receptionStartedAt;
      const unit = db.units.find(
        (u) => u.id === row.unitId && u.organizationId === row.organizationId,
      )!;
      for (const check of row.receptionChecks) {
        ensure(
          check && validAt(check.at) && !!previous && check.at >= previous && actor(check.actorId),
          'Invalid reception chronology',
        );
        ensure(
          ['cpf', 'name'].includes(check.identityMethod) &&
            ['routine', 'priority'].includes(check.priority),
          'Invalid reception confirmation',
        );
        ensure(
          check.priority === 'priority'
            ? preferenceReasons.some((r) => r.id === check.preferenceReason)
            : check.preferenceReason === undefined,
          'Invalid confirmed preference',
        );
        ensure(
          servicesForUnit(unit.kind).some((s) => s.value === check.service) &&
            ['triage', 'service'].includes(check.destination),
          'Invalid reception service',
        );
        ensure(
          check.destination === 'triage'
            ? check.roomId === 'escuta-1'
            : roomsForUnit(unit).some((r) => r.id === check.roomId && r.id !== 'escuta-1'),
          'Invalid reception destination',
        );
        ensure(
          typeof check.adjustmentReason === 'string' && check.adjustmentReason.length <= 500,
          'Invalid reception adjustment',
        );
        previous = check.at;
      }
    }
  }
}
