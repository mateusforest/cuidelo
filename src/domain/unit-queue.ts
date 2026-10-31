import {
  can,
  type Command,
  type Context,
  type Database,
  type Encounter,
  type QueueAssessment,
  type RoomStay,
  type ServiceTicket,
  type SectorSeat,
  type UnitKind,
  type Role,
} from './model';
import { demoIdentities } from './access';
import { DomainError } from './errors';
import { readyForIntake, readyForConsultation } from './reception';

export const consultRooms = [
  { id: 'consultorio-1', name: 'Consultório 01' },
  { id: 'consultorio-2', name: 'Consultório 02' },
] as const;
export const isConsultRoom = (id: string) => consultRooms.some((r) => r.id === id);
const serviceRooms = [
  { id: 'enfermagem-1', name: 'Enfermagem' },
  { id: 'vacina-1', name: 'Sala de vacina' },
  { id: 'farmacia-1', name: 'Farmácia' },
];
export const roomName = (id: string) =>
  [
    { id: 'escuta-1', name: 'Escuta e reavaliação' },
    ...consultRooms,
    ...serviceRooms,
    { id: 'orientacao', name: 'Orientação e encerramento' },
  ].find((r) => r.id === id)?.name ?? 'Sala sem identificação';
export function destinations(kind: UnitKind) {
  return [
    ...consultRooms,
    ...serviceRooms.filter(
      (r) => r.id === 'enfermagem-1' || (r.id === 'vacina-1' ? kind === 'ubs' : kind !== 'upa'),
    ),
    { id: 'orientacao', name: 'Orientação e encerramento na escuta' },
  ];
}
function serviceRole(roomId: string, role: Role) {
  return roomId === 'farmacia-1'
    ? role === 'pharmacy'
    : ['enfermagem-1', 'vacina-1'].includes(roomId) && can(role, 'clinical');
}
export function sectorRooms(kind: UnitKind) {
  return [
    { id: 'escuta-1', name: 'Triagem' },
    ...destinations(kind).filter((r) => serviceRooms.some((s) => s.id === r.id)),
  ];
}
const isSector = (room: string) => room === 'escuta-1' || serviceRooms.some((r) => r.id === room);
type DestinationRef = Pick<
  QueueAssessment,
  'id' | 'roomId' | 'at' | 'organizationId' | 'unitId' | 'encounterId'
