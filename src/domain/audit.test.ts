import { describe, it, expect } from 'vitest';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { createSeed } from '../data/seed';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { issueKiosk, performance } from './patient-flow';
import { validateAdmissions } from './hospital';

const now = new Date('2026-10-31T15:00:00Z');
const reception = demoContext('aurora', 'aurora-centro', 'reception');
const hospital = demoContext('aurora', 'aurora-hospital', 'admin');
const manager = demoContext('aurora', 'all', 'manager');
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
function bookedArrival() {
  const db = createSeed(now);
  const appointment = db.appointments.find((a) => a.id === 'aurora-centro-a0')!;
  const patient = db.patients.find((p) => p.id === appointment.patientId)!;
  issueKiosk(
    db,
    {
      organizationId: 'aurora',
      unitId: 'aurora-centro',
      requestId: 'kiosk-audit-0001',
      priority: 'priority',
      service: 'Consulta',
      identification: { kind: 'cpf', value: patient.cpf!, birthDate: patient.birthDate },
    },
    now,
  );
  const encounter = db.encounters.find(
    (e) => e.unitId === reception.unitId && e.patientId === patient.id,
  )!;
  return { db, appointment, encounter };
}
describe('auditoria de continuidade da demonstração', () => {
  it('vincula a chegada do totem e preserva senha, preferência, conferência e horário sem duplicar', () => {
    const { db, appointment, encounter } = bookedArrival();
    const original = structuredClone(encounter);
    const total = db.encounters.length;
    const cmd = {
      type: 'appointment.checkIn' as const,
      id: appointment.id,
      kioskEncounterId: encounter.id,
    };
    expect(applyCommand(db, reception, cmd, now)).toBe(encounter.id);
    expect(appointment.encounterId).toBe(encounter.id);
    expect(db.encounters).toHaveLength(total);
    expect(encounter).toEqual(original);
    expect(() => applyCommand(db, reception, cmd, now)).toThrow();
    const storage = store();
    storage.setItem(storageKey, JSON.stringify(db));
    expect(
      new DemoRepository(storage, () => now)
        .snapshot(reception)
        .appointments.find((a) => a.id === appointment.id)?.encounterId,
    ).toBe(encounter.id);
  });
  it('rejeita vínculo de outra pessoa, unidade, serviço e chegada já utilizada', () => {
    const { db, appointment, encounter } = bookedArrival();
    const cmd = {
      type: 'appointment.checkIn' as const,
      id: appointment.id,
      kioskEncounterId: encounter.id,
    };
    expect(() =>
      applyCommand(db, reception, { ...cmd, kioskEncounterId: 'aurora-centro-e0' }, now),
    ).toThrow();
    expect(() =>
      applyCommand(db, demoContext('aurora', 'aurora-vila', 'reception'), cmd, now),
    ).toThrow();
    encounter.service = 'Farmácia';
    expect(() => applyCommand(db, reception, cmd, now)).toThrow();
    encounter.service = 'Consulta';
    db.appointments.push({
      ...appointment,
      id: 'prior',
      status: 'checked-in',
      encounterId: encounter.id,
    });
    expect(() => applyCommand(db, reception, cmd, now)).toThrow();
    expect(appointment.status).toBe('scheduled');
  });
  it('uma redefinição desatualizada é recusada e preserva as alterações de outra prefeitura', async () => {
    const storage = store();
    const a = new DemoRepository(storage, () => now),
      b = new DemoRepository(storage, () => now);
    const foreign = demoContext('horizonte', 'horizonte-centro', 'reception');
    const id = await b.execute(foreign, {
      type: 'patient.create',
      name: 'Cadastro fictício de Horizonte',
      socialName: '',
      phone: '',
      birthDate: '2000-01-01',
    });
    const original = storage.getItem(storageKey);
    await expect(a.reset(manager, 0)).rejects.toThrow('mudaram');
    expect(storage.getItem(storageKey)).toBe(original);
    await a.reset(manager, a.getRevision());
    expect(
      new DemoRepository(storage, () => now).snapshot(foreign).patients.some((p) => p.id === id),
    ).toBe(true);
  });
  it('arquivo incompatível permanece intacto e a aba reconhece uma restauração válida', async () => {
    const storage = store();
    const repo = new DemoRepository(storage, () => now);
    const valid = storage.getItem(storageKey)!;
    storage.setItem(storageKey, 'incompatível');
    repo.refresh();
    expect(repo.recoveryMessage).not.toBe('');
    await expect(repo.reset(manager)).rejects.toThrow();
    expect(storage.getItem(storageKey)).toBe('incompatível');
    storage.setItem(storageKey, valid);
    repo.refresh();
    expect(repo.recoveryMessage).toBe('');
  });
  it('administração vê o andamento sem receber justificativa nem contrarreferência de solicitação manual', () => {
    const db = createSeed(now);
    const regulator = demoContext('aurora', 'aurora-centro', 'regulation');
    const id = applyCommand(
      db,
      regulator,
      {
        type: 'referral.create',
        patientId: 'aurora-p1',
        specialty: 'Exemplo',
        destination: 'Serviço fictício',
        reason: 'Justificativa clínica fictícia',
      },
      now,
    );
    applyCommand(
      db,
      regulator,
      {
        type: 'referral.schedule',
        id,
        date: '2026-10-31',
        time: '09:00',
        destination: 'Serviço fictício',
      },
      now,
    );
    applyCommand(
      db,
      regulator,
      { type: 'referral.complete', id, date: '2026-10-31', summary: 'Contrarreferência fictícia' },
      now,
    );
    const admin = readSnapshot(db, demoContext('aurora', 'aurora-centro', 'admin')).referrals.find(
      (r) => r.id === id,
    )!;
    expect(admin.status).toBe('completed');
    expect(admin.reason).toBe('');
    expect(admin.response).toBeUndefined();
    expect(readSnapshot(db, regulator).referrals.find((r) => r.id === id)?.response?.summary).toBe(
      'Contrarreferência fictícia',
    );
  });
});
describe('movimentação de internação', () => {
  const cmd = {
    type: 'admission.transfer' as const,
    id: 'aurora-hospital-i1',
    fromBedId: 'aurora-hospital-b1',
    toBedId: 'aurora-hospital-b4',
    expectedTransfers: 0,
    reason: 'Transferência fictícia',
  };
  it('transfere uma internação, preserva histórico e libera origem para higienização', async () => {
    const storage = store();
    const repo = new DemoRepository(storage, () => now);
    await repo.execute(hospital, cmd);
    const reloaded = new DemoRepository(storage, () => now);
    expect(reloaded.recoveryMessage).toBe('');
    const state = reloaded.snapshot(hospital),
      a = state.admissions.find((a) => a.id === cmd.id)!;
    expect(a.bedId).toBe(cmd.toBedId);
    expect(a.transfers?.[0].actorId).toBe(hospital.sessionId);
    expect(state.beds.find((b) => b.id === cmd.fromBedId)?.status).toBe('cleaning');
    expect(state.beds.find((b) => b.id === cmd.toBedId)?.status).toBe('occupied');
    await expect(reloaded.execute(hospital, cmd)).rejects.toThrow();
    await reloaded.execute(hospital, {
      type: 'admission.discharge',
      id: a.id,
      reason: 'Saída administrativa fictícia',
    });
    expect(reloaded.snapshot(hospital).admissions.find((x) => x.id === a.id)?.transfers).toEqual(
      a.transfers,
    );
    await expect(reloaded.execute(hospital, cmd)).rejects.toThrow();
  });
  it('recusa transferência fora de escopo, destino ocupado, motivo vazio e concorrência', () => {
    const db = createSeed(now),
      before = JSON.stringify(db);
    for (const ctx of [
      reception,
      demoContext('aurora', 'aurora-centro', 'admin'),
      demoContext('horizonte', 'horizonte-hospital', 'admin'),
    ])
      expect(() => applyCommand(db, ctx, cmd, now)).toThrow();
    for (const patch of [
      { reason: ' ' },
      { toBedId: 'aurora-hospital-b2' },
      { expectedTransfers: 2 },
      { toBedId: 'horizonte-hospital-b4' },
    ])
      expect(() => applyCommand(db, hospital, { ...cmd, ...patch }, now)).toThrow();
    const older = new Date('2026-10-20T12:00:00Z');
    expect(() => applyCommand(db, hospital, cmd, older)).toThrow('relógio');
    expect(() =>
      applyCommand(
        db,
        hospital,
        { type: 'admission.discharge', id: cmd.id, reason: 'Teste' },
        older,
      ),
    ).toThrow('relógio');
    expect(JSON.stringify(db)).toBe(before);
    applyCommand(db, hospital, cmd, now);
    db.beds.find((b) => b.id === cmd.fromBedId)!.status = 'occupied';
    expect(() => validateAdmissions(db)).toThrow();
  });
});

