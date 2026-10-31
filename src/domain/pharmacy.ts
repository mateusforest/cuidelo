import type { ClinicalDocument, DocumentIdentity, MedicationLine } from './clinical-documents';
import type { Context, Database, Scoped, StockLot } from './model';
import { can } from './model';
import { demoIdentities, identityFor } from './access';
import { addDays, dateKey, validDay } from './dates';
import { DomainError } from './errors';

export interface MedicationStock {
  strength: string;
  form: string;
  quantityUnit: string;
}
export interface PharmacyPrescription extends Scoped {
  unitId: string;
  patientId: string;
  encounterId: string;
  version: number;
  status: 'issued' | 'cancelled';
  number: string;
  issuedAt: string;
  identity: DocumentIdentity;
  content: Extract<ClinicalDocument['content'], { kind: 'prescription' }>;
}
export interface Allocation {
  itemId: string;
  lotId: string;
  quantity: number;
}
export interface Dispensation extends Scoped {
  unitId: string;
  patientId: string;
  documentId: string;
  number: string;
  at: string;
  authorId: string;
  author: string;
  requestId: string;
  fingerprint: string;
  recipient: { kind: 'patient' | 'representative'; name: string };
  partialReason: string;
  notes: string;
  allocations: (Allocation & {
    movementId: string;
    product: string;
    lot: string;
    expiresAt: string;
    quantityUnit: string;
  })[];
  balances: {
    itemId: string;
    prescribed: number;
    before: number;
    delivered: number;
    remaining: number;
  }[];
}
export type AdjustmentKind = 'return' | 'reversal';
export interface DispensationAdjustment extends Scoped {
  unitId: string;
  dispensationId: string;
  documentId: string;
  itemId: string;
  lotId: string;
  originalMovementId: string;
  requestId: string;
  sequence: number;
  balanceBefore: number;
  balanceAfter: number;
  kind: AdjustmentKind;
  destination: 'stock' | 'segregated';
  quantity: number;
  reason: string;
  at: string;
  authorId: string;
  author: string;
}
export type PharmacyCommand =
  | {
      type: 'pharmacy.adjust';
      dispensationId: string;
      originalMovementId: string;
      kind: AdjustmentKind;
      quantity: number;
      reason: string;
      confirmed: boolean;
      expectedAdjustments: number;
      requestId: string;
    }
  | {
      type: 'stock.register';
      product: string;
      medication: MedicationStock;
      lot: string;
      expiresAt: string;
      quantity: number;
      minimum: number;
      reason: string;
    }
  | { type: 'stock.identify'; id: string; medication: MedicationStock; confirmed: boolean }
  | {
      type: 'pharmacy.dispense';
      documentId: string;
      expectedDocumentVersion: number;
      expectedDeliveries: number;
      expectedAdjustments?: number;
      requestId: string;
      allocations: Allocation[];
      recipient: { kind: 'patient' | 'representative'; name: string };
      identityConfirmed: boolean;
      itemsConfirmed: boolean;
      partialReason: string;
      notes: string;
    };

