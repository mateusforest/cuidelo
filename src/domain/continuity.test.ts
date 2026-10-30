import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { validateContinuity, lastExamSchedule, examDateOverdue } from './continuity';
import { validateClinicalDocuments } from './clinical-documents';
import type { Command, Database } from './model';

const now = new Date('2026-10-30T15:00:00Z'),
  today = '2026-10-30';
const nurse = demoContext('aurora', 'aurora-centro', 'nursing'),
  regulator = demoContext('aurora', 'aurora-centro', 'regulation'),
  doctor = demoContext('aurora', 'aurora-centro', 'clinical');
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
function recall(db: Database) {
  return applyCommand(
    db,
    nurse,
    {
      type: 'vaccine.recall.create',
      patientId: 'aurora-p1',
      immunobiological: 'Imunizante fictício',
      dose: 'Dose fictícia',
      date: today,
      reason: 'Retorno fictício',
    },
    now,
  );
}
const contact = (id: string): Extract<Command, { type: 'vaccine.recall.contact' }> => ({
  type: 'vaccine.recall.contact',
  id,
  outcome: 'unanswered',
  note: 'Tentativa fictícia sem resposta',
  expectedContacts: 0,
  expectedEvents: 1,
});
function referral(db: Database) {
  const id = applyCommand(
    db,
    regulator,
    {
      type: 'referral.create',
      patientId: 'aurora-p1',
      specialty: 'Especialidade fictícia',
      destination: 'Destino inicial',
      reason: 'Justificativa preservada',
    },
    now,
  );
  applyCommand(
    db,
    regulator,
    { type: 'referral.schedule', id, date: today, time: '09:00', destination: 'Destino inicial' },
    now,
  );
  return id;
}
const reschedule = (id: string): Extract<Command, { type: 'referral.reschedule' }> => ({
  type: 'referral.reschedule',
  id,
  date: '2026-10-31',
  time: '10:00',
  destination: 'Novo destino fictício',
  reason: 'Alteração informada pelo serviço fictício',
  expectedHistoryCount: 1,
});
function exam(db: Database) {
  applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e0' }, now);
  const id = applyCommand(
    db,
    doctor,
    {
      type: 'document.save',
      encounterId: 'aurora-centro-e0',
      expectedVersion: 0,
      content: {
        kind: 'exams',
        items: [{ id: 'exam', name: 'Exame fictício', material: '', notes: '' }],
        indication: 'Teste',
        priority: 'routine',
        priorityReason: '',
      },
    },
    now,
  );
  applyCommand(db, doctor, { type: 'document.issue', id, expectedVersion: 1, reviewed: true }, now);
  return db.clinicalDocuments.find((d) => d.id === id)!;
}
describe('contatos de retornos vacinais', () => {
  it('preserva aprazamento e estoque; registra autoria e persiste após recarga', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now);
    const id = await repo.execute(nurse, {
      type: 'vaccine.recall.create',
      patientId: 'aurora-p1',
      immunobiological: 'Teste',
      dose: 'Teste',
      date: today,
      reason: 'Orientação fictícia',
    });
    const before = repo.snapshot(nurse);
    await repo.execute(nurse, contact(id));
    const reloaded = new DemoRepository(storage, () => now),
      after = reloaded.snapshot(nurse),
      r = after.vaccineRecalls.find((r) => r.id === id)!;
    expect(reloaded.recoveryMessage).toBe('');
    expect(r.contacts?.[0]).toMatchObject({
      actorId: nurse.sessionId,
      outcome: 'unanswered',
      note: 'Tentativa fictícia sem resposta',
    });
    expect(r.events).toEqual(before.vaccineRecalls.find((r) => r.id === id)!.events);
    expect(r.status).toBe('scheduled');
    expect(r.date).toBe(today);
    expect(after.vaccineMovements).toEqual(before.vaccineMovements);
  });
  it.each([
    demoContext('aurora', 'aurora-vila', 'nursing'),
    demoContext('horizonte', 'horizonte-centro', 'nursing'),
    demoContext('aurora', 'aurora-centro', 'reception'),
  ])('bloqueia contato fora do vínculo permitido: %j', (context) => {
    const db = createSeed(now),
      id = recall(db),
      before = JSON.stringify(db);
    expect(() => applyCommand(db, context, contact(id), now)).toThrow();
    expect(JSON.stringify(db)).toBe(before);
    if (context.role === 'reception') expect(readSnapshot(db, context).vaccineRecalls).toEqual([]);
  });
  it('rejeita nota vazia, resultado inválido, contato duplicado e formulário anterior ao reagendamento', () => {
    const db = createSeed(now),
      id = recall(db);
    expect(() => applyCommand(db, nurse, { ...contact(id), note: ' ' }, now)).toThrow(
      'registro do contato',
    );
    expect(() =>
      applyCommand(db, nurse, { ...contact(id), outcome: 'invalid' as 'reached' }, now),
    ).toThrow('resultado');
    applyCommand(db, nurse, contact(id), now);
    expect(() => applyCommand(db, nurse, contact(id), now)).toThrow('retorno mudou');
    applyCommand(
      db,
      nurse,
      {
        type: 'vaccine.recall.update',
        id,
        action: 'reschedule',
        date: '2026-10-31',
        reason: 'Teste',
      },
      now,
    );
    expect(() => applyCommand(db, nurse, { ...contact(id), expectedContacts: 1 }, now)).toThrow(
      'retorno mudou',
    );
  });
  it.each(['cancelled', 'completed'] as const)(
    'preserva contatos e recusa inclusão após %s',
    (status) => {
      const db = createSeed(now),
        id = recall(db);
      applyCommand(db, nurse, contact(id), now);
      const r = db.vaccineRecalls.find((r) => r.id === id)!;
      r.status = status;
      const before = JSON.stringify(db);
      expect(() => applyCommand(db, nurse, { ...contact(id), expectedContacts: 1 }, now)).toThrow(
        'pendentes',
      );
      expect(JSON.stringify(db)).toBe(before);
    },
  );
});
describe('reagendamento na regulação', () => {
  it('guarda antes/depois sem mudar solicitação; admite nova remarcação e recarga', async () => {
    const db = createSeed(now),
      id = referral(db),
      r = db.referrals.find((r) => r.id === id)!;
    applyCommand(db, regulator, reschedule(id), now);
    expect(r.history?.at(-1)).toMatchObject({
      action: 'rescheduled',
      previousAppointment: { date: today, time: '09:00', destination: 'Destino inicial' },
      appointment: { date: '2026-10-31', time: '10:00', destination: 'Novo destino fictício' },
    });
    expect(r.reason).toBe('Justificativa preservada');
    applyCommand(db, regulator, { ...reschedule(id), expectedHistoryCount: 2, time: '11:00' }, now);
    expect(() => validateContinuity(db)).not.toThrow();
    expect(() => validateClinicalDocuments(db)).not.toThrow();
    const storage = new MemoryStorage();
    storage.setItem(storageKey, JSON.stringify(db));
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    expect(repo.snapshot(regulator).referrals.find((r) => r.id === id)?.appointmentTime).toBe(
      '11:00',
    );
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'regulation')).referrals.some(
        (r) => r.id === id,
      ),
    ).toBe(false);
  });
  it('preserva documento emitido e permite retorno após reagendamento', () => {
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
          kind: 'referral',
          specialty: 'Teste',
          destination: 'Destino original',
          reason: 'Razão fictícia',
          summary: 'Resumo fictício',
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
    const doc = db.clinicalDocuments.find((d) => d.id === docId)!,
      before = JSON.stringify(doc),
      id = doc.referralId!;
    applyCommand(
      db,
      regulator,
      { type: 'referral.schedule', id, date: today, time: '09:00', destination: 'Destino' },
      now,
    );
    const r = db.referrals.find((r) => r.id === id)!;
    applyCommand(
      db,
      regulator,
      { ...reschedule(id), date: today, expectedHistoryCount: r.history!.length },
      now,
    );
    applyCommand(
      db,
      regulator,
      { type: 'referral.complete', id, date: today, summary: 'Retorno fictício' },
      now,
    );
    expect(JSON.stringify(doc)).toBe(before);
    expect(r.status).toBe('completed');
    expect(() => validateContinuity(db)).not.toThrow();
  });
  it('bloqueia motivo vazio, estado encerrado, conflito de versão, data inválida e escopo indevido', () => {
    const db = createSeed(now),
      id = referral(db);
    for (const cmd of [
      { ...reschedule(id), reason: '' },
      { ...reschedule(id), date: '2026-10-29' },
      { ...reschedule(id), date: today, time: '09:00', destination: 'Destino inicial' },
    ])
      expect(() => applyCommand(db, regulator, cmd, now)).toThrow();
    for (const ctx of [
      nurse,
      demoContext('aurora', 'aurora-vila', 'regulation'),
      demoContext('horizonte', 'horizonte-centro', 'regulation'),
    ])
      expect(() => applyCommand(db, ctx, reschedule(id), now)).toThrow();
    applyCommand(db, regulator, reschedule(id), now);
    expect(() => applyCommand(db, regulator, reschedule(id), now)).toThrow('mudou');
    applyCommand(db, regulator, { type: 'referral.cancel', id, reason: 'Teste' }, now);
    expect(() =>
      applyCommand(db, regulator, { ...reschedule(id), expectedHistoryCount: 3 }, now),
    ).toThrow('agendados');
  });
});
describe('agendamento e acompanhamento dos exames', () => {
  it('exige motivo e mudança real ao reagendar e mantém os dois horários e a ordem emitida', () => {
    const db = createSeed(now),
      doc = exam(db),
      content = JSON.stringify(doc.content);
    const event: Extract<Command, { type: 'exam.event' }> = {
      type: 'exam.event',
      id: doc.id,
      expectedVersion: doc.version,
      itemId: 'exam',
      kind: 'scheduled',
      date: today,
      time: '10:00',
      location: 'Local inicial',
      note: '',
    };
    applyCommand(db, nurse, event, now);
    expect(() =>
      applyCommand(db, nurse, { ...event, expectedVersion: doc.version, time: '11:00' }, now),
    ).toThrow('motivo');
    expect(() =>
      applyCommand(db, nurse, { ...event, expectedVersion: doc.version, note: 'Teste' }, now),
    ).toThrow('Altere');
    applyCommand(
      db,
      nurse,
      { ...event, expectedVersion: doc.version, time: '11:00', note: 'Alteração fictícia' },
      now,
    );
    expect(doc.examEvents).toHaveLength(2);
    expect(lastExamSchedule(doc, 'exam')?.time).toBe('11:00');
    expect(JSON.stringify(doc.content)).toBe(content);
    expect(() => validateClinicalDocuments(db)).not.toThrow();
  });
  it('data ultrapassada só sinaliza exame agendado e ativo, sem alterar a situação', () => {
    const db = createSeed(now),
      doc = exam(db);
    const event: Extract<Command, { type: 'exam.event' }> = {
      type: 'exam.event',
      id: doc.id,
      expectedVersion: doc.version,
      itemId: 'exam',
      kind: 'scheduled',
      date: today,
      time: '10:00',
      location: 'Local',
      note: '',
    };
    applyCommand(db, nurse, event, now);
    expect(examDateOverdue(doc, 'exam', today)).toBe(false);
    expect(examDateOverdue(doc, 'exam', '2026-10-31')).toBe(true);
    applyCommand(db, nurse, { ...event, expectedVersion: doc.version, kind: 'performed' }, now);
    expect(examDateOverdue(doc, 'exam', '2026-10-31')).toBe(false);
    doc.status = 'cancelled';
    expect(examDateOverdue(doc, 'exam', '2026-10-31')).toBe(false);
  });
});
it('bases anteriores permanecem válidas e autoria ou histórico adulterado bloqueiam gravações', () => {
  const db = createSeed(now);
  expect(() => validateContinuity(db)).not.toThrow();
  const id = recall(db);
  applyCommand(db, nurse, contact(id), now);
  db.vaccineRecalls.find((r) => r.id === id)!.contacts![0].actorId = 'horizonte-centro:nursing';
  const storage = new MemoryStorage();
  storage.setItem(storageKey, JSON.stringify(db));
  expect(new DemoRepository(storage, () => now).recoveryMessage).not.toBe('');
  const other = createSeed(now),
    rid = referral(other);
  applyCommand(other, regulator, reschedule(rid), now);
  other.referrals.find((r) => r.id === rid)!.appointmentTime = '12:00';
  expect(() => validateContinuity(other)).toThrow('difere');
});
