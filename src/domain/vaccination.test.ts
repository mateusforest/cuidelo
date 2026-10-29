import { describe, it, expect } from 'vitest';
import { applyCommand, readSnapshot, readSummary } from './operations';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { readDisplay } from './queue';
import { validateVaccinationDatabase } from './vaccination-validation';
import type { Context, VaccinationCommand } from './model';

const now = new Date('2026-10-29T15:00:00Z'),
  today = '2026-10-29';
const context: Context = { organizationId: 'aurora', unitId: 'aurora-centro', role: 'nursing' };
const application: Extract<VaccinationCommand, { type: 'vaccine.record' }> = {
  type: 'vaccine.record',
  patientId: 'aurora-p1',
  source: 'administered',
  lotId: 'aurora-centro-vac0',
  immunobiological: '',
  batch: '',
  manufacturer: '',
  dose: 'Dose de teste',
  date: today,
  route: 'Via informada',
  site: 'Local informado',
  strategy: 'Rotina',
  group: 'Grupo fictício',
  professional: 'Profissional fictício',
  institution: '',
  observations: 'Observação fictícia',
};
const recall: VaccinationCommand = {
  type: 'vaccine.recall.create',
  patientId: 'aurora-p1',
  immunobiological: 'Imunizante demonstração A',
  dose: 'Dose de teste',
  date: today,
  reason: 'Orientação de teste',
};
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}

