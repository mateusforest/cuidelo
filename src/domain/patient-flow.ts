import { activeEncounter } from './model';
import { can, type Context, type Database, type Encounter } from './model';
import { demoIdentities } from './access';
import { dateKey, validDay } from './dates';
import { DomainError } from './errors';
import { nextTicket } from './queue';
import { cpfDigits, validCpf, normalizedName } from './identification';
import { lastReceptionCheck } from './reception';
import { preferenceReasons, servicesForUnit, type PreferenceReason } from './kiosk-options';
export { kioskServices } from './kiosk-options';

export function ownCare(e: Encounter, c: Context) {
  if (e.professionalId !== c.sessionId)
    throw new DomainError(
      'Assuma este atendimento antes de registrar. Um atendimento em curso pertence ao profissional responsável.',
      'permission',
    );
}
export function startCare(db: Database, c: Context, e: Encounter, at: string, id: () => string) {
  if (!activeEncounter(e) || db.careSegments.some((s) => s.encounterId === e.id && !s.endedAt))
    throw new DomainError(
      'Este atendimento já está em curso com um profissional ou foi concluído.',
      'conflict',
    );
  if (db.careSegments.some((s) => s.professionalId === c.sessionId && !s.endedAt))
    throw new DomainError(
      'Conclua ou encaminhe à observação o atendimento que está em curso com você.',
      'conflict',
    );
  if (e.intakeStartedAt && !e.intakeCompletedAt)
    throw new DomainError('Conclua a escuta antes de iniciar a consulta.', 'conflict');
  e.professionalId = c.sessionId;
  const segmentId = id();
  db.careSegments.push({
    id: segmentId,
    organizationId: c.organizationId,
    unitId: c.unitId,
    encounterId: e.id,
    professionalId: c.sessionId,
    startedAt: at,
  });
  return segmentId;
}
export function closeCare(
  db: Database,
  encounterId: string,
  at: string,
  reason: 'observation' | 'completed',
) {
  const segment = db.careSegments.find((s) => s.encounterId === encounterId && !s.endedAt);
  if (segment) {
    segment.endedAt = at;
    segment.endReason = reason;
  }
}
export interface KioskRequest {
  organizationId: string;
  unitId: string;
  service: string;
  priority: 'routine' | 'priority';
  identification?: { kind: 'cpf' | 'name'; value: string; birthDate: string };
  preferenceReason?: PreferenceReason;
  requestId: string;
}
export interface TicketReceipt {
  priority: 'routine' | 'priority';
  preferenceNeedsReview?: boolean;
  ticket: string;
  unitName: string;
  service: string;
  issuedAt: string;
  needsIdentification: boolean;
  existing: boolean;
}
export function issueKiosk(
  db: Database,
  request: KioskRequest,
  now: Date,
  id = () => crypto.randomUUID(),
): TicketReceipt {
  const unit = db.units.find(
    (u) => u.id === request.unitId && u.organizationId === request.organizationId,
  );
  if (!unit) throw new DomainError('Totem não configurado para esta unidade.', 'scope');
  if (
    !servicesForUnit(unit.kind).some((s) => s.value === request.service) ||
    !['routine', 'priority'].includes(request.priority) ||
    !/^[\w-]{8,80}$/.test(request.requestId)
  )
    throw new DomainError('Revise o serviço e a identificação da solicitação.');
  const reason =
    request.priority === 'priority' ? (request.preferenceReason ?? 'reception') : undefined;
  if (
    (reason && !preferenceReasons.some((r) => r.id === reason)) ||
    (request.priority === 'routine' && request.preferenceReason)
  )
    throw new DomainError('Revise a opção de atendimento preferencial.');
  const prior = db.kioskArrivals.find(
    (a) =>
      a.id === request.requestId &&
      a.organizationId === unit.organizationId &&
      a.unitId === unit.id,
  );
  if (prior)
    return {
      priority: db.encounters.find((e) => e.id === prior.encounterId)?.priority ?? prior.priority,
      preferenceNeedsReview: prior.preferenceNeedsReview,
      ticket: prior.ticket,
      unitName: unit.name,
      service: prior.service,
      issuedAt: prior.arrivedAt,
      needsIdentification: !prior.encounterId,
      existing: true,
    };
  if (db.kioskArrivals.some((a) => a.id === request.requestId))
    throw new DomainError(
      'Solicitação já utilizada em outro dispositivo. Reinicie a retirada de senha.',
      'conflict',
    );
  const identification = request.identification;
  let patient;
  if (identification !== undefined) {
    if (
      !identification ||
      !['cpf', 'name'].includes(identification.kind) ||
      typeof identification.value !== 'string' ||
      !identification.value.trim() ||
      identification.value.length > 120 ||
      !validDay(identification.birthDate) ||
      identification.birthDate > dateKey(now)
    )
      throw new DomainError('Informe CPF ou nome completo e uma data de nascimento válida.');
    const value = identification.value.trim();
    if (identification.kind === 'cpf' && !validCpf(value))
      throw new DomainError('Confira o CPF: informe os 11 números e verifique a digitação.');
    if (identification.kind === 'name' && normalizedName(value).split(' ').length < 2)
      throw new DomainError('Informe o nome completo, como está no cadastro.');
    const matches = db.patients.filter(
      (p) =>
        p.organizationId === unit.organizationId &&
        p.birthDate === identification.birthDate &&
        (identification.kind === 'cpf'
          ? p.cpf === cpfDigits(value)
          : [p.name, p.socialName]
              .filter(Boolean)
              .some((n) => normalizedName(n) === normalizedName(value))),
    );
    if (matches.length > 1)
      throw new DomainError(
        'Não foi possível identificar com segurança. Use o CPF ou retire uma senha para a recepção.',
      );
    if (!matches.length)
      throw new DomainError(
        'Não foi possível confirmar o cadastro. Confira os dados ou retire uma senha para a recepção.',
      );
    patient = matches[0];
  }
  const existing =
    patient &&
    db.encounters.find(
      (e) =>
        e.organizationId === unit.organizationId &&
        e.unitId === unit.id &&
        e.patientId === patient.id &&
        activeEncounter(e),
    );
  if (existing && dateKey(new Date(existing.arrivedAt)) !== dateKey(now))
    throw new DomainError(
      'Há um atendimento de outro dia em aberto. Procure a recepção para conferir sua chegada.',
    );
  if (existing) {
    if (existing.status === 'waiting' && !existing.intakeStartedAt)
      existing.receptionRequired = true;
    const review =
      request.priority === 'priority' &&
      (existing.status !== 'waiting' || !!lastReceptionCheck(existing)) &&
      (existing.priority !== 'priority' || existing.preferenceReason !== reason);
    if (
      request.priority === 'priority' &&
      existing.status === 'waiting' &&
      !lastReceptionCheck(existing) &&
      (existing.priority !== 'priority' || (existing.preferenceReason ?? 'reception') !== reason)
    ) {
      existing.priority = 'priority';
      existing.preferenceReason = reason;
      for (const a of db.kioskArrivals.filter((a) => a.encounterId === existing.id)) {
        a.priority = 'priority';
        a.preferenceReason = reason;
      }
      db.audit.push({
        id: id(),
        organizationId: unit.organizationId,
        unitId: unit.id,
        at: now.toISOString(),
        actor: 'Totem · demonstração',
        entityId: existing.id,
        action: 'Preferência administrativa solicitada no totem',
      });
    }
    db.kioskArrivals.push({
      id: request.requestId,
      organizationId: unit.organizationId,
      unitId: unit.id,
      ticket: existing.ticket,
      service: existing.service,
      priority: existing.priority,
      ...(existing.preferenceReason ? { preferenceReason: existing.preferenceReason } : {}),
      preferenceNeedsReview: review,
      arrivedAt: existing.arrivedAt,
      encounterId: existing.id,
    });
    db.audit.push({
      id: id(),
      organizationId: unit.organizationId,
      unitId: unit.id,
      at: now.toISOString(),
      actor: 'Totem · demonstração',
      entityId: existing.id,
      action: 'Senha existente recuperada no totem',
    });
    db.revision++;
    return {
      priority: existing.priority,
      preferenceNeedsReview: review,
      ticket: existing.ticket,
      unitName: unit.name,
      service: existing.service,
      issuedAt: existing.arrivedAt,
      needsIdentification: false,
      existing: true,
    };
  }
  const at = now.toISOString(),
    ticket = nextTicket(
      [...db.encounters, ...db.kioskArrivals],
      unit.organizationId,
      unit.id,
      dateKey(now),
    );
  const encounterId = patient ? id() : undefined;
  db.kioskArrivals.push({
    id: request.requestId,
    organizationId: unit.organizationId,
    unitId: unit.id,
    ticket,
    service: request.service,
    priority: request.priority,
    ...(reason ? { preferenceReason: reason } : {}),
    arrivedAt: at,
    encounterId,
  });
  if (patient && encounterId)
    db.encounters.push({
      id: encounterId,
      organizationId: unit.organizationId,
      unitId: unit.id,
      patientId: patient.id,
      ticket,
      service: request.service,
      priority: request.priority,
      ...(reason ? { preferenceReason: reason } : {}),
      arrivedAt: at,
      status: 'waiting',
      source: 'kiosk',
      receptionRequired: true,
    });
  db.audit.push({
    id: id(),
    organizationId: unit.organizationId,
    unitId: unit.id,
    at,
    actor: 'Totem · demonstração',
    entityId: encounterId ?? request.requestId,
    action: `Senha ${ticket} emitida no totem`,
  });
  db.revision++;
  return {
    priority: request.priority,
    ticket,
    unitName: unit.name,
    service: request.service,
    issuedAt: at,
    needsIdentification: !patient,
    existing: false,
  };
}

