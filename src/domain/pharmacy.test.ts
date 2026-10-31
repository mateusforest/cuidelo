import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot, readSummary } from './operations';
import {
  allocationBalance,
  matchesMedication,
  stockLotAttention,
  prescriptionProgress,
  validatePharmacy,
  type PharmacyCommand,
} from './pharmacy';
import type { ClinicalDocument, DocumentContent } from './clinical-documents';
import type { Database } from './model';

const now = new Date('2026-10-29T15:00:00Z'),
  doctor = demoContext('aurora', 'aurora-centro', 'clinical'),
  pharmacist = demoContext('aurora', 'aurora-centro', 'pharmacy'),
  admin = demoContext('aurora', 'aurora-centro', 'admin');

it('conta atenção por segregação, mínimo e validade apenas nos lotes do contexto', () => {
  const db = createSeed(now);
  const base = {
    ...db.lots[0],
    organizationId: 'aurora',
    unitId: 'aurora-centro',
    quantity: 0,
    minimum: 0,
    expiresAt: '2026-11-29',
  };
  db.lots = [
    { ...base, id: 'segregado', segregatedQuantity: 2 },
    { ...base, id: 'mínimo', minimum: 1 },
    { ...base, id: '30 dias', quantity: 1, expiresAt: '2026-11-28' },
    { ...base, id: 'vencido', quantity: 1, expiresAt: '2026-10-28' },
    { ...base, id: '31 dias e no mínimo', quantity: 1, minimum: 1 },
    { ...base, id: 'sem alerta' },
    { ...base, id: 'outra unidade', unitId: 'aurora-vila', segregatedQuantity: 2 },
    {
      ...base,
      id: 'outra rede',
      organizationId: 'horizonte',
      unitId: 'horizonte-centro',
      minimum: 1,
    },
  ];
  const flagged = readSnapshot(db, pharmacist).lots.filter(
    (l) => stockLotAttention(l, '2026-10-29').needsAttention,
  );
  expect(flagged.map((l) => l.id)).toEqual(['segregado', 'mínimo', '30 dias', 'vencido']);
  expect(readSummary(db, pharmacist, now).stockAlerts).toBe(4);
  expect(readSummary(db, demoContext('aurora', 'all', 'manager'), now).stockAlerts).toBe(5);
  expect(readSummary(db, demoContext('horizonte', 'all', 'manager'), now).stockAlerts).toBe(1);
});
const content: DocumentContent = {
  kind: 'prescription',
  orientations: 'Somente demonstração.',
  items: [
    {
      id: 'med-a',
      medicine: 'Medicamento fictício Alfa',
      strength: 'Concentração de teste',
      form: 'Apresentação de teste',
      dose: 'Dose fictícia',
      route: 'Via fictícia',
      frequency: 'Frequência fictícia',
      duration: 'Duração fictícia',
      quantity: '10',
      quantityUnit: 'unidade de teste',
      instructions: '',
    },
    {
      id: 'med-b',
      medicine: 'Medicamento fictício Beta',
      strength: 'Concentração de teste',
      form: 'Apresentação de teste',
      dose: 'Dose fictícia',
      route: 'Via fictícia',
      frequency: 'Frequência fictícia',
      duration: 'Duração fictícia',
      quantity: '4',
      quantityUnit: 'unidade de teste',
      instructions: '',
    },
  ],
};
const metadata = {
  strength: 'Concentração de teste',
  form: 'Apresentação de teste',
  quantityUnit: 'unidade de teste',
};
function setup() {
  const db = createSeed(now);
  applyCommand(db, doctor, { type: 'encounter.start', id: 'aurora-centro-e0' }, now);
  const id = applyCommand(
    db,
    doctor,
    { type: 'document.save', encounterId: 'aurora-centro-e0', expectedVersion: 0, content },
    now,
  );
  applyCommand(db, doctor, { type: 'document.issue', id, expectedVersion: 1, reviewed: true }, now);
  const register = (product: string, lot: string, quantity: number) =>
    applyCommand(
      db,
      pharmacist,
      {
        type: 'stock.register',
        product,
        medication: metadata,
        lot,
        quantity,
        minimum: 0,
        expiresAt: '2027-01-01',
        reason: 'Estoque fictício',
      },
      now,
    );
  return {
    db,
    doc: db.clinicalDocuments.find((d) => d.id === id)!,
    a: register('Medicamento fictício Alfa', 'ALFA-1', 6),
    a2: register('Medicamento fictício Alfa', 'ALFA-2', 10),
    b: register('Medicamento fictício Beta', 'BETA-1', 8),
  };
}
type DeliveryCommand = Extract<PharmacyCommand, { type: 'pharmacy.dispense' }>;
function command(
  doc: ClinicalDocument,
  a: string,
  b: string,
  patch: Partial<DeliveryCommand> = {},
): DeliveryCommand {
  return {
    type: 'pharmacy.dispense',
    documentId: doc.id,
    expectedDocumentVersion: doc.version,
    expectedDeliveries: 0,
    requestId: crypto.randomUUID(),
    allocations: [
      { itemId: 'med-a', lotId: a, quantity: 5 },
      { itemId: 'med-b', lotId: b, quantity: 2 },
    ],
    recipient: { kind: 'patient', name: doc.identity!.name },
    identityConfirmed: true,
    itemsConfirmed: true,
    partialReason: 'Restante combinado para outro momento de teste.',
    notes: '',
    ...patch,
  };
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

describe('receita, dispensação e baixa por lote', () => {
  it('entrega parcial seguida de conclusão por vários lotes mantém saldos e comprovantes imutáveis', () => {
    const { db, doc, a, a2, b } = setup();
    applyCommand(db, pharmacist, command(doc, a, b), now);
    const first = structuredClone(db.dispensations[0]);
    expect(prescriptionProgress(doc, db.dispensations).status).toBe('partial');
    expect(db.lots.find((l) => l.id === a)?.quantity).toBe(1);
    applyCommand(
      db,
      pharmacist,
      command(doc, a, b, {
        expectedDeliveries: 1,
        allocations: [
          { itemId: 'med-a', lotId: a, quantity: 1 },
          { itemId: 'med-a', lotId: a2, quantity: 4 },
          { itemId: 'med-b', lotId: b, quantity: 2 },
        ],
        partialReason: '',
      }),
      now,
    );
    expect(prescriptionProgress(doc, db.dispensations).status).toBe('complete');
    expect(db.lots.find((l) => l.id === a)?.quantity).toBe(0);
    expect(db.lots.find((l) => l.id === a2)?.quantity).toBe(6);
    expect(db.lots.find((l) => l.id === b)?.quantity).toBe(4);
    expect(db.dispensations[0]).toEqual(first);
    expect(db.dispensations[1].balances[0]).toEqual({
      itemId: 'med-a',
      prescribed: 10,
      before: 5,
      delivered: 5,
      remaining: 0,
    });
    expect(doc.version).toBe(2);
    expect(doc.content).toEqual(content);
    validatePharmacy(db);
  });
  it('permite omitir um item em entrega parcial, exige motivo e não marca o item como entregue', () => {
    const { db, doc, a, b } = setup();
    const cmd = command(doc, a, b, {
      allocations: [{ itemId: 'med-a', lotId: a, quantity: 1 }],
      partialReason: '',
    });
    const before = structuredClone(db);
    expect(() => applyCommand(db, pharmacist, cmd, now)).toThrow('motivo');
    expect(db).toEqual(before);
    applyCommand(
      db,
      pharmacist,
      { ...cmd, partialReason: 'Item Beta sem entrega neste momento.' },
      now,
    );
    expect(prescriptionProgress(doc, db.dispensations).items[1].remaining).toBe(4);
  });
  it('rejeita excesso prescrito e insuficiência sem baixar nenhum dos lotes', () => {
    const { db, doc, a, a2, b } = setup();
    const before = structuredClone(db);
    for (const allocations of [
      [
        { itemId: 'med-a', lotId: a, quantity: 7 },
        { itemId: 'med-b', lotId: b, quantity: 1 },
      ],
      [{ itemId: 'med-b', lotId: b, quantity: 5 }],
      [
        { itemId: 'med-a', lotId: a, quantity: 6 },
        { itemId: 'med-a', lotId: a2, quantity: 5 },
      ],
    ]) {
      expect(() =>
        applyCommand(db, pharmacist, command(doc, a, b, { allocations }), now),
      ).toThrow();
      expect(db).toEqual(before);
    }
  });
  it('valida o saldo agregado quando dois itens usam o mesmo lote', () => {
    const { db, doc, a, b } = setup();
    if (doc.content.kind === 'prescription') {
      doc.content.items[1] = { ...doc.content.items[0], id: 'med-b', quantity: '4' };
    }
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        command(doc, a, b, {
          allocations: [
            { itemId: 'med-a', lotId: a, quantity: 5 },
            { itemId: 'med-b', lotId: a, quantity: 2 },
          ],
        }),
        now,
      ),
    ).toThrow('Saldo insuficiente');
    expect(db.lots.find((l) => l.id === a)?.quantity).toBe(6);
  });
  it('bloqueia vencidos, apresentação divergente, unidade diferente e lote não identificado', () => {
    for (const change of [
      (l: Database['lots'][number]) => {
        l.expiresAt = '2026-10-28';
      },
      (l: Database['lots'][number]) => {
        l.medication!.strength = 'Outra concentração';
      },
      (l: Database['lots'][number]) => {
        l.medication!.form = 'Outra forma';
      },
      (l: Database['lots'][number]) => {
        l.medication!.quantityUnit = 'caixa';
      },
      (l: Database['lots'][number]) => {
        delete l.medication;
      },
      (l: Database['lots'][number]) => {
        l.product = 'Outro medicamento';
      },
    ]) {
      const { db, doc, a, b } = setup();
      change(db.lots.find((l) => l.id === a)!);
      const before = structuredClone(db);
      expect(() => applyCommand(db, pharmacist, command(doc, a, b), now)).toThrow();
      expect(db).toEqual(before);
    }
  });
  it('recusa linhas repetidas, zero, negativos, frações, NaN e identificadores de outro item', () => {
    const { db, doc, a, b } = setup();
    for (const q of [0, -1, 0.5, NaN, Infinity])
      expect(() =>
        applyCommand(
          db,
          pharmacist,
          command(doc, a, b, { allocations: [{ itemId: 'med-a', lotId: a, quantity: q }] }),
          now,
        ),
      ).toThrow('inteira');
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        command(doc, a, b, {
          allocations: [
            { itemId: 'med-a', lotId: a, quantity: 1 },
            { itemId: 'med-a', lotId: a, quantity: 1 },
          ],
        }),
        now,
      ),
    ).toThrow('repetido');
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        command(doc, a, b, { allocations: [{ itemId: 'foreign', lotId: a, quantity: 1 }] }),
        now,
      ),
    ).toThrow('Item');
    expect(db.dispensations).toHaveLength(0);
  });
  it('exige as confirmações e a identidade do recebedor, aceita representante identificado', () => {
    const { db, doc, a, b } = setup();
    for (const patch of [
      { identityConfirmed: false },
      { itemsConfirmed: false },
      { recipient: { kind: 'patient' as const, name: 'Outro nome' } },
      { recipient: { kind: 'representative' as const, name: '' } },
    ])
      expect(() => applyCommand(db, pharmacist, command(doc, a, b, patch), now)).toThrow();
    applyCommand(
      db,
      pharmacist,
      command(doc, a, b, { recipient: { kind: 'representative', name: 'Responsável fictício' } }),
      now,
    );
    expect(db.dispensations[0].recipient.name).toBe('Responsável fictício');
    validatePharmacy(db);
  });
  it('isola a entrega por papel, unidade e prefeitura e oferece projeção mínima à farmácia', () => {
    const { db, doc, a, b } = setup();
    for (const c of [
      doctor,
      admin,
      demoContext('aurora', 'aurora-centro', 'reception'),
      demoContext('aurora', 'aurora-vila', 'pharmacy'),
      demoContext('horizonte', 'horizonte-centro', 'pharmacy'),
    ])
      expect(() => applyCommand(db, c, command(doc, a, b), now)).toThrow();
    const snapshot = readSnapshot(db, pharmacist);
    expect(snapshot.pharmacyPrescriptions).toHaveLength(1);
    expect(snapshot.clinicalDocuments).toHaveLength(0);
    expect(snapshot.notes).toHaveLength(0);
    expect(snapshot.patients).toHaveLength(0);
    expect(readSnapshot(db, admin).pharmacyPrescriptions).toHaveLength(0);
    applyCommand(db, pharmacist, command(doc, a, b), now);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'clinical')).dispensations,
    ).toHaveLength(1);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'pharmacy')).dispensations,
    ).toHaveLength(0);
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical')).dispensations,
    ).toHaveLength(0);
    expect(readSnapshot(db, admin).dispensations).toHaveLength(0);
    expect(
      readSnapshot(db, admin).movements.find((m) => m.kind === 'exit')?.documentId,
    ).toBeUndefined();
  });
  it('não recebe rascunhos ou exames e bloqueia nova entrega após cancelamento sem devolver saldo', () => {
    const { db, doc, a, b } = setup();
    const draftId = applyCommand(
      db,
      doctor,
      { type: 'document.save', encounterId: doc.encounterId, expectedVersion: 0, content },
      now,
    );
    expect(readSnapshot(db, pharmacist).pharmacyPrescriptions.some((d) => d.id === draftId)).toBe(
      false,
    );
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        command(doc, a, b, { documentId: draftId, expectedDocumentVersion: 1 }),
        now,
      ),
    ).toThrow('rascunho');
    applyCommand(db, pharmacist, command(doc, a, b), now);
    const quantity = db.lots.find((l) => l.id === a)!.quantity;
    applyCommand(
      db,
      doctor,
      {
        type: 'document.cancel',
        id: doc.id,
        expectedVersion: doc.version,
        reason: 'Cancelamento fictício após entrega parcial',
      },
      now,
    );
    expect(() =>
      applyCommand(db, pharmacist, command(doc, a, b, { expectedDeliveries: 1 }), now),
    ).toThrow('cancelada');
    expect(db.lots.find((l) => l.id === a)!.quantity).toBe(quantity);
    expect(db.dispensations).toHaveLength(1);
    expect(readSnapshot(db, pharmacist).pharmacyPrescriptions[0].status).toBe('cancelled');
    validatePharmacy(db);
  });
  it('recusa versões e saldos antigos e repetição de solicitação não duplica a baixa', () => {
    const { db, doc, a, b } = setup();
    const cmd = command(doc, a, b);
    expect(() => applyCommand(db, pharmacist, { ...cmd, expectedDocumentVersion: 1 }, now)).toThrow(
      'mudou',
    );
    const id = applyCommand(db, pharmacist, cmd, now),
      q = db.lots.find((l) => l.id === a)!.quantity;
    expect(applyCommand(db, pharmacist, cmd, now)).toBe(id);
    expect(db.dispensations).toHaveLength(1);
    expect(db.lots.find((l) => l.id === a)!.quantity).toBe(q);
    expect(() => applyCommand(db, pharmacist, { ...cmd, notes: 'Modificado' }, now)).toThrow(
      'outra entrega',
    );
    expect(() =>
      applyCommand(db, pharmacist, { ...cmd, requestId: crypto.randomUUID() }, now),
    ).toThrow('Outra entrega');
  });
  it('uma entrega total bloqueia excesso e saída avulsa não reduz saldo da receita', () => {
    const { db, doc, a, a2, b } = setup();
    applyCommand(
      db,
      pharmacist,
      { type: 'stock.move', id: a, kind: 'exit', quantity: 1, reason: 'Saída avulsa fictícia' },
      now,
    );
    expect(prescriptionProgress(doc, db.dispensations).items[0].remaining).toBe(10);
    applyCommand(
      db,
      pharmacist,
      command(doc, a, b, {
        allocations: [
          { itemId: 'med-a', lotId: a2, quantity: 10 },
          { itemId: 'med-b', lotId: b, quantity: 4 },
        ],
        partialReason: '',
      }),
      now,
    );
    expect(() =>
      applyCommand(db, pharmacist, command(doc, a, b, { expectedDeliveries: 1 }), now),
    ).toThrow('completo');
    validatePharmacy(db);
  });
  it('cadastro de lote registra saldo inicial, impede duplicação e identificação não converte estoque legado', () => {
    const { db, a } = setup(),
      lot = db.lots.find((l) => l.id === a)!;
    expect(db.movements.find((m) => m.lotId === a)?.quantity).toBe(6);
    const create: PharmacyCommand = {
      type: 'stock.register',
      product: lot.product,
      medication: metadata,
      lot: lot.lot,
      expiresAt: lot.expiresAt,
      quantity: 2,
      minimum: 0,
      reason: 'Teste',
    };
    expect(() => applyCommand(db, pharmacist, create, now)).toThrow('já');
    expect(() =>
      applyCommand(db, pharmacist, { ...create, lot: 'NOVO', expiresAt: '2026-10-28' }, now),
    ).toThrow('validade');
    const legacy = db.lots[1],
      q = legacy.quantity;
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        { type: 'stock.identify', id: legacy.id, medication: metadata, confirmed: false },
        now,
      ),
    ).toThrow('Confirme');
    applyCommand(
      db,
      pharmacist,
      { type: 'stock.identify', id: legacy.id, medication: metadata, confirmed: true },
      now,
    );
    expect(legacy.quantity).toBe(q);
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        { type: 'stock.identify', id: legacy.id, medication: metadata, confirmed: true },
        now,
      ),
    ).toThrow('preservada');
    expect(
      matchesMedication({ ...content.items[0], medicine: '  MEDICAMENTO FICTICIO   ALFA  ' }, lot),
    ).toBe(true);
    validatePharmacy(db);
  });
  it('migra a versão 8, persiste entregas e rejeita conflito entre duas abas sem perder estoque', async () => {
    const { db, doc, a, b } = setup();
    const store = new MemoryStorage();
    (db as unknown as { schemaVersion: number }).schemaVersion = 8;
    delete (db as unknown as { dispensations?: unknown }).dispensations;
    store.setItem(storageKey, JSON.stringify(db));
    const repo = new DemoRepository(store, () => now),
      other = new DemoRepository(store, () => now);
    expect(repo.recoveryMessage).toBe('');
    await repo.execute(pharmacist, command(doc, a, b));
    await expect(other.execute(pharmacist, command(doc, a, b))).rejects.toThrow('mudaram');
    const loaded = new DemoRepository(store, () => now);
    expect(loaded.recoveryMessage).toBe('');
    expect(loaded.snapshot(pharmacist).dispensations).toHaveLength(1);
    expect(JSON.parse(store.getItem(storageKey)!).schemaVersion).toBe(17);
    const saved = store.getItem(storageKey);
    await expect(
      loaded.execute(
        pharmacist,
        command(doc, a, b, {
          expectedDeliveries: 1,
          allocations: [{ itemId: 'med-a', lotId: a, quantity: 99 }],
        }),
      ),
    ).rejects.toThrow();
    expect(store.getItem(storageKey)).toBe(saved);
  });
  it('falha de armazenamento não baixa saldo nem confirma entrega', async () => {
    const { db, doc, a, b } = setup(),
      store = new MemoryStorage();
    store.setItem(storageKey, JSON.stringify(db));
    const repo = new DemoRepository(store, () => now);
    store.setItem = () => {
      throw Error('Full');
    };
    await expect(repo.execute(pharmacist, command(doc, a, b))).rejects.toThrow();
    expect(repo.snapshot(pharmacist).dispensations).toHaveLength(0);
    expect(repo.snapshot(pharmacist).lots.find((l) => l.id === a)?.quantity).toBe(6);
  });
  it('detecta base adulterada com quantidade excessiva, ligação ausente, destinatário vazio ou movimento órfão', () => {
    const { db, doc, a, b } = setup();
    applyCommand(db, pharmacist, command(doc, a, b), now);
    for (const mutate of [
      (d: Database) => {
        d.dispensations[0].allocations[0].quantity = 99;
      },
      (d: Database) => {
        d.movements = d.movements.filter((m) => !m.dispensationId);
      },
      (d: Database) => {
        d.dispensations[0].recipient.name = '';
      },
      (d: Database) => {
        d.dispensations = [];
      },
      (d: Database) => {
        d.dispensations[0].balances[0].remaining = 900;
      },
      (d: Database) => {
        d.dispensations[0].unitId = 'aurora-vila';
      },
    ]) {
      const altered = structuredClone(db);
      mutate(altered);
      const store = new MemoryStorage();
      store.setItem(storageKey, JSON.stringify(altered));
      expect(new DemoRepository(store, () => now).recoveryMessage).not.toBe('');
    }
  });
});