function ensure(value: unknown, message: string, code = 'validation'): asserts value {
  if (!value) throw new DomainError(message, code);
}
function bounded(v: unknown, label: string, max: number, required = false): string {
  ensure(typeof v === 'string' && v.length <= max, `${label}: limite de ${max} caracteres.`);
  ensure(!required || !!v.trim(), `Preencha ${label.toLocaleLowerCase('pt-BR')}.`);
  return v.trim();
}
const integer = (v: unknown, min = 1, max = 1000000): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const normalized = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ');
export function stockLotAttention(lot: StockLot, today: string) {
  const low = lot.quantity < lot.minimum;
  const expiring = lot.expiresAt <= addDays(today, 30);
  return { low, expiring, needsAttention: low || expiring || (lot.segregatedQuantity ?? 0) > 0 };
}
export function medicationKey(product: string, medication: MedicationStock) {
  return [product, medication.strength, medication.form, medication.quantityUnit]
    .map(normalized)
    .join('|');
}
export function matchesMedication(item: MedicationLine, lot: StockLot) {
  return (
    !!lot.medication &&
    medicationKey(item.medicine, item) === medicationKey(lot.product, lot.medication)
  );
}
export function allocationBalance(
  allocation: Dispensation['allocations'][number],
  adjustments: DispensationAdjustment[],
) {
  let returned = 0,
    reversed = 0;
  for (const a of adjustments) {
    if (a.originalMovementId !== allocation.movementId) continue;
    if (a.kind === 'return') returned += a.quantity;
    else reversed += a.quantity;
  }
  return { returned, reversed, remaining: allocation.quantity - returned - reversed };
}
export function prescriptionProgress(
  doc: PharmacyPrescription | ClinicalDocument,
  deliveries: Dispensation[],
  adjustments: DispensationAdjustment[] = [],
) {
  const history = deliveries.filter((d) => d.documentId === doc.id);
  const changes = adjustments.filter((a) => a.documentId === doc.id);
  const items =
    doc.content.kind === 'prescription'
      ? doc.content.items.map((item) => {
          const delivered = history.reduce(
            (total, d) =>
              total +
              d.allocations
                .filter((a) => a.itemId === item.id)
                .reduce((sum, a) => sum + a.quantity, 0),
            0,
          );
          const reversed = changes
            .filter((a) => a.itemId === item.id && a.kind === 'reversal')
            .reduce((n, a) => n + a.quantity, 0);
          const net = delivered - reversed;
          return { item, delivered: net, remaining: Number(item.quantity) - net };
        })
      : [];
  const status: 'cancelled' | 'complete' | 'partial' | 'waiting' =
    doc.status === 'cancelled'
      ? 'cancelled'
      : items.length && items.every((i) => i.remaining === 0)
        ? 'complete'
        : items.some((i) => i.delivered > 0)
          ? 'partial'
          : 'waiting';
  return { items, history, status, adjustmentCount: changes.length };
}
export function pharmacyPrescription(doc: ClinicalDocument): PharmacyPrescription {
  ensure(
    doc.content.kind === 'prescription' &&
      ['issued', 'cancelled'].includes(doc.status) &&
      doc.identity &&
      doc.number &&
      doc.issuedAt,
    'Receita emitida não encontrada.',
  );
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    unitId: doc.unitId,
    patientId: doc.patientId,
    encounterId: doc.encounterId,
    version: doc.version,
    status: doc.status as 'issued' | 'cancelled',
    number: doc.number,
    issuedAt: doc.issuedAt,
    identity: doc.identity,
    content: doc.content,
  };
}
function medication(raw: MedicationStock): MedicationStock {
  ensure(raw && typeof raw === 'object', 'Informe a apresentação do medicamento.');
  return {
    strength: bounded(raw.strength, 'Concentração', 100, true),
    form: bounded(raw.form, 'Apresentação', 100, true),
    quantityUnit: bounded(raw.quantityUnit, 'Unidade de entrega', 100, true),
  };
}

