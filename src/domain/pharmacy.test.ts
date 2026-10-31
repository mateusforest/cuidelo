import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import {
  matchesMedication,
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
    expect(JSON.parse(store.getItem(storageKey)!).schemaVersion).toBe(10);
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
