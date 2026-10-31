import { expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext, demoIdentities } from './access';
import { applyCommand, readSnapshot, readSummary } from './operations';
import { issueKiosk } from './patient-flow';
import { readDisplay } from './queue';

const now = new Date('2026-10-31T14:00:00Z');
const central = demoContext('aurora', 'aurora-central', 'pharmacy');
const receive = demoContext('aurora', 'aurora-centro', 'pharmacy');
const manager = demoContext('aurora', 'all', 'manager');
it('a central tem estoque próprio; não emite senhas e não oferece sessão de consultório', () => {
  const db = createSeed(now);
  expect(
    demoIdentities(db)
      .filter((i) => i.unitId === central.unitId)
      .map((i) => i.role),
  ).toEqual(['pharmacy']);
  expect(readSnapshot(db, central).lots.map((l) => [l.lot, l.quantity])).toEqual([
    ['CD-DEMO-01', 24],
  ]);
  expect(() => readSnapshot(db, demoContext('aurora', central.unitId, 'clinical'))).toThrow();
  expect(() => readDisplay(db, 'aurora', central.unitId, now)).toThrow();
  expect(() =>
    issueKiosk(
      db,
      {
        organizationId: 'aurora',
        unitId: central.unitId,
        service: 'Consulta',
        priority: 'routine',
        requestId: 'central-nao-atende',
      },
      now,
    ),
  ).toThrow();
});

it('a prefeitura acompanha as duas pontas somente por contagens e no contexto escolhido', () => {
  const db = createSeed(now);
  const shipmentId = applyCommand(
    db,
    central,
    {
      type: 'stock.ship',
      lotId: 'aurora-central-cd01',
      toUnitId: receive.unitId,
      quantity: 3,
      expectedStock: 24,
      reference: 'Informação restrita da expedição',
      reason: 'Transferência fictícia',
      requestId: 'teste-rota-123',
    },
    now,
  );
  const route = { fromUnitId: central.unitId, toUnitId: receive.unitId, inTransit: 1, received: 0 };
  for (const unitId of ['all', central.unitId, receive.unitId])
    expect(readSummary(db, { ...manager, unitId }, now).stockRoutes).toEqual([route]);
  expect(readSummary(db, { ...manager, unitId: 'aurora-upa' }, now).stockRoutes).toEqual([]);
  expect(readSummary(db, demoContext('horizonte', 'all', 'manager'), now).stockRoutes).toEqual([]);
  expect(readSummary(db, receive, now).stockRoutes).toEqual([]);
  applyCommand(
    db,
    receive,
    {
      type: 'stock.receive',
      shipmentId,
      requestId: 'teste-recebimento-123',
      reference: 'Recebimento conferido',
    },
    now,
  );
  expect(readSummary(db, manager, now).stockRoutes).toEqual([
    { ...route, inTransit: 0, received: 1 },
  ]);
});

it('a migração introduz o exemplo da central uma única vez sem mudar o estoque do posto', async () => {
  const db = createSeed(now);
  const { stockLogistics: _old, ...old } = db;
  const previous = {
    ...old,
    schemaVersion: 15,
    units: db.units.filter((u) => u.kind !== 'central'),
    lots: db.lots.filter((l) => l.unitId !== central.unitId),
  };
  previous.lots[0].quantity = 63;
  const data = new Map([[storageKey, JSON.stringify(previous)]]);
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const repo = new DemoRepository(storage, () => now);
  expect(repo.recoveryMessage).toBe('');
  expect(repo.snapshot(receive).lots[0].quantity).toBe(63);
  await repo.execute(central, {
    type: 'stock.ship',
    lotId: 'aurora-central-cd01',
    expectedStock: 24,
    toUnitId: receive.unitId,
    quantity: 4,
    reason: 'Entrega fictícia',
    reference: 'Teste de migração',
    requestId: 'migracao-central-01',
  });
  const reopened = new DemoRepository(storage, () => now);
  expect(reopened.snapshot(central).lots).toHaveLength(1);
  expect(reopened.snapshot(central).lots[0].quantity).toBe(20);
  expect(reopened.snapshot(receive).lots[0].quantity).toBe(63);
  expect(reopened.directory().units.filter((u) => u.kind === 'central')).toHaveLength(1);
});