export function applyPharmacyCommand(
  db: Database,
  c: Context,
  cmd: PharmacyCommand,
  now: Date,
  newId: () => string,
) {
  const at = now.toISOString(),
    today = dateKey(now);
  ensure(can(c.role, 'stock'), 'Este perfil não movimenta o estoque.', 'permission');
  if (cmd.type === 'stock.register') {
    const product = bounded(cmd.product, 'Medicamento', 200, true),
      m = medication(cmd.medication),
      lot = bounded(cmd.lot, 'Lote', 100, true),
      reason = bounded(cmd.reason, 'Origem / referência', 2000, true);
    ensure(
      validDay(cmd.expiresAt) && cmd.expiresAt >= today,
      'Informe uma validade a partir de hoje.',
    );
    ensure(
      integer(cmd.quantity, 0) && integer(cmd.minimum, 0),
      'Informe saldo e mínimo inteiros entre 0 e 1000000.',
    );
    ensure(
      !db.lots.some(
        (l) =>
          l.organizationId === c.organizationId &&
          l.unitId === c.unitId &&
          normalized(l.product) === normalized(product) &&
          normalized(l.lot) === normalized(lot),
      ),
      'Este produto e lote já estão cadastrados. Use Entrada no lote existente.',
    );
    const id = newId();
    db.lots.push({
      id,
      organizationId: c.organizationId,
      unitId: c.unitId,
      product,
      presentation: `${m.strength} · ${m.form}`,
      medication: m,
      lot,
      expiresAt: cmd.expiresAt,
      quantity: cmd.quantity,
      minimum: cmd.minimum,
    });
    if (cmd.quantity)
      db.movements.push({
        id: newId(),
        organizationId: c.organizationId,
        unitId: c.unitId,
        lotId: id,
        quantity: cmd.quantity,
        kind: 'entry',
        reason,
        at,
      });
    return { entityId: id, action: 'Lote de medicamento cadastrado para dispensação' };
  }
  if (cmd.type === 'stock.identify') {
    const lot = db.lots.find(
      (l) => l.id === cmd.id && l.organizationId === c.organizationId && l.unitId === c.unitId,
    );
    ensure(lot, 'Lote não encontrado nesta unidade.', 'scope');
    ensure(!lot.medication, 'A identificação deste lote já está preservada.', 'immutable');
    ensure(cmd.confirmed === true, 'Confirme a apresentação e a unidade de contagem do estoque.');
    lot.medication = medication(cmd.medication);
    return { entityId: lot.id, action: 'Apresentação do lote conferida para dispensação' };
  }
  ensure(
    c.role === 'pharmacy',
    'A entrega vinculada à receita é registrada pelo perfil Farmácia.',
    'permission',
  );
  ensure(
    typeof cmd.requestId === 'string' && /^[\w-]{8,100}$/.test(cmd.requestId),
    'Identificação da entrega inválida. Reabra o formulário.',
  );
  if (cmd.type === 'pharmacy.adjust') return adjustDispensation(db, c, cmd, now, newId);
  ensure(
    Array.isArray(cmd.allocations) && cmd.allocations.length >= 1 && cmd.allocations.length <= 60,
    'Informe de 1 a 60 entregas por lote.',
  );
  const allocations = cmd.allocations.map((a) => {
    ensure(
      a && typeof a.itemId === 'string' && typeof a.lotId === 'string' && integer(a.quantity),
      'Informe o item, lote e uma quantidade inteira maior que zero.',
    );
    return { itemId: a.itemId, lotId: a.lotId, quantity: a.quantity };
  });
  ensure(
    new Set(allocations.map((a) => a.itemId + ':' + a.lotId)).size === allocations.length,
    'Um mesmo lote está repetido no mesmo item. Some as quantidades em uma única linha.',
  );
  ensure(
    cmd.recipient && ['patient', 'representative'].includes(cmd.recipient.kind),
    'Informe quem recebe a entrega.',
  );
  const recipient = {
      kind: cmd.recipient.kind,
      name: bounded(cmd.recipient.name, 'Nome de quem recebe', 200, true),
    },
    partialReason = bounded(cmd.partialReason, 'Motivo do saldo pendente', 2000),
    notes = bounded(cmd.notes, 'Observações', 2000);
  const fingerprint = JSON.stringify({
    documentId: cmd.documentId,
    expectedDocumentVersion: cmd.expectedDocumentVersion,
    expectedDeliveries: cmd.expectedDeliveries,
    ...(cmd.expectedAdjustments ? { expectedAdjustments: cmd.expectedAdjustments } : {}),
    allocations,
    recipient,
    partialReason,
    notes,
    identityConfirmed: cmd.identityConfirmed,
    itemsConfirmed: cmd.itemsConfirmed,
  });
  const prior = db.dispensations.find(
    (d) => d.organizationId === c.organizationId && d.requestId === cmd.requestId,
  );
  if (prior) {
    ensure(
      prior.unitId === c.unitId &&
        prior.authorId === c.sessionId &&
        prior.fingerprint === fingerprint,
      'Esta identificação já pertence a outra entrega. Reabra o formulário.',
      'conflict',
    );
    return { entityId: prior.id, action: 'Entrega já registrada', replayed: true };
  }
  const doc = db.clinicalDocuments.find(
    (d) =>
      d.id === cmd.documentId && d.organizationId === c.organizationId && d.unitId === c.unitId,
  );
  ensure(
    doc && doc.content.kind === 'prescription',
    'Receita não encontrada nesta unidade.',
    'scope',
  );
  ensure(
    doc.status === 'issued',
    'A receita está em rascunho ou foi cancelada. Entrega bloqueada.',
  );
  ensure(
    doc.version === cmd.expectedDocumentVersion,
    'A receita mudou. Reabra e confira a versão atual.',
    'conflict',
  );
  const progress = prescriptionProgress(doc, db.dispensations, db.dispensationAdjustments);
  ensure(
    progress.history.length === cmd.expectedDeliveries,
    'Outra entrega foi registrada. Reabra e confira o saldo atual.',
    'conflict',
  );
  ensure(
    progress.adjustmentCount === (cmd.expectedAdjustments ?? 0),
    'Um ajuste foi registrado. Reabra e confira o saldo da receita.',
    'conflict',
  );
  ensure(progress.status !== 'complete', 'Esta receita já foi entregue por completo.');
  ensure(
    cmd.identityConfirmed === true && cmd.itemsConfirmed === true,
    'Confirme a identificação de quem recebe e a conferência dos itens.',
  );
  if (recipient.kind === 'patient')
    ensure(
      recipient.name === (doc.identity!.socialName || doc.identity!.name),
      'Confira o nome da pessoa da receita.',
    );
  const byItem = new Map<string, number>(),
    byLot = new Map<string, number>();
  for (const a of allocations) {
    const item = doc.content.items.find((i) => i.id === a.itemId),
      lot = db.lots.find(
        (l) => l.id === a.lotId && l.organizationId === c.organizationId && l.unitId === c.unitId,
      );
    ensure(item, 'Item não encontrado nesta receita.');
    ensure(lot, 'Lote não encontrado nesta unidade.', 'scope');
    ensure(
      matchesMedication(item, lot),
      'Medicamento, concentração, apresentação e unidade de entrega precisam corresponder à receita. Não há substituição ou conversão automática.',
    );
    ensure(lot.expiresAt >= today, 'Lote vencido: entrega bloqueada.', 'expired');
    byItem.set(item.id, (byItem.get(item.id) ?? 0) + a.quantity);
    byLot.set(lot.id, (byLot.get(lot.id) ?? 0) + a.quantity);
  }
  for (const [id, quantity] of byLot)
    ensure(
      db.lots.find((l) => l.id === id)!.quantity >= quantity,
      'Saldo insuficiente no lote. Revise a quantidade ou escolha outro lote.',
      'stock',
    );
  const balances = progress.items.map(({ item, delivered, remaining }) => {
    const amount = byItem.get(item.id) ?? 0;
    ensure(amount <= remaining, `A entrega de ${item.medicine} supera o saldo da receita.`);
    return {
      itemId: item.id,
      prescribed: Number(item.quantity),
      before: delivered,
      delivered: amount,
      remaining: remaining - amount,
    };
  });
  ensure(
    !balances.some((b) => b.remaining > 0) || !!partialReason,
    'Informe o motivo do saldo pendente para registrar a entrega parcial.',
  );
  const id = newId(),
    number = `DEMO-ENT-${String(1 + db.dispensations.filter((d) => d.organizationId === c.organizationId).length).padStart(4, '0')}`;
  const record: Dispensation = {
    id,
    organizationId: c.organizationId,
    unitId: c.unitId,
    patientId: doc.patientId,
    documentId: doc.id,
    number,
    at,
    authorId: c.sessionId,
    author: identityFor(db, c).name,
    requestId: cmd.requestId,
    fingerprint,
    recipient,
    partialReason,
    notes,
    balances,
    allocations: allocations.map((a) => {
      const lot = db.lots.find((l) => l.id === a.lotId)!;
      return {
        ...a,
        movementId: newId(),
        product: lot.product,
        lot: lot.lot,
        expiresAt: lot.expiresAt,
        quantityUnit: lot.medication!.quantityUnit,
      };
    }),
  };
  for (const a of record.allocations) {
    db.lots.find((l) => l.id === a.lotId)!.quantity -= a.quantity;
    db.movements.push({
      id: a.movementId,
      organizationId: c.organizationId,
      unitId: c.unitId,
      lotId: a.lotId,
      quantity: a.quantity,
      kind: 'exit',
      reason: `Entrega vinculada à receita ${doc.number}`,
      at,
      dispensationId: id,
      documentId: doc.id,
      itemId: a.itemId,
    });
  }
  db.dispensations.push(record);
  return {
    entityId: id,
    action: balances.every((b) => b.remaining === 0)
      ? 'Entrega concluída e estoque baixado por lote'
      : 'Entrega parcial registrada e estoque baixado por lote',
  };
}

