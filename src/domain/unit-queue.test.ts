import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { readDisplay } from './queue';
import { currentStay, validateUnitQueue } from './unit-queue';
import type { Command, Database } from './model';
import inventory from '../data/pulso-inventory.json';
import { deliveryOrder } from '../data/delivery-order';
const now = new Date('2026-10-31T14:00:00Z'),
  later = (n: number) => new Date(now.getTime() + n * 60000);
const unit = 'aurora-centro',
  nurse = demoContext('aurora', unit, 'nursing'),
  doctor = demoContext('aurora', unit, 'clinical'),
  reception = demoContext('aurora', unit, 'reception');
const e0 = unit + '-e0',
  e1 = unit + '-e1';
function intake(db: Database, id: string) {
  applyCommand(db, nurse, { type: 'intake.start', encounterId: id }, now);
  applyCommand(
    db,
    nurse,
    {
      type: 'intake.record',
      encounterId: id,
      content: { complaint: 'Relato fictício', observations: '', vitals: {} },
    },
    later(1),
  );
}
const assess = (id: string, rank = 2): Extract<Command, { type: 'queue.assess' }> => ({
  type: 'queue.assess',
  id,
  rank,
  roomId: 'consultorio-1',
  classification: 'Denominação fictícia',
  protocol: 'Referência fictícia A',
  reason: 'Justificativa clínica fictícia',
  expectedCount: 0,
  reviewMinutes: 15,
});
const call = (id: string, roomId = 'consultorio-1'): Extract<Command, { type: 'queue.call' }> => ({
  type: 'queue.call',
  encounterId: id,
  roomId,
});
function stored(db: Database) {
  let raw = JSON.stringify(db);
  return new DemoRepository(
    {
      getItem: () => raw,
      setItem: (_, v) => {
        raw = v;
      },
    },
    () => later(15),
  );
}
describe('classificação e circulação entre salas', () => {
  it('prioriza a faixa registrada, usa preferência para empate e preserva reavaliações com autoria', () => {
    const db = createSeed(now);
    intake(db, e0);
    intake(db, e1);
    applyCommand(db, nurse, assess(e0), later(2));
    applyCommand(db, nurse, assess(e1), later(2));
    expect(readSnapshot(db, reception).queueDirections.map((d) => d.encounterId)).toEqual([e1, e0]);
    const first = structuredClone(db.queueAssessments[0]);
    applyCommand(
      db,
      doctor,
      {
        ...assess(e0, 1),
        expectedCount: 1,
        reason: 'Reavaliação fictícia',
        reviewMinutes: undefined,
      },
      later(4),
    );
    expect(db.queueAssessments[0]).toEqual(first);
    expect(db.queueAssessments[2].actorId).toBe(doctor.sessionId);
    expect(db.queueAssessments[0].reviewAt).toBe(later(17).toISOString());
    expect(readSnapshot(db, reception).queueDirections[0].encounterId).toBe(e0);
    expect(readSnapshot(db, reception).queueAssessments).toEqual([]);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'clinical')).queueAssessments,
    ).toHaveLength(3);
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical')).queueAssessments,
    ).toEqual([]);
    expect(stored(db).recoveryMessage).toBe('');
  });
  it('rejeita antes da escuta, perfis ou unidades indevidas, prazo inválido e formulário desatualizado', () => {
    const db = createSeed(now);
    expect(() => applyCommand(db, nurse, assess(e0), now)).toThrow();
    intake(db, e0);
    for (const c of [
      reception,
      demoContext('aurora', 'aurora-vila', 'nursing'),
      demoContext('horizonte', 'horizonte-centro', 'clinical'),
    ])
      expect(() => applyCommand(db, c, assess(e0), later(2))).toThrow();
    for (const patch of [
      { rank: 0 },
      { rank: 1.5 },
      { reviewMinutes: -1 },
      { roomId: 'inventada' },
      { protocol: ' ' },
      { reason: '' },
    ])
      expect(() => applyCommand(db, nurse, { ...assess(e0), ...patch }, later(2))).toThrow();
    applyCommand(db, nurse, assess(e0), later(2));
    expect(() => applyCommand(db, nurse, assess(e0), later(3))).toThrow('mudou');
    applyCommand(db, reception, call(e0), later(3));
    expect(() =>
      applyCommand(
        db,
        nurse,
        { ...assess(e0), roomId: 'consultorio-2', expectedCount: 1 },
        later(4),
      ),
    ).toThrow('Devolva');
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'encounter.start', id: e0, roomId: 'consultorio-2' },
        later(4),
      ),
    ).toThrow();
    expect(db.queueAssessments).toHaveLength(1);
  });
  it('chamada, rechamada e entrada usam uma única reserva; bloqueia dupla ocupação e libera na conclusão', () => {
    const db = createSeed(now),
      person = db.encounters.find((e) => e.id === e0)!;
    const id = applyCommand(db, reception, call(e0), now);
    applyCommand(db, reception, { type: 'queue.recall', callId: id }, later(1));
    expect(person.roomStays).toHaveLength(1);
    expect(db.careSegments.length).toBe(0);
    expect(() => applyCommand(db, reception, call(e1), later(1))).toThrow('reservado');
    applyCommand(db, doctor, { type: 'encounter.start', id: e0 }, later(3));
    expect(currentStay(person)?.enteredAt).toBe(later(3).toISOString());
    expect(() =>
      applyCommand(
        db,
        reception,
        { type: 'queue.release-room', id: e0, stayId: id, reason: 'Teste' },
        later(4),
      ),
    ).toThrow();
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', unit, 'clinical', true),
        { type: 'encounter.start', id: e1, roomId: 'consultorio-1' },
        later(4),
      ),
    ).toThrow();
    applyCommand(
      db,
      doctor,
      {
        type: 'note.save',
        encounterId: e0,
        soap: {
          subjective: '',
          objective: '',
          assessment: 'Avaliação fictícia',
          plan: 'Plano fictício',
        },
      },
      later(7),
    );
    applyCommand(db, doctor, { type: 'note.finalize', encounterId: e0 }, later(8));
    expect(currentStay(person)).toBeUndefined();
    expect(person.roomStays?.[0].outcome).toBe('completed');
    applyCommand(db, reception, call(e1), later(8));
    expect(stored(db).recoveryMessage).toBe('');
  });
  it('devolução preserva a chegada, retira a chamada da TV e recusa repetição antiga depois de nova reserva', () => {
    const db = createSeed(now),
      e = db.encounters.find((e) => e.id === e0)!,
      arrival = e.arrivedAt;
    const id = applyCommand(db, reception, call(e0), now);
    const release = {
      type: 'queue.release-room' as const,
      id: e0,
      stayId: id,
      reason: 'Chamada adiada pela equipe',
    };
    expect(() => applyCommand(db, reception, { ...release, reason: ' ' }, later(1))).toThrow();
    applyCommand(db, reception, release, later(1));
    expect(() =>
      applyCommand(db, reception, { type: 'queue.recall', callId: id }, later(1)),
    ).toThrow('reserva terminou');
    expect(e.arrivedAt).toBe(arrival);
    expect(e.status).toBe('waiting');
    const feed = readDisplay(db, 'aurora', unit, later(1));
    expect(feed.current).toBeNull();
    expect(feed.recent[0].ticket).toBe(e.ticket);
    applyCommand(db, reception, call(e0, 'consultorio-2'), later(2));
    expect(() => applyCommand(db, reception, release, later(2))).toThrow();
    expect(stored(db).recoveryMessage).toBe('');
    e.roomStays![0].endedAt = undefined;
    expect(() => validateUnitQueue(db)).toThrow();
  });
  it('salas independentes por unidade; observação libera sala, e períodos antigos não recebem sala inventada', () => {
    const db = createSeed(now),
      upa = demoContext('aurora', 'aurora-upa', 'clinical'),
      id = 'aurora-upa-e0';
    applyCommand(db, doctor, { type: 'encounter.start', id: e0 }, now);
    applyCommand(db, upa, { type: 'encounter.start', id }, now);
    applyCommand(db, upa, { type: 'encounter.observe', id }, later(2));
    expect(db.encounters.find((e) => e.id === id)?.roomStays?.[0].outcome).toBe('observation');
    expect(stored(db).recoveryMessage).toBe('');
    const old = createSeed(now);
    applyCommand(old, doctor, { type: 'encounter.start', id: e0 }, now);
    delete old.encounters.find((e) => e.id === e0)!.roomStays;
    const repo = stored({ ...old, schemaVersion: 10 } as unknown as Database);
    expect(repo.recoveryMessage).toBe('');
    expect(repo.snapshot(doctor).encounters.find((e) => e.id === e0)?.roomStays).toBeUndefined();
  });
  it('a sequência da entrega cobre exatamente os 44 recursos de origem sem repetição', () => {
    expect(deliveryOrder.size).toBe(44);
    expect([...deliveryOrder.keys()].sort()).toEqual(
      inventory.rows
        .filter((r) => !['tv', 'inicio'].includes(r.id))
        .map((r) => r.id)
        .sort(),
    );
  });
});

