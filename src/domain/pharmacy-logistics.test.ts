import { describe, expect, it } from 'vitest';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { createSeed } from '../data/seed';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { validatePharmacy } from './pharmacy';
import { pendingStockTransfers, type StockLogisticsCommand } from './pharmacy-logistics';
import type { Database } from './model';

const now = new Date('2026-10-31T12:00:00Z'),
  expired = new Date('2026-11-06T12:00:00Z');
const origin = demoContext('aurora', 'aurora-centro', 'pharmacy'),
  dest = demoContext('aurora', 'aurora-vila', 'admin');
const metadata = {
  strength: '10 de teste',
  form: 'Forma fictícia',
  quantityUnit: 'unidade de teste',
};
const receipt = (
  shipmentId: string,
): Extract<StockLogisticsCommand, { type: 'stock.receive' }> => ({
  type: 'stock.receive',
  shipmentId,
  reference: 'Guia de recebimento fictícia',
  requestId: crypto.randomUUID(),
});
function prepare() {
  const db = createSeed(now);
  const register = {
    type: 'stock.register',
    product: 'Logística fictícia',
    medication: metadata,
    lot: 'TRANS-1',
    expiresAt: '2026-11-03',
    quantity: 10,
    minimum: 0,
    reason: 'Abertura de teste',
  } as const;
  const lotId = applyCommand(db, origin, register, now);
  const ship: Extract<StockLogisticsCommand, { type: 'stock.ship' }> = {
    type: 'stock.ship',
    lotId,
    toUnitId: dest.unitId,
    quantity: 6,
    expectedStock: 10,
    reference: 'Guia A',
    reason: 'Reposição fictícia',
    requestId: crypto.randomUUID(),
  };
  const inventory: Extract<StockLogisticsCommand, { type: 'stock.inventory' }> = {
    type: 'stock.inventory',
    lotId,
    countedStock: 8,
    countedSegregated: 0,
    expectedStock: 10,
    expectedSegregated: 0,
    reference: 'Ficha A',
    reason: 'Contagem física fictícia',
    requestId: crypto.randomUUID(),
  };
  return { db, lotId, register, ship, inventory, lot: db.lots.find((l) => l.id === lotId)! };
}
function storeWith(db: unknown) {
  const data = new Map([[storageKey, JSON.stringify(db)]]);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

describe('logística de estoque da farmácia', () => {
  it('conserva saldos em trânsito e nas duas unidades, oculta saldos remotos e localiza os eventos correlatos', () => {
    const { db, lot, ship } = prepare();
    const id = applyCommand(db, origin, ship, now);
    expect(lot.quantity).toBe(4);
    expect(readSnapshot(db, dest).lots.some((l) => l.lot === 'TRANS-1')).toBe(false);
    expect(pendingStockTransfers(readSnapshot(db, dest).stockLogistics).map((e) => e.id)).toEqual([
      id,
    ]);
    expect(readSnapshot(db, dest).stockLogistics[0]).not.toHaveProperty('before');
    const third = demoContext('aurora', 'aurora-upa', 'admin');
    for (const session of [
      third,
      demoContext('horizonte', 'horizonte-centro', 'admin'),
      demoContext('aurora', origin.unitId, 'reception'),
    ]) {
      expect(readSnapshot(db, session).stockLogistics).toHaveLength(0);
    }
    const cmd = receipt(id),
      result = applyCommand(db, dest, cmd, now);
    const received = db.lots.find((l) => l.unitId === dest.unitId && l.lot === lot.lot)!;
    expect(received).toMatchObject({ quantity: 6, expiresAt: lot.expiresAt, medication: metadata });
    expect(pendingStockTransfers(readSnapshot(db, origin).stockLogistics)).toHaveLength(0);
    expect(readSnapshot(db, origin).stockLogistics[1]).not.toHaveProperty('after');
    expect(readSnapshot(db, origin).lots.some((l) => l.id === received.id)).toBe(false);
    expect(db.stockLogistics[1]).toMatchObject({
      kind: 'receipt',
      shipmentId: id,
      quantity: 6,
      before: 0,
      after: 6,
    });
    const saved = structuredClone(db);
    expect(applyCommand(db, dest, cmd, now)).toBe(result);
    expect(() => applyCommand(db, dest, receipt(id), now)).toThrow('já foi recebida');
    expect(db).toEqual(saved);
    validatePharmacy(db);
  });
  it('mantém o número do lote e soma o recebimento a um lote equivalente existente', () => {
    const { db, ship, register } = prepare();
    const destinationLot = applyCommand(
      db,
      dest,
      { ...register, product: ' LOGÍSTICA fictícia ', lot: 'trans-1', quantity: 2 },
      now,
    );
    const id = applyCommand(db, origin, ship, now);
    applyCommand(db, dest, receipt(id), now);
    expect(db.lots.find((l) => l.id === destinationLot)?.quantity).toBe(8);
    expect(db.stockLogistics[1]).toMatchObject({ lotId: destinationLot, before: 2, after: 8 });
    validatePharmacy(db);
  });
  it('recebe remessa vencida em trânsito somente em segregação e permite destinação parcial com referência', () => {
    const { db, ship } = prepare(),
      id = applyCommand(db, origin, ship, now);
    applyCommand(db, dest, receipt(id), expired);
    const lot = readSnapshot(db, dest).lots.find((l) => l.lot === 'TRANS-1')!;
    expect(lot).toMatchObject({ quantity: 0, segregatedQuantity: 6 });
    const dispose: Extract<StockLogisticsCommand, { type: 'stock.dispose' }> = {
      type: 'stock.dispose',
      lotId: lot.id,
      quantity: 2,
      expectedSegregated: 6,
      destination: 'Coleta fictícia',
      reference: 'Termo 1',
      reason: 'Destinação registrada',
      requestId: crypto.randomUUID(),
    };
    for (const patch of [
      { destination: ' ' },
      { reference: '' },
      { reason: '' },
      { quantity: 7 },
      { quantity: 0 },
      { quantity: 0.5 },
      { expectedSegregated: 5 },
    ]) {
      expect(() => applyCommand(db, dest, { ...dispose, ...patch }, expired)).toThrow();
    }
    const eventId = applyCommand(db, dest, dispose, expired);
    expect(applyCommand(db, dest, dispose, expired)).toBe(eventId);
    expect(readSnapshot(db, dest).lots.find((l) => l.id === lot.id)).toMatchObject({
      quantity: 0,
      segregatedQuantity: 4,
    });
    expect(db.stockLogistics.at(-1)).toMatchObject({
      kind: 'disposal',
      before: 6,
      after: 4,
      reference: 'Termo 1',
      destination: 'Coleta fictícia',
      authorId: dest.sessionId,
    });
    expect(readSnapshot(db, origin).stockLogistics).toHaveLength(2);
    validatePharmacy(db);
  });
  it('registra contagem segregada divergente sem movimento e reconcilia somente após recontagem justificada', () => {
    const { db, lot, inventory } = prepare();
    const movements = db.movements.length;
    applyCommand(db, origin, { ...inventory, countedSegregated: 1 }, now);
    expect(lot.quantity).toBe(10);
    expect(db.stockLogistics[0]).toMatchObject({
      kind: 'inventory',
      reconciled: false,
      countedStock: 8,
      countedSegregated: 1,
      before: 10,
      after: 10,
    });
    expect(db.movements).toHaveLength(movements);
    const corrected = { ...inventory, requestId: crypto.randomUUID() };
    applyCommand(db, origin, corrected, now);
    expect(lot.quantity).toBe(8);
    expect(db.movements.at(-1)).toMatchObject({
      logisticsKind: 'inventory',
      kind: 'exit',
      quantity: 2,
    });
    applyCommand(
      db,
      origin,
      { ...inventory, expectedStock: 8, countedStock: 11, requestId: crypto.randomUUID() },
      now,
    );
    applyCommand(
      db,
      origin,
      { ...inventory, expectedStock: 11, countedStock: 11, requestId: crypto.randomUUID() },
      now,
    );
    expect(lot.quantity).toBe(11);
    expect(db.movements).toHaveLength(movements + 2);
    validatePharmacy(db);
    expect(() => applyCommand(db, origin, inventory, now)).toThrow();
  });
  it('impede saldo negativo, lote vencido/não identificado, origem igual, outra rede, unidade sem vínculo e concorrência', () => {
    const { db, lotId, ship } = prepare(),
      before = structuredClone(db);
    for (const patch of [
      { expectedStock: 9 },
      { quantity: 0 },
      { quantity: 0.3 },
      { quantity: 11 },
      { toUnitId: origin.unitId },
      { toUnitId: 'horizonte-centro' },
      { toUnitId: 'desconhecida' },
      { requestId: ' ' },
      { reason: ' ' },
    ]) {
      expect(() => applyCommand(db, origin, { ...ship, ...patch }, now)).toThrow();
    }
    for (const session of [
      dest,
      demoContext('horizonte', 'horizonte-centro', 'pharmacy'),
      demoContext('aurora', origin.unitId, 'reception'),
    ])
      expect(() => applyCommand(db, session, ship, now)).toThrow();
    expect(() => applyCommand(db, origin, ship, expired)).toThrow('vencido');
    const old = db.lots.find((l) => l.unitId === origin.unitId && !l.medication)!;
    expect(() =>
      applyCommand(
        db,
        origin,
        { ...ship, lotId: old.id, quantity: 1, expectedStock: old.quantity },
        now,
      ),
    ).toThrow();
    expect(db).toEqual(before);
    const id = applyCommand(db, origin, ship, now);
    expect(() =>
      applyCommand(db, origin, { ...ship, requestId: crypto.randomUUID() }, now),
    ).toThrow('mudou');
    expect(() => applyCommand(db, origin, receipt(id), now)).toThrow('nesta unidade');
    expect(() => applyCommand(db, dest, receipt(id), new Date('2026-10-30'))).toThrow('anteceder');
    expect(db.lots.find((l) => l.id === lotId)!.quantity).toBe(4);
  });
  it('a remessa ainda não recebida impede crédito de inventário duplicado no lote de destino', () => {
    const { db, register, ship, inventory } = prepare();
    const destinationLot = applyCommand(db, dest, { ...register, quantity: 2 }, now);
    const id = applyCommand(db, origin, ship, now);
    const count = { ...inventory, lotId: destinationLot, expectedStock: 2, countedStock: 8 };
    expect(() => applyCommand(db, dest, count, now)).toThrow('remessa pendente');
    expect(db.lots.find((l) => l.id === destinationLot)?.quantity).toBe(2);
    applyCommand(db, dest, receipt(id), now);
    applyCommand(db, dest, { ...count, expectedStock: 8 }, now);
    expect(db.lots.find((l) => l.id === destinationLot)?.quantity).toBe(8);
    expect(db.stockLogistics.at(-1)).toMatchObject({
      kind: 'inventory',
      reconciled: true,
      before: 8,
      after: 8,
    });
    validatePharmacy(db);
    const damaged = structuredClone(db);
    damaged.movements.push({
      ...db.movements[0],
      id: 'movimento-inválido',
      logisticsKind: 'inventory',
      lotId: 'lote-inexistente',
    });
    expect(() => validatePharmacy(damaged)).toThrow('lote inexistente');
  });
  it('bloqueia conflitos de validade/apresentação inclusive enquanto outra remessa aguarda recebimento', () => {
    const { db, register, ship } = prepare(),
      third = demoContext('aurora', 'aurora-upa', 'pharmacy');
    const id = applyCommand(db, origin, ship, now);
    const incompatible = { ...register, expiresAt: '2026-12-13' };
    expect(() => applyCommand(db, dest, incompatible, now)).toThrow('em trânsito');
    const otherLot = applyCommand(db, third, incompatible, now);
    expect(() =>
      applyCommand(db, third, { ...ship, lotId: otherLot, requestId: crypto.randomUUID() }, now),
    ).toThrow('em trânsito');
    applyCommand(db, dest, receipt(id), now);
    expect(() =>
      applyCommand(db, third, { ...ship, lotId: otherLot, requestId: crypto.randomUUID() }, now),
    ).toThrow('incompatível');
    validatePharmacy(db);
  });
  it('migra a versão 15, faz repetição segura, detecta disputa por duas estações e reverte a transação que não pôde persistir', async () => {
    const { db, ship } = prepare(),
      { stockLogistics: unused, ...legacy } = db;
    expect(unused).toEqual([]);
    const storage = storeWith({ ...legacy, schemaVersion: 15 });
    const station = new DemoRepository(storage, () => now),
      another = new DemoRepository(storage, () => now);
    const revision = station.getRevision(),
      id = await station.execute(origin, ship, revision);
    expect(await another.execute(origin, ship, revision)).toBe(id);
    await expect(
      another.execute(origin, { ...ship, requestId: crypto.randomUUID() }, revision),
    ).rejects.toThrow('mudaram');
    await expect(another.execute(origin, { ...ship, quantity: 1 }, revision)).rejects.toThrow(
      'identificação',
    );
    const loaded = new DemoRepository(storage, () => now);
    expect(loaded.recoveryMessage).toBe('');
    expect(loaded.snapshot(dest).stockLogistics).toHaveLength(1);
    expect(JSON.parse(storage.getItem(storageKey)!).schemaVersion).toBe(16);
    storage.setItem = () => {
      throw Error('teste sem espaço');
    };
    await expect(loaded.execute(dest, receipt(id))).rejects.toThrow('salvar');
    expect(pendingStockTransfers(loaded.snapshot(dest).stockLogistics)).toHaveLength(1);
    expect(loaded.snapshot(dest).lots.some((l) => l.lot === 'TRANS-1')).toBe(false);
  });
  it('rejeita adulteração em movimento, vínculo entre unidades, segregação e autoria', () => {
    const { db, ship } = prepare(),
      id = applyCommand(db, origin, ship, now);
    applyCommand(db, dest, receipt(id), expired);
    for (const mutate of [
      (d: Database) => {
        d.stockLogistics[0].after += 1;
      },
      (d: Database) => {
        d.stockLogistics[1].authorId = origin.sessionId;
      },
      (d: Database) => {
        const e = d.stockLogistics[1];
        if (e.kind === 'receipt') e.shipmentId = 'desconhecido';
      },
      (d: Database) => {
        const e = d.stockLogistics[1];
        if (e.kind === 'receipt') e.destination = 'stock';
      },
      (d: Database) => {
        d.lots.find((l) => l.id === d.stockLogistics[1].lotId)!.segregatedQuantity = 7;
      },
      (d: Database) => {
        d.movements.pop();
      },
      (d: Database) => {
        d.stockLogistics.pop();
      },
      (d: Database) => {
        d.stockLogistics[0].previousMovementId = null;
      },
    ]) {
      const damaged = structuredClone(db);
      mutate(damaged);
      expect(() => validatePharmacy(damaged)).toThrow();
    }
  });
});