function adjustDispensation(
  db: Database,
  c: Context,
  cmd: Extract<PharmacyCommand, { type: 'pharmacy.adjust' }>,
  now: Date,
  newId: () => string,
) {
  ensure(cmd.kind === 'return' || cmd.kind === 'reversal', 'Tipo de ajuste inválido.');
  ensure(integer(cmd.quantity), 'Informe uma quantidade inteira maior que zero.');
  ensure(
    Number.isSafeInteger(cmd.expectedAdjustments) && cmd.expectedAdjustments >= 0,
    'Reabra a conferência da entrega.',
  );
  ensure(cmd.confirmed === true, 'Confirme a conferência física do lote.');
  const reason = bounded(cmd.reason, 'Motivo do ajuste', 500, true);
  const delivery = db.dispensations.find(
    (d) =>
      d.id === cmd.dispensationId && d.organizationId === c.organizationId && d.unitId === c.unitId,
  );
  ensure(delivery, 'Entrega original não encontrada nesta unidade.', 'scope');
  const original = delivery.allocations.find((a) => a.movementId === cmd.originalMovementId);
  ensure(original, 'A saída selecionada não pertence à entrega original.');
  const prior = db.dispensationAdjustments.find(
    (a) => a.organizationId === c.organizationId && a.requestId === cmd.requestId,
  );
  if (prior) {
    ensure(
      prior.dispensationId === delivery.id &&
        prior.authorId === c.sessionId &&
        prior.originalMovementId === original.movementId &&
        prior.quantity === cmd.quantity &&
        prior.kind === cmd.kind &&
        prior.reason === reason &&
        prior.sequence === cmd.expectedAdjustments + 1,
      'Identificação já utilizada em outro ajuste. Reabra a conferência.',
      'conflict',
    );
    return { entityId: prior.id, action: 'Ajuste já registrado', replayed: true };
  }
  const history = db.dispensationAdjustments.filter((a) => a.dispensationId === delivery.id);
  ensure(
    history.length === cmd.expectedAdjustments,
    'A entrega recebeu outro ajuste. Reabra e confira as quantidades.',
    'conflict',
  );
  ensure(
    cmd.quantity <= allocationBalance(original, history).remaining,
    'A quantidade supera o saldo ajustável da saída original.',
  );
  const at = now.toISOString();
  ensure(
    at >= (history.at(-1)?.at ?? delivery.at),
    'A data do ajuste não pode anteceder o registro anterior.',
  );
  const lot = db.lots.find(
    (l) =>
      l.id === original.lotId && l.organizationId === c.organizationId && l.unitId === c.unitId,
  );
  ensure(lot, 'Lote original não encontrado nesta unidade.', 'scope');
  const destination =
    cmd.kind === 'return' || lot.expiresAt < dateKey(now) ? 'segregated' : 'stock';
  const balanceBefore = destination === 'stock' ? lot.quantity : (lot.segregatedQuantity ?? 0);
  const balance = balanceBefore + cmd.quantity;
  ensure(Number.isSafeInteger(balance), 'Quantidade acima do limite permitido.');
  const id = newId();
  const record: DispensationAdjustment = {
    id,
    organizationId: c.organizationId,
    unitId: c.unitId,
    dispensationId: delivery.id,
    documentId: delivery.documentId,
    itemId: original.itemId,
    lotId: lot.id,
    originalMovementId: original.movementId,
    requestId: cmd.requestId,
    sequence: history.length + 1,
    balanceBefore,
    balanceAfter: balance,
    kind: cmd.kind,
    destination,
    quantity: cmd.quantity,
    reason,
    at,
    authorId: c.sessionId,
    author: identityFor(db, c).name,
  };
  if (destination === 'stock') lot.quantity = balance;
  else lot.segregatedQuantity = balance;
  db.dispensationAdjustments.push(record);
  db.movements.push({
    id,
    organizationId: c.organizationId,
    unitId: c.unitId,
    kind: 'entry',
    adjustmentKind: cmd.kind,
    destination,
    quantity: cmd.quantity,
    lotId: lot.id,
    at,
    dispensationId: delivery.id,
    documentId: delivery.documentId,
    itemId: original.itemId,
    originalMovementId: original.movementId,
    reason:
      (cmd.kind === 'return' ? 'Devolução da entrega ' : 'Estorno da entrega ') + delivery.number,
  });
  return {
    entityId: id,
    action:
      cmd.kind === 'return'
        ? 'Devolução registrada em estoque segregado'
        : 'Estorno da saída por lote registrado',
  };
}

