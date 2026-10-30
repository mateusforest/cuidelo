import { validateContinuity } from '../domain/continuity';
import { validateAdministrativeHistory } from '../domain/administrative-records';
import { validatePharmacy } from '../domain/pharmacy';
import type { Command, Context, Database } from '../domain/model';
import {
  applyCommand,
  assertContext,
  DomainError,
  readSnapshot,
  readSummary,
} from '../domain/operations';
import { issueKiosk, performance, type KioskRequest } from '../domain/patient-flow';
import { moduleFor, workMetrics } from '../domain/work-modules';
import { validDay, dateKey } from '../domain/dates';
import { createSeed } from './seed';
import type { CareRepository } from './repository';
import { assignMissingTickets, readDisplay } from '../domain/queue';
import { validateIntakeContent } from '../domain/intake';
import { validateVaccinationDatabase } from '../domain/vaccination-validation';
import { validCpf } from '../domain/identification';
import { preferenceReasons } from '../domain/kiosk-options';
import { validateReceptionDatabase } from '../domain/reception';
import { validateClinicalDocuments } from '../domain/clinical-documents';

export const storageKey = 'cuidelo.demo.database.v1';
type LocalStorage = Pick<Storage, 'getItem' | 'setItem'>;
const collections = [
  'dispensations',
  'clinicalDocuments',
  'workRecords',
  'careSegments',
  'kioskArrivals',
  'organizations',
  'units',
  'patients',
  'appointments',
  'encounters',
  'notes',
  'beds',
  'admissions',
  'lots',
  'movements',
  'referrals',
  'audit',
  'calls',
  'intakes',
  'addenda',
  'vaccineLots',
  'vaccineMovements',
  'immunizations',
  'vaccineVoids',
  'vaccineRecalls',
] as const;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
function parseDatabase(value: string): Database {
  const db: unknown = JSON.parse(value);
  if (isRecord(db) && db.schemaVersion === 1 && Array.isArray(db.encounters)) {
    // A migração é gravada na próxima operação bem-sucedida; o dado antigo não é apagado.
    db.schemaVersion = 2;
    db.calls = [];
    assignMissingTickets(db.encounters as Database['encounters']);
  }
  if (isRecord(db) && db.schemaVersion === 2) {
    db.schemaVersion = 3;
    db.intakes = [];
    db.addenda = [];
  }
  if (isRecord(db) && db.schemaVersion === 3) {
    db.schemaVersion = 4;
    db.vaccineLots = [];
    db.vaccineMovements = [];
    db.immunizations = [];
    db.vaccineVoids = [];
    db.vaccineRecalls = [];
  }
  if (isRecord(db) && db.schemaVersion === 4) {
    db.schemaVersion = 5;
    db.careSegments = [];
    db.kioskArrivals = [];
    db.workRecords = [];
  }
  if (isRecord(db) && db.schemaVersion === 5 && Array.isArray(db.patients)) {
    const initial = createSeed().patients;
    for (const p of db.patients) {
      if (!isRecord(p) || p.cpf !== undefined) continue;
      const fixture = initial.find(
        (f) =>
          f.id === p.id &&
          f.organizationId === p.organizationId &&
          f.name === p.name &&
          f.birthDate === p.birthDate &&
          f.record === p.record,
      );
      if (fixture) p.cpf = fixture.cpf;
    }
    db.schemaVersion = 6;
  }
  if (isRecord(db) && db.schemaVersion === 6) {
    db.schemaVersion = 7;
    if (Array.isArray(db.encounters))
      for (const e of db.encounters) {
        if (isRecord(e) && e.source === 'kiosk' && e.status === 'waiting' && !e.intakeStartedAt)
          e.receptionRequired = true;
      }
  }
  if (isRecord(db) && db.schemaVersion === 7) {
    db.schemaVersion = 8;
    db.clinicalDocuments = [];
  }
  if (isRecord(db) && db.schemaVersion === 8) {
    db.schemaVersion = 9;
    db.dispensations = [];
  }
  if (
    !isRecord(db) ||
    db.schemaVersion !== 9 ||
    !Number.isSafeInteger(db.revision) ||
    Number(db.revision) < 0
  )
    throw new Error('Incompatible database');
  for (const key of collections) {
    const rows = db[key];
    if (!Array.isArray(rows) || rows.some((r) => !isRecord(r) || typeof r.id !== 'string' || !r.id))
      throw new Error('Invalid collection');
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error('Duplicate identifiers');
  }
  const typed = db as unknown as Database;
  const cpfKeys = typed.patients.filter((p) => p.cpf).map((p) => `${p.organizationId}:${p.cpf}`);
  if (
    new Set(cpfKeys).size !== cpfKeys.length ||
    typed.patients.some(
      (p) => p.cpf !== undefined && (typeof p.cpf !== 'string' || !validCpf(p.cpf)),
    )
  )
    throw new Error('Invalid patient CPF');
  for (const e of [...typed.encounters, ...typed.kioskArrivals])
    if (
      e.preferenceReason !== undefined &&
      (e.priority !== 'priority' || !preferenceReasons.some((r) => r.id === e.preferenceReason))
    )
      throw new Error('Invalid administrative preference');
  for (const r of typed.workRecords) {
    const m = moduleFor(r.module);
    if (
      !m.states[r.status] ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      !isRecord(r.values) ||
      Object.values(r.values).some((v) => typeof v !== 'string') ||
      !Array.isArray(r.history) ||
      !r.history.length ||
      r.history.some(
        (h) =>
          typeof h.action !== 'string' ||
          typeof h.reason !== 'string' ||
          !Number.isFinite(Date.parse(h.at)),
      )
    )
      throw new Error('Invalid work record');
    if (r.organizationId === 'cuidelo' && (m.permission !== 'business' || r.unitId !== 'office'))
      throw new Error('Invalid business scope');
    if (m.permission === 'business' && r.organizationId !== 'cuidelo')
      throw new Error('Invalid business organization');
    if (r.unitId === 'all' && !m.network) throw new Error('Invalid network record');
    for (const f of m.fields) {
      const value = r.values[f.key];
      if (
        typeof value !== 'string' ||
        (!f.optional && !value.trim()) ||
        (f.type === 'date' && value && !validDay(value))
      )
        throw new Error('Invalid module fields');
      if (
        f.type === 'reference' &&
        !typed.workRecords.some(
          (p) =>
            p.id === value &&
            p.module === f.reference &&
            p.organizationId === r.organizationId &&
            p.unitId === r.unitId,
        )
      )
        throw new Error('Invalid module reference');
      if (
        f.type === 'patient' &&
        !typed.patients.some((p) => p.id === value && p.organizationId === r.organizationId)
      )
        throw new Error('Invalid module patient');
    }
  }
  for (const s of typed.careSegments) {
    const e = typed.encounters.find(
      (e) =>
        e.id === s.encounterId && e.unitId === s.unitId && e.organizationId === s.organizationId,
    );
    if (
      !e ||
      typeof s.professionalId !== 'string' ||
      !Number.isFinite(Date.parse(s.startedAt)) ||
      (s.endedAt && (!Number.isFinite(Date.parse(s.endedAt)) || s.endedAt < s.startedAt))
    )
      throw new Error('Invalid care segment');
  }
  const active = typed.careSegments.filter((s) => !s.endedAt);
  if (
    new Set(active.map((s) => s.encounterId)).size !== active.length ||
    new Set(active.map((s) => s.professionalId)).size !== active.length
  )
    throw new Error('Conflicting active consultations');
  for (const a of typed.kioskArrivals) {
    if (
      !/^A-\d{3,4}$/.test(a.ticket) ||
      !Number.isFinite(Date.parse(a.arrivedAt)) ||
      typeof a.service !== 'string' ||
      !['routine', 'priority'].includes(a.priority) ||
      (a.encounterId &&
        !typed.encounters.some(
          (e) =>
            e.id === a.encounterId &&
            e.unitId === a.unitId &&
            e.organizationId === a.organizationId &&
            e.ticket === a.ticket,
        ))
    )
      throw new Error('Invalid kiosk arrival');
  }
  const strings = (row: unknown, fields: string[]) =>
    isRecord(row) && fields.every((f) => typeof row[f] === 'string');
  if (
    !typed.organizations.length ||
    typed.organizations.some((r) => !strings(r, ['name', 'shortName']))
  )
    throw new Error('Invalid organizations');
  for (const key of collections.filter((k) => k !== 'organizations'))
    for (const row of typed[key]) {
      if (
        (key === 'workRecords' || key === 'audit') &&
        row.organizationId === 'cuidelo' &&
        'unitId' in row &&
        row.unitId === 'office'
      )
        continue;
      if (
        !('organizationId' in row) ||
        !typed.organizations.some((o) => o.id === row.organizationId)
      )
        throw new Error('Invalid organization link');
      if (
        'unitId' in row &&
        !((key === 'workRecords' || key === 'audit') && row.unitId === 'all') &&
        !typed.units.some((u) => u.id === row.unitId && u.organizationId === row.organizationId)
      )
        throw new Error('Invalid unit link');
      if (
        'patientId' in row &&
        !typed.patients.some(
          (p) => p.id === row.patientId && p.organizationId === row.organizationId,
        )
      )
        throw new Error('Invalid patient link');
    }
  if (
    typed.units.some(
      (r) => !strings(r, ['name', 'district']) || !['ubs', 'upa', 'hospital'].includes(r.kind),
    )
  )
    throw new Error('Invalid units');
  if (
    typed.patients.some(
      (r) =>
        !strings(r, ['name', 'socialName', 'birthDate', 'phone', 'record']) ||
        !validDay(r.birthDate) ||
        !Array.isArray(r.allergies) ||
        r.allergies.some((a) => typeof a !== 'string'),
    )
  )
    throw new Error('Invalid patients');
  if (
    typed.appointments.some(
      (r) =>
        !strings(r, ['patientId', 'unitId', 'professional', 'service', 'date', 'time']) ||
        !['scheduled', 'checked-in', 'cancelled'].includes(r.status) ||
        !Number.isInteger(r.duration) ||
        r.duration <= 0,
    )
  )
    throw new Error('Invalid appointments');
  if (
    typed.encounters.some(
      (r) =>
        !strings(r, ['patientId', 'unitId', 'service', 'arrivedAt', 'ticket']) ||
        !/^A-\d{3,4}$/.test(r.ticket) ||
        !['waiting', 'in-care', 'observation', 'completed'].includes(r.status) ||
        !Number.isFinite(Date.parse(r.arrivedAt)),
    )
  )
    throw new Error('Invalid encounters');
  const ticketKeys = typed.encounters.map(
    (e) => `${e.organizationId}:${e.unitId}:${dateKey(new Date(e.arrivedAt))}:${e.ticket}`,
  );
  ticketKeys.push(
    ...typed.kioskArrivals
      .filter((a) => !a.encounterId)
      .map((a) => `${a.organizationId}:${a.unitId}:${dateKey(new Date(a.arrivedAt))}:${a.ticket}`),
  );
  if (new Set(ticketKeys).size !== ticketKeys.length) throw new Error('Duplicate tickets');
  if (
    typed.calls.some(
      (c) =>
        !strings(c, ['unitId', 'ticket', 'roomId', 'calledAt']) ||
        !Number.isFinite(Date.parse(c.calledAt)) ||
        Boolean(c.encounterId) === Boolean(c.arrivalId) ||
        !(c.arrivalId ? typed.kioskArrivals : typed.encounters).some(
          (e) =>
            e.id === (c.encounterId ?? c.arrivalId) &&
            e.unitId === c.unitId &&
            e.organizationId === c.organizationId &&
            e.ticket === c.ticket,
        ),
    )
  )
    throw new Error('Invalid queue calls');
  if (
    typed.notes.some(
      (r) =>
        !strings(r, ['patientId', 'unitId', 'encounterId', 'author', 'updatedAt']) ||
        !strings(r.soap, ['subjective', 'objective', 'assessment', 'plan']) ||
        !['draft', 'final'].includes(r.status),
    )
  )
    throw new Error('Invalid notes');
  if (
    typed.beds.some(
      (r) =>
        !strings(r, ['unitId', 'name', 'ward']) ||
        !['available', 'occupied', 'cleaning', 'blocked'].includes(r.status),
    )
  )
    throw new Error('Invalid beds');
  if (
    typed.admissions.some(
      (r) =>
        !strings(r, ['unitId', 'patientId', 'bedId', 'admittedAt']) ||
        !typed.beds.some(
          (b) => b.id === r.bedId && b.unitId === r.unitId && b.organizationId === r.organizationId,
        ),
    )
  )
    throw new Error('Invalid admissions');
  if (
    typed.lots.some(
      (r) =>
        !strings(r, ['unitId', 'product', 'presentation', 'lot', 'expiresAt']) ||
        !validDay(r.expiresAt) ||
        !Number.isSafeInteger(r.quantity) ||
        r.quantity < 0 ||
        !Number.isFinite(r.minimum),
    )
  )
    throw new Error('Invalid lots');
  if (
    typed.movements.some(
      (r) =>
        !strings(r, ['unitId', 'lotId', 'reason', 'at']) ||
        !['entry', 'exit'].includes(r.kind) ||
        !Number.isSafeInteger(r.quantity) ||
        r.quantity <= 0,
    )
  )
    throw new Error('Invalid movements');
  if (
    typed.referrals.some(
      (r) =>
        !strings(r, ['unitId', 'patientId', 'specialty', 'destination', 'reason', 'createdAt']) ||
        !['requested', 'scheduled', 'cancelled', 'completed'].includes(r.status),
    )
  )
    throw new Error('Invalid referrals');
  if (typed.audit.some((r) => !strings(r, ['unitId', 'at', 'actor', 'action', 'entityId'])))
    throw new Error('Invalid audit');
  for (const r of typed.intakes) {
    validateIntakeContent(r);
    if (
      !strings(r, ['unitId', 'patientId', 'encounterId', 'author', 'recordedAt']) ||
      !Number.isFinite(Date.parse(r.recordedAt)) ||
      !['initial', 'reassessment', 'correction'].includes(r.kind) ||
      !typed.encounters.some(
        (e) =>
          e.id === r.encounterId &&
          e.unitId === r.unitId &&
          e.organizationId === r.organizationId &&
          e.patientId === r.patientId,
      )
    )
      throw new Error('Invalid intake');
    const previous = typed.intakes
      .slice(0, typed.intakes.indexOf(r))
      .filter((i) => i.encounterId === r.encounterId);
    if (r.kind === 'initial' ? previous.length > 0 || !r.complaint.trim() : !previous.length)
      throw new Error('Invalid intake sequence');
    if (r.kind === 'correction') {
      const sourceIndex = typed.intakes.findIndex(
        (i) => i.id === r.correctionOf && i.encounterId === r.encounterId,
      );
      if (
        sourceIndex < 0 ||
        sourceIndex >= typed.intakes.indexOf(r) ||
        !r.correctionReason?.trim() ||
        r.correctionReason.length > 1000 ||
        typed.intakes.filter((i) => i.correctionOf === r.correctionOf).length !== 1
      )
        throw new Error('Invalid correction chain');
    } else if (r.correctionOf || r.correctionReason) throw new Error('Unexpected correction');
  }
  for (const r of typed.addenda)
    if (
      !strings(r, ['unitId', 'patientId', 'noteId', 'text', 'reason', 'recordedAt', 'author']) ||
      !r.text.trim() ||
      r.text.length > 10000 ||
      !r.reason.trim() ||
      r.reason.length > 1000 ||
      !Number.isFinite(Date.parse(r.recordedAt)) ||
      !typed.notes.some(
        (n) =>
          n.id === r.noteId &&
          n.status === 'final' &&
          n.unitId === r.unitId &&
          n.organizationId === r.organizationId &&
          n.patientId === r.patientId,
      )
    )
      throw new Error('Invalid addendum');
  validateVaccinationDatabase(typed);
  validateReceptionDatabase(typed);
  validateClinicalDocuments(typed);
  validatePharmacy(typed);
  validateAdministrativeHistory(typed);
  validateContinuity(typed);
  return typed;
}

