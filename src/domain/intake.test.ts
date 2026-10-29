import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { applyCommand, readSnapshot } from './operations';
import { activeIntakes, validateIntakeContent } from './intake';
import { readDisplay } from './queue';
import type { Context, IntakeContent, Command, Database } from './model';

const now = new Date('2026-10-29T15:00:00Z');
const context: Context = { organizationId: 'aurora', unitId: 'aurora-centro', role: 'nursing' };
const content: IntakeContent = {
  complaint: 'Relato fictício de acolhimento.',
  observations: 'Informação para teste.',
  vitals: { systolic: 120, diastolic: 80, temperature: 36.5, weight: 68.125 },
};
const record: Command = { type: 'intake.record', encounterId: 'aurora-centro-e0', content };
class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}
function completeNote(db: Database) {
  applyCommand(
    db,
    context,
    {
      type: 'note.save',
      encounterId: 'aurora-centro-e2',
      soap: {
        subjective: 'Teste',
        objective: '',
        assessment: 'Demonstração',
        plan: 'Plano fictício',
      },
    },
    now,
  );
  applyCommand(db, context, { type: 'note.finalize', encounterId: 'aurora-centro-e2' }, now);
  return db.notes.find((n) => n.encounterId === 'aurora-centro-e2')!;
}
describe('escuta, aferições e complementos', () => {
  it('registra escuta sem iniciar a consulta e mantém aferições distintas', () => {
    const db = createSeed(now);
    applyCommand(db, context, record, now);
    applyCommand(
      db,
      context,
      { ...record, content: { complaint: '', observations: '', vitals: { temperature: 36.8 } } },
      now,
    );
    expect(db.encounters.find((e) => e.id === record.encounterId)?.status).toBe('waiting');
    const entries = db.intakes.filter((r) => r.encounterId === record.encounterId);
    expect(entries.map((r) => r.kind)).toEqual(['initial', 'reassessment']);
    expect(entries[1].vitals.weight).toBeUndefined();
    expect(entries[0].vitals.weight).toBe(68.125);
    expect(entries[0].author).toContain('Enfermagem');
    expect(db.audit.at(-1)?.action).toBe('Nova aferição registrada');
  });
  it('exige relato inicial e rejeita medidas inválidas ou pressão incompleta', () => {
    expect(
      validateIntakeContent({
        ...content,
        vitals: { pulse: 0, respiratoryRate: 0, oxygenSaturation: 0 },
      }).vitals,
    ).toEqual({ pulse: 0, respiratoryRate: 0, oxygenSaturation: 0 });
    for (const bad of [
      { temperature: NaN },
      { weight: -2 },
      { weight: 1.1234 },
      { oxygenSaturation: 101 },
      { pulse: 60.1 },
      { systolic: 120 },
    ])
      expect(() => validateIntakeContent({ ...content, vitals: bad })).toThrow();
    expect(() => validateIntakeContent({ complaint: ' ', observations: '', vitals: {} })).toThrow(
      'Registre',
    );
    expect(() =>
      applyCommand(
        createSeed(now),
        context,
        { ...record, content: { ...content, complaint: '' } },
        now,
      ),
    ).toThrow('motivo da procura');
    expect(
      validateIntakeContent({ ...content, vitals: { weight: 0.7, height: 38.5 } }).vitals,
    ).toEqual({ weight: 0.7, height: 38.5 });
  });
  it('protege leitura e escrita clínica, mantendo apenas histórico da mesma rede', () => {
    const db = createSeed(now);
    applyCommand(db, context, record, now);
    const note = completeNote(db);
    applyCommand(
      db,
      context,
      { type: 'note.addendum', noteId: note.id, text: 'Complemento privado', reason: 'Teste' },
      now,
    );
    for (const role of ['reception', 'manager', 'regulation', 'pharmacy'] as const) {
      const limited = { ...context, role };
      expect(readSnapshot(db, limited).intakes).toEqual([]);
      expect(readSnapshot(db, limited).addenda).toEqual([]);
      expect(() => applyCommand(db, limited, record, now)).toThrow('não tem acesso');
      expect(() =>
        applyCommand(
          db,
          limited,
          { type: 'note.addendum', noteId: note.id, text: 'x', reason: 'y' },
          now,
        ),
      ).toThrow('não tem acesso');
    }
    expect(readSnapshot(db, { ...context, unitId: 'aurora-vila' }).intakes).toHaveLength(1);
    expect(
      readSnapshot(db, { ...context, organizationId: 'horizonte', unitId: 'horizonte-centro' })
        .intakes,
    ).toEqual([]);
    expect(() => applyCommand(db, { ...context, unitId: 'aurora-vila' }, record, now)).toThrow(
      'não encontrado',
    );
    expect(() => applyCommand(db, { ...context, unitId: 'all' }, record, now)).toThrow();
    expect(JSON.stringify(readDisplay(db, 'aurora', context.unitId, now))).not.toContain(
      content.complaint,
    );
  });
  it('preserva o original, vincula correções e impede bifurcação ou correção de outro atendimento', () => {
    const db = createSeed(now);
    const id = applyCommand(db, context, record, now),
      original = structuredClone(db.intakes[0]);
    const correction: Command = {
      ...record,
      correctionOf: id,
      correctionReason: 'Erro de digitação',
      content: { ...content, vitals: { temperature: 36.6 } },
    };
    expect(() => applyCommand(db, context, { ...correction, correctionReason: '' }, now)).toThrow(
      'Motivo',
    );
    expect(() =>
      applyCommand(db, context, { ...correction, encounterId: 'aurora-centro-e1' }, now),
    ).toThrow('mesmo atendimento');
    const nextId = applyCommand(db, context, correction, now);
    expect(db.intakes[0]).toEqual(original);
    expect(activeIntakes(db.intakes).map((r) => r.id)).toEqual([nextId]);
    expect(() => applyCommand(db, context, correction, now)).toThrow('já possui');
    applyCommand(db, context, { ...correction, correctionOf: nextId }, now);
    expect(activeIntakes(db.intakes)).toHaveLength(1);
  });
  it('bloqueia nova aferição após conclusão mas permite uma correção rastreável', () => {
    const db = createSeed(now);
    const id = applyCommand(db, context, record, now);
    db.encounters.find((e) => e.id === record.encounterId)!.status = 'completed';
    expect(() => applyCommand(db, context, record, now)).toThrow('concluído');
    applyCommand(
      db,
      context,
      { ...record, correctionOf: id, correctionReason: 'Correção documentada' },
      now,
    );
    expect(db.intakes.at(-1)?.correctionOf).toBe(id);
  });
  it('complementa nota final sem alterá-la e exige unidade, motivo e conteúdo', () => {
    const db = createSeed(now),
      note = completeNote(db),
      original = structuredClone(note);
    const cmd: Command = {
      type: 'note.addendum',
      noteId: note.id,
      text: 'Informação complementar',
      reason: 'Informação recebida depois',
    };
    expect(() => applyCommand(db, { ...context, unitId: 'aurora-vila' }, cmd, now)).toThrow(
      'não encontrado',
    );
    expect(() => applyCommand(db, context, { ...cmd, reason: ' ' }, now)).toThrow('Motivo');
    applyCommand(db, context, cmd, now);
    expect(note).toEqual(original);
    expect(db.addenda[0]).toMatchObject({
      noteId: note.id,
      patientId: note.patientId,
      text: cmd.text,
    });
    note.status = 'draft';
    expect(() => applyCommand(db, context, cmd, now)).toThrow('Conclua');
  });
  it('migra versão 2 sem perder conteúdo e restaura os novos registros', async () => {
    const storage = new MemoryStorage(),
      old = JSON.parse(JSON.stringify(createSeed(now)));
    const note = completeNote(old);
    old.schemaVersion = 2;
    delete old.intakes;
    delete old.addenda;
    storage.setItem(storageKey, JSON.stringify(old));
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    await repo.execute(context, record);
    await repo.execute(context, {
      type: 'note.addendum',
      noteId: note.id,
      text: 'Complemento após migração',
      reason: 'Teste de preservação',
    });
    const saved = JSON.parse(storage.getItem(storageKey)!);
    for (const key of ['patients', 'appointments', 'notes', 'encounters', 'calls'])
      expect(saved[key]).toEqual(old[key]);
    expect(saved.schemaVersion).toBe(3);
    const restored = new DemoRepository(storage, () => now);
    expect(restored.recoveryMessage).toBe('');
    expect(restored.snapshot(context).intakes).toHaveLength(1);
    expect(restored.snapshot(context).addenda).toHaveLength(1);
  });
  it('rejeita correção concorrente e não publica quando o armazenamento falha', async () => {
    const storage = new MemoryStorage(),
      a = new DemoRepository(storage, () => now);
    const id = await a.execute(context, record),
      b = new DemoRepository(storage, () => now);
    const cmd: Command = { ...record, correctionOf: id, correctionReason: 'Teste' };
    await a.execute(context, cmd);
    await expect(b.execute(context, cmd)).rejects.toThrow('dados');
    await expect(b.execute(context, cmd)).rejects.toThrow('já possui');
    storage.setItem = () => {
      throw new Error('Quota');
    };
    const before = a.snapshot(context).intakes;
    await expect(a.execute(context, record)).rejects.toThrow('Não foi possível salvar');
    expect(a.snapshot(context).intakes).toEqual(before);
  });
  it('bloqueia uma base adulterada com referência clínica ou cadeia inválida', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now);
    const id = await repo.execute(context, record);
    await repo.execute(context, { ...record, correctionOf: id, correctionReason: 'Teste' });
    const valid = JSON.parse(storage.getItem(storageKey)!);
    for (const mutate of [
      (db: Database) => {
        db.intakes[1].correctionOf = db.intakes[1].id;
      },
      (db: Database) => {
        db.intakes[0].patientId = 'aurora-p8';
      },
      (db: Database) => {
        db.intakes[0].vitals.oxygenSaturation = 101;
      },
    ]) {
      const bad = structuredClone(valid);
      mutate(bad);
      storage.setItem(storageKey, JSON.stringify(bad));
      expect(new DemoRepository(storage, () => now).recoveryMessage).not.toBe('');
    }
  });
});