function validateAdjustments(
  db: Database,
  positions: Map<string, number>,
  linkedMovements: Set<string>,
) {
  const deliveries = new Map(db.dispensations.map((d) => [d.id, d]));
  const lots = new Map(db.lots.map((l) => [l.id, l]));
  const actors = new Map(demoIdentities(db).map((a) => [a.sessionId, a]));
  const adjusted = new Map<string, number>(),
    segregated = new Map<string, number>();
  const priorByDelivery = new Map<string, DispensationAdjustment>(),
    requests = new Set<string>();
  const reversals = new Map<string, { position: number; quantity: number }[]>();
  const stockBalances = new Map<string, number>(),
    byMovement = new Map<string, DispensationAdjustment>();
  for (const a of db.dispensationAdjustments) {
    const delivery = deliveries.get(a.dispensationId),
      lot = lots.get(a.lotId);
    ensure(
      delivery &&
        lot &&
        delivery.documentId === a.documentId &&
        delivery.unitId === a.unitId &&
        delivery.organizationId === a.organizationId &&
        lot.unitId === a.unitId &&
        lot.organizationId === a.organizationId,
      'Invalid adjustment scope',
    );
    const original = delivery.allocations.find((x) => x.movementId === a.originalMovementId);
    ensure(
      original && original.itemId === a.itemId && original.lotId === a.lotId,
      'Invalid adjustment allocation',
    );
    const actor = actors.get(a.authorId),
      prior = priorByDelivery.get(delivery.id);
    ensure(
      actor &&
        actor.name === a.author &&
        actor.role === 'pharmacy' &&
        actor.unitId === a.unitId &&
        actor.organizationId === a.organizationId,
      'Invalid adjustment actor',
    );
    ensure(
      a.sequence === (prior?.sequence ?? 0) + 1 &&
        typeof a.at === 'string' &&
        Number.isFinite(Date.parse(a.at)) &&
        a.at >= (prior?.at ?? delivery.at),
      'Invalid adjustment sequence',
    );
    const request = a.organizationId + ':' + a.requestId;
    ensure(
      typeof a.requestId === 'string' &&
        /^[\w-]{8,100}$/.test(a.requestId) &&
        !requests.has(request),
      'Invalid adjustment request',
    );
    bounded(a.reason, 'Motivo do ajuste', 500, true);
    ensure(
      (a.kind === 'return' || a.kind === 'reversal') && integer(a.quantity),
      'Invalid adjustment kind or quantity',
    );
    const destination =
      a.kind === 'return' || lot.expiresAt < dateKey(new Date(a.at)) ? 'segregated' : 'stock';
    ensure(a.destination === destination, 'Invalid adjustment destination');
    ensure(
      Number.isSafeInteger(a.balanceBefore) &&
        a.balanceBefore >= 0 &&
        Number.isSafeInteger(a.balanceAfter) &&
        a.balanceAfter === a.balanceBefore + a.quantity,
      'Invalid adjustment balance',
    );
    const total = (adjusted.get(original.movementId) ?? 0) + a.quantity;
    ensure(total <= original.quantity, 'Adjustment exceeds original allocation');
    const position = positions.get(a.id),
      initialPosition = positions.get(original.movementId);
    ensure(
      position !== undefined &&
        initialPosition !== undefined &&
        initialPosition < position &&
        !linkedMovements.has(a.id),
      'Missing adjustment movement',
    );
    const m = db.movements[position];
    ensure(
      m.kind === 'entry' &&
        m.adjustmentKind === a.kind &&
        m.destination === destination &&
        m.originalMovementId === original.movementId &&
        m.dispensationId === delivery.id &&
        m.documentId === delivery.documentId &&
        m.itemId === a.itemId &&
        m.lotId === lot.id &&
        m.organizationId === a.organizationId &&
        m.unitId === a.unitId &&
        m.quantity === a.quantity &&
        m.at === a.at,
      'Invalid adjustment movement',
    );
    priorByDelivery.set(delivery.id, a);
    requests.add(request);
    linkedMovements.add(a.id);
    adjusted.set(original.movementId, total);
    if (destination === 'segregated') {
      ensure(
        a.balanceBefore === (segregated.get(lot.id) ?? 0),
        'Invalid segregated movement balance',
      );
      segregated.set(lot.id, a.balanceAfter);
    } else {
      stockBalances.set(lot.id, lot.quantity);
      byMovement.set(a.id, a);
    }
    if (a.kind === 'reversal') {
      const key = a.documentId + ':' + a.itemId;
      if (!reversals.has(key)) reversals.set(key, []);
      reversals.get(key)!.push({ position, quantity: a.quantity });
    }
  }
  for (const lot of db.lots)
    ensure(
      (lot.segregatedQuantity === undefined || Number.isSafeInteger(lot.segregatedQuantity)) &&
        (lot.segregatedQuantity ?? 0) === (segregated.get(lot.id) ?? 0),
      'Invalid segregated balance',
    );
  // Os lotes antigos podem ter saldo inicial sem uma entrada. Reconcilia a partir do saldo atual.
  for (let i = db.movements.length - 1; i >= 0 && stockBalances.size; i--) {
    const m = db.movements[i],
      balance = stockBalances.get(m.lotId);
    if (balance === undefined || m.destination === 'segregated') continue;
    const entry = byMovement.get(m.id);
    if (entry) ensure(entry.balanceAfter === balance, 'Reversal does not reconcile with stock');
    stockBalances.set(m.lotId, balance + (m.kind === 'exit' ? m.quantity : -m.quantity));
  }
  return reversals;
}