export class DemoRepository implements CareRepository {
  private db: Database;
  private listeners = new Set<() => void>();
  persistent = false;
  recoveryMessage = '';
  constructor(
    private storage?: LocalStorage,
    private now = () => new Date(),
  ) {
    this.db = createSeed(now());
    if (storage) {
      try {
        const value = storage.getItem(storageKey);
        if (value) this.db = parseDatabase(value);
        else storage.setItem(storageKey, JSON.stringify(this.db));
        this.persistent = true;
      } catch {
        this.recoveryMessage =
          'Não foi possível carregar a base local. O cenário exibido é temporário; registros estão bloqueados até redefinir a demonstração.';
      }
    }
  }
  getRevision = () => this.db.revision;
  display = (organizationId: string, unitId: string) =>
    readDisplay(this.db, organizationId, unitId, this.now());
  refresh = () => {
    if (!this.storage || this.recoveryMessage) return;
    try {
      const value = this.storage.getItem(storageKey);
      if (!value) return;
      const next = parseDatabase(value);
      if (next.revision !== this.db.revision) {
        this.db = next;
        this.notify();
      }
    } catch {
      this.recoveryMessage =
        'A base de demonstração mudou para um formato inválido. Preserve os dados e redefina o cenário para continuar.';
      this.notify();
    }
  };
  directory = () => structuredClone({ organizations: this.db.organizations, units: this.db.units });
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = (context: Context) => readSnapshot(this.db, context);
  summary = (context: Context) => readSummary(this.db, context, this.now());
  workMetrics = (context: Context) => {
    assertContext(this.db, context);
    return workMetrics(this.db, context);
  };
  performance = (context: Context, from: string, to: string) => {
    assertContext(this.db, context);
    return performance(this.db, context, from, to, this.now());
  };
  async issueTicket(request: KioskRequest) {
    return this.locked(() => {
      if (this.recoveryMessage)
        throw new DomainError(
          'A recepção precisa revisar o ambiente antes de emitir senhas.',
          'storage',
        );
      const saved = this.storage?.getItem(storageKey);
      const next = saved ? parseDatabase(saved) : structuredClone(this.db);
      const receipt = issueKiosk(next, request, this.now());
      try {
        this.storage?.setItem(storageKey, JSON.stringify(next));
      } catch {
        throw new DomainError('Não foi possível salvar a senha. Procure a recepção.', 'storage');
      }
      this.db = next;
      this.notify();
      return receipt;
    });
  }
  private notify = () => this.listeners.forEach((l) => l());
  private async locked<T>(fn: () => T): Promise<T> {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks)
      return navigator.locks.request('cuidelo-demo-write', fn);
    return fn();
  }
  async execute(
    context: Context,
    command: Command,
    expectedRevision = this.db.revision,
  ): Promise<string> {
    return this.locked(() => {
      if (this.recoveryMessage)
        throw new DomainError('Redefina a demonstração antes de registrar alterações.', 'storage');
      if (this.storage) {
        const latest = this.storage.getItem(storageKey);
        if (latest) {
          let next: Database;
          try {
            next = parseDatabase(latest);
          } catch {
            throw new DomainError(
              'A base local foi alterada em um formato incompatível.',
              'storage',
            );
          }
          if (next.revision !== expectedRevision) {
            this.db = next;
            this.notify();
            throw new DomainError(
              'Os dados mudaram em outra ação ou aba. Revise a tela e tente novamente.',
              'conflict',
            );
          }
        }
      }
      if (this.db.revision !== expectedRevision)
        throw new DomainError('Os dados foram atualizados. Revise antes de salvar.', 'conflict');
      const next = structuredClone(this.db);
      const id = applyCommand(next, context, command, this.now());
      if (this.storage) {
        try {
          this.storage.setItem(storageKey, JSON.stringify(next));
        } catch {
          throw new DomainError(
            'Não foi possível salvar no navegador. A alteração não foi aplicada.',
            'storage',
          );
        }
      }
      this.db = next;
      this.notify();
      return id;
    });
  }
  async reset(context: Context): Promise<void> {
    assertContext(this.db, context);
    if (context.role !== 'manager')
      throw new DomainError(
        'Somente a gestão da prefeitura pode redefinir o cenário da sua rede.',
        'permission',
      );
    return this.locked(() => {
      const seed = createSeed(this.now()),
        next = structuredClone(this.db);
      for (const key of collections) {
        if (key === 'organizations' || key === 'units') continue;
        (next[key] as unknown[]) = [
          ...this.db[key].filter((r) => r.organizationId !== context.organizationId),
          ...seed[key].filter((r) => r.organizationId === context.organizationId),
        ];
      }
      next.revision = this.db.revision + 1;
      if (this.storage) {
        try {
          this.storage.setItem(storageKey, JSON.stringify(next));
          this.persistent = true;
        } catch {
          throw new DomainError('O navegador não permitiu salvar a demonstração.', 'storage');
        }
      }
      this.db = next;
      this.recoveryMessage = '';
      this.notify();
    });
  }
}

export function browserRepository(): DemoRepository {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    /* Sessão local temporária, explicitada na interface. */
  }
  return new DemoRepository(storage);
}
