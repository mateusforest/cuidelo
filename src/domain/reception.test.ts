import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot, readSummary } from './operations';
import { issueKiosk, performance } from './patient-flow';
import { readDisplay } from './queue';
import { flowStage, type ReceptionCommand } from './reception';
import type { Command, Database } from './model';

const start = new Date('2026-10-29T15:00:00Z'),
  later = (n: number) => new Date(start.getTime() + n * 60000);
const reception = demoContext('aurora', 'aurora-centro', 'reception'),
  nurse = demoContext('aurora', 'aurora-centro', 'nursing'),
  doctor = demoContext('aurora', 'aurora-centro', 'clinical');
const target = { kind: 'arrival' as const, id: 'arrival-reception-001' };
function setup() {
  const db = createSeed(start);
  issueKiosk(
    db,
    {
      organizationId: 'aurora',
      unitId: 'aurora-centro',
      requestId: target.id,
      service: 'Consulta',
      priority: 'priority',
      preferenceReason: 'pregnant',
    },
    start,
  );
  return db;
}
function complete(
  db: Database,
  patch: Partial<Extract<ReceptionCommand, { type: 'reception.complete' }>> = {},
) {
  const p = db.patients.find((p) => p.id === 'aurora-p12')!;
  return {
    type: 'reception.complete',
    target,
    patientId: p.id,
    identity: { kind: 'cpf', value: p.cpf!, birthDate: p.birthDate },
    identityConfirmed: true,
    preferenceConfirmed: true,
    priority: 'priority',
    preferenceReason: 'pregnant',
    service: 'Consulta',
    destination: 'triage',
    roomId: 'escuta-1',
    adjustmentReason: '',
    expectedChecks: 0,
    ...patch,
  } as const;
}
function checked() {
  const db = setup();
  applyCommand(db, reception, { type: 'reception.start', target }, later(4));
  const id = applyCommand(db, reception, complete(db), later(7));
  return { db, id };
}
describe('recepção, conferência e encaminhamento', () => {
  it('chama senha anônima no guichê sem publicar identidade ou motivo e mantém chamada depois da vinculação', () => {
    const db = setup();
    applyCommand(db, reception, { type: 'queue.call-arrival', arrivalId: target.id }, later(2));
    const feed = readDisplay(db, 'aurora', 'aurora-centro', later(2));
    expect(feed.current?.room).toBe('Guichê 01');
    expect(JSON.stringify(feed)).not.toMatch(/pregnant|CPF|patientId|arrivalId/);
    applyCommand(db, reception, { type: 'reception.start', target }, later(4));
    const id = applyCommand(db, reception, complete(db), later(7));
    expect(readSnapshot(db, reception).calls.at(-1)?.encounterId).toBe(id);
    const e = db.encounters.find((e) => e.id === id)!;
    expect(e.arrivedAt).toBe(start.toISOString());
    expect(e.ticket).toBe(feed.current?.ticket);
    expect(e.receptionChecks?.[0].actorId).toBe(reception.sessionId);
    expect(readSnapshot(db, reception).kioskArrivals).toHaveLength(0);
  });
  it('não permite concluir sem início, dados correspondentes e duas confirmações', () => {
    const db = setup();
    expect(() => applyCommand(db, reception, complete(db), later(1))).toThrow('início');
    applyCommand(db, reception, { type: 'reception.start', target }, later(1));
    expect(() =>
      applyCommand(db, reception, complete(db, { identityConfirmed: false }), later(2)),
    ).toThrow('Confirme');
    expect(() =>
      applyCommand(db, reception, complete(db, { preferenceConfirmed: false }), later(2)),
    ).toThrow('Confirme');
    expect(() =>
      applyCommand(
        db,
        reception,
        complete(db, { identity: { kind: 'cpf', value: '11111111111', birthDate: '1962-08-10' } }),
        later(2),
      ),
    ).toThrow('não confere');
    expect(() =>
      applyCommand(
        db,
        reception,
        complete(db, {
          identity: { kind: 'name', value: 'Lucas Pereira', birthDate: '2000-01-01' },
        }),
        later(2),
      ),
    ).toThrow('nascimento');
    expect(db.kioskArrivals[0].encounterId).toBeUndefined();
  });
  it('confere pessoa sem CPF por nome social e nascimento, sem escolher homônimos automaticamente', () => {
    const db = setup(),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    delete p.cpf;
    p.socialName = 'Lucas de Teste';
    db.patients.push({ ...p, id: 'homonym', record: 'DEMO-9999' });
    applyCommand(db, reception, { type: 'reception.start', target }, later(1));
    const id = applyCommand(
      db,
      reception,
      complete(db, {
        identity: { kind: 'name', value: '  lúcas de TESTE ', birthDate: p.birthDate },
      }),
      later(2),
    );
    expect(db.encounters.find((e) => e.id === id)?.patientId).toBe(p.id);
  });
  it('restringe conferência por perfil, prefeitura e unidade', () => {
    const db = setup();
    for (const c of [
      nurse,
      doctor,
      demoContext('aurora', 'aurora-vila', 'reception'),
      demoContext('horizonte', 'horizonte-centro', 'reception'),
    ])
      expect(() => applyCommand(db, c, { type: 'reception.start', target }, later(1))).toThrow();
    applyCommand(db, reception, { type: 'reception.start', target }, later(1));
    expect(() =>
      applyCommand(db, reception, complete(db, { patientId: 'horizonte-p12' }), later(2)),
    ).toThrow('prefeitura');
  });
  it('bloqueia consulta e chamada para consultório até terminar conferência e triagem', () => {
    const db = setup(),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    const id = applyCommand(
      db,
      reception,
      { type: 'kiosk.link', arrivalId: target.id, patientId: p.id },
      later(1),
    );
    expect(() =>
      applyCommand(db, nurse, { type: 'intake.start', encounterId: id }, later(2)),
    ).toThrow('conferência');
    expect(() => applyCommand(db, doctor, { type: 'encounter.start', id }, later(2))).toThrow(
      'conferência',
    );
    applyCommand(
      db,
      reception,
      { type: 'reception.start', target: { kind: 'encounter', id } },
      later(3),
    );
    applyCommand(db, reception, complete(db, { target: { kind: 'encounter', id } }), later(4));
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'queue.call', encounterId: id, roomId: 'consultorio-1' },
        later(5),
      ),
    ).toThrow('triagem');
    expect(() =>
      applyCommand(
        db,
        nurse,
        {
          type: 'intake.record',
          encounterId: id,
          content: { complaint: 'Teste', observations: '', vitals: {} },
        },
        later(5),
      ),
    ).toThrow('entrada');
    applyCommand(db, nurse, { type: 'queue.call', encounterId: id, roomId: 'escuta-1' }, later(5));
    expect(db.encounters.find((e) => e.id === id)?.intakeStartedAt).toBeUndefined();
    applyCommand(db, nurse, { type: 'intake.start', encounterId: id }, later(6));
    applyCommand(
      db,
      nurse,
      {
        type: 'intake.record',
        encounterId: id,
        content: { complaint: 'Teste', observations: '', vitals: {} },
      },
      later(9),
    );
    applyCommand(db, doctor, { type: 'encounter.start', id }, later(12));
    expect(flowStage(db.encounters.find((e) => e.id === id)!)).toBe('Em consulta');
  });
  it('preserva a preferência conferida quando o totem é usado novamente', () => {
    const { db, id } = checked(),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    const result = issueKiosk(
      db,
      {
        organizationId: 'aurora',
        unitId: 'aurora-centro',
        requestId: 'repeat-after-checked',
        service: 'Consulta',
        priority: 'priority',
        preferenceReason: 'elderly',
        identification: { kind: 'cpf', value: p.cpf!, birthDate: p.birthDate },
      },
      later(8),
    );
    expect(result.preferenceNeedsReview).toBe(true);
    expect(db.encounters.find((e) => e.id === id)?.preferenceReason).toBe('pregnant');
  });
  it('ajustes são justificados, acrescentados e impedidos depois da entrada na triagem', () => {
    const { db, id } = checked(),
      e = db.encounters.find((e) => e.id === id)!;
    const cmd = complete(db, {
      target: { kind: 'encounter', id },
      priority: 'routine',
      preferenceReason: undefined,
      expectedChecks: 1,
    });
    expect(() => applyCommand(db, reception, cmd, later(8))).toThrow('Explique');
    applyCommand(
      db,
      reception,
      { ...cmd, adjustmentReason: 'Solicitação corrigida pela pessoa.' },
      later(8),
    );
    expect(e.receptionChecks).toHaveLength(2);
    expect(e.receptionChecks?.[0].priority).toBe('priority');
    expect(() =>
      applyCommand(db, reception, { ...cmd, adjustmentReason: 'Duplicado' }, later(8)),
    ).toThrow('mudou');
    applyCommand(db, nurse, { type: 'intake.start', encounterId: id }, later(9));
    expect(() =>
      applyCommand(
        db,
        reception,
        { ...cmd, expectedChecks: 2, adjustmentReason: 'Novo ajuste' },
        later(10),
      ),
    ).toThrow('preservada');
  });
  it('ausência e retorno preservam senha, chegada e histórico e bloqueiam chamada enquanto ausente', () => {
    const db = setup();
    expect(() =>
      applyCommand(
        db,
        reception,
        { type: 'reception.absent', target, reason: 'Não localizada' },
        later(1),
      ),
    ).toThrow('Chame');
    const call = applyCommand(
      db,
      reception,
      { type: 'queue.call-arrival', arrivalId: target.id },
      later(1),
    );
    applyCommand(
      db,
      reception,
      { type: 'reception.absent', target, reason: 'Não localizada' },
      later(2),
    );
    expect(() =>
      applyCommand(db, reception, { type: 'queue.recall', callId: call }, later(3)),
    ).toThrow('retorno');
    applyCommand(db, reception, { type: 'reception.return', target }, later(5));
    applyCommand(db, reception, { type: 'reception.start', target }, later(6));
    const id = applyCommand(db, reception, complete(db), later(7));
    const e = db.encounters.find((e) => e.id === id)!;
    expect(e.arrivedAt).toBe(start.toISOString());
    expect(e.receptionEvents?.map((x) => x.kind)).toEqual(['absent', 'returned']);
  });
  it('mede espera, balcão, triagem e profissional sem incluir espera no tempo de atendimento', () => {
    const { db, id } = checked();
    applyCommand(db, nurse, { type: 'intake.start', encounterId: id }, later(10));
    applyCommand(
      db,
      nurse,
      {
        type: 'intake.record',
        encounterId: id,
        content: { complaint: 'Teste', observations: '', vitals: {} },
      },
      later(13),
    );
    const report = performance(
      db,
      demoContext('aurora', 'all', 'manager'),
      '2026-10-29',
      '2026-10-29',
      later(15),
    );
    expect(report.beforeReception.average).toBe(4);
    expect(report.desk.average).toBe(3);
    expect(report.beforeTriage.average).toBe(3);
    expect(report.byReception[0].duration.average).toBe(3);
    expect(JSON.stringify(report.byReception)).not.toMatch(/Lucas|pregnant|cpf/);
  });
  it('valida serviço, sala, dia, duplicidade e não substitui o paciente da senha identificada', () => {
    const db = setup();
    applyCommand(db, reception, { type: 'reception.start', target }, later(1));
    expect(() =>
      applyCommand(db, reception, complete(db, { roomId: 'consultorio-1' }), later(2)),
    ).toThrow('sala');
    expect(() =>
      applyCommand(db, reception, complete(db, { service: 'Inexistente' }), later(2)),
    ).toThrow('serviço');
    expect(() => applyCommand(db, reception, complete(db), later(1441))).toThrow('hoje');
    const p = db.patients.find((p) => p.id === 'aurora-p1')!;
    expect(() =>
      applyCommand(
        db,
        reception,
        complete(db, {
          patientId: p.id,
          identity: { kind: 'cpf', value: p.cpf!, birthDate: p.birthDate },
        }),
        later(2),
      ),
    ).toThrow('atendimento aberto');
  });
  it('persiste as etapas e chamadas anônimas; migra versão 6 sem inventar horários de recepção', async () => {
    let saved = JSON.stringify({ ...setup(), schemaVersion: 6 });
    const storage = {
      getItem: () => saved,
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    let now = later(1);
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    await repo.execute(reception, { type: 'queue.call-arrival', arrivalId: target.id });
    now = later(4);
    await repo.execute(reception, { type: 'reception.start', target });
    now = later(7);
    await repo.execute(reception, complete(JSON.parse(saved)));
    const reload = new DemoRepository(storage, () => now);
    expect(reload.recoveryMessage).toBe('');
    expect(reload.snapshot(reception).encounters.at(-1)?.receptionChecks).toHaveLength(1);
    expect(JSON.parse(saved).schemaVersion).toBe(9);
    expect(reload.snapshot(reception).encounters[0].receptionStartedAt).toBeUndefined();
  });
  it('falha de conferência não deixa vínculo parcial nem altera armazenamento', async () => {
    let saved = JSON.stringify(setup());
    const storage = {
      getItem: () => saved,
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    const repo = new DemoRepository(storage, () => later(4));
    await repo.execute(reception, { type: 'reception.start', target });
    const before = saved;
    await expect(
      repo.execute(reception, {
        ...complete(JSON.parse(saved)),
        identityConfirmed: false,
      } as Command),
    ).rejects.toThrow('Confirme');
    expect(saved).toBe(before);
  });
  it('gestão conta senhas anônimas e etapas sem duplicar a chegada após identificar', () => {
    const db = setup(),
      manager = demoContext('aurora', 'all', 'manager');
    const before = readSummary(db, manager, start);
    const other = readSummary(db, demoContext('horizonte', 'all', 'manager'), start);
    applyCommand(db, reception, { type: 'reception.start', target }, later(4));
    applyCommand(db, reception, complete(db), later(7));
    const after = readSummary(db, manager, later(8));
    expect(after.flow.reception).toBe(before.flow.reception - 1);
    expect(after.flow.triageWaiting).toBe(before.flow.triageWaiting + 1);
    expect(after.today).toBe(before.today + 1);
    expect(readSummary(db, demoContext('horizonte', 'all', 'manager'), later(8)).flow).toEqual(
      other.flow,
    );
    expect(readSnapshot(db, manager).calls).toEqual([]);
    expect(readSnapshot(db, manager).encounters).toEqual([]);
  });
  it('recusa armazenamento com autoria de outra unidade ou horário impossível na conferência', () => {
    const { db, id } = checked(),
      e = db.encounters.find((e) => e.id === id)!;
    e.receptionChecks![0].actorId = 'aurora-vila:reception';
    expect(
      new DemoRepository({ getItem: () => JSON.stringify(db), setItem: () => {} }, () => later(9))
        .recoveryMessage,
    ).not.toBe('');
    e.receptionChecks![0].actorId = reception.sessionId;
    e.receptionChecks![0].at = later(2).toISOString();
    expect(
      new DemoRepository({ getItem: () => JSON.stringify(db), setItem: () => {} }, () => later(9))
        .recoveryMessage,
    ).not.toBe('');
  });
});