export function validatePharmacy(db: Database) {
  const identities = demoIdentities(db),
    requests = new Set<string>(),
    numbers = new Set<string>(),
    movementIds = new Set<string>(),
    delivered = new Map<string, number>();
  const movementPositions = new Map(db.movements.map((m, index) => [m.id, index]));
  const reversals = validateAdjustments(db, movementPositions, movementIds);
  for (const lot of db.lots) if (lot.medication) medication(lot.medication);
  for (const d of db.dispensations) {
    const doc = db.clinicalDocuments.find(
      (x) =>
        x.id === d.documentId &&
        x.organizationId === d.organizationId &&
        x.unitId === d.unitId &&
        x.patientId === d.patientId,
    );
    ensure(
      doc && doc.content.kind === 'prescription' && ['issued', 'cancelled'].includes(doc.status),
      'Invalid dispensation prescription',
    );
    ensure(
      typeof d.at === 'string' &&
        Number.isFinite(Date.parse(d.at)) &&
        d.at >= doc.issuedAt! &&
        identities.some(
          (i) =>
            i.sessionId === d.authorId &&
            i.role === 'pharmacy' &&
            i.organizationId === d.organizationId &&
            i.unitId === d.unitId,
        ),
      'Invalid dispensation actor or date',
    );
    const cancellation = doc.history.find((h) => h.action === 'cancelled');
    ensure(!cancellation || d.at <= cancellation.at, 'Dispensation after cancellation');
    ensure(
      typeof d.author === 'string' &&
        !!d.author &&
        typeof d.requestId === 'string' &&
        /^[\w-]{8,100}$/.test(d.requestId) &&
        typeof d.fingerprint === 'string',
      'Invalid dispensation identity',
    );
    ensure(
      /^DEMO-ENT-\d{4,}$/.test(d.number) &&
        !numbers.has(d.organizationId + ':' + d.number) &&
        !requests.has(d.organizationId + ':' + d.requestId),
      'Duplicate dispensation',
    );
    numbers.add(d.organizationId + ':' + d.number);
    requests.add(d.organizationId + ':' + d.requestId);
    ensure(
      d.recipient && ['patient', 'representative'].includes(d.recipient.kind),
      'Invalid recipient',
    );
    bounded(d.recipient.name, 'Destinatário', 200, true);
    bounded(d.partialReason, 'Motivo', 2000);
    bounded(d.notes, 'Observações', 2000);
    ensure(
      Array.isArray(d.allocations) &&
        d.allocations.length > 0 &&
        d.allocations.length <= 60 &&
        Array.isArray(d.balances) &&
        d.balances.length === doc.content.items.length,
      'Invalid dispensation allocations',
    );
    const pairs = new Set<string>(),
      amounts = new Map<string, number>();
    for (const a of d.allocations) {
      const item = doc.content.items.find((i) => i.id === a.itemId),
        lot = db.lots.find(
          (l) => l.id === a.lotId && l.organizationId === d.organizationId && l.unitId === d.unitId,
        );
      ensure(
        item &&
          lot &&
          matchesMedication(item, lot) &&
          integer(a.quantity) &&
          a.product === lot.product &&
          a.lot === lot.lot &&
          a.expiresAt === lot.expiresAt &&
          a.expiresAt >= dateKey(new Date(d.at)) &&
          a.quantityUnit === lot.medication!.quantityUnit,
        'Invalid dispensation item',
      );
      ensure(
        !pairs.has(a.itemId + ':' + a.lotId) && !movementIds.has(a.movementId),
        'Duplicate allocation or movement',
      );
      pairs.add(a.itemId + ':' + a.lotId);
      movementIds.add(a.movementId);
      ensure(
        db.movements.some(
          (m) =>
            m.id === a.movementId &&
            m.dispensationId === d.id &&
            m.documentId === d.documentId &&
            m.itemId === a.itemId &&
            m.lotId === a.lotId &&
            m.organizationId === d.organizationId &&
            m.unitId === d.unitId &&
            m.kind === 'exit' &&
            !m.originalMovementId &&
            !m.adjustmentKind &&
            !m.destination &&
            m.quantity === a.quantity &&
            m.at === d.at,
        ),
        'Missing linked stock movement',
      );
      amounts.set(a.itemId, (amounts.get(a.itemId) ?? 0) + a.quantity);
    }
    ensure(
      new Set(d.balances.map((b) => b.itemId)).size === d.balances.length,
      'Duplicate dispensation balance',
    );
    // A ordem no extrato distingue operações registradas no mesmo instante.
    const firstPosition = movementPositions.get(d.allocations[0].movementId)!;
    for (const item of doc.content.items) {
      const key = d.documentId + ':' + item.id,
        gross = delivered.get(key) ?? 0,
        reversedBefore = (reversals.get(key) ?? []).reduce(
          (n, r) => (r.position < firstPosition ? n + r.quantity : n),
          0,
        ),
        previous = gross - reversedBefore,
        amount = amounts.get(item.id) ?? 0,
        remaining = Number(item.quantity) - previous - amount,
        b = d.balances.find((b) => b.itemId === item.id);
      ensure(
        previous >= 0 &&
          remaining >= 0 &&
          b &&
          b.prescribed === Number(item.quantity) &&
          b.before === previous &&
          b.delivered === amount &&
          b.remaining === remaining,
        'Invalid prescription balance',
      );
      delivered.set(key, gross + amount);
    }
    ensure(
      !d.balances.some((b) => b.remaining > 0) || !!d.partialReason.trim(),
      'Missing partial delivery reason',
    );
  }
  for (const m of db.movements)
    if (
      m.dispensationId ||
      m.documentId ||
      m.itemId ||
      m.originalMovementId ||
      m.adjustmentKind ||
      m.destination
    )
      ensure(movementIds.has(m.id), 'Orphan dispensation movement');
}
