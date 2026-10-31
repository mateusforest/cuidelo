import { activeEncounter } from './model';
import type { Database, Encounter, QueueCall, Unit } from './model';
import { dateKey } from './dates';
import { DomainError } from './errors';

export interface Room {
  id: string;
  name: string;
  direction: string;
}
export interface DisplayCall {
  id: string;
  ticket: string;
  room: string;
  direction: string;
  calledAt: string;
}
export interface DisplayFeed {
  unitName: string;
  organizationName: string;
  current: DisplayCall | null;
  recent: DisplayCall[];
}
export function roomsForUnit(unit: Unit): Room[] {
  return [
    { id: 'recepcao-1', name: 'Guichê 01', direction: 'Recepção · entrada principal' },
    {
      id: 'escuta-1',
      name: 'Triagem · Sala 01',
      direction: 'Corredor principal · primeira porta à direita',
    },
    {
      id: 'consultorio-1',
      name: 'Consultório 01',
      direction: 'Corredor principal · lado esquerdo',
    },
    { id: 'consultorio-2', name: 'Consultório 02', direction: 'Corredor principal · lado direito' },
    { id: 'enfermagem-1', name: 'Enfermagem', direction: 'Dirija-se à sala de enfermagem' },
    { id: 'farmacia-1', name: 'Farmácia', direction: 'Ao final do corredor principal' },
    unit.kind === 'ubs'
      ? { id: 'vacina-1', name: 'Sala de vacina', direction: 'Corredor lateral · segunda porta' }
      : { id: 'sala-3', name: 'Sala 03', direction: 'Corredor lateral · primeira porta' },
  ];
}
export function nextTicket(
  encounters: Pick<Encounter, 'organizationId' | 'unitId' | 'arrivedAt' | 'ticket'>[],
  organizationId: string,
  unitId: string,
  day: string,
): string {
  const sequence =
    Math.max(
      0,
      ...encounters
        .filter(
          (e) =>
            e.organizationId === organizationId &&
            e.unitId === unitId &&
            dateKey(new Date(e.arrivedAt)) === day,
        )
        .map((e) => Number(e.ticket?.split('-')[1]) || 0),
    ) + 1;
  if (sequence > 9999)
    throw new DomainError('O limite de senhas desta unidade para o dia foi atingido.');
  return `A-${String(sequence).padStart(3, '0')}`;
}
// Migra somente os números ausentes do cenário anterior, preservando os registros.
export function assignMissingTickets(encounters: Encounter[]) {
  const assigned: Encounter[] = [];
  for (const e of [...encounters].sort(
    (a, b) => a.arrivedAt.localeCompare(b.arrivedAt) || a.id.localeCompare(b.id),
  )) {
    if (!e.ticket)
      e.ticket = nextTicket(assigned, e.organizationId, e.unitId, dateKey(new Date(e.arrivedAt)));
    assigned.push(e);
  }
}
export function makeQueueCall(
  db: Database,
  encounter: Encounter,
  roomId: string,
  now: Date,
  id: string,
): QueueCall {
  if (!activeEncounter(encounter)) throw new DomainError('Este atendimento já foi concluído.');
  if (dateKey(new Date(encounter.arrivedAt)) !== dateKey(now))
    throw new DomainError('Só é possível chamar senhas emitidas hoje.');
  const unit = db.units.find(
    (u) => u.id === encounter.unitId && u.organizationId === encounter.organizationId,
  );
  if (!unit || !roomsForUnit(unit).some((r) => r.id === roomId))
    throw new DomainError('Selecione um local de atendimento desta unidade.');
  return {
    id,
    organizationId: encounter.organizationId,
    unitId: encounter.unitId,
    encounterId: encounter.id,
    ticket: encounter.ticket,
    roomId,
    calledAt: now.toISOString(),
  };
}
// Projeção da TV: nunca inclui nome, prontuário, paciente, prioridade ou dados clínicos.
export function readDisplay(
  db: Database,
  organizationId: string,
  unitId: string,
  now = new Date(),
): DisplayFeed {
  const org = db.organizations.find((o) => o.id === organizationId);
  const unit = db.units.find((u) => u.id === unitId && u.organizationId === organizationId);
  if (!org || !unit) throw new DomainError('Painel não encontrado nesta rede.', 'scope');
  const rooms = roomsForUnit(unit);
  const list = db.calls
    .filter(
      (c) =>
        c.organizationId === organizationId &&
        c.unitId === unitId &&
        dateKey(new Date(c.calledAt)) === dateKey(now),
    )
    .slice()
    .reverse()
    .sort((a, b) => b.calledAt.localeCompare(a.calledAt));
  const seen = new Set<string>();
  const calls: DisplayCall[] = [];
  for (const call of list) {
    if (seen.has(call.ticket)) continue;
    const room = rooms.find((r) => r.id === call.roomId);
    if (!room) continue;
    seen.add(call.ticket);
    calls.push({
      id: call.id,
      ticket: call.ticket,
      room: room.name,
      direction: room.direction,
      calledAt: call.calledAt,
    });
    if (calls.length === 5) break;
  }
  const announced = list[0];
  const released =
    !!announced?.roomStayId &&
    db.encounters
      .find((e) => e.id === announced.encounterId)
      ?.roomStays?.some((s) => s.id === announced.roomStayId && s.outcome === 'released');
  return {
    unitName: unit.name,
    organizationName: org.shortName,
    current: released ? null : (calls[0] ?? null),
    recent: released ? calls.slice(0, 4) : calls.slice(1),
  };
}