it('encerra a chegada antiga sem registro clínico e permite nova senha no dia correto', async () => {
  const { db, encounter } = bookedArrival(),
    nextDay = new Date('2026-11-01T13:00:00Z');
  const close = {
    type: 'reception.close-prior' as const,
    id: encounter.id,
    reason: 'Saída anterior confirmada no balcão.',
  };
  expect(() => applyCommand(db, reception, close, now)).toThrow();
  expect(() =>
    applyCommand(db, demoContext('aurora', 'aurora-vila', 'reception'), close, nextDay),
  ).toThrow();
  expect(() =>
    applyCommand(db, demoContext('aurora', 'aurora-centro', 'clinical'), close, nextDay),
  ).toThrow();
  const issued = encounter.arrivedAt,
    ticket = encounter.ticket;
  applyCommand(db, reception, close, nextDay);
  expect(encounter.arrivedAt).toBe(issued);
  expect(encounter.ticket).toBe(ticket);
  expect(encounter.completedAt).toBeUndefined();
  expect(encounter.closedWithoutCare?.actorId).toBe(reception.sessionId);
  expect(() => applyCommand(db, reception, close, nextDay)).toThrow();
  const patient = db.patients.find((p) => p.id === encounter.patientId)!;
  const receipt = issueKiosk(
    db,
    {
      organizationId: 'aurora',
      unitId: 'aurora-centro',
      requestId: 'new-day-audit',
      priority: 'routine',
      service: 'Consulta',
      identification: { kind: 'cpf', value: patient.cpf!, birthDate: patient.birthDate },
    },
    nextDay,
  );
  expect(receipt.existing).toBe(false);
  expect(receipt.issuedAt).toBe(nextDay.toISOString());
  const mem = store();
  mem.setItem(storageKey, JSON.stringify(db));
  expect(new DemoRepository(mem, () => nextDay).recoveryMessage).toBe('');
  expect(() =>
    applyCommand(
      db,
      demoContext('aurora', 'aurora-centro', 'clinical'),
      { type: 'encounter.start', id: encounter.id },
      nextDay,
    ),
  ).toThrow();
});
it('mantém a escuta em curso fora da chamada de consulta e protege a chegada de dias anteriores', () => {
  const db = createSeed(now),
    c = demoContext('aurora', 'aurora-centro', 'nursing'),
    id = 'aurora-centro-e0';
  applyCommand(db, c, { type: 'intake.start', encounterId: id }, now);
  expect(() =>
    applyCommand(db, c, { type: 'queue.call', encounterId: id, roomId: 'consultorio-1' }, now),
  ).toThrow('escuta');
  expect(() =>
    applyCommand(db, c, { type: 'queue.call', encounterId: id, roomId: 'escuta-1' }, now),
  ).not.toThrow();
  expect(() =>
    applyCommand(
      db,
      reception,
      { type: 'reception.close-prior', id, reason: 'Teste' },
      new Date('2026-11-01T13:00:00Z'),
    ),
  ).toThrow();
  const other = db.encounters.find((e) => e.id === 'aurora-centro-e1')!;
  applyCommand(
    db,
    reception,
    { type: 'queue.call', encounterId: other.id, roomId: 'recepcao-1' },
    now,
  );
  applyCommand(
    db,
    reception,
    {
      type: 'reception.absent',
      target: { kind: 'encounter', id: other.id },
      reason: 'Ausência fictícia',
    },
    now,
  );
  const report = performance(
    db,
    demoContext('aurora', 'aurora-centro', 'admin'),
    '2026-10-31',
    '2026-10-31',
    now,
  );
  expect(report.currentWait.count).toBe(0);
});
