import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { applyCommand, readSnapshot } from './operations';
import { demoContext } from './access';
import { workModules, workMetrics, type WorkModule } from './work-modules';
import type { Database, Context } from './model';
const now = new Date('2026-10-29T15:00:00Z');
const ctx = (m: WorkModule) =>
  m.permission === 'business'
    ? demoContext('cuidelo', 'office', 'business')
    : demoContext(
        'aurora',
        'aurora-centro',
        m.permission === 'clinical' ? 'clinical' : m.permission === 'territory' ? 'acs' : 'admin',
      );
function valuesFor(db: Database, m: WorkModule, c: Context): Record<string, string> {
  return Object.fromEntries(
    m.fields.map((f) => [
      f.key,
      f.type === 'date'
        ? '2026-10-29'
        : f.type === 'number'
          ? String(Math.max(1, f.min ?? 0))
          : f.type === 'select'
            ? f.options![0]
            : f.type === 'patient'
              ? 'aurora-p12'
              : f.type === 'reference'
                ? db.workRecords.find(
                    (r) => r.module === f.reference && r.organizationId === c.organizationId,
                  )!.id
                : f.key === 'competence'
                  ? '2026-10'
                  : 'Registro fictício de teste',
    ]),
  );
}
describe('módulos de acompanhamento e separação da empresa', () => {
  it('cada módulo aceita cadastro válido, preserva histórico e sobrevive à leitura persistida', async () => {
    const db = createSeed(now);
    for (const m of workModules) {
      const c = ctx(m),
        id = applyCommand(
          db,
          c,
          { type: 'work.create', module: m.id, values: valuesFor(db, m, c) },
          now,
        );
      expect(readSnapshot(db, c).workRecords.some((r) => r.id === id)).toBe(true);
    }
    const storage = {
      getItem: (k: string) => (k === storageKey ? JSON.stringify(db) : null),
      setItem: () => {},
    };
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    expect(repo.snapshot(demoContext('cuidelo', 'office', 'business')).workRecords).toHaveLength(6);
  });
  it('prefeitura e empresa não acessam os registros uma da outra nem conteúdo clínico', () => {
    const db = createSeed(now),
      m = workModules.find((m) => m.id === 'bo-municipios')!,
      business = ctx(m),
      manager = demoContext('aurora', 'all', 'manager');
    const id = applyCommand(
      db,
      business,
      { type: 'work.create', module: m.id, values: valuesFor(db, m, business) },
      now,
    );
    expect(readSnapshot(db, manager).workRecords).toEqual([]);
    expect(readSnapshot(db, business).patients).toEqual([]);
    expect(readSnapshot(db, business).notes).toEqual([]);
    expect(readSnapshot(db, business).units).toEqual([]);
    expect(() =>
      applyCommand(
        db,
        manager,
        { type: 'work.transition', id, status: 'active', reason: 'Teste' },
        now,
      ),
    ).toThrow('contexto');
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', 'aurora-centro', 'admin'),
        { type: 'work.create', module: m.id, values: valuesFor(db, m, business) },
        now,
      ),
    ).toThrow('perfil');
  });
  it('administração local não cria registros para toda a rede e ACS só modifica sua unidade', () => {
    const db = createSeed(now),
      m = workModules.find((m) => m.id === 'familias')!,
      c = ctx(m),
      v = valuesFor(db, m, c);
    const id = applyCommand(db, c, { type: 'work.create', module: m.id, values: v }, now);
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', 'aurora-vila', 'acs'),
        { type: 'work.update', id, values: v, reason: 'Teste' },
        now,
      ),
    ).toThrow('contexto');
    expect(() =>
      applyCommand(
        db,
        { ...demoContext('aurora', 'aurora-centro', 'admin'), unitId: 'all' },
        { type: 'work.create', module: 'campanhas', values: {} },
        now,
      ),
    ).toThrow();
    expect(readSnapshot(db, demoContext('aurora', 'aurora-vila', 'acs')).workRecords).toHaveLength(
      0,
    );
  });
  it('rejeita transições inválidas e preserva conteúdo anterior/encerrado', () => {
    const db = createSeed(now),
      m = workModules.find((m) => m.id === 'alertas')!,
      c = ctx(m),
      v = valuesFor(db, m, c),
      id = applyCommand(db, c, { type: 'work.create', module: m.id, values: v }, now);
    expect(() =>
      applyCommand(db, c, { type: 'work.transition', id, status: 'done', reason: 'Teste' }, now),
    ).toThrow('não é permitida');
    applyCommand(
      db,
      c,
      { type: 'work.update', id, values: { ...v, name: 'Novo título' }, reason: 'Conferência' },
      now,
    );
    expect(db.workRecords[0].history[1].previousValues?.name).toBe(v.name);
    applyCommand(db, c, { type: 'work.transition', id, status: 'active', reason: 'Iniciado' }, now);
    applyCommand(db, c, { type: 'work.transition', id, status: 'done', reason: 'Resolvido' }, now);
    expect(() =>
      applyCommand(db, c, { type: 'work.update', id, values: v, reason: 'Tentativa' }, now),
    ).toThrow('preservado');
  });
  it('pré-natal tem unicidade na prefeitura e gestão só recebe agregados', () => {
    const db = createSeed(now),
      m = workModules.find((m) => m.id === 'prenatal')!,
      c = ctx(m),
      v = valuesFor(db, m, c);
    applyCommand(db, c, { type: 'work.create', module: m.id, values: v }, now);
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', 'aurora-vila', 'clinical'),
        { type: 'work.create', module: m.id, values: v },
        now,
      ),
    ).toThrow('Já existe');
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'clinical')).workRecords,
    ).toHaveLength(1);
    const manager = demoContext('aurora', 'all', 'manager');
    expect(readSnapshot(db, manager).workRecords).toEqual([]);
    expect(workMetrics(db, manager).find((r) => r.unit === 'UBS Centro')?.prenatal).toBe(1);
  });
  it('referências cruzadas e valores inválidos são bloqueados', () => {
    const db = createSeed(now),
      m = workModules.find((m) => m.id === 'indicadores')!,
      c = ctx(m),
      v = valuesFor(db, m, c);
    expect(() =>
      applyCommand(
        db,
        c,
        { type: 'work.create', module: m.id, values: { ...v, denominator: '0' } },
        now,
      ),
    ).toThrow('Denominador');
    expect(() =>
      applyCommand(
        db,
        c,
        { type: 'work.create', module: m.id, values: { ...v, numerator: '2', denominator: '1' } },
        now,
      ),
    ).toThrow('numerador');
    const f = workModules.find((m) => m.id === 'familias')!,
      fc = ctx(f),
      id = applyCommand(
        db,
        fc,
        { type: 'work.create', module: f.id, values: valuesFor(db, f, fc) },
        now,
      );
    const visits = workModules.find((m) => m.id === 'visitas')!;
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', 'aurora-vila', 'acs'),
        {
          type: 'work.create',
          module: 'visitas',
          values: { ...valuesFor(db, visits, fc), family: id },
        },
        now,
      ),
    ).toThrow('desta unidade');
  });
});
