import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import {
  examState,
  validateClinicalDocuments,
  type DocumentContent,
  type ExamEvent,
} from './clinical-documents';
import type { Context, Database } from './model';

const now = new Date('2026-10-29T15:00:00Z'),
  encounterId = 'aurora-centro-e0';
const doctor = demoContext('aurora', 'aurora-centro', 'clinical'),
  other = demoContext('aurora', 'aurora-centro', 'clinical', true),
  nurse = demoContext('aurora', 'aurora-centro', 'nursing'),
  regulator = demoContext('aurora', 'aurora-centro', 'regulation'),
  admin = demoContext('aurora', 'aurora-centro', 'admin');
const prescription: DocumentContent = {
  kind: 'prescription',
  orientations: 'Somente teste do formulário.',
  items: [
    {
      id: 'med-1',
      medicine: 'Medicamento fictício Alfa',
      strength: 'Concentração de teste',
      form: 'Apresentação de teste',
      dose: 'Dose fictícia',
      route: 'Via de teste',
      frequency: 'Frequência de teste',
      duration: 'Duração de teste',
      quantity: '2',
      quantityUnit: 'unidades fictícias',
      instructions: 'Não utilizar.',
    },
  ],
};
const exams: DocumentContent = {
  kind: 'exams',
  items: [
    { id: 'exam-1', name: 'Exame fictício A', material: '', notes: '' },
    { id: 'exam-2', name: 'Exame fictício B', material: '', notes: '' },
  ],
  indication: 'Indicação fictícia',
  priority: 'routine',
  priorityReason: '',
};
const referral: DocumentContent = {
  kind: 'referral',
  specialty: 'Especialidade de teste',
  destination: 'Serviço fictício',
  reason: 'Justificativa fictícia confidencial',
  summary: 'Resumo fictício',
  priority: 'urgent',
  priorityReason: 'Motivo fictício',
};
function setup() {
  const db = createSeed(now);
  applyCommand(db, doctor, { type: 'encounter.start', id: encounterId }, now);
  return db;
}
function save(db: Database, content: DocumentContent = prescription) {
  return applyCommand(
    db,
    doctor,
    { type: 'document.save', encounterId, expectedVersion: 0, content },
    now,
  );
}
function issue(db: Database, content: DocumentContent = prescription) {
  const id = save(db, content);
  applyCommand(db, doctor, { type: 'document.issue', id, expectedVersion: 1, reviewed: true }, now);
  return db.clinicalDocuments.find((d) => d.id === id)!;
}
function event(
  db: Database,
  id: string,
  kind: ExamEvent['kind'],
  c: Context = doctor,
  itemId = 'exam-1',
) {
  return applyCommand(
    db,
    c,
    {
      type: 'exam.event',
      id,
      expectedVersion: db.clinicalDocuments.find((d) => d.id === id)!.version,
      itemId,
      kind,
      date: '2026-10-29',
      time: '16:00',
      location: 'Local de teste',
      note: 'Registro fictício para teste',
    },
    now,
  );
}
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('documentos e continuidade do consultório', () => {
  it('permite rascunho incompleto, exige revisão e todos os campos para emitir', () => {
    const db = setup(),
      incomplete = structuredClone(prescription);
    if (incomplete.kind === 'prescription') incomplete.items[0].dose = '';
    const id = save(db, incomplete);
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.issue', id, expectedVersion: 1, reviewed: false },
        now,
      ),
    ).toThrow('Confirme');
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.issue', id, expectedVersion: 1, reviewed: true },
        now,
      ),
    ).toThrow('dose');
    expect(db.clinicalDocuments[0].status).toBe('draft');
    applyCommand(
      db,
      doctor,
      { type: 'document.save', encounterId, id, expectedVersion: 1, content: prescription },
      now,
    );
    applyCommand(
      db,
      doctor,
      { type: 'document.issue', id, expectedVersion: 2, reviewed: true },
      now,
    );
    expect(db.clinicalDocuments[0].number).toBe('DEMO-RX-0001');
    validateClinicalDocuments(db);
  });
  it('congela conteúdo e identidade, preserva original após cancelamento e exige novo documento', () => {
    const db = setup(),
      doc = issue(db),
      identity = structuredClone(doc.identity),
      content = structuredClone(doc.content);
    db.patients.find((p) => p.id === doc.patientId)!.name = 'Nome alterado no cadastro';
    expect(() =>
      applyCommand(
        db,
        doctor,
        {
          type: 'document.save',
          id: doc.id,
          encounterId,
          expectedVersion: doc.version,
          content: prescription,
        },
        now,
      ),
    ).toThrow('preservado');
    applyCommand(
      db,
      doctor,
      {
        type: 'document.cancel',
        id: doc.id,
        expectedVersion: doc.version,
        reason: 'Erro fictício de preenchimento',
      },
      now,
    );
    expect(doc.content).toEqual(content);
    expect(doc.identity).toEqual(identity);
    expect(doc.status).toBe('cancelled');
    expect(issue(db).number).toBe('DEMO-RX-0002');
    validateClinicalDocuments(db);
  });
  it('bloqueia emissão por outro médico, enfermagem ou recepção e edição em outro atendimento', () => {
    const db = setup(),
      id = save(db);
    for (const c of [other, nurse, demoContext('aurora', 'aurora-centro', 'reception')]) {
      expect(() =>
        applyCommand(
          db,
          c,
          { type: 'document.issue', id, expectedVersion: 1, reviewed: true },
          now,
        ),
      ).toThrow();
      expect(() =>
        applyCommand(
          db,
          c,
          { type: 'document.save', encounterId, expectedVersion: 0, content: prescription },
          now,
        ),
      ).toThrow();
    }
    expect(() =>
      applyCommand(
        db,
        doctor,
        {
          type: 'document.save',
          id,
          encounterId: 'aurora-centro-e2',
          expectedVersion: 1,
          content: prescription,
        },
        now,
      ),
    ).toThrow();
  });
  it('rejeita versão antiga e emissão repetida sem duplicar numeração ou encaminhamento', () => {
    const db = setup(),
      id = save(db, referral);
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.save', id, encounterId, expectedVersion: 0, content: referral },
        now,
      ),
    ).toThrow('mudou');
    applyCommand(
      db,
      doctor,
      { type: 'document.issue', id, expectedVersion: 1, reviewed: true },
      now,
    );
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.issue', id, expectedVersion: 2, reviewed: true },
        now,
      ),
    ).toThrow('já');
    expect(db.referrals.filter((r) => r.sourceDocumentId === id)).toHaveLength(1);
  });
  it('compartilha emitidos e retornos na prefeitura, restringe rascunhos, escrita e outras prefeituras', () => {
    const db = setup(),
      draft = save(db),
      doc = issue(db, referral),
      r = db.referrals.find((r) => r.id === doc.referralId)!;
    applyCommand(
      db,
      regulator,
      {
        type: 'referral.schedule',
        id: r.id,
        date: '2026-10-29',
        time: '15:00',
        destination: r.destination,
      },
      now,
    );
    applyCommand(
      db,
      regulator,
      { type: 'referral.complete', id: r.id, date: '2026-10-29', summary: 'Retorno fictício' },
      now,
    );
    const neighbor = demoContext('aurora', 'aurora-vila', 'clinical');
    expect(readSnapshot(db, neighbor).clinicalDocuments.map((d) => d.id)).toEqual([doc.id]);
    expect(readSnapshot(db, neighbor).referrals.find((x) => x.id === r.id)?.response?.summary).toBe(
      'Retorno fictício',
    );
    expect(() =>
      applyCommand(
        db,
        neighbor,
        { type: 'document.cancel', id: doc.id, expectedVersion: doc.version, reason: 'Teste' },
        now,
      ),
    ).toThrow('unidade');
    expect(readSnapshot(db, nurse).clinicalDocuments.some((d) => d.id === draft)).toBe(false);
    for (const c of [admin, regulator, demoContext('horizonte', 'horizonte-centro', 'clinical')])
      expect(readSnapshot(db, c).clinicalDocuments).toHaveLength(0);
    const operational = readSnapshot(db, admin).referrals.find((x) => x.id === r.id)!;
    expect(operational.reason).toBe('');
    expect(operational.response).toBeUndefined();
    validateClinicalDocuments(db);
  });
  it('cria regulação somente ao emitir e sincroniza cancelamento nos dois sentidos', () => {
    const db = setup(),
      count = db.referrals.length,
      id = save(db, referral);
    expect(db.referrals).toHaveLength(count);
    applyCommand(
      db,
      doctor,
      { type: 'document.issue', id, expectedVersion: 1, reviewed: true },
      now,
    );
    const doc = db.clinicalDocuments[0],
      r = db.referrals.find((r) => r.id === doc.referralId)!;
    expect(r.priority).toBe('urgent');
    expect(r.reason).toBe(referral.kind === 'referral' ? referral.reason : '');
    applyCommand(
      db,
      regulator,
      { type: 'referral.cancel', id: r.id, reason: 'Solicitação duplicada de teste' },
      now,
    );
    expect(doc.status).toBe('cancelled');
    expect(doc.history.at(-1)?.actorId).toBe(regulator.sessionId);
    const next = issue(db, referral);
    applyCommand(
      db,
      doctor,
      {
        type: 'document.cancel',
        id: next.id,
        expectedVersion: next.version,
        reason: 'Substituição de teste',
      },
      now,
    );
    expect(db.referrals.find((r) => r.id === next.referralId)?.status).toBe('cancelled');
    validateClinicalDocuments(db);
  });
  it('contrarreferência exige agendamento e perfil, preserva retorno concluído', () => {
    const db = setup(),
      doc = issue(db, referral),
      r = db.referrals.find((r) => r.id === doc.referralId)!;
    const complete = {
      type: 'referral.complete' as const,
      id: r.id,
      date: '2026-10-29',
      summary: 'Resposta fictícia',
    };
    expect(() => applyCommand(db, regulator, complete, now)).toThrow('Agende');
    applyCommand(
      db,
      regulator,
      {
        type: 'referral.schedule',
        id: r.id,
        date: '2026-10-29',
        time: '15:00',
        destination: r.destination,
      },
      now,
    );
    expect(() => applyCommand(db, admin, complete, now)).toThrow('contrarreferência');
    expect(() => applyCommand(db, regulator, { ...complete, date: '2026-10-30' }, now)).toThrow(
      'data',
    );
    applyCommand(db, regulator, complete, now);
    expect(() => applyCommand(db, regulator, complete, now)).toThrow();
    expect(() =>
      applyCommand(db, regulator, { type: 'referral.cancel', id: r.id, reason: 'Teste' }, now),
    ).toThrow();
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.cancel', id: doc.id, expectedVersion: doc.version, reason: 'Teste' },
        now,
      ),
    ).toThrow('contrarreferência');
    validateClinicalDocuments(db);
  });
  it('acompanha exames separadamente, aceita resultado pela enfermagem e revisão só pelo médico', () => {
    const db = setup(),
      doc = issue(db, exams);
    event(db, doc.id, 'scheduled', nurse);
    event(db, doc.id, 'performed', nurse);
    event(db, doc.id, 'result', nurse);
    expect(examState(doc, 'exam-1')).toBe('result');
    expect(examState(doc, 'exam-2')).toBe('requested');
    expect(() => event(db, doc.id, 'reviewed', nurse)).toThrow('médico');
    event(db, doc.id, 'result', nurse);
    event(db, doc.id, 'reviewed');
    expect(doc.examEvents).toHaveLength(5);
    expect(() => event(db, doc.id, 'result')).toThrow('revisado');
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.cancel', id: doc.id, expectedVersion: doc.version, reason: 'Teste' },
        now,
      ),
    ).toThrow('resultado');
    validateClinicalDocuments(db);
  });
  it('não inventa resultados nem aceita revisão sem resultado, datas impossíveis e itens alheios', () => {
    const db = setup(),
      doc = issue(db, exams);
    expect(() => event(db, doc.id, 'reviewed')).toThrow('resultado');
    expect(() => event(db, doc.id, 'result', doctor, 'other')).toThrow('Exame');
    const cmd = {
      type: 'exam.event' as const,
      id: doc.id,
      expectedVersion: doc.version,
      itemId: 'exam-1',
      kind: 'result' as const,
      date: '2026-10-30',
      time: '',
      location: '',
      note: 'Teste',
    };
    expect(() => applyCommand(db, doctor, cmd, now)).toThrow('futuro');
    expect(() => applyCommand(db, doctor, { ...cmd, date: '2026-10-28' }, now)).toThrow('anterior');
    expect(() => applyCommand(db, doctor, { ...cmd, date: '2026-10-29', note: '' }, now)).toThrow(
      'Preencha',
    );
    expect(doc.examEvents).toHaveLength(0);
  });
  it('exige resolver rascunhos antes de concluir e permite acompanhar resultados depois da consulta', () => {
    const db = setup(),
      id = save(db),
      doc = issue(db, exams);
    applyCommand(
      db,
      doctor,
      {
        type: 'note.save',
        coding: { codes: [{ system: 'CIAP-2', code: 'R05', label: 'Tosse' }], reason: '' },
        encounterId,
        soap: {
          subjective: 'Teste',
          objective: '',
          assessment: 'Avaliação fictícia',
          plan: 'Plano fictício',
        },
      },
      now,
    );
    expect(() => applyCommand(db, doctor, { type: 'note.finalize', encounterId }, now)).toThrow(
      'rascunho',
    );
    applyCommand(
      db,
      doctor,
      { type: 'document.discard', id, expectedVersion: 1, reason: 'Teste de descarte' },
      now,
    );
    applyCommand(db, doctor, { type: 'note.finalize', encounterId }, now);
    event(db, doc.id, 'result');
    event(db, doc.id, 'reviewed');
    expect(() => save(db)).toThrow('andamento');
    validateClinicalDocuments(db);
  });
  it('valida prioridade, quantidade, duplicação e limites de itens sem sugerir condutas', () => {
    const db = setup(),
      urgent = { ...exams, priority: 'urgent', priorityReason: '' } as DocumentContent,
      id = save(db, urgent);
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.issue', id, expectedVersion: 1, reviewed: true },
        now,
      ),
    ).toThrow('prioridade');
    if (exams.kind === 'exams')
      expect(() =>
        save(db, { ...exams, items: [exams.items[0], { ...exams.items[0], id: 'unique' }] }),
      ).toThrow('repetidos');
    if (prescription.kind === 'prescription')
      for (const quantity of ['0', '1.5', '-1', '100000'])
        expect(() =>
          save(db, { ...prescription, items: [{ ...prescription.items[0], quantity }] }),
        ).toThrow('quantidade');
    if (exams.kind === 'exams') expect(() => save(db, { ...exams, items: [] })).toThrow('20');
  });
  it('persiste emissão atômica, recarrega resultados, migra schema 7 e detecta alterações concorrentes', async () => {
    const store = new MemoryStorage(),
      db = setup();
    (db as unknown as { schemaVersion: number }).schemaVersion = 7;
    delete (db as unknown as { clinicalDocuments?: unknown }).clinicalDocuments;
    store.setItem(storageKey, JSON.stringify(db));
    const repo = new DemoRepository(store, () => now);
    expect(repo.recoveryMessage).toBe('');
    const id = await repo.execute(doctor, {
      type: 'document.save',
      encounterId,
      expectedVersion: 0,
      content: exams,
    });
    const stale = new DemoRepository(store, () => now);
    await repo.execute(doctor, { type: 'document.issue', id, expectedVersion: 1, reviewed: true });
    await expect(
      stale.execute(doctor, { type: 'document.issue', id, expectedVersion: 1, reviewed: true }),
    ).rejects.toThrow('mudaram');
    const loaded = new DemoRepository(store, () => now);
    expect(loaded.recoveryMessage).toBe('');
    expect(loaded.snapshot(doctor).clinicalDocuments[0].number).toBe('DEMO-EX-0001');
    await loaded.execute(nurse, {
      type: 'exam.event',
      id,
      expectedVersion: 2,
      itemId: 'exam-1',
      kind: 'result',
      date: '2026-10-29',
      time: '',
      location: '',
      note: 'Resultado fictício',
    });
    expect(
      new DemoRepository(store, () => now).snapshot(doctor).clinicalDocuments[0].examEvents,
    ).toHaveLength(1);
    const before = store.getItem(storageKey);
    await expect(
      loaded.execute(doctor, { type: 'document.cancel', id, expectedVersion: 3, reason: 'Teste' }),
    ).rejects.toThrow('resultado');
    expect(store.getItem(storageKey)).toBe(before);
    expect(JSON.parse(before!).schemaVersion).toBe(13);
  });
  it('bloqueia base importada com vínculo, autor, estado ou resposta adulterados', () => {
    const db = setup(),
      doc = issue(db, exams);
    event(db, doc.id, 'result');
    const changes = [
      (x: Database) => {
        x.clinicalDocuments[0].unitId = 'aurora-vila';
      },
      (x: Database) => {
        x.clinicalDocuments[0].status = 'draft';
      },
      (x: Database) => {
        x.clinicalDocuments[0].examEvents[0].kind = 'reviewed';
      },
      (x: Database) => {
        x.clinicalDocuments[0].number = 'DEMO-RX-0001';
      },
      (x: Database) => {
        x.referrals[0].status = 'completed';
      },
    ];
    for (const mutate of changes) {
      const altered = structuredClone(db);
      mutate(altered);
      const store = new MemoryStorage();
      store.setItem(storageKey, JSON.stringify(altered));
      expect(new DemoRepository(store, () => now).recoveryMessage).not.toBe('');
    }
  });
});
