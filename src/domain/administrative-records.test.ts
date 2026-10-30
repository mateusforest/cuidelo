import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { registrationOf, slotOf, validateAdministrativeHistory } from './administrative-records';
import { intakeQueueState } from './intake';
import type { Command, Database, PatientRegistration } from './model';
import { demoCpf } from './identification';

const now = new Date('2026-10-29T15:00:00Z');
const reception = demoContext('aurora', 'aurora-centro', 'reception');
const doctor = demoContext('aurora', 'aurora-centro', 'clinical');
const pharmacy = demoContext('aurora', 'aurora-centro', 'pharmacy');
const update = (
  db: Database,
  values: Partial<PatientRegistration> = {},
): Extract<Command, { type: 'patient.update' }> => ({
  type: 'patient.update',
  id: 'aurora-p1',
  values: {
    ...registrationOf(db.patients.find((p) => p.id === 'aurora-p1')!),
    phone: 'Contato fictício atualizado',
    ...values,
  },
  reason: 'Conferência cadastral fictícia',
  expectedChangeCount: 0,
});
const reschedule = (db: Database): Extract<Command, { type: 'appointment.reschedule' }> => ({
  type: 'appointment.reschedule',
  id: 'aurora-centro-a0',
  values: { ...slotOf(db.appointments.find((a) => a.id === 'aurora-centro-a0')!), time: '18:00' },
  reason: 'Remarcação fictícia solicitada',
  expectedChangeCount: 0,
});
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('atualização cadastral preservada', () => {
  it('registra antes/depois e mantém nota final e documento emitido intactos', () => {
    const db = createSeed(now);
    applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e0' }, now);
    const docId = applyCommand(
      db,
      doctor,
      {
        type: 'document.save',
        encounterId: 'aurora-centro-e0',
        expectedVersion: 0,
        content: {
          kind: 'exams',
          items: [{ id: 'item', name: 'Exame fictício', material: '', notes: '' }],
          indication: 'Teste',
          priority: 'routine',
          priorityReason: '',
        },
      },
      now,
    );
    applyCommand(
      db,
      doctor,
      { type: 'document.issue', id: docId, expectedVersion: 1, reviewed: true },
      now,
    );
    applyCommand(
      db,
      doctor,
      {
        type: 'note.save',
        encounterId: 'aurora-centro-e0',
        soap: {
          subjective: 'Teste',
          objective: '',
          assessment: 'Avaliação fictícia',
          plan: 'Plano fictício',
        },
      },
      now,
    );
    applyCommand(db, doctor, { type: 'note.finalize', encounterId: 'aurora-centro-e0' }, now);
    const records = JSON.stringify([db.notes, db.clinicalDocuments]),
      before = registrationOf(db.patients[0]);
    applyCommand(db, reception, update(db, { name: 'Ana Clara Fictícia', cpf: demoCpf(500) }), now);
    const p = db.patients.find((p) => p.id === 'aurora-p1')!;
    expect(p.changes?.[0].before).toEqual(before);
    expect(p.changes?.[0].after).toEqual(registrationOf(p));
    expect(p.changes?.[0]).toMatchObject({
      actorId: reception.sessionId,
      unitId: reception.unitId,
      reason: 'Conferência cadastral fictícia',
    });
    expect(JSON.stringify([db.notes, db.clinicalDocuments])).toBe(records);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'reception')).patients.find(
        (x) => x.id === p.id,
      )?.name,
    ).toBe('Ana Clara Fictícia');
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'reception')).patients.some(
        (x) => x.id === p.id,
      ),
    ).toBe(false);
    expect(() => validateAdministrativeHistory(db)).not.toThrow();
  });
  it.each([
    ['CPF repetido', { cpf: demoCpf(2) }, 'Já existe'],
    ['CPF inválido', { cpf: '11111111111' }, 'CPF válido'],
    ['nascimento futuro', { birthDate: '2099-01-01' }, 'nascimento'],
    ['nome vazio', { name: '  ' }, 'nome'],
  ])('recusa %s sem alterar o cadastro', (_label, values, message) => {
    const db = createSeed(now),
      before = JSON.stringify(db);
    expect(() =>
      applyCommand(db, reception, update(db, values as Partial<PatientRegistration>), now),
    ).toThrow(String(message));
    expect(JSON.stringify(db)).toBe(before);
  });
  it('recusa outro município, perfil sem permissão, motivo vazio e formulário desatualizado', () => {
    const db = createSeed(now),
      cmd = update(db);
    expect(() => applyCommand(db, doctor, cmd, now)).toThrow('não tem acesso');
    expect(() => applyCommand(db, reception, { ...cmd, id: 'horizonte-p1' }, now)).toThrow(
      'não encontrado',
    );
    expect(() => applyCommand(db, reception, { ...cmd, reason: ' ' }, now)).toThrow('motivo');
    applyCommand(db, reception, cmd, now);
    expect(() =>
      applyCommand(
        db,
        reception,
        { ...cmd, values: { ...cmd.values, name: 'Outra alteração' } },
        now,
      ),
    ).toThrow('atualizado');
    expect(db.patients.find((p) => p.id === cmd.id)?.changes).toHaveLength(1);
    expect(readSnapshot(db, pharmacy).patients).toEqual([]);
  });
  it('permite retirar CPF com justificativa e mantém a cadeia após reabrir a base', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now);
    const cmd = update(createSeed(now), { cpf: '' });
    await repo.execute(reception, cmd);
    const next = new DemoRepository(storage, () => now);
    expect(next.recoveryMessage).toBe('');
    const p = next.snapshot(reception).patients.find((p) => p.id === cmd.id)!;
    expect(p.cpf).toBeUndefined();
    await next.execute(reception, {
      ...cmd,
      expectedChangeCount: 1,
      values: { ...registrationOf(p), phone: 'Segundo contato fictício' },
    });
    expect(
      new DemoRepository(storage, () => now)
        .snapshot(reception)
        .patients.find((p) => p.id === cmd.id)?.changes,
    ).toHaveLength(2);
  });
});