describe('encaminhamentos para outros setores', () => {
  it('farmácia recebe apenas o destino próprio e pode devolver; nova avaliação encaminha para vacinação sem movimentar estoque', () => {
    const db = createSeed(now);
    intake(db, e0);
    const ph = demoContext('aurora', unit, 'pharmacy');
    const assessmentId = applyCommand(db, nurse, { ...assess(e0), roomId: 'farmacia-1' }, later(2));
    const hint = readSnapshot(db, ph).serviceTickets[0];
    expect(hint.assessmentId).toBe(assessmentId);
    expect(readSnapshot(db, ph).queueAssessments).toEqual([]);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'pharmacy')).serviceTickets,
    ).toEqual([]);
    const pass = {
      type: 'queue.service' as const,
      id: e0,
      assessmentId,
      expectedCount: 0,
      action: 'receive' as const,
      note: '',
    };
    expect(() => applyCommand(db, nurse, pass, later(2))).toThrow();
    expect(() => applyCommand(db, doctor, { type: 'encounter.start', id: e0 }, later(2))).toThrow();
    const receiveCall = { type: 'queue.call-service' as const, id: e0, assessmentId };
    applyCommand(db, ph, receiveCall, later(3));
    expect(readDisplay(db, 'aurora', unit, later(3)).current?.room).toBe('Farmácia');
    applyCommand(db, ph, pass, later(4));
    expect(() => applyCommand(db, ph, receiveCall, later(4))).toThrow();
    expect(() => applyCommand(db, nurse, { ...assess(e0), expectedCount: 1 }, later(4))).toThrow(
      'recebeu',
    );
    expect(() =>
      applyCommand(db, ph, { ...pass, action: 'return', note: 'Motivo' }, later(4)),
    ).toThrow();
    applyCommand(
      db,
      ph,
      { ...pass, action: 'return', note: 'Conferência fictícia necessária', expectedCount: 1 },
      later(5),
    );
    expect(readSnapshot(db, reception).queueDirections[0].roomId).toBe('escuta-1');
    expect(readSnapshot(db, reception).queueServiceEvents.at(-1)?.note).toBe('');
    const next = applyCommand(
      db,
      nurse,
      { ...assess(e0), expectedCount: 1, roomId: 'vacina-1' },
      later(6),
    );
    expect(() => applyCommand(db, ph, pass, later(6))).toThrow();
    const before = JSON.stringify([db.dispensations, db.immunizations, db.vaccineLots, db.lots]);
    applyCommand(db, nurse, { ...pass, assessmentId: next }, later(7));
    applyCommand(
      db,
      nurse,
      {
        ...pass,
        assessmentId: next,
        action: 'finish',
        expectedCount: 1,
        note: 'Passagem fictícia concluída',
      },
      later(8),
    );
    expect(db.encounters.find((e) => e.id === e0)?.status).toBe('completed');
    expect(JSON.stringify([db.dispensations, db.immunizations, db.vaccineLots, db.lots])).toBe(
      before,
    );
    expect(() => applyCommand(db, nurse, { ...assess(e0), expectedCount: 2 }, later(9))).toThrow();
    expect(stored(db).recoveryMessage).toBe('');
  });
  it('orientação que encerra a visita exige confirmação expressa e preserva a avaliação sem gerar consulta médica', () => {
    const db = createSeed(now);
    intake(db, e0);
    const cmd = { ...assess(e0), roomId: 'orientacao', reviewMinutes: undefined };
    expect(() => applyCommand(db, nurse, cmd, later(2))).toThrow('Confirme');
    expect(() =>
      applyCommand(db, nurse, { ...cmd, confirmClosure: true, reviewMinutes: 5 }, later(2)),
    ).toThrow();
    applyCommand(db, nurse, { ...cmd, confirmClosure: true }, later(2));
    expect(db.careSegments.length).toBe(0);
    expect(db.notes.length).toBe(0);
    expect(stored(db).recoveryMessage).toBe('');
    db.queueAssessments[0].at = later(1).toISOString();
    expect(() => validateUnitQueue(db)).toThrow();
  });
});