describe('vacinação e estoque', () => {
  it('registra aplicação e baixa exatamente uma dose do lote da unidade', () => {
    const db = createSeed(now),
      lot = db.vaccineLots.find((l) => l.id === application.lotId)!;
    const before = lot.quantity,
      id = applyCommand(db, context, application, now);
    expect(lot.quantity).toBe(before - 1);
    expect(db.immunizations[0]).toMatchObject({
      id,
      batch: lot.batch,
      manufacturer: lot.manufacturer,
      immunobiological: lot.immunobiological,
    });
    expect(db.vaccineMovements.filter((m) => m.applicationId === id)).toHaveLength(1);
    expect(() => validateVaccinationDatabase(db)).not.toThrow();
    expect(readSummary(db, context, now).vaccination.applied).toBe(1);
  });
  it('bloqueia lote vencido, em quarentena, sem saldo e baixa de outro dia', () => {
    for (const change of [
      { lotId: 'aurora-centro-vac2' },
      { date: '2026-10-28' },
      { date: '2026-10-30' },
      { date: '1900-01-01' },
      { date: '2026-02-30' },
      { professional: '' },
      { route: '' },
    ])
      expect(() =>
        applyCommand(createSeed(now), context, { ...application, ...change }, now),
      ).toThrow();
    const db = createSeed(now),
      lot = db.vaccineLots.find((l) => l.id === application.lotId)!;
    lot.status = 'quarantine';
    expect(() => applyCommand(db, context, application, now)).toThrow('quarentena');
    lot.status = 'available';
    lot.quantity = 0;
    expect(() => applyCommand(db, context, application, now)).toThrow('sem saldo');
  });
  it('transcreve comprovante anterior sem baixa ou inclusão na produção local', () => {
    const db = createSeed(now),
      previous = structuredClone(db.vaccineLots);
    const id = applyCommand(
      db,
      context,
      {
        ...application,
        source: 'transcribed',
        date: '2026-10-01',
        lotId: undefined,
        immunobiological: 'Imunizante do comprovante',
        institution: 'Comprovante fictício',
        professional: '',
        route: '',
        site: '',
        strategy: '',
        group: '',
      },
      now,
    );
    expect(db.vaccineLots).toEqual(previous);
    expect(db.vaccineMovements.some((m) => m.applicationId === id)).toBe(false);
    expect(readSummary(db, context, now).vaccination).toMatchObject({ applied: 0, transcribed: 1 });
    expect(() => validateVaccinationDatabase(db)).not.toThrow();
  });
  it('impede duplicidade em outra unidade da mesma rede sem consumir estoque', () => {
    const db = createSeed(now);
    applyCommand(db, context, application, now);
    const previous = structuredClone(db.vaccineLots);
    expect(() =>
      applyCommand(
        db,
        { ...context, unitId: 'aurora-vila' },
        { ...application, lotId: 'aurora-vila-vac0', dose: ' dose de TESTE ' },
        now,
      ),
    ).toThrow('Já existe registro');
    expect(db.vaccineLots).toEqual(previous);
    expect(db.immunizations).toHaveLength(1);
  });
  it('isola escrita por unidade e rede e protege conteúdo clínico de outros perfis', () => {
    const db = createSeed(now);
    applyCommand(db, context, application, now);
    for (const role of ['reception', 'manager', 'regulation', 'pharmacy'] as const) {
      const c = { ...context, role };
      expect(readSnapshot(db, c).immunizations).toEqual([]);
      expect(readSnapshot(db, c).vaccineRecalls).toEqual([]);
      expect(readSnapshot(db, c).vaccineVoids).toEqual([]);
      expect(() => applyCommand(db, c, application, now)).toThrow('não tem acesso');
    }
    expect(readSnapshot(db, { ...context, role: 'pharmacy' }).vaccineLots.length).toBeGreaterThan(
      0,
    );
    expect(() =>
      applyCommand(db, context, { ...application, lotId: 'aurora-vila-vac0' }, now),
    ).toThrow('nesta unidade');
    expect(() =>
      applyCommand(db, context, { ...application, patientId: 'horizonte-p1' }, now),
    ).toThrow('nesta rede');
    const other: Context = { ...context, organizationId: 'horizonte', unitId: 'horizonte-centro' };
    expect(readSnapshot(db, other).immunizations).toEqual([]);
    expect(readSummary(db, other, now).vaccination.applied).toBe(0);
    expect(JSON.stringify(readDisplay(db, 'aurora', context.unitId, now))).not.toContain(
      'Observação fictícia',
    );
  });
  it('anula com rastreabilidade sem modificar o original ou devolver doses', () => {
    const db = createSeed(now),
      id = applyCommand(db, context, application, now),
      original = structuredClone(db.immunizations[0]);
    const lots = structuredClone(db.vaccineLots);
    expect(() =>
      applyCommand(db, context, { type: 'vaccine.void', applicationId: id, reason: '' }, now),
    ).toThrow('Motivo');
    expect(() =>
      applyCommand(
        db,
        { ...context, unitId: 'aurora-vila' },
        { type: 'vaccine.void', applicationId: id, reason: 'Teste' },
        now,
      ),
    ).toThrow('nesta unidade');
    applyCommand(
      db,
      context,
      { type: 'vaccine.void', applicationId: id, reason: 'Registro em pessoa incorreta no teste' },
      now,
    );
    expect(db.immunizations[0]).toEqual(original);
    expect(db.vaccineLots).toEqual(lots);
    expect(readSummary(db, context, now).vaccination).toMatchObject({ applied: 0, voided: 1 });
    expect(() =>
      applyCommand(db, context, { type: 'vaccine.void', applicationId: id, reason: 'Teste' }, now),
    ).toThrow('já foi anulado');
    validateVaccinationDatabase(db);
  });
  it('cria lote sem duplicidade e registra recebimento, quarentena, liberação e perda', () => {
    const db = createSeed(now);
    const c: Context = { ...context, role: 'pharmacy' };
    const cmd: VaccinationCommand = {
      type: 'vaccine.lot.create',
      immunobiological: 'Vacina fictícia X',
      manufacturer: 'Fabricante fictício',
      batch: 'X001',
      quantity: 10,
      expiresAt: '2027-01-01',
    };
    const id = applyCommand(db, c, cmd, now);
    expect(() => applyCommand(db, c, { ...cmd, batch: ' x001 ' }, now)).toThrow(
      'já está cadastrado',
    );
    for (const q of [-1, 0, 1.5, NaN, 1000001])
      expect(() =>
        applyCommand(
          db,
          c,
          { type: 'vaccine.stock', lotId: id, kind: 'receipt', quantity: q, reason: 'Teste' },
          now,
        ),
      ).toThrow();
    applyCommand(
      db,
      c,
      {
        type: 'vaccine.stock',
        lotId: id,
        kind: 'receipt',
        quantity: 5,
        reason: 'Recebimento conferido',
      },
      now,
    );
    applyCommand(
      db,
      c,
      {
        type: 'vaccine.stock',
        lotId: id,
        kind: 'quarantine',
        quantity: 0,
        reason: 'Avaliação pendente',
      },
      now,
    );
    expect(() => applyCommand(db, context, { ...application, lotId: id }, now)).toThrow(
      'quarentena',
    );
    applyCommand(
      db,
      c,
      {
        type: 'vaccine.stock',
        lotId: id,
        kind: 'release',
        quantity: 0,
        reason: 'Liberação informada pelo responsável',
      },
      now,
    );
    applyCommand(
      db,
      c,
      { type: 'vaccine.stock', lotId: id, kind: 'loss', quantity: 4, reason: 'Perda documentada' },
      now,
    );
    expect(db.vaccineLots.find((l) => l.id === id)?.quantity).toBe(11);
    expect(() =>
      applyCommand(
        db,
        c,
        { type: 'vaccine.stock', lotId: id, kind: 'loss', quantity: 12, reason: 'Teste' },
        now,
      ),
    ).toThrow('Saldo insuficiente');
    // Lotes vencidos admitem descarte, sem permitir novas aplicações ou entradas.
    applyCommand(
      db,
      c,
      {
        type: 'vaccine.stock',
        lotId: 'aurora-centro-vac2',
        kind: 'loss',
        quantity: 8,
        reason: 'Vencimento',
      },
      now,
    );
    expect(() =>
      applyCommand(
        db,
        c,
        {
          type: 'vaccine.stock',
          lotId: 'aurora-centro-vac2',
          kind: 'receipt',
          quantity: 1,
          reason: 'Teste',
        },
        now,
      ),
    ).toThrow('vencido');
    validateVaccinationDatabase(db);
  });
  it('mantém aprazamento, reagendamentos, vínculo da aplicação e reabertura por anulação', () => {
    const db = createSeed(now),
      id = applyCommand(db, context, recall, now);
    expect(() => applyCommand(db, context, recall, now)).toThrow('Já existe um aprazamento');
    applyCommand(
      db,
      context,
      {
        type: 'vaccine.recall.update',
        id,
        action: 'reschedule',
        date: '2026-11-05',
        reason: 'Ajuste definido pela equipe',
      },
      now,
    );
    expect(() =>
      applyCommand(db, context, { ...application, patientId: 'aurora-p2', recallId: id }, now),
    ).toThrow('mesma pessoa');
    expect(() =>
      applyCommand(db, context, { ...application, dose: 'Outra dose', recallId: id }, now),
    ).toThrow('mesma pessoa');
    const applicationId = applyCommand(db, context, { ...application, recallId: id }, now);
    expect(db.vaccineRecalls[0]).toMatchObject({ status: 'completed', applicationId });
    expect(() =>
      applyCommand(
        db,
        context,
        { type: 'vaccine.recall.update', id, action: 'cancel', date: '', reason: 'Teste' },
        now,
      ),
    ).toThrow('pendentes');
    applyCommand(
      db,
      context,
      { type: 'vaccine.void', applicationId, reason: 'Erro de teste' },
      now,
    );
    expect(db.vaccineRecalls[0].status).toBe('scheduled');
    expect(db.vaccineRecalls[0].events.map((e) => e.action)).toEqual([
      'Criado',
      'Reagendado',
      'Atendido',
      'Reaberto',
    ]);
    applyCommand(
      db,
      context,
      {
        type: 'vaccine.recall.update',
        id,
        action: 'cancel',
        date: '',
        reason: 'Cancelamento informado',
      },
      now,
    );
    expect(db.vaccineRecalls[0].status).toBe('cancelled');
    validateVaccinationDatabase(db);
  });
  it('conta retornos atrasados e produção por unidade sem expor nomes de pessoas', () => {
    const db = createSeed(now);
    applyCommand(db, context, recall, now);
    applyCommand(db, context, application, now);
    const next = new Date('2026-10-30T15:00:00Z');
    const summary = readSummary(
      db,
      { ...context, role: 'manager', unitId: 'all' },
      next,
    ).vaccination;
    expect(summary).toMatchObject({ applied: 1, pending: 1, overdue: 1 });
    expect(summary.byUnit.find((u) => u.unitId === 'aurora-centro')?.applied).toBe(1);
    expect(JSON.stringify(summary)).not.toContain('aurora-p1');
    expect(JSON.stringify(summary)).not.toContain('Ana Clara');
  });
  it('migra formato 3 preservando a base anterior e persiste a vacinação', async () => {
    const storage = new MemoryStorage(),
      old = JSON.parse(JSON.stringify(createSeed(now)));
    old.schemaVersion = 3;
    for (const key of [
      'vaccineLots',
      'vaccineMovements',
      'immunizations',
      'vaccineVoids',
      'vaccineRecalls',
    ])
      delete old[key];
    storage.setItem(storageKey, JSON.stringify(old));
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    expect(repo.snapshot(context).vaccineLots).toEqual([]);
    const lotId = await repo.execute(context, {
      type: 'vaccine.lot.create',
      immunobiological: 'Imunizante teste',
      manufacturer: 'Fictício',
      batch: 'M001',
      expiresAt: '2027-01-01',
      quantity: 2,
    });
    await repo.execute(context, { ...application, lotId });
    const saved = JSON.parse(storage.getItem(storageKey)!);
    for (const key of ['patients', 'notes', 'intakes', 'addenda', 'calls', 'encounters'])
      expect(saved[key]).toEqual(old[key]);
    const restored = new DemoRepository(storage, () => now);
    expect(restored.recoveryMessage).toBe('');
    expect(restored.snapshot(context).immunizations).toHaveLength(1);
    expect(restored.snapshot(context).vaccineLots[0].quantity).toBe(1);
  });
  it('conflito e falha de gravação não duplicam aplicações nem alteram saldo', async () => {
    const storage = new MemoryStorage(),
      a = new DemoRepository(storage, () => now),
      b = new DemoRepository(storage, () => now);
    await a.execute(context, application);
    await expect(b.execute(context, application)).rejects.toThrow('dados');
    await expect(b.execute(context, application)).rejects.toThrow('Já existe registro');
    storage.setItem = () => {
      throw new Error('Quota');
    };
    const previous = a.snapshot(context);
    await expect(a.execute(context, { ...application, patientId: 'aurora-p2' })).rejects.toThrow(
      'Não foi possível salvar',
    );
    expect(a.snapshot(context)).toEqual(previous);
  });
  it('detecta saldo ou referências adulterados no carregamento', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now);
    await repo.execute(context, application);
    const original = JSON.parse(storage.getItem(storageKey)!);
    const altered = structuredClone(original);
    altered.vaccineLots[0].quantity += 1;
    storage.setItem(storageKey, JSON.stringify(altered));
    expect(new DemoRepository(storage, () => now).recoveryMessage).not.toBe('');
    original.immunizations[0].lotId = 'aurora-vila-vac0';
    storage.setItem(storageKey, JSON.stringify(original));
    expect(new DemoRepository(storage, () => now).recoveryMessage).not.toBe('');
  });
});
