import type { Command, Context, Database } from '../domain/model';
import { applyCommand, DomainError, readSnapshot, readSummary } from '../domain/operations';
import { validDay, dateKey } from '../domain/dates';
import { createSeed } from './seed';
import type { CareRepository } from './repository';
import { assignMissingTickets, readDisplay } from '../domain/queue';
import { validateIntakeContent } from '../domain/intake';
import { validateVaccinationDatabase } from '../domain/vaccination-validation';

export const storageKey = 'cuidelo.demo.database.v1';
type LocalStorage = Pick<Storage, 'getItem' | 'setItem'>;
const collections = [
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
  if (
    !isRecord(db) ||
    db.schemaVersion !== 4 ||
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
        !('organizationId' in row) ||
        !typed.organizations.some((o) => o.id === row.organizationId)
      )
        throw new Error('Invalid organization link');
      if (
        'unitId' in row &&
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
  if (new Set(ticketKeys).size !== ticketKeys.length) throw new Error('Duplicate tickets');
  if (
    typed.calls.some(
      (c) =>
        !strings(c, ['unitId', 'encounterId', 'ticket', 'roomId', 'calledAt']) ||
        !Number.isFinite(Date.parse(c.calledAt)) ||
        !typed.encounters.some(
          (e) =>
            e.id === c.encounterId &&
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
        !['requested', 'scheduled', 'cancelled'].includes(r.status),
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
    if (context.role !== 'admin')
      throw new DomainError(
        'Use o perfil Administração para redefinir a demonstração.',
        'permission',
      );
    return this.locked(() => {
      const next = createSeed(this.now());
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
