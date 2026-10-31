import {
  can,
  type Command,
  type Context,
  type Database,
  type Encounter,
  type QueueAssessment,
  type RoomStay,
  type ServiceTicket,
  type UnitKind,
  type Role,
} from './model';
import { demoIdentities } from './access';
import { DomainError } from './errors';
import { readyForConsultation } from './reception';

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
      const a = recent.get(e.id);
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
  const a = db.queueAssessments.filter((a) => a.encounterId === e.id).at(-1);
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
  const recent = new Map<string, QueueAssessment>();
  for (const a of db.queueAssessments)
    if (a.unitId === c.unitId && a.organizationId === c.organizationId)
      recent.set(a.encounterId, a);
  return db.encounters
    .filter((e) => inUnit(e, c) && e.status === 'waiting' && recent.has(e.id))
    .sort((a, b) => {
      const byRank = recent.get(a.id)!.rank - recent.get(b.id)!.rank;
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
    'Selecione uma faixa e um consultório válidos.',
  );
  const stay = currentStay(e);
  requireRule(
    !stay || stay.roomId === command.roomId,
    'Devolva a senha à fila antes de alterar o consultório reservado.',
  );
  const history = db.queueAssessments.filter((a) => a.encounterId === e.id);
  requireRule(
    db.queueServiceEvents.filter((ev) => ev.assessmentId === history.at(-1)?.id).at(-1)?.action !==
      'receive',
    'O setor já recebeu a pessoa. Registre a devolução antes de reavaliar.',
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
    at >=
      (db.queueServiceEvents.filter((ev) => ev.assessmentId === history.at(-1)?.id).at(-1)?.at ??
        history.at(-1)?.at ??
        e.intakeCompletedAt ??
        e.arrivedAt),
    'Confira o relógio da unidade antes de registrar.',
  );
  const minutes = command.reviewMinutes;
  requireRule(
    minutes === undefined || (Number.isSafeInteger(minutes) && minutes >= 1 && minutes <= 1440),
    'Informe um prazo de reavaliação entre 1 e 1.440 minutos ou deixe em branco.',
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
  const direction =
    e.status === 'waiting'
      ? db.queueAssessments.filter((a) => a.encounterId === e.id).at(-1)?.roomId
      : undefined;
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
    'Esta senha já tem consultório reservado. Devolva-a à fila antes de trocar.',
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
  if (!isConsultRoom(roomId)) {
    const direction = queueDirections(db, c).find((d) => d.encounterId === e.id);
    requireRule(
      !direction || direction.roomId === roomId || roomId === 'recepcao-1',
      'Confira o destino indicado na escuta antes da chamada.',
    );
    requireRule(!own, 'Libere o consultório antes de chamar a pessoa para outro setor.');
    return;
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
  requireRule(inUnit(e, c) && can(c.role, 'queue'), 'Acesso indisponível para esta unidade.');
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
  const byAssessment = new Map(db.queueAssessments.map((a) => [a.id, a]));
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
          isConsultRoom(s.roomId) &&
          localActor(s.actorId, e, false) &&
          instant(s.at) &&
          s.at >= last,
        'Reserva ou sequência de salas inválida.',
      );
      stayIds.add(s.id);
      if (s.enteredAt !== undefined || s.segmentId !== undefined) {
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
            localActor(s.endedBy!, e, false) &&
            (s.enteredAt
              ? s.outcome === 'observation' || s.outcome === 'completed'
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
          'Ocupação de consultório inconsistente.',
        );
        rooms.add(key);
      }
      last = s.endedAt;
    }
  }
}
