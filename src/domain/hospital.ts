import { can, type Admission, type Database } from './model';
import { demoIdentities } from './access';
import { DomainError } from './errors';

export function checkMovementTime(admission: Admission, now: Date) {
  const latest = admission.transfers?.at(-1)?.at ?? admission.admittedAt;
  if (now.getTime() < Date.parse(latest))
    throw new DomainError(
      'Confira o relógio. A movimentação deve ser posterior ou igual ao último registro da internação.',
    );
}

export function validateAdmissions(db: Database) {
  const activeBeds = new Set<string>();
  const activePatients = new Set<string>();
  const staff = new Map(demoIdentities(db).map((person) => [person.sessionId, person]));
  const beds = new Map(db.beds.map((bed) => [bed.id, bed]));
  for (const admission of db.admissions) {
    const bed = beds.get(admission.bedId);
    const localBed = (id: string) => {
      const candidate = beds.get(id);
      return (
        candidate?.organizationId === admission.organizationId &&
        candidate.unitId === admission.unitId
      );
    };
    const opened = Date.parse(admission.admittedAt);
    const closed =
      admission.dischargedAt === undefined ? undefined : Date.parse(admission.dischargedAt);
    if (
      !bed ||
      !localBed(bed.id) ||
      !Number.isFinite(opened) ||
      (closed !== undefined && (!Number.isFinite(closed) || closed < opened)) ||
      (admission.transfers !== undefined && !Array.isArray(admission.transfers))
    )
      throw new DomainError('Internação ou data de movimentação inválida.');
    let previousBed: string | undefined;
    let previousTime = opened;
    for (const move of admission.transfers ?? []) {
      const person = staff.get(move.actorId);
      const at = Date.parse(move.at);
      if (
        !person ||
        !can(person.role, 'beds') ||
        person.unitId !== admission.unitId ||
        person.organizationId !== admission.organizationId ||
        !localBed(move.fromBedId) ||
        !localBed(move.toBedId) ||
        move.fromBedId === move.toBedId ||
        (previousBed && previousBed !== move.fromBedId) ||
        typeof move.reason !== 'string' ||
        !move.reason.trim() ||
        move.reason.length > 1000 ||
        !Number.isFinite(at) ||
        at < previousTime ||
        (closed !== undefined && at > closed)
      )
        throw new DomainError('Histórico de transferência de leito inconsistente.');
      previousBed = move.toBedId;
      previousTime = at;
    }
    if (previousBed && previousBed !== bed.id)
      throw new DomainError('Leito atual difere do histórico.');
    if (closed === undefined) {
      if (
        bed.status !== 'occupied' ||
        activeBeds.has(bed.id) ||
        activePatients.has(admission.patientId)
      )
        throw new DomainError('Ocupação hospitalar incompatível com as internações ativas.');
      activeBeds.add(bed.id);
      activePatients.add(admission.patientId);
    }
  }
  if (db.beds.some((bed) => bed.status === 'occupied' && !activeBeds.has(bed.id)))
    throw new DomainError('Há leito ocupado sem internação ativa.');
}