describe('remarcação com histórico', () => {
  it('remarca preservando identidade, horário anterior, autoria e leitura após recarga', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now),
      db = createSeed(now),
      cmd = reschedule(db);
    const before = slotOf(db.appointments.find((a) => a.id === cmd.id)!);
    await repo.execute(reception, cmd);
    const next = new DemoRepository(storage, () => now);
    expect(next.recoveryMessage).toBe('');
    const a = next.snapshot(reception).appointments.find((a) => a.id === cmd.id)!;
    expect(a.time).toBe('18:00');
    expect(a.reschedules?.[0].before).toEqual(before);
    expect(a.reschedules?.[0].after).toEqual(cmd.values);
    expect(a.status).toBe('scheduled');
    expect(next.snapshot(reception).appointments).toHaveLength(
      repo.snapshot(reception).appointments.length,
    );
    expect(() =>
      validateAdministrativeHistory(JSON.parse(storage.getItem(storageKey)!)),
    ).not.toThrow();
  });
  it('exclui o próprio horário da verificação e permite intervalos adjacentes', () => {
    const db = createSeed(now),
      cmd = reschedule(db),
      a = db.appointments.find((a) => a.id === cmd.id)!;
    cmd.values = { ...slotOf(a), service: 'Retorno fictício' };
    expect(() => applyCommand(db, reception, cmd, now)).not.toThrow();
    applyCommand(
      db,
      reception,
      { ...cmd, expectedChangeCount: 1, values: { ...cmd.values, time: '18:00' } },
      now,
    );
    expect(() =>
      applyCommand(
        db,
        reception,
        { type: 'appointment.create', patientId: 'aurora-p12', ...cmd.values, time: '18:30' },
        now,
      ),
    ).not.toThrow();
  });
  it.each(['professional', 'patient'] as const)(
    'bloqueia conflito de %s inclusive em outra unidade da prefeitura',
    (kind) => {
      const db = createSeed(now),
        cmd = reschedule(db),
        a = db.appointments.find((a) => a.id === cmd.id)!;
      db.appointments.push({
        ...a,
        id: 'conflict',
        unitId: 'aurora-vila',
        time: '18:10',
        professional: kind === 'professional' ? a.professional : 'Outro profissional',
        patientId: kind === 'patient' ? a.patientId : 'aurora-p12',
      });
      const before = JSON.stringify(db);
      expect(() => applyCommand(db, reception, cmd, now)).toThrow(
        kind === 'patient' ? 'pessoa já tem' : 'profissional já tem',
      );
      expect(JSON.stringify(db)).toBe(before);
    },
  );
  it('não considera horários de outra prefeitura e mantém unidade de origem', () => {
    const db = createSeed(now),
      cmd = reschedule(db),
      a = db.appointments.find((a) => a.id === cmd.id)!;
    db.appointments.push({
      ...a,
      id: 'other-network',
      organizationId: 'horizonte',
      unitId: 'horizonte-centro',
      patientId: 'horizonte-p1',
      time: '18:00',
    });
    applyCommand(db, reception, cmd, now);
    expect(a.unitId).toBe(reception.unitId);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'reception')).appointments.some(
        (x) => x.id === a.id,
      ),
    ).toBe(false);
  });
  it('bloqueia remarcação após chegada, cancelamento, conflito de versão e escopo inválido', () => {
    const db = createSeed(now),
      cmd = reschedule(db);
    expect(() => applyCommand(db, pharmacy, cmd, now)).toThrow('não tem acesso');
    expect(() =>
      applyCommand(db, demoContext('aurora', 'aurora-vila', 'reception'), cmd, now),
    ).toThrow('não encontrado');
    expect(() => applyCommand(db, reception, { ...cmd, reason: '' }, now)).toThrow('motivo');
    applyCommand(db, reception, cmd, now);
    expect(() => applyCommand(db, reception, cmd, now)).toThrow('atualizado');
    applyCommand(db, reception, { type: 'appointment.checkIn', id: cmd.id }, now);
    expect(() => applyCommand(db, reception, { ...cmd, expectedChangeCount: 1 }, now)).toThrow(
      'pendentes',
    );
    const other = createSeed(now);
    applyCommand(
      other,
      reception,
      { type: 'appointment.cancel', id: cmd.id, reason: 'Teste' },
      now,
    );
    expect(() => applyCommand(other, reception, cmd, now)).toThrow('pendentes');
  });
  it('rejeita data passada e fim após meia-noite sem tocar no agendamento', () => {
    const db = createSeed(now),
      cmd = reschedule(db),
      before = JSON.stringify(db);
    expect(() =>
      applyCommand(db, reception, { ...cmd, values: { ...cmd.values, date: '2026-10-28' } }, now),
    ).toThrow('hoje');
    expect(() =>
      applyCommand(db, reception, { ...cmd, values: { ...cmd.values, time: '23:50' } }, now),
    ).toThrow('mesmo dia');
    expect(JSON.stringify(db)).toBe(before);
  });
});