>;
function deskDestination(
  e: Encounter,
  index = (e.receptionChecks?.length ?? 0) - 1,
): DestinationRef | undefined {
  const check = e.receptionChecks?.[index];
  if (check?.destination !== 'service' || !serviceRooms.some((r) => r.id === check.roomId)) return;
  return {
    id: 'desk:' + e.id + ':' + index,
    unitId: e.unitId,
    organizationId: e.organizationId,
    encounterId: e.id,
    at: check.at,
    roomId: check.roomId,
  };
}
function destinationRef(db: Database, e: Encounter): DestinationRef | undefined {
  return db.queueAssessments.filter((a) => a.encounterId === e.id).at(-1) ?? deskDestination(e);
}
export function sectorReturn(db: Database, c: Context, e: Encounter) {
  if (!inUnit(e, c) || e.status !== 'waiting' || e.receptionHold) return false;
  const ref = destinationRef(db, e);
  return (
    !!ref &&
    db.queueServiceEvents.some((ev) => ev.assessmentId === ref.id && ev.action === 'return')
  );
}
function sectorSeatsOfUnit(db: Database, c: Context): SectorSeat[] {
  const seats: SectorSeat[] = [];
  const events = new Map(
    db.queueServiceEvents
      .filter((ev) => ev.organizationId === c.organizationId && ev.unitId === c.unitId)
      .map((ev) => [ev.encounterId, ev]),
  );
  for (const e of db.encounters) {
    if (!inUnit(e, c)) continue;
    const stay = currentStay(e);
    if (stay) {
      if (isSector(stay.roomId))
        seats.push({
          roomId: stay.roomId,
          encounterId: e.id,
          since: stay.enteredAt ?? stay.at,
          entered: !!stay.enteredAt,
          legacy: false,
        });
      continue;
    }
    if (e.status !== 'waiting') continue;
    if (e.intakeStartedAt && !e.intakeCompletedAt)
      seats.push({
        roomId: 'escuta-1',
        encounterId: e.id,
        since: e.intakeStartedAt,
        entered: true,
        legacy: true,
      });
    const last = events.get(e.id);
    if (last?.action === 'receive') {
      const dest = destinationRef(db, e);
      if (dest)
        seats.push({
          roomId: dest.roomId,
          encounterId: e.id,
          since: last.at,
          entered: true,
          legacy: true,
        });
    }
  }
  return seats;
}
export function sectorSeats(db: Database, c: Context) {
  return sectorSeatsOfUnit(db, c).filter(
    (s) => can(c.role, 'queue') || serviceRole(s.roomId, c.role),
  );
}
export function bookSector(
  db: Database,
  c: Context,
  e: Encounter,
  roomId: string,
  at: string,
  id: string,
  enter = false,
) {
  const kind = db.units.find((u) => u.id === c.unitId)?.kind;
  requireRule(
    kind && inUnit(e, c) && sectorRooms(kind).some((r) => r.id === roomId),
    'Setor indisponível nesta unidade.',
  );
  const current = currentStay(e);
  requireRule(!current || current.roomId === roomId, 'Esta senha já está vinculada a outra sala.');
  const ref = destinationRef(db, e);
  if (roomId === 'escuta-1') {
    const returned =
      ref &&
      db.queueServiceEvents.some((ev) => ev.assessmentId === ref.id && ev.action === 'return');
    requireRule(
      e.status === 'waiting' && !e.receptionHold && (readyForIntake(e) || returned),
      'A pessoa não está disponível para triagem.',
    );
    requireRule(
      !ref ||
        returned ||
        (!isSector(ref.roomId) &&
          !db.queueServiceEvents.some(
            (ev) => ev.assessmentId === ref.id && ev.action === 'receive',
          )),
      'O setor de destino precisa devolver a pessoa à triagem.',
    );
  } else {
    requireRule(
      e.status === 'waiting' &&
        !e.receptionHold &&
        ref?.roomId === roomId &&
        !db.queueServiceEvents.some(
          (ev) => ev.assessmentId === ref.id && ['return', 'finish'].includes(ev.action),
        ),
      'Confira o encaminhamento para este setor.',
    );
  }
  const seats = sectorSeatsOfUnit(db, c);
  requireRule(
    !seats.some((s) => s.roomId === roomId && s.encounterId !== e.id),
    'Esta sala está ocupada ou reservada para outra senha.',
  );
  requireRule(
    at >= (current?.enteredAt ?? current?.at ?? e.roomStays?.at(-1)?.endedAt ?? e.arrivedAt),
    'Confira o relógio antes de movimentar a sala.',
  );
  const legacy = seats.find((s) => s.encounterId === e.id && s.legacy);
  if (!current && legacy) {
    requireRule(legacy.roomId === roomId, 'Esta senha já está em outro setor.');
    requireRule(!enter, 'A pessoa já tem uma entrada anterior registrada.');
    return undefined;
  }
  const stay = current ?? {
    id,
    roomId,
    at,
    actorId: c.sessionId,
    ...(roomId !== 'escuta-1' ? { sectorRef: ref!.id } : {}),
  };
  if (!current) (e.roomStays ??= []).push(stay);
  if (enter) {
    requireRule(!stay.enteredAt, 'A entrada nesta sala já foi registrada.');
    stay.enteredAt = at;
    stay.entryBy = c.sessionId;
  }
  return stay.id;
}
export function serviceTickets(db: Database, c: Context): ServiceTicket[] {
  if (!serviceRooms.some((r) => serviceRole(r.id, c.role))) return [];
  const order = new Map(queueDirections(db, c).map((d) => [d.encounterId, d.order]));
  const recent = new Map(
    db.queueAssessments
      .filter((a) => a.unitId === c.unitId && a.organizationId === c.organizationId)
      .map((a) => [a.encounterId, a]),
  );
  return db.encounters
    .filter((e) => inUnit(e, c) && e.status === 'waiting')
    .flatMap((e) => {
      const a = recent.get(e.id) ?? deskDestination(e);
      if (!a || !serviceRole(a.roomId, c.role)) return [];
      const events = db.queueServiceEvents.filter((ev) => ev.assessmentId === a.id);
      if (events.at(-1)?.action === 'return' || events.at(-1)?.action === 'finish') return [];
      const p = db.patients.find((p) => p.id === e.patientId);
      return [
        {
          encounterId: e.id,
          assessmentId: a.id,
          roomId: a.roomId,
          ticket: e.ticket,
          name: p?.socialName || p?.name || 'Cadastro',
          at: a.at,
          received: events.at(-1)?.action === 'receive',
          count: events.length,
        },
      ];
    })
    .sort((a, b) => (order.get(a.encounterId) ?? 0) - (order.get(b.encounterId) ?? 0));
}
export function recordService(
  db: Database,
  c: Context,
  e: Encounter,
  cmd: Extract<Command, { type: 'queue.service' }>,
  at: string,
  id: string,
) {
  const a = destinationRef(db, e);
  requireRule(
    a && inUnit(e, c) && serviceRole(a.roomId, c.role),
    'Somente a equipe do setor de destino pode registrar a passagem.',
  );
  const events = db.queueServiceEvents.filter((ev) => ev.assessmentId === a.id);
  const last = events.at(-1);
  requireRule(
    e.status === 'waiting' &&
      a.id === cmd.assessmentId &&
      events.length === cmd.expectedCount &&
      at >= (last?.at ?? a.at),
    'O encaminhamento mudou. Confira a fila atual do setor.',
  );
  requireRule(
    (cmd.action === 'receive' && !last) ||
      (cmd.action === 'return' && (!last || last.action === 'receive')) ||
      (cmd.action === 'finish' && last?.action === 'receive'),
    'Ação incompatível com o estado desta passagem.',
  );
  requireRule(
    cmd.action === 'receive' || present(cmd.note, 600),
    'Informe o motivo ou resultado da passagem.',
  );
  if (cmd.action === 'receive') bookSector(db, c, e, a.roomId, at, id, true);
  else if (currentStay(e)?.roomId === a.roomId)
    closeRoom(
      e,
      c,
      at,
      currentStay(e)?.enteredAt ? (cmd.action === 'finish' ? 'finished' : 'returned') : 'released',
      'Passagem atualizada pelo setor.',
    );
  db.queueServiceEvents.push({
    id,
    assessmentId: a.id,
    encounterId: e.id,
    organizationId: c.organizationId,
    unitId: c.unitId,
    actorId: c.sessionId,
    action: cmd.action,
    at,
    note: cmd.action === 'receive' ? '' : cmd.note.trim(),
  });
  if (cmd.action === 'finish') {
    e.status = 'completed';
    e.completedAt = at;
  }
}
export function currentStay(e: Encounter) {
  const visit = e.roomStays?.at(-1);
  return visit?.endedAt ? undefined : visit;
}
const requireRule: (ok: unknown, message: string) => asserts ok = (ok, message) => {
  if (!ok) throw new DomainError(message, 'conflict');
};
const present = (s: string, limit: number) =>
  typeof s === 'string' && !!s.trim() && s.length <= limit;
