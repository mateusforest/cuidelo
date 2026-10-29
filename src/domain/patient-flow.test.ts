import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { issueKiosk, performance } from './patient-flow';
import { readDisplay } from './queue';
const now = new Date('2026-10-29T15:00:00Z'),
  later = (minutes: number) => new Date(now.getTime() + minutes * 60000);
const doctor = demoContext('aurora', 'aurora-centro', 'clinical'),
  nurse = demoContext('aurora', 'aurora-centro', 'nursing'),
  admin = demoContext('aurora', 'aurora-centro', 'admin'),
  manager = demoContext('aurora', 'all', 'manager');
const soap = {
  subjective: 'Demonstração',
  objective: '',
  assessment: 'Avaliação de teste',
  plan: 'Plano fictício',
};
describe('sessões, jornada e totem', () => {
  it('não conta a escuta em andamento como espera atual e reinicia a espera após a escuta', () => {
    const db = createSeed(now),
      e = db.encounters.find((e) => e.id === 'aurora-centro-e0')!;
    db.encounters = [e];
    e.arrivedAt = now.toISOString();
    applyCommand(db, nurse, { type: 'intake.start', encounterId: e.id }, later(5));
    expect(performance(db, manager, '2026-10-29', '2026-10-29', later(8)).currentWait.count).toBe(
      0,
    );
    applyCommand(
      db,
      nurse,
      {
        type: 'intake.record',
        encounterId: e.id,
        content: { complaint: 'Teste', observations: '', vitals: {} },
      },
      later(10),
    );
    expect(performance(db, manager, '2026-10-29', '2026-10-29', later(18)).currentWait).toEqual({
      count: 1,
      average: 8,
    });
  });
  it('não reutiliza solicitação em outra unidade nem emite senha de atendimento de outro dia', () => {
    const db = createSeed(now),
      request = {
        organizationId: 'aurora',
        unitId: 'aurora-centro',
        service: 'Consulta',
        priority: 'routine' as const,
        requestId: 'unique-device-request',
      };
    issueKiosk(db, request, now);
    expect(() => issueKiosk(db, { ...request, unitId: 'aurora-vila' }, now)).toThrow(
      'outro dispositivo',
    );
    const p = db.patients.find((p) => p.id === 'aurora-p1')!,
      e = db.encounters.find((e) => e.patientId === p.id && e.unitId === 'aurora-centro')!;
    e.arrivedAt = '2026-10-28T15:00:00Z';
    expect(() =>
      issueKiosk(
        db,
        {
          ...request,
          requestId: 'another-device-request',
          record: p.record,
          birthDate: p.birthDate,
        },
        now,
      ),
    ).toThrow('outro dia');
  });
  it('bloqueia troca de unidade/perfil/rede na sessão e administração não recebe conteúdo clínico', () => {
    const db = createSeed(now);
    for (const c of [doctor, admin, nurse, demoContext('aurora', 'aurora-centro', 'reception')]) {
      expect(() => readSnapshot(db, { ...c, unitId: 'aurora-vila' })).toThrow('única unidade');
      expect(() => readSnapshot(db, { ...c, role: 'manager' })).toThrow('sessão');
      expect(() => readSnapshot(db, { ...c, organizationId: 'horizonte' })).toThrow('prefeitura');
      expect(() => readSnapshot(db, { ...c, unitId: 'all' })).toThrow();
    }
    expect(() => readSnapshot(db, { ...manager, unitId: 'aurora-vila' })).not.toThrow();
    expect(() => readSnapshot(db, { ...manager, unitId: 'horizonte-centro' })).toThrow();
    expect(() =>
      applyCommand(db, admin, { type: 'encounter.start', id: 'aurora-centro-e0' }, now),
    ).toThrow('não tem acesso');
  });
  it('mantém história clínica na prefeitura e bloqueia comandos entre unidades', () => {
    const db = createSeed(now);
    applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e0' }, now);
    applyCommand(
      db,
      doctor,
      { type: 'note.save', encounterId: 'aurora-centro-e0', soap },
      later(5),
    );
    const other = demoContext('aurora', 'aurora-vila', 'clinical');
    expect(readSnapshot(db, other).notes).toHaveLength(1);
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical')).notes,
    ).toHaveLength(0);
    expect(readSnapshot(db, admin).notes).toHaveLength(0);
    expect(() =>
      applyCommand(db, other, { type: 'note.finalize', encounterId: 'aurora-centro-e0' }, later(6)),
    ).toThrow('nesta unidade');
  });
  it('mede etapas, separa chamada da consulta e exclui observação do tempo profissional', () => {
    const db = createSeed(now),
      c = demoContext('aurora', 'aurora-upa', 'clinical'),
      n = demoContext('aurora', 'aurora-upa', 'nursing'),
      e = db.encounters.find((e) => e.id === 'aurora-upa-e0')!;
    e.arrivedAt = now.toISOString();
    applyCommand(db, n, { type: 'intake.start', encounterId: e.id }, later(5));
    applyCommand(
      db,
      n,
      {
        type: 'intake.record',
        encounterId: e.id,
        content: { complaint: 'Teste', observations: '', vitals: {} },
      },
      later(10),
    );
    applyCommand(
      db,
      c,
      { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-1' },
      later(12),
    );
    expect(e.startedAt).toBeUndefined();
    applyCommand(db, c, { type: 'encounter.start', id: e.id }, later(15));
    applyCommand(db, c, { type: 'note.save', encounterId: e.id, soap }, later(20));
    applyCommand(db, c, { type: 'encounter.observe', id: e.id }, later(25));
    applyCommand(db, c, { type: 'encounter.start', id: e.id }, later(55));
    applyCommand(db, c, { type: 'note.finalize', encounterId: e.id }, later(60));
    const r = performance(db, c, '2026-10-29', '2026-10-29', later(60));
    expect(r.reception).toEqual({ count: 1, average: 5 });
    expect(r.intake.average).toBe(5);
    expect(r.beforeConsult.average).toBe(5);
    expect(r.byProfessional[0].duration).toEqual({ count: 2, average: 7.5 });
    expect(r.total.average).toBe(60);
  });
  it('impede dois profissionais no mesmo atendimento e dois pacientes simultâneos por profissional', () => {
    const db = createSeed(now),
      other = demoContext('aurora', 'aurora-centro', 'clinical', true);
    applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e0' }, now);
    expect(() =>
      applyCommand(db, other, { type: 'encounter.start', id: 'aurora-centro-e0' }, now),
    ).toThrow('em curso');
    expect(() =>
      applyCommand(db, other, { type: 'note.save', encounterId: 'aurora-centro-e0', soap }, now),
    ).toThrow('responsável');
    expect(() =>
      applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e1' }, now),
    ).toThrow('em curso com você');
    expect(performance(db, other, '2026-10-29', '2026-10-29', now).byProfessional).toEqual([]);
  });
  it('não inventa autoria nem duração para atendimentos antigos', () => {
    const db = createSeed(now);
    expect(performance(db, manager, '2026-10-29', '2026-10-29', now).byProfessional).toEqual([]);
    expect(performance(db, manager, '2026-10-29', '2026-10-29', now).unassigned).toBeGreaterThan(0);
    applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e2' }, now);
    expect(db.careSegments[0].startedAt).toBe(now.toISOString());
  });
  it('emite senha anônima uma vez e vincula cadastro preservando a chegada', () => {
    const db = createSeed(now),
      request = {
        organizationId: 'aurora',
        unitId: 'aurora-centro',
        service: 'Consulta',
        priority: 'routine' as const,
        requestId: 'solicitacao-totem-001',
      };
    const a = issueKiosk(db, request, now),
      b = issueKiosk(db, request, later(1));
    expect(a.ticket).toBe(b.ticket);
    expect(db.kioskArrivals).toHaveLength(1);
    const e = applyCommand(
      db,
      admin,
      { type: 'kiosk.link', arrivalId: request.requestId, patientId: 'aurora-p12' },
      later(10),
    );
    expect(db.encounters.find((x) => x.id === e)).toMatchObject({
      ticket: a.ticket,
      arrivedAt: now.toISOString(),
      source: 'kiosk',
    });
    expect(() =>
      applyCommand(
        db,
        admin,
        { type: 'kiosk.link', arrivalId: request.requestId, patientId: 'aurora-p12' },
        later(11),
      ),
    ).toThrow('já foi identificada');
    const c = issueKiosk(db, { ...request, requestId: 'solicitacao-totem-002' }, later(2));
    expect(c.ticket).not.toBe(a.ticket);
  });
  it('exige correspondência exata para identificação e não expõe nome ou nascimento no recibo/TV', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    const request = {
      organizationId: 'aurora',
      unitId: 'aurora-centro',
      service: 'Consulta',
      priority: 'routine' as const,
      record: p.record,
      birthDate: p.birthDate,
      requestId: 'solicitacao-totem-003',
    };
    expect(() => issueKiosk(db, { ...request, birthDate: '1900-01-01' }, now)).toThrow('confirmar');
    const receipt = issueKiosk(db, request, now);
    expect(JSON.stringify(receipt)).not.toContain(p.name);
    expect(JSON.stringify(receipt)).not.toContain(p.birthDate);
    expect(
      issueKiosk(db, { ...request, requestId: 'solicitacao-totem-004' }, later(1)).ticket,
    ).toBe(receipt.ticket);
    const e = db.encounters.find(
      (e) => e.ticket === receipt.ticket && e.unitId === 'aurora-centro',
    )!;
    applyCommand(
      db,
      doctor,
      { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-1' },
      now,
    );
    expect(JSON.stringify(readDisplay(db, 'aurora', 'aurora-centro', now))).not.toContain(p.name);
  });
  it('migra base anterior sem marcar etapas fictícias e falha de armazenamento não emite senha', async () => {
    const values = new Map<string, string>();
    const old = { ...createSeed(now), schemaVersion: 4 };
    values.set(storageKey, JSON.stringify(old));
    let fail = false;
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (fail) throw Error('full');
        values.set(k, v);
      },
    };
    const repo = new DemoRepository(storage, () => now);
    expect(repo.snapshot(doctor).careSegments).toEqual([]);
    fail = true;
    await expect(
      repo.issueTicket({
        organizationId: 'aurora',
        unitId: 'aurora-centro',
        service: 'Consulta',
        priority: 'routine',
        requestId: 'storage-failure-ticket',
      }),
    ).rejects.toThrow('salvar a senha');
    expect(repo.snapshot(admin).kioskArrivals).toEqual([]);
  });
});