it('bases anteriores sem histórico continuam válidas; histórico adulterado bloqueia gravações', async () => {
  const storage = new MemoryStorage(),
    repo = new DemoRepository(storage, () => now);
  expect(new DemoRepository(storage, () => now).recoveryMessage).toBe('');
  await repo.execute(reception, update(createSeed(now)));
  const db: Database = JSON.parse(storage.getItem(storageKey)!);
  db.patients.find((p) => p.id === 'aurora-p1')!.changes![0].unitId = 'horizonte-centro';
  storage.setItem(storageKey, JSON.stringify(db));
  const invalid = new DemoRepository(storage, () => now);
  expect(invalid.recoveryMessage).not.toBe('');
  await expect(invalid.execute(reception, update(db))).rejects.toThrow('Redefina');
  expect(storage.getItem(storageKey)).toBe(JSON.stringify(db));
});

it('triagem distingue espera, escuta iniciada, registro, conclusão e conferência pendente', () => {
  const e = createSeed(now).encounters.find((e) => e.id === 'aurora-centro-e0')!;
  expect(intakeQueueState(e, false)).toBe('pending');
  expect(intakeQueueState({ ...e, intakeStartedAt: now.toISOString() }, false)).toBe('active');
  expect(intakeQueueState(e, true)).toBe('recorded');
  expect(intakeQueueState({ ...e, status: 'completed' }, true)).toBe('completed');
  expect(intakeQueueState({ ...e, receptionRequired: true }, false)).toBe('other');
  expect(
    intakeQueueState(
      {
        ...e,
        receptionHold: { at: now.toISOString(), actorId: reception.sessionId, reason: 'Ausente' },
      },
      false,
    ),
  ).toBe('other');
});