const validRank = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= 5;
const inUnit = (e: Encounter, c: Context) =>
  e.unitId === c.unitId && e.organizationId === c.organizationId;
export function queueDirections(db: Database, c: Context) {
  const recent = new Map<string, DestinationRef & { rank?: number }>();
  for (const a of db.queueAssessments)
    if (a.unitId === c.unitId && a.organizationId === c.organizationId)
      recent.set(a.encounterId, a);
  for (const e of db.encounters)
    if (inUnit(e, c) && !recent.has(e.id)) {
      const ref = deskDestination(e);
      if (ref) recent.set(e.id, ref);
    }
  return db.encounters
    .filter((e) => inUnit(e, c) && e.status === 'waiting' && recent.has(e.id))
    .sort((a, b) => {
      const byRank = (recent.get(a.id)!.rank ?? Infinity) - (recent.get(b.id)!.rank ?? Infinity);
      return (
        byRank ||
        Number(b.priority === 'priority') - Number(a.priority === 'priority') ||
        a.arrivedAt.localeCompare(b.arrivedAt) ||
        a.ticket.localeCompare(b.ticket)
      );
    })
    .map((e, index) => ({
      encounterId: e.id,
      roomId: db.queueServiceEvents.some(
        (ev) => ev.assessmentId === recent.get(e.id)!.id && ev.action === 'return',
      )
        ? 'escuta-1'
        : recent.get(e.id)!.roomId,
      order: index + 1,
      received:
        db.queueServiceEvents.filter((ev) => ev.assessmentId === recent.get(e.id)!.id).at(-1)
          ?.action === 'receive',
    }));
}
export function assessQueue(
  db: Database,
  c: Context,
  e: Encounter,
  command: Extract<Command, { type: 'queue.assess' }>,
  at: string,
  id: string,
) {
  requireRule(
    inUnit(e, c) && can(c.role, 'clinical'),
    'Somente a equipe assistencial da unidade pode registrar esta avaliação.',
  );
  requireRule(
    e.status === 'waiting' &&
      readyForConsultation(e) &&
      db.intakes.some((r) => r.encounterId === e.id),
    'Registre a escuta antes de classificar. A pessoa deve estar aguardando atendimento.',
  );
  requireRule(
    present(command.protocol, 120) &&
      present(command.classification, 80) &&
      present(command.reason, 1000),
    'Preencha a referência utilizada, a classificação e a justificativa.',
  );
  requireRule(
    validRank(command.rank) &&
      destinations(db.units.find((u) => u.id === e.unitId)!.kind).some(
        (r) => r.id === command.roomId,
      ),
    'Selecione uma faixa e um destino válidos.',
  );
  const history = db.queueAssessments.filter((a) => a.encounterId === e.id);
  const ref = destinationRef(db, e);
  const lastService =
    ref && db.queueServiceEvents.filter((ev) => ev.assessmentId === ref.id).at(-1);
  requireRule(
    lastService?.action !== 'receive',
    'O setor já recebeu a pessoa. Registre a devolução antes de reavaliar.',
  );
  const stay = currentStay(e);
  requireRule(
    !stay || stay.roomId === 'escuta-1' || stay.roomId === command.roomId,
    'Devolva a senha à fila antes de alterar o setor reservado.',
  );
  requireRule(
    command.roomId !== 'orientacao' ||
      (command.confirmClosure === true &&
        command.reviewMinutes === undefined &&
        !e.startedAt &&
        !db.clinicalDocuments.some((d) => d.encounterId === e.id) &&
        !db.notes.some((n) => n.encounterId === e.id)),
    'Confirme o encerramento após orientação, sem prazo de reavaliação e sem consulta aberta.',
  );
  requireRule(
    command.expectedCount === history.length,
    'A avaliação mudou. Reabra a ficha antes de salvar.',
  );
  requireRule(
    at >= (lastService?.at ?? history.at(-1)?.at ?? e.intakeCompletedAt ?? e.arrivedAt),
    'Confira o relógio da unidade antes de registrar.',
  );
  const minutes = command.reviewMinutes;
  requireRule(
    minutes === undefined || (Number.isSafeInteger(minutes) && minutes >= 1 && minutes <= 1440),
    'Informe um prazo de reavaliação entre 1 e 1.440 minutos ou deixe em branco.',
  );
  requireRule(
    !stay || stay.roomId === 'escuta-1' || isConsultRoom(stay.roomId),
    'Devolva a reserva do setor antes de reavaliar.',
  );
  if (stay?.roomId === 'escuta-1')
    closeRoom(
      e,
      c,
      at,
      stay.enteredAt ? 'triaged' : 'released',
      'Avaliação concluída pela equipe.',
    );
  db.queueAssessments.push({
    id,
    organizationId: c.organizationId,
    unitId: c.unitId,
    encounterId: e.id,
    patientId: e.patientId,
    at,
    actorId: c.sessionId,
    classification: command.classification.trim(),
    protocol: command.protocol.trim(),
    reason: command.reason.trim(),
    rank: command.rank,
    roomId: command.roomId,
    ...(minutes !== undefined
      ? { reviewAt: new Date(Date.parse(at) + minutes * 60000).toISOString() }
      : {}),
  });
}
export function availableRoom(db: Database, c: Context, e: Encounter, requested?: string) {
  const own = currentStay(e);
  const direction = e.status === 'waiting' ? destinationRef(db, e)?.roomId : undefined;
  const others = new Set(
    db.encounters.filter((x) => inUnit(x, c) && x.id !== e.id).map((x) => currentStay(x)?.roomId),
  );
  requireRule(
    !direction || isConsultRoom(direction),
    'A pessoa foi encaminhada a outro setor. Confira o destino na escuta.',
  );
  const room =
    requested ?? own?.roomId ?? direction ?? consultRooms.find((r) => !others.has(r.id))?.id;
  requireRule(room && isConsultRoom(room), 'Escolha um consultório livre nesta unidade.');
  requireRule(
    !own || room === own.roomId,
    'Esta senha já tem uma sala reservada. Devolva-a à fila antes de trocar.',
  );
  requireRule(
    !direction || direction === room,
    'Use o consultório indicado na avaliação mais recente.',
  );
  requireRule(!others.has(room), 'Este consultório está ocupado ou reservado para outra senha.');
  return room;
}
export function reserveCall(
  db: Database,
  c: Context,
  e: Encounter,
  roomId: string,
  at: string,
  id: string,
) {
  const own = currentStay(e);
  if (isSector(roomId)) return bookSector(db, c, e, roomId, at, id);
  if (!isConsultRoom(roomId)) {
    const direction = queueDirections(db, c).find((d) => d.encounterId === e.id);
    requireRule(
      !direction || direction.roomId === roomId || roomId === 'recepcao-1',
      'Confira o destino indicado na escuta antes da chamada.',
    );
    requireRule(!own, 'Libere a sala antes de chamar a pessoa para outro setor.');
    return;
  }
  if (can(c.role, 'clinical')) {
    requireRule(
      !db.careSegments.some(
        (s) =>
          !s.endedAt &&
          ((s.encounterId === e.id && s.professionalId !== c.sessionId) ||
            (s.professionalId === c.sessionId && s.encounterId !== e.id)),
      ),
      'Confira o atendimento em curso antes de chamar para o consultório.',
    );
  }
  const room = availableRoom(db, c, e, roomId);
  if (own) {
    requireRule(at >= own.at, 'Confira o relógio antes de rechamar.');
    return own.id;
  }
  requireRule(
    at >= (e.roomStays?.at(-1)?.endedAt ?? e.arrivedAt),
    'Confira o relógio antes de reservar a sala.',
  );
  // Um atendimento antigo em andamento não ganha uma entrada retroativa.
  requireRule(
    !db.careSegments.some((s) => s.encounterId === e.id && !s.endedAt),
    'Atendimento em curso sem sala registrada nesta versão.',
  );
  (e.roomStays ??= []).push({ id, roomId: room, at, actorId: c.sessionId });
  return id;
}
export function markEntry(e: Encounter, c: Context, roomId: string, at: string, segmentId: string) {
  let stay = currentStay(e);
  if (!stay) {
    stay = { id: segmentId, roomId, at, actorId: c.sessionId };
    (e.roomStays ??= []).push(stay);
  }
  stay.enteredAt = at;
  stay.segmentId = segmentId;
}
export function closeRoom(
  e: Encounter,
  c: Context,
  at: string,
  outcome: NonNullable<RoomStay['outcome']>,
  reason?: string,
) {
  const stay = currentStay(e);
  if (!stay) return;
  requireRule(
    at >= (stay.enteredAt ?? stay.at),
    'Confira o relógio da unidade antes de liberar a sala.',
  );
  stay.endedAt = at;
  stay.endedBy = c.sessionId;
  stay.outcome = outcome;
  if (reason) stay.reason = reason.trim();
}
export function releaseRoom(
  e: Encounter,
  c: Context,
  command: Extract<Command, { type: 'queue.release-room' }>,
  at: string,
) {
  requireRule(
    inUnit(e, c) && (can(c.role, 'queue') || serviceRole(currentStay(e)?.roomId ?? '', c.role)),
    'Acesso indisponível para esta unidade.',
  );
  const stay = currentStay(e);
  requireRule(
    stay && !stay.enteredAt && stay.id === command.stayId,
    'Esta reserva mudou ou a pessoa já entrou em atendimento.',
  );
  requireRule(
    present(command.reason, 400),
    'Informe o motivo da devolução à fila, com até 400 caracteres.',
  );
  closeRoom(e, c, at, 'released', command.reason);
}
export function validateUnitQueue(db: Database) {
  const encounters = new Map(db.encounters.map((e) => [e.id, e])),
    people = new Map(demoIdentities(db).map((p) => [p.sessionId, p]));
  const localActor = (id: string, e: Encounter, clinical: boolean) => {
    const actor = people.get(id);
    return !!actor && inUnit(e, actor) && can(actor.role, clinical ? 'clinical' : 'queue');
  };
  const instant = (v: string) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const prior = new Map<string, string>(),
    rooms = new Set<string>(),
    stayIds = new Set<string>();
  for (const a of db.queueAssessments) {
    const e = encounters.get(a.encounterId);
    requireRule(
      e &&
        e.patientId === a.patientId &&
        e.unitId === a.unitId &&
        e.organizationId === a.organizationId &&
        localActor(a.actorId, e, true) &&
        destinations(db.units.find((u) => u.id === e.unitId)!.kind).some(
          (r) => r.id === a.roomId,
        ) &&
        validRank(a.rank) &&
        present(a.protocol, 120) &&
        present(a.classification, 80) &&
        present(a.reason, 1000) &&
        instant(a.at) &&
        a.at >= (prior.get(e.id) ?? e.arrivedAt) &&
        db.intakes.some((i) => i.encounterId === e.id && i.recordedAt <= a.at) &&
        (a.reviewAt === undefined ||
          (instant(a.reviewAt) &&
            Date.parse(a.reviewAt) > Date.parse(a.at) &&
            Date.parse(a.reviewAt) - Date.parse(a.at) <= 86400000)),
      'Histórico de classificação inválido.',
    );
    prior.set(e.id, a.at);
  }
  const byAssessment = new Map<string, DestinationRef>(db.queueAssessments.map((a) => [a.id, a]));
  for (const e of db.encounters)
    e.receptionChecks?.forEach((_, i) => {
      const ref = deskDestination(e, i);
      if (ref) byAssessment.set(ref.id, ref);
    });
  const lastEvent = new Map<string, (typeof db.queueServiceEvents)[number]>();
  for (const ev of db.queueServiceEvents) {
    const a = byAssessment.get(ev.assessmentId),
      e = encounters.get(ev.encounterId),
      actor = people.get(ev.actorId);
    const last = lastEvent.get(ev.assessmentId);
    requireRule(
      a &&
        e &&
        actor &&
        inUnit(e, actor) &&
        serviceRole(a.roomId, actor.role) &&
        ev.encounterId === a.encounterId &&
        ev.organizationId === a.organizationId &&
        ev.unitId === a.unitId &&
        instant(ev.at) &&
        ev.at >= (last?.at ?? a.at) &&
        ((!last && ev.action === 'receive' && ev.note === '') ||
          ((!last || last.action === 'receive') &&
            ev.action === 'return' &&
            present(ev.note, 600)) ||
          (last?.action === 'receive' &&
            ev.action === 'finish' &&
            present(ev.note, 600) &&
            e.status === 'completed' &&
            ev.at === e.completedAt)),
      'Histórico de recebimento no setor inválido.',
    );
    lastEvent.set(ev.assessmentId, ev);
  }
  const lastAssessment = new Map<string, QueueAssessment>();
  for (const a of db.queueAssessments) {
    const prev = lastAssessment.get(a.encounterId);
    if (prev) {
      const passage = lastEvent.get(prev.id);
      requireRule(
        prev.roomId !== 'orientacao' &&
          (!passage || (passage.action === 'return' && passage.at <= a.at)),
        'A avaliação anterior não permite um novo encaminhamento.',
      );
    }
    lastAssessment.set(a.encounterId, a);
  }
  for (const a of db.queueAssessments)
    if (a.roomId === 'orientacao') {
      const e = encounters.get(a.encounterId)!;
      requireRule(
        e.status === 'completed' && e.completedAt === a.at && !a.reviewAt && !e.startedAt,
        'Encerramento por orientação inválido.',
      );
    }
  for (const call of db.calls) {
    if (call.roomStayId === undefined) continue;
    const e = encounters.get(call.encounterId ?? '');
    const s = e?.roomStays?.find((v) => v.id === call.roomStayId);
    requireRule(
      s &&
        s.roomId === call.roomId &&
        call.calledAt >= s.at &&
        (!s.endedAt || call.calledAt <= s.endedAt),
      'Chamada sem reserva de sala correspondente.',
    );
  }
  for (const e of db.encounters) {
    if (e.roomStays === undefined) continue;
    requireRule(Array.isArray(e.roomStays), 'Histórico de sala inválido.');
    let last: string | undefined = e.arrivedAt;
    for (const s of e.roomStays) {
      requireRule(
        last &&
          present(s.id, 150) &&
          !stayIds.has(s.id) &&
          (isConsultRoom(s.roomId) ||
            sectorRooms(db.units.find((u) => u.id === e.unitId)!.kind).some(
              (r) => r.id === s.roomId,
            )) &&
          (localActor(s.actorId, e, false) ||
            (!!people.get(s.actorId) &&
              inUnit(e, people.get(s.actorId)!) &&
              serviceRole(s.roomId, people.get(s.actorId)!.role))) &&
          instant(s.at) &&
          s.at >= last,
        'Reserva ou sequência de salas inválida.',
      );
      stayIds.add(s.id);
      const sector = isSector(s.roomId);
      const validSectorActor = (id: string) => {
        const actor = people.get(id);
        return (
          !!actor &&
          inUnit(e, actor) &&
          (s.roomId === 'escuta-1'
            ? can(actor.role, 'clinical')
            : serviceRole(s.roomId, actor.role))
        );
      };
      if (sector) {
        requireRule(
          !s.segmentId &&
            (!s.enteredAt ||
              (instant(s.enteredAt) && s.enteredAt >= s.at && validSectorActor(s.entryBy!))),
          'Entrada em setor inválida.',
        );
        if (s.roomId === 'escuta-1' && s.outcome === 'triaged') {
          requireRule(
            db.intakes.some((r) => r.encounterId === e.id && r.recordedAt === s.endedAt) ||
              db.queueAssessments.some((a) => a.encounterId === e.id && a.at === s.endedAt),
            'Liberação sem registro da triagem.',
          );
        }
        if (s.roomId !== 'escuta-1') {
          const ref = byAssessment.get(s.sectorRef ?? '');
          requireRule(
            ref &&
              ref.encounterId === e.id &&
              ref.roomId === s.roomId &&
              (!s.enteredAt ||
                db.queueServiceEvents.some(
                  (ev) =>
                    ev.assessmentId === ref.id &&
                    ev.action === 'receive' &&
                    ev.at === s.enteredAt &&
                    ev.actorId === s.entryBy,
                )),
            'Ocupação sem recebimento correspondente.',
          );
          if (s.enteredAt)
            requireRule(
              s.endedAt
                ? db.queueServiceEvents.some(
                    (ev) =>
                      ev.assessmentId === ref.id &&
                      ev.at === s.endedAt &&
                      ev.actorId === s.endedBy &&
                      ev.action === (s.outcome === 'finished' ? 'finish' : 'return'),
                  )
                : lastEvent.get(ref.id)?.action === 'receive',
              'Saída incompatível com o setor.',
            );
        }
      }
      if (!sector && (s.enteredAt !== undefined || s.segmentId !== undefined)) {
        const segment = db.careSegments.find((p) => p.id === s.segmentId && p.encounterId === e.id);
        requireRule(
          segment &&
            s.enteredAt === segment.startedAt &&
            s.enteredAt >= s.at &&
            s.endedAt === segment.endedAt &&
            s.outcome === segment.endReason,
          'Entrada em sala incompatível com o atendimento.',
        );
      }
      if (s.endedAt !== undefined) {
        requireRule(
          instant(s.endedAt) &&
            s.endedAt >= (s.enteredAt ?? s.at) &&
            (localActor(s.endedBy!, e, false) || (sector && validSectorActor(s.endedBy!))) &&
            (s.enteredAt
              ? sector
                ? s.roomId === 'escuta-1'
                  ? s.outcome === 'triaged'
                  : s.outcome === 'returned' || s.outcome === 'finished'
                : s.outcome === 'observation' || s.outcome === 'completed'
              : s.outcome === 'released' && present(s.reason!, 400)),
          'Liberação de sala inválida.',
        );
      } else {
        const key = e.unitId + ':' + s.roomId;
        requireRule(
          s.outcome === undefined &&
            s.endedBy === undefined &&
            !rooms.has(key) &&
            !e.closedWithoutCare &&
            e.status !== 'completed',
          'Ocupação de sala inconsistente.',
        );
        rooms.add(key);
      }
      last = s.endedAt;
    }
  }
}