const elapsed = (a?: string, b?: string) =>
  a && b ? Math.max(0, (Date.parse(b) - Date.parse(a)) / 60000) : null;
const sample = (values: (number | null)[]) => {
  const known = values.filter((n): n is number => n !== null);
  return {
    count: known.length,
    average: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
  };
};
export function performance(db: Database, c: Context, from: string, to: string, now: Date) {
  if (!can(c.role, 'performance'))
    throw new DomainError('Este perfil não tem acesso aos indicadores.', 'permission');
  if (!validDay(from) || !validDay(to) || from > to)
    throw new DomainError('Informe um período válido.');
  const own = !can(c.role, 'manage');
  const scoped = (x: { organizationId: string; unitId: string }) =>
    x.organizationId === c.organizationId && (c.unitId === 'all' || x.unitId === c.unitId);
  const entries = db.encounters.filter(
    (e) =>
      scoped(e) && dateKey(new Date(e.arrivedAt)) >= from && dateKey(new Date(e.arrivedAt)) <= to,
  );
  const ids = new Set(entries.map((e) => e.id));
  const segments = db.careSegments.filter(
    (s) => scoped(s) && ids.has(s.encounterId) && (!own || s.professionalId === c.sessionId),
  );
  const encounters = own
    ? entries.filter((e) => segments.some((s) => s.encounterId === e.id))
    : entries;
  const identities = demoIdentities(db);
  const passages = new Map(db.queueServiceEvents.map((ev) => [ev.encounterId, ev.action]));
  const awaiting = (e: Encounter) =>
    e.status === 'waiting' &&
    passages.get(e.id) !== 'receive' &&
    !e.receptionHold &&
    !(e.intakeStartedAt && !e.intakeCompletedAt);
  return {
    arrivals: encounters.length,
    waiting: encounters.filter(awaiting).length,
    reception: sample(
      encounters.map((e) =>
        elapsed(
          e.arrivedAt,
          e.intakeStartedAt ??
            (!db.intakes.some((r) => r.encounterId === e.id) ? e.startedAt : undefined),
        ),
      ),
    ),
    beforeReception: sample(encounters.map((e) => elapsed(e.arrivedAt, e.receptionStartedAt))),
    desk: sample(encounters.map((e) => elapsed(e.receptionStartedAt, e.receptionChecks?.[0]?.at))),
    beforeTriage: sample(
      encounters.map((e) =>
        lastReceptionCheck(e)?.destination === 'triage'
          ? elapsed(lastReceptionCheck(e)?.at, e.intakeStartedAt)
          : null,
      ),
    ),
    unidentifiedWaiting: own
      ? 0
      : db.kioskArrivals.filter(
          (a) =>
            scoped(a) &&
            !a.encounterId &&
            !a.receptionHold &&
            dateKey(new Date(a.arrivedAt)) >= from &&
            dateKey(new Date(a.arrivedAt)) <= to,
        ).length,
    byReception: own
      ? []
      : [...new Set(encounters.map((e) => e.receptionStartedBy).filter(Boolean))].map((actorId) => {
          const list = encounters.filter((e) => e.receptionStartedBy === actorId);
          return {
            actorId,
            name: identities.find((i) => i.sessionId === actorId)?.name ?? 'Profissional',
            unitName: db.units.find((u) => u.id === list[0].unitId)?.name ?? '',
            checked: list.filter((e) => e.receptionChecks?.length).length,
            duration: sample(
              list.map((e) => elapsed(e.receptionStartedAt, e.receptionChecks?.[0]?.at)),
            ),
          };
        }),
    intake: sample(encounters.map((e) => elapsed(e.intakeStartedAt, e.intakeCompletedAt))),
    beforeConsult: sample(encounters.map((e) => elapsed(e.intakeCompletedAt, e.startedAt))),
    total: sample(encounters.map((e) => elapsed(e.arrivedAt, e.completedAt))),
    unassigned: encounters.filter((e) => !db.careSegments.some((s) => s.encounterId === e.id))
      .length,
    currentWait: sample(
      encounters
        .filter(awaiting)
        .map((e) => elapsed(e.intakeCompletedAt ?? e.arrivedAt, now.toISOString())),
    ),
    byProfessional: [...new Set(segments.map((s) => s.professionalId))].map((professionalId) => {
      const list = segments.filter((s) => s.professionalId === professionalId);
      return {
        professionalId,
        name:
          identities.find((i) => i.sessionId === professionalId)?.name ??
          'Profissional não identificado',
        unitName: db.units.find((u) => u.id === list[0].unitId)?.name ?? '',
        patients: new Set(list.map((s) => s.encounterId)).size,
        active: list.filter((s) => !s.endedAt).length,
        duration: sample(list.filter((s) => s.endedAt).map((s) => elapsed(s.startedAt, s.endedAt))),
        activeMinutes: list
          .filter((s) => !s.endedAt)
          .reduce((n, s) => n + (elapsed(s.startedAt, now.toISOString()) ?? 0), 0),
      };
    }),
    byUnit: db.units
      .filter(
        (u) => u.organizationId === c.organizationId && (c.unitId === 'all' || u.id === c.unitId),
      )
      .map((u) => ({
        name: u.name,
        arrivals: encounters.filter((e) => e.unitId === u.id).length,
        completed: encounters.filter((e) => e.unitId === u.id && e.status === 'completed').length,
        waiting: encounters.filter((e) => e.unitId === u.id && awaiting(e)).length,
      })),
  };
}
export type PerformanceReport = ReturnType<typeof performance>;