describe('devolução e estorno ligados à saída original', () => {
  function prepared() {
    const setupData = setup();
    const { db, doc, a, b } = setupData;
    applyCommand(db, pharmacist, command(doc, a, b), now);
    const delivery = db.dispensations[0],
      origin = delivery.allocations[0];
    const adjust = (
      patch: Partial<Extract<PharmacyCommand, { type: 'pharmacy.adjust' }>> = {},
    ): Extract<PharmacyCommand, { type: 'pharmacy.adjust' }> => ({
      type: 'pharmacy.adjust',
      dispensationId: delivery.id,
      originalMovementId: origin.movementId,
      kind: 'return',
      quantity: 2,
      confirmed: true,
      expectedAdjustments: db.dispensationAdjustments.filter(
        (r) => r.dispensationId === delivery.id,
      ).length,
      reason: 'Conferência fictícia de balcão',
      requestId: crypto.randomUUID(),
      ...patch,
    });
    const progress = () => prescriptionProgress(doc, db.dispensations, db.dispensationAdjustments);
    return { ...setupData, delivery, origin, adjust, progress };
  }
  function countAvailable(db: Database, lotId: string, countedStock: number, reference: string) {
    const lot = db.lots.find((l) => l.id === lotId)!;
    return applyCommand(
      db,
      pharmacist,
      {
        type: 'stock.inventory',
        lotId,
        countedStock,
        countedSegregated: lot.segregatedQuantity ?? 0,
        expectedStock: lot.quantity,
        expectedSegregated: lot.segregatedQuantity ?? 0,
        reason: 'Conferência de estoque fictícia',
        reference,
        requestId: crypto.randomUUID(),
      },
      now,
    );
  }
  it('vincula o estorno à contagem que já recompôs a unidade, reabre a receita e conserva o extrato ao recarregar', async () => {
    const { db, a, adjust, progress, delivery } = prepared();
    const original = structuredClone(delivery),
      lot = db.lots.find((l) => l.id === a)!;
    expect(lot.quantity).toBe(1);
    const id = countAvailable(db, a, 2, 'CONT-100');
    const cmd = adjust({ kind: 'reversal', quantity: 1 });
    expect(() => applyCommand(db, pharmacist, cmd, now)).toThrow('créditos de inventário');
    const bound = { ...cmd, inventoryCredits: [{ inventoryId: id, quantity: 1 }] };
    const adjustmentId = applyCommand(db, pharmacist, bound, now),
      revision = db.revision;
    expect(lot.quantity).toBe(2);
    expect(db.dispensationAdjustments.at(-1)).toMatchObject({
      inventoryCredits: [{ inventoryId: id, reference: 'CONT-100', quantity: 1 }],
      balanceBefore: 2,
      balanceAfter: 2,
    });
    expect(db.movements.at(-1)).toMatchObject({ id: adjustmentId, quantity: 0, kind: 'entry' });
    expect(progress().items[0]).toMatchObject({ delivered: 4, remaining: 6 });
    expect(applyCommand(db, pharmacist, bound, now)).toBe(adjustmentId);
    expect(db.revision).toBe(revision);
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        { ...bound, inventoryCredits: [{ inventoryId: id, quantity: 0 }] },
        now,
      ),
    ).toThrow('Identificação');
    expect(db.dispensations[0]).toEqual(original);
    validatePharmacy(db);
    const store = new MemoryStorage();
    store.setItem(storageKey, JSON.stringify(db));
    const loaded = new DemoRepository(store, () => now);
    expect(loaded.recoveryMessage).toBe('');
    expect(loaded.snapshot(pharmacist).dispensationAdjustments.at(-1)?.inventoryCredits).toEqual([
      { inventoryId: id, quantity: 1, reference: 'CONT-100' },
    ]);
    // Uma contagem não pode recompor duas saídas, mesmo com outro requestId.
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        adjust({
          kind: 'reversal',
          quantity: 1,
          inventoryCredits: [{ inventoryId: id, quantity: 1 }],
        }),
        now,
      ),
    ).toThrow('inventário');
    const altered = structuredClone(db);
    altered.dispensationAdjustments[0].inventoryCredits![0].quantity = 0;
    expect(() => validatePharmacy(altered)).toThrow();
  });
  it('permite conciliação parcial e zero atribuído com justificativa e impede somar além da diferença contada', () => {
    const { db, a, adjust } = prepared(),
      lot = db.lots.find((l) => l.id === a)!;
    const x = countAvailable(db, a, 2, 'CONT-A'),
      y = countAvailable(db, a, 4, 'CONT-B');
    const arithmetic = adjust({
      kind: 'reversal',
      quantity: 2,
      inventoryCredits: [
        { inventoryId: x, quantity: 1 },
        { inventoryId: y, quantity: 0 },
      ],
    });
    for (const credits of [
      [{ inventoryId: x, quantity: 1 }],
      [
        { inventoryId: x, quantity: 1 },
        { inventoryId: x, quantity: 1 },
      ],
      [
        { inventoryId: x, quantity: 2 },
        { inventoryId: y, quantity: 0 },
      ],
      [
        { inventoryId: x, quantity: 1 },
        { inventoryId: y, quantity: 2 },
      ],
    ])
      expect(() =>
        applyCommand(db, pharmacist, { ...arithmetic, inventoryCredits: credits }, now),
      ).toThrow();
    applyCommand(db, pharmacist, arithmetic, now);
    expect(lot.quantity).toBe(5);
    applyCommand(
      db,
      pharmacist,
      adjust({
        kind: 'reversal',
        quantity: 1,
        inventoryCredits: [{ inventoryId: y, quantity: 0 }],
      }),
      now,
    );
    expect(lot.quantity).toBe(6);
    expect(db.dispensationAdjustments.at(-1)?.inventoryCredits?.[0].quantity).toBe(0);
    validatePharmacy(db);
  });
  it('ao vencer após a contagem, reclassifica a parcela já contada e segrega a quantidade efetiva uma única vez', () => {
    const { db, a, adjust } = prepared(),
      lot = db.lots.find((l) => l.id === a)!;
    const id = countAvailable(db, a, 2, 'CONT-EXP');
    const expired = new Date('2027-01-02T12:00:00Z');
    applyCommand(
      db,
      pharmacist,
      adjust({
        kind: 'reversal',
        quantity: 2,
        inventoryCredits: [{ inventoryId: id, quantity: 1 }],
      }),
      expired,
    );
    expect(lot).toMatchObject({ quantity: 1, segregatedQuantity: 2 });
    expect(db.movements.at(-2)).toMatchObject({ kind: 'exit', destination: 'stock', quantity: 1 });
    expect(db.movements.at(-1)).toMatchObject({
      kind: 'entry',
      destination: 'segregated',
      quantity: 2,
    });
    validatePharmacy(db);
    const corrupted = structuredClone(db);
    corrupted.movements.splice(-2, 1);
    expect(() => validatePharmacy(corrupted)).toThrow();
  });
  it('destina quantidades devolvidas na base 15 e aceita nova devolução sem alterar o comprovante', async () => {
    const { db, a, adjust, delivery } = prepared();
    applyCommand(db, pharmacist, adjust({ quantity: 3 }), now);
    const original = structuredClone(delivery),
      savedAdjustments = structuredClone(db.dispensationAdjustments);
    const { stockLogistics: empty, ...legacy } = db;
    expect(empty).toEqual([]);
    const store = new MemoryStorage();
    store.setItem(storageKey, JSON.stringify({ ...legacy, schemaVersion: 15 }));
    const repo = new DemoRepository(store, () => now);
    expect(repo.recoveryMessage).toBe('');
    await repo.execute(pharmacist, {
      type: 'stock.dispose',
      lotId: a,
      quantity: 2,
      expectedSegregated: 3,
      reason: 'Material já encaminhado ao coletor de teste',
      reference: 'Termo de coleta 1',
      destination: 'Coletor fictício',
      requestId: crypto.randomUUID(),
    });
    await repo.execute(pharmacist, adjust({ quantity: 1, expectedAdjustments: 1 }));
    const loaded = new DemoRepository(store, () => now);
    expect(loaded.recoveryMessage).toBe('');
    const view = loaded.snapshot(pharmacist);
    expect(view.lots.find((l) => l.id === a)).toMatchObject({ segregatedQuantity: 2, quantity: 1 });
    expect(view.dispensations[0]).toEqual(original);
    expect(view.dispensationAdjustments[0]).toEqual(savedAdjustments[0]);
    expect(view.dispensationAdjustments[1]).toMatchObject({ balanceBefore: 1, balanceAfter: 2 });
  });
  it('segrega a devolução física sem reabrir a receita e mantém o comprovante intacto', () => {
    const { db, a, delivery, origin, adjust, progress } = prepared(),
      before = structuredClone(delivery),
      lot = db.lots.find((l) => l.id === a)!;
    const q = lot.quantity,
      cmd = adjust(),
      id = applyCommand(db, pharmacist, cmd, now);
    expect(lot.quantity).toBe(q);
    expect(lot.segregatedQuantity).toBe(2);
    expect(db.dispensationAdjustments[0]).toMatchObject({
      id,
      kind: 'return',
      destination: 'segregated',
      balanceBefore: 0,
      balanceAfter: 2,
      authorId: pharmacist.sessionId,
      at: now.toISOString(),
      reason: cmd.reason,
    });
    expect(db.movements.at(-1)).toMatchObject({
      id,
      kind: 'entry',
      adjustmentKind: 'return',
      originalMovementId: origin.movementId,
      itemId: origin.itemId,
      lotId: a,
      dispensationId: delivery.id,
    });
    expect(progress().items[0]).toMatchObject({ delivered: 5, remaining: 5 });
    expect(allocationBalance(origin, db.dispensationAdjustments)).toEqual({
      remaining: 3,
      returned: 2,
      reversed: 0,
    });
    expect(() =>
      applyCommand(db, pharmacist, adjust({ quantity: 4, kind: 'reversal' }), now),
    ).toThrow('saldo ajustável');
    expect(delivery).toEqual(before);
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        { type: 'stock.move', id: a, quantity: q + 1, reason: 'Teste', kind: 'exit' },
        now,
      ),
    ).toThrow('Saldo insuficiente');
    validatePharmacy(db);
  });
  it('estorno parcial recompõe o lote e a receita e permite uma nova baixa em outro lote do mesmo item', () => {
    const { db, doc, a, a2, b, delivery, origin, adjust, progress } = prepared(),
      lot = db.lots.find((l) => l.id === a)!;
    const initial = structuredClone(delivery);
    applyCommand(db, pharmacist, adjust({ kind: 'reversal', quantity: 3 }), now);
    expect(lot.quantity).toBe(4);
    expect(db.dispensationAdjustments[0]).toMatchObject({
      destination: 'stock',
      balanceBefore: 1,
      balanceAfter: 4,
    });
    expect(progress().items[0]).toMatchObject({ delivered: 2, remaining: 8 });
    const follow = command(doc, a2, b, {
      expectedDeliveries: 1,
      expectedAdjustments: 1,
      allocations: [
        { itemId: 'med-a', lotId: a2, quantity: 8 },
        { itemId: 'med-b', lotId: b, quantity: 2 },
      ],
      partialReason: '',
    });
    expect(() => applyCommand(db, pharmacist, { ...follow, expectedAdjustments: 0 }, now)).toThrow(
      'ajuste',
    );
    applyCommand(db, pharmacist, follow, now);
    expect(progress().status).toBe('complete');
    expect(db.dispensations[1].balances[0]).toEqual({
      itemId: 'med-a',
      prescribed: 10,
      before: 2,
      delivered: 8,
      remaining: 0,
    });
    applyCommand(db, pharmacist, adjust({ kind: 'return', quantity: 2 }), now);
    expect(allocationBalance(origin, db.dispensationAdjustments).remaining).toBe(0);
    expect(() =>
      applyCommand(db, pharmacist, adjust({ kind: 'reversal', quantity: 1 }), now),
    ).toThrow('saldo ajustável');
    expect(delivery).toEqual(initial);
    expect(lot.quantity).toBe(4);
    applyCommand(
      db,
      pharmacist,
      { type: 'stock.move', id: a, quantity: 3, reason: 'Uso fictício', kind: 'exit' },
      now,
    );
    validatePharmacy(db);
  });
  it('estorno total de todos os itens permite nova entrega e cada lote conserva sua própria quantidade', () => {
    const { db, delivery, adjust, progress } = prepared();
    for (const movement of delivery.allocations)
      applyCommand(
        db,
        pharmacist,
        adjust({
          kind: 'reversal',
          originalMovementId: movement.movementId,
          quantity: movement.quantity,
        }),
        now,
      );
    expect(progress().status).toBe('waiting');
    expect(progress().items.map((x) => x.remaining)).toEqual([10, 4]);
    expect(db.dispensationAdjustments.map((r) => r.sequence)).toEqual([1, 2]);
    validatePharmacy(db);
  });
  it('recebe ajustes de entrega cancelada e de lote vencido sem liberar nova dispensação', () => {
    const { db, doc, a, b, adjust, progress } = prepared(),
      lot = db.lots.find((l) => l.id === a)!;
    applyCommand(
      db,
      doctor,
      {
        type: 'document.cancel',
        id: doc.id,
        expectedVersion: doc.version,
        reason: 'Cancelamento demonstrativo.',
      },
      now,
    );
    const later = new Date('2027-01-02T15:00:00Z');
    applyCommand(db, pharmacist, adjust({ kind: 'reversal' }), later);
    applyCommand(db, pharmacist, adjust({ kind: 'return' }), later);
    expect(db.dispensationAdjustments.map((x) => x.destination)).toEqual([
      'segregated',
      'segregated',
    ]);
    expect(lot.quantity).toBe(1);
    expect(lot.segregatedQuantity).toBe(4);
    expect(progress().status).toBe('cancelled');
    expect(() =>
      applyCommand(
        db,
        pharmacist,
        command(doc, a, b, { expectedDeliveries: 1, expectedAdjustments: 2 }),
        later,
      ),
    ).toThrow('cancelada');
    validatePharmacy(db);
  });
  it('impede acesso de outra unidade, outra rede e outros perfis, preservando a leitura municipal da equipe de saúde', () => {
    const { db, adjust } = prepared(),
      cmd = adjust();
    const foreign = demoContext('aurora', 'aurora-vila', 'pharmacy'),
      cross = demoContext('horizonte', 'horizonte-centro', 'pharmacy'),
      reception = demoContext('aurora', 'aurora-centro', 'reception');
    for (const c of [foreign, cross, admin, doctor, reception])
      expect(() => applyCommand(db, c, cmd, now)).toThrow();
    applyCommand(db, pharmacist, cmd, now);
    for (const c of [foreign, cross, admin, reception])
      expect(readSnapshot(db, c).dispensationAdjustments).toEqual([]);
    expect(
      readSnapshot(db, demoContext('aurora', 'aurora-vila', 'clinical')).dispensationAdjustments,
    ).toHaveLength(1);
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical'))
        .dispensationAdjustments,
    ).toHaveLength(0);
    const entry = readSnapshot(db, admin).movements.at(-1)!;
    expect(entry.dispensationId).toBeUndefined();
    expect(entry.documentId).toBeUndefined();
    expect(entry.originalMovementId).toBeUndefined();
    expect(entry.reason).not.toContain(cmd.reason);
  });
  it('exige origem, quantidade, motivo e conferência válidos, permite repetição idêntica e recusa concorrência', () => {
    const { db, adjust } = prepared(),
      cmd = adjust();
    for (const patch of [
      { originalMovementId: 'ausente' },
      { dispensationId: 'ausente' },
      { quantity: 6 },
      { quantity: 0 },
      { quantity: -2 },
      { quantity: 0.01 },
      { confirmed: false },
      { reason: '   ' },
      { reason: 'a'.repeat(501) },
    ]) {
      const before = structuredClone(db);
      expect(() => applyCommand(db, pharmacist, { ...cmd, ...patch }, now)).toThrow();
      expect(db).toEqual(before);
    }
    const second = adjust(),
      id = applyCommand(db, pharmacist, cmd, now),
      saved = structuredClone(db);
    expect(applyCommand(db, pharmacist, cmd, now)).toBe(id);
    expect(() => applyCommand(db, pharmacist, { ...cmd, quantity: 1 }, now)).toThrow(
      'Identificação',
    );
    expect(() => applyCommand(db, pharmacist, second, now)).toThrow('outro ajuste');
    expect(db).toEqual(saved);
  });
  it('abre a base 14 com suas entregas, grava em transação, detecta edição por outra aba e conserva ambos os registros após recarregar', async () => {
    const { db, adjust, delivery } = prepared(),
      store = new MemoryStorage();
    const { dispensationAdjustments: unused, ...old } = db;
    expect(unused).toEqual([]);
    store.setItem(storageKey, JSON.stringify({ ...old, schemaVersion: 14 }));
    const repo = new DemoRepository(store, () => now),
      other = new DemoRepository(store, () => now),
      cmd = adjust();
    expect(repo.recoveryMessage).toBe('');
    await repo.execute(pharmacist, cmd);
    await expect(
      other.execute(pharmacist, { ...cmd, requestId: crypto.randomUUID() }),
    ).rejects.toThrow('mudaram');
    const loaded = new DemoRepository(store, () => now);
    expect(loaded.recoveryMessage).toBe('');
    expect(loaded.snapshot(pharmacist).dispensations).toEqual([delivery]);
    expect(loaded.snapshot(pharmacist).dispensationAdjustments).toHaveLength(1);
    store.setItem = () => {
      throw Error('Capacidade esgotada');
    };
    await expect(
      loaded.execute(pharmacist, {
        ...cmd,
        expectedAdjustments: 1,
        requestId: crypto.randomUUID(),
        kind: 'reversal',
      }),
    ).rejects.toThrow('salvar');
    expect(loaded.snapshot(pharmacist).dispensationAdjustments).toHaveLength(1);
  });
  it('rejeita base adulterada na origem, autoria, sequência, movimento, destino e totais', () => {
    const { db, a, adjust } = prepared();
    applyCommand(db, pharmacist, adjust({ kind: 'reversal' }), now);
    applyCommand(db, pharmacist, adjust(), now);
    for (const mutate of [
      (d: Database) => {
        d.dispensationAdjustments[0].authorId = admin.sessionId;
      },
      (d: Database) => {
        d.dispensationAdjustments[0].quantity = 6;
      },
      (d: Database) => {
        d.dispensationAdjustments[0].originalMovementId =
          d.dispensations[0].allocations[1].movementId;
      },
      (d: Database) => {
        d.dispensationAdjustments[0].destination = 'segregated';
      },
      (d: Database) => {
        d.dispensationAdjustments[1].sequence = 1;
      },
      (d: Database) => {
        d.movements.pop();
      },
      (d: Database) => {
        d.dispensationAdjustments.pop();
      },
      (d: Database) => {
        d.lots.find((l) => l.id === a)!.quantity += 1;
      },
      (d: Database) => {
        d.lots.find((l) => l.id === a)!.segregatedQuantity = 3;
      },
    ]) {
      const altered = structuredClone(db);
      mutate(altered);
      expect(() => validatePharmacy(altered)).toThrow();
    }
  });
});
