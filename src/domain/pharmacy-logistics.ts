import { channelShipment, networkEvents, validateChannels } from './shared-shipments';
import { dateKey } from './dates';
import { DomainError } from './errors';
import { demoIdentities, identityFor } from './access';
import { can, type Context, type Database, type Scoped, type StockLot } from './model';
import { medicationKey } from './pharmacy';
import { normalizedName } from './identification';

interface LogisticsHeader extends Scoped {
  unitId: string;
  lotId: string;
  product: string;
  presentation: string;
  lot: string;
  expiresAt: string;
  quantityUnit: string;
  at: string;
  author: string;
  authorId: string;
  reason: string;
  reference: string;
  requestId: string;
  before: number;
  after: number;
  previousMovementId: string | null;
}
type StockDisposal = LogisticsHeader & { kind: 'disposal'; quantity: number; destination: string };
type StockInventory = LogisticsHeader & {
  kind: 'inventory';
  countedStock: number;
  countedSegregated: number;
  segregatedBefore: number;
  reconciled: boolean;
};
type StoredShipment = LogisticsHeader & { kind: 'shipment'; quantity: number; toUnitId: string };
type StockReceipt = LogisticsHeader & {
  kind: 'receipt';
  quantity: number;
  fromUnitId: string;
  shipmentId: string;
  destination: 'stock' | 'segregated';
  confirmedAt?: string;
};
export type StoredStockLogisticsEvent =
  StockDisposal | StockInventory | StoredShipment | StockReceipt;
type LocalBalances = 'before' | 'after' | 'previousMovementId' | 'requestId';
type TransferView<T extends LogisticsHeader> = Omit<T, LocalBalances> &
  Partial<Pick<T, LocalBalances>>;
export type StockShipment = TransferView<StoredShipment>;
export type StockLogisticsEvent =
  StockDisposal | StockInventory | StockShipment | TransferView<StockReceipt>;
type Request = { requestId: string; reference: string };
type LotRequest = Request & { lotId: string; reason: string };
export type StockLogisticsCommand =
  | (LotRequest & {
      type: 'stock.dispose';
      quantity: number;
      expectedSegregated: number;
      destination: string;
    })
  | (LotRequest & {
      type: 'stock.inventory';
      countedStock: number;
      countedSegregated: number;
      expectedStock: number;
      expectedSegregated: number;
    })
  | (LotRequest & { type: 'stock.ship'; quantity: number; toUnitId: string; expectedStock: number })
  | (Request & {
      type: 'stock.receive';
      shipmentId: string;
      quantity?: number;
      expectedReceived?: number;
    });

function ensure(condition: unknown, message: string, code = 'validation'): asserts condition {
  if (!condition) throw new DomainError(message, code);
}
function field(value: unknown, label: string, max: number) {
  ensure(
    typeof value === 'string' && value.trim() && value.length <= max,
    'Informe ' + label + ' (até ' + max + ' caracteres).',
  );
  return value.trim();
}
const amount = (v: unknown, min = 0) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const authorized = (c: Context) => c.unitId !== 'all' && can(c.role, 'stock');
export function visibleStockLogistics(db: Database, c: Context): StockLogisticsEvent[] {
  if (!authorized(c)) return [];
  return networkEvents(db)
    .filter(
      (e) =>
        e.organizationId === c.organizationId &&
        (e.unitId === c.unitId ||
          (e.kind === 'shipment' && e.toUnitId === c.unitId) ||
          (e.kind === 'receipt' && e.fromUnitId === c.unitId)),
    )
    .map((e) => {
      if (e.unitId === c.unitId || (e.kind !== 'shipment' && e.kind !== 'receipt')) return e;
      const {
        before: _before,
        after: _after,
        previousMovementId: _previous,
        requestId: _request,
        ...shared
      } = e;
      return shared;
    });
}
export function pendingStockTransfers(events: StockLogisticsEvent[]): StockShipment[] {
  const received = new Map<string, number>();
  for (const e of events)
    if (e.kind === 'receipt')
      received.set(e.shipmentId, (received.get(e.shipmentId) ?? 0) + e.quantity);
  return events.filter(
    (e): e is StockShipment => e.kind === 'shipment' && (received.get(e.id) ?? 0) < e.quantity,
  );
}
export function incomingTransfersForLot(
  events: StockLogisticsEvent[],
  lot: StockLot,
): StockShipment[] {
  return pendingStockTransfers(events).filter(
    (s) => s.organizationId === lot.organizationId && s.toUnitId === lot.unitId && sameCode(s, lot),
  );
}

type LotIdentity = Pick<StockLot, 'product' | 'medication' | 'lot' | 'expiresAt'>;
function sameCode(
  a: Pick<LotIdentity, 'product' | 'lot'>,
  b: Pick<LotIdentity, 'product' | 'lot'>,
) {
  return (
    normalizedName(a.lot) === normalizedName(b.lot) &&
    normalizedName(a.product) === normalizedName(b.product)
  );
}
function compatible(a: LotIdentity, b: LotIdentity) {
  return (
    !!a.medication &&
    !!b.medication &&
    a.expiresAt === b.expiresAt &&
    medicationKey(a.product, a.medication) === medicationKey(b.product, b.medication)
  );
}
// Em trânsito, a mesma identificação de produto e lote precisa continuar recebível no destino.
export function checkIncomingIdentity(
  db: Database,
  org: string,
  unit: string,
  identity: LotIdentity,
) {
  for (const transfer of pendingStockTransfers(networkEvents(db))) {
    if (transfer.organizationId !== org || transfer.toUnitId !== unit) continue;
    const source =
      db.transferChannels.find((ch) => ch.id === transfer.id)?.manifest ??
      db.lots.find((l) => l.id === transfer.lotId);
    if (source && sameCode(source, identity))
      ensure(
        compatible(source, identity),
        'Uma remessa em trânsito utiliza este lote com outra apresentação ou validade.',
        'conflict',
      );
  }
}
export function receivingLot(db: Database, org: string, unit: string, source: LotIdentity) {
  const targets = db.lots.filter(
    (l) => l.organizationId === org && l.unitId === unit && sameCode(l, source),
  );
  ensure(
    targets.length <= 1 && (!targets.length || compatible(targets[0], source)),
    'O lote no destino tem identificação, apresentação ou validade incompatível. Confira os cadastros.',
    'conflict',
  );
  return targets[0];
}

export function previousLogisticsRequest(db: Database, c: Context, cmd: StockLogisticsCommand) {
  ensure(authorized(c), 'Este perfil não registra logística de estoque na unidade.', 'permission');
  identityFor(db, c);
  ensure(
    typeof cmd.requestId === 'string' && /^[\w-]{8,100}$/.test(cmd.requestId),
    'Identificação da operação inválida.',
  );
  const prior = db.stockLogistics.find(
    (e) => e.organizationId === c.organizationId && e.requestId === cmd.requestId,
  );
  if (!prior) return;
  const same =
    prior.unitId === c.unitId &&
    prior.authorId === c.sessionId &&
    prior.reference === field(cmd.reference, 'a referência', 200) &&
    (cmd.type === 'stock.receive' ||
      (cmd.lotId === prior.lotId && prior.reason === field(cmd.reason, 'o motivo', 500)));
  let details = false;
  switch (cmd.type) {
    case 'stock.receive':
      details =
        prior.kind === 'receipt' &&
        prior.shipmentId === cmd.shipmentId &&
        (cmd.quantity === undefined || prior.quantity === cmd.quantity);
      break;
    case 'stock.dispose':
      details =
        prior.kind === 'disposal' &&
        prior.quantity === cmd.quantity &&
        prior.before === cmd.expectedSegregated &&
        prior.destination === field(cmd.destination, 'o destino do material', 200);
      break;
    case 'stock.ship':
      details =
        prior.kind === 'shipment' &&
        prior.quantity === cmd.quantity &&
        prior.before === cmd.expectedStock &&
        prior.toUnitId === cmd.toUnitId;
      break;
    case 'stock.inventory':
      details =
        prior.kind === 'inventory' &&
        prior.before === cmd.expectedStock &&
        prior.segregatedBefore === cmd.expectedSegregated &&
        prior.countedStock === cmd.countedStock &&
        prior.countedSegregated === cmd.countedSegregated;
      break;
  }
  ensure(
    same && details,
    'Esta identificação já foi usada em outra operação de estoque.',
    'conflict',
  );
  return prior;
}
const actions = {
  disposal: 'Destinação do material segregado registrada',
  shipment: 'Remessa de estoque expedida',
  receipt: 'Recebimento da remessa confirmado',
  inventory: 'Contagem física de estoque registrada',
};
export function applyStockLogistics(
  db: Database,
  c: Context,
  cmd: StockLogisticsCommand,
  now: Date,
  newId: () => string,
) {
  const prior = previousLogisticsRequest(db, c, cmd);
  if (prior) return { entityId: prior.id, action: actions[prior.kind], replayed: true };
  const author = identityFor(db, c).name,
    at = now.toISOString(),
    today = dateKey(now);
  const reference = field(cmd.reference, 'a referência', 200);
  const reason =
    cmd.type === 'stock.receive'
      ? 'Recebimento conferido no destino'
      : field(cmd.reason, 'o motivo', 500);
  const header = (lot: StockLot): Omit<LogisticsHeader, 'before' | 'after'> => {
    const previous = db.movements.filter((m) => m.lotId === lot.id).at(-1);
    ensure(
      !previous || at >= previous.at,
      'A data da operação antecede a última movimentação deste lote.',
    );
    return {
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      lotId: lot.id,
      product: lot.product,
      presentation: lot.presentation,
      lot: lot.lot,
      expiresAt: lot.expiresAt,
      quantityUnit: lot.medication?.quantityUnit ?? 'unidade de estoque',
      at,
      author,
      authorId: c.sessionId,
      reason,
      reference,
      requestId: cmd.requestId,
      previousMovementId: previous?.id ?? null,
    };
  };
  let lot: StockLot, event: StoredStockLogisticsEvent;
  let newLot = false;
  if (cmd.type === 'stock.receive') {
    const ch = db.transferChannels.find((t) => t.id === cmd.shipmentId);
    const shipment =
      db.stockLogistics.find(
        (e): e is StoredShipment => e.kind === 'shipment' && e.id === cmd.shipmentId,
      ) ??
      (ch && channelShipment(db, ch));
    ensure(
      shipment && shipment.organizationId === c.organizationId && shipment.toUnitId === c.unitId,
      'Remessa não encontrada para recebimento nesta unidade.',
      'scope',
    );
    const received = db.stockLogistics
      .filter((e): e is StockReceipt => e.kind === 'receipt' && e.shipmentId === shipment.id)
      .reduce((sum, e) => sum + e.quantity, 0);
    const remaining = shipment.quantity - received;
    ensure(remaining > 0, 'Esta remessa já foi recebida.', 'conflict');
    const quantity = cmd.quantity ?? remaining;
    ensure(
      amount(quantity, 1) && quantity <= remaining,
      'A quantidade deve estar entre 1 e o saldo em trânsito.',
      'conflict',
    );
    ensure(
      cmd.expectedReceived === undefined || cmd.expectedReceived === received,
      'O saldo em trânsito mudou. Reabra o recebimento.',
      'conflict',
    );
    if (ch) {
      const r = ch.receipts.find((r) => r.requestId === cmd.requestId);
      ensure(
        ch.receiverKey &&
          r &&
          r.quantity === quantity &&
          r.reference === reference &&
          r.role === c.role,
        'Confira esta remessa no canal conectado da UBS.',
        'permission',
      );
    }
    ensure(at >= shipment.at, 'O recebimento não pode anteceder a expedição.');
    const origin =
      ch?.manifest ??
      db.lots.find(
        (l) =>
          l.id === shipment.lotId &&
          l.unitId === shipment.unitId &&
          l.organizationId === c.organizationId,
      );
    ensure(origin?.medication, 'Identificação do lote de origem indisponível.', 'scope');
    const existing = receivingLot(db, c.organizationId, c.unitId, origin);
    newLot = !existing;
    lot = existing ?? {
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      product: origin.product,
      presentation: origin.presentation,
      medication: { ...origin.medication },
      lot: origin.lot,
      expiresAt: origin.expiresAt,
      minimum: 0,
      quantity: 0,
    };
    const confirmation = ch?.receipts.find((r) => r.requestId === cmd.requestId);
    const destination =
      lot.expiresAt < (confirmation ? dateKey(new Date(confirmation.at)) : today)
        ? 'segregated'
        : 'stock';
    const before = destination === 'stock' ? lot.quantity : (lot.segregatedQuantity ?? 0);
    ensure(amount(before + quantity), 'O saldo do lote excede o limite permitido.');
    event = {
      ...header(lot),
      kind: 'receipt',
      before,
      after: before + quantity,
      quantity,
      ...(confirmation ? { confirmedAt: confirmation.at } : {}),
      fromUnitId: shipment.unitId,
      shipmentId: shipment.id,
      destination,
    };
  } else {
    const source = db.lots.find(
      (l) => l.id === cmd.lotId && l.organizationId === c.organizationId && l.unitId === c.unitId,
    );
    ensure(source, 'Lote não encontrado nesta unidade.', 'scope');
    lot = source;
    const segregated = lot.segregatedQuantity ?? 0;
    if (cmd.type === 'stock.dispose') {
      ensure(
        cmd.expectedSegregated === segregated,
        'O saldo segregado mudou. Reabra a conferência.',
        'conflict',
      );
      ensure(
        amount(cmd.quantity, 1) && cmd.quantity <= segregated,
        'Quantidade inválida ou superior ao saldo segregado.',
      );
      event = {
        ...header(lot),
        kind: 'disposal',
        before: segregated,
        after: segregated - cmd.quantity,
        quantity: cmd.quantity,
        destination: field(cmd.destination, 'o destino do material', 200),
      };
    } else if (cmd.type === 'stock.inventory') {
      ensure(
        cmd.expectedStock === lot.quantity && cmd.expectedSegregated === segregated,
        'Os saldos mudaram. Reabra a contagem.',
        'conflict',
      );
      ensure(
        amount(cmd.countedStock) && amount(cmd.countedSegregated),
        'Informe contagens físicas inteiras, iguais ou maiores que zero.',
      );
      const reconciled = cmd.countedSegregated === segregated;
      if (reconciled && cmd.countedStock > lot.quantity)
        ensure(
          !incomingTransfersForLot(networkEvents(db), lot).length,
          'Há remessa pendente para este lote. Confira o recebimento antes de aumentar o disponível pelo inventário.',
          'conflict',
        );
      event = {
        ...header(lot),
        kind: 'inventory',
        before: lot.quantity,
        after: reconciled ? cmd.countedStock : lot.quantity,
        segregatedBefore: segregated,
        countedStock: cmd.countedStock,
        countedSegregated: cmd.countedSegregated,
        reconciled,
      };
    } else {
      ensure(
        cmd.expectedStock === lot.quantity,
        'O saldo disponível mudou. Reabra a expedição.',
        'conflict',
      );
      ensure(
        amount(cmd.quantity, 1) && cmd.quantity <= lot.quantity,
        'Quantidade inválida ou superior ao saldo disponível.',
      );
      ensure(lot.expiresAt >= today, 'Lote vencido não pode ser expedido.');
      ensure(
        lot.medication,
        'Identifique a apresentação e a unidade de entrega do lote antes da expedição.',
      );
      ensure(
        cmd.toUnitId !== c.unitId &&
          db.units.some((u) => u.id === cmd.toUnitId && u.organizationId === c.organizationId),
        'Selecione outra unidade desta prefeitura.',
        'scope',
      );
      receivingLot(db, c.organizationId, cmd.toUnitId, lot);
      checkIncomingIdentity(db, c.organizationId, cmd.toUnitId, lot);
      event = {
        ...header(lot),
        kind: 'shipment',
        before: lot.quantity,
        after: lot.quantity - cmd.quantity,
        quantity: cmd.quantity,
        toUnitId: cmd.toUnitId,
      };
    }
  }
  const segregated =
    event.kind === 'disposal' || (event.kind === 'receipt' && event.destination === 'segregated');
  if (newLot) db.lots.push(lot);
  if (segregated) lot.segregatedQuantity = event.after;
  else lot.quantity = event.after;
  db.stockLogistics.push(event);
  if (event.before !== event.after) {
    db.movements.push({
      id: event.id,
      organizationId: c.organizationId,
      unitId: c.unitId,
      lotId: lot.id,
      at,
      logisticsKind: event.kind,
      destination: segregated ? 'segregated' : 'stock',
      kind: event.after > event.before ? 'entry' : 'exit',
      quantity: Math.abs(event.after - event.before),
      reason: actions[event.kind] + ' · ' + reference,
    });
  }
  return { entityId: event.id, action: actions[event.kind], replayed: false };
}

export function validateStockLogistics(db: Database) {
  validateChannels(db);
  const receivedByShipment = new Map<string, number>();
  // Bases antigas podem ter saldo de abertura sem um lançamento inicial. A reconstituição
  // parte do saldo atual e distingue os dois compartimentos em cada linha do extrato.
  const lots = new Map(db.lots.map((l) => [l.id, l]));
  const balances = new Map(
    db.lots.map((l) => [l.id, { stock: l.quantity, segregated: l.segregatedQuantity ?? 0 }]),
  );
  const positions = new Map(db.movements.map((m, i) => [m.id, i]));
  const after = new Map<string, { stock: number; segregated: number }>();
  const logisticsMoves = new Set<string>();
  const adjustmentLines = new Map(db.dispensationAdjustments.map((a) => [a.id, a]));
  const participants = new Set(db.stockLogistics.map((e) => e.lotId));
  for (let i = db.movements.length - 1; i >= 0; i--) {
    const m = db.movements[i],
      balance = balances.get(m.lotId);
    if (!balance) {
      ensure(!m.logisticsKind, 'Movimento logístico vinculado a lote inexistente.');
      continue;
    }
    after.set(m.id, { ...balance });
    const bucket = m.destination === 'segregated' ? 'segregated' : 'stock';
    if (m.logisticsKind) logisticsMoves.add(m.id);
    const adjustment = adjustmentLines.get(m.id);
    if (adjustment)
      ensure(
        adjustment.balanceAfter === balance[bucket],
        'O ajuste não confere com o saldo do lote.',
      );
    balance[bucket] += m.kind === 'exit' ? m.quantity : -m.quantity;
    ensure(amount(balance.segregated), 'Saldo segregado incompatível com o extrato.');
    if (participants.has(m.lotId))
      ensure(amount(balance.stock), 'Saldo de estoque incompatível com o extrato.');
  }
  for (const l of db.lots) {
    ensure(
      amount(l.segregatedQuantity ?? 0) && balances.get(l.id)!.segregated === 0,
      'Saldo segregado não confere com os registros.',
    );
  }
  const previousAtMovement = new Map<string, string | null>(),
    lastMovementByLot = new Map<string, string>();
  for (const m of db.movements) {
    if (m.logisticsKind) previousAtMovement.set(m.id, lastMovementByLot.get(m.lotId) ?? null);
    lastMovementByLot.set(m.lotId, m.id);
  }
  const authors = new Map(demoIdentities(db).map((a) => [a.sessionId, a]));
  const requests = new Set<string>(),
    pending = new Map<string, StoredShipment>();
  const chronology = new Map<string, number>();
  for (const e of db.stockLogistics) {
    const lot = lots.get(e.lotId),
      actor = authors.get(e.authorId),
      req = e.organizationId + ':' + e.requestId;
    ensure(
      lot && lot.organizationId === e.organizationId && lot.unitId === e.unitId,
      'Lote da logística fora da unidade.',
    );
    ensure(
      actor &&
        actor.unitId === e.unitId &&
        actor.organizationId === e.organizationId &&
        can(actor.role, 'stock') &&
        actor.name === e.author,
      'Autoria de logística inválida.',
    );
    ensure(
      typeof e.requestId === 'string' && /^[\w-]{8,100}$/.test(e.requestId) && !requests.has(req),
      'Identificação de logística repetida ou inválida.',
    );
    requests.add(req);
    ensure(
      typeof e.at === 'string' &&
        Number.isFinite(Date.parse(e.at)) &&
        e.at === new Date(e.at).toISOString(),
      'Data de logística inválida.',
    );
    field(e.reason, 'o motivo', 500);
    field(e.reference, 'a referência', 200);
    ensure(
      e.lot === lot.lot &&
        e.expiresAt === lot.expiresAt &&
        e.product === lot.product &&
        e.presentation === lot.presentation,
      'Identidade do lote alterada.',
    );
    ensure(
      e.quantityUnit === lot.medication?.quantityUnit ||
        (e.kind === 'inventory' && e.quantityUnit === 'unidade de estoque'),
      'Unidade da quantidade inválida.',
    );
    const anchor = e.previousMovementId === null ? -1 : positions.get(e.previousMovementId);
    ensure(
      anchor !== undefined && anchor >= (chronology.get(lot.id) ?? -1),
      'Ordem de logística inválida.',
    );
    if (anchor >= 0)
      ensure(
        db.movements[anchor].lotId === lot.id && db.movements[anchor].at <= e.at,
        'Movimentação anterior inválida.',
      );
    const previous =
      e.previousMovementId === null ? balances.get(lot.id) : after.get(e.previousMovementId);
    ensure(previous, 'Saldo de abertura não localizado.');
    const segregated =
      e.kind === 'disposal' || (e.kind === 'receipt' && e.destination === 'segregated');
    ensure(
      amount(e.after) && e.before === previous[segregated ? 'segregated' : 'stock'],
      'Saldos da logística não conferem.',
    );
    switch (e.kind) {
      case 'inventory':
        if (e.after > e.before)
          ensure(
            ![...pending.values()].some(
              (s) =>
                s.organizationId === lot.organizationId &&
                s.toUnitId === lot.unitId &&
                sameCode(s, lot),
            ),
            'Crédito de inventário com remessa por receber.',
          );
        ensure(
          amount(e.countedStock) &&
            amount(e.countedSegregated) &&
            e.segregatedBefore === previous.segregated &&
            e.reconciled === (e.segregatedBefore === e.countedSegregated) &&
            e.after === (e.reconciled ? e.countedStock : e.before),
          'Conferência de inventário inválida.',
        );
        break;
      case 'disposal':
        field(e.destination, 'o destino do material', 200);
        ensure(amount(e.quantity, 1) && e.after === e.before - e.quantity, 'Destinação inválida.');
        break;
      case 'shipment':
        ensure(
          lot.medication &&
            e.toUnitId !== e.unitId &&
            db.units.some((u) => u.id === e.toUnitId && u.organizationId === e.organizationId) &&
            lot.expiresAt >= dateKey(new Date(e.at)) &&
            amount(e.quantity, 1) &&
            e.after === e.before - e.quantity,
          'Expedição inválida.',
        );
        pending.set(e.id, e);
        break;
      case 'receipt': {
        const channel = db.transferChannels.find((ch) => ch.id === e.shipmentId);
        const shipment =
          pending.get(e.shipmentId) ??
          (channel && !channel.senderKey && channelShipment(db, channel));
        const received = (receivedByShipment.get(e.shipmentId) ?? 0) + e.quantity;
        if (channel) {
          const ack = channel.receipts.find((r) => r.requestId === e.requestId);
          ensure(
            channel.receiverKey &&
              ack &&
              ack.quantity === e.quantity &&
              ack.reference === e.reference &&
              e.confirmedAt === ack.at &&
              actor.role === ack.role,
            'Recebimento local sem confirmação compartilhada.',
          );
        }
        ensure(
          shipment &&
            shipment.unitId === e.fromUnitId &&
            shipment.toUnitId === e.unitId &&
            shipment.organizationId === e.organizationId &&
            shipment.at <= e.at &&
            amount(e.quantity, 1) &&
            received <= shipment.quantity &&
            e.after === e.before + e.quantity,
          'Recebimento sem remessa compatível.',
        );
        const origin = channel?.manifest ?? lots.get(shipment.lotId)!;
        ensure(
          sameCode(origin, lot) &&
            compatible(origin, lot) &&
            e.destination ===
              (lot.expiresAt < dateKey(new Date(e.confirmedAt ?? e.at)) ? 'segregated' : 'stock'),
          'Lote ou compartimento de recebimento inválido.',
        );
        receivedByShipment.set(shipment.id, received);
        if (received === shipment.quantity) pending.delete(shipment.id);
        break;
      }
      default:
        throw new DomainError('Tipo de evento de logística inválido.');
    }
    if (e.before === e.after) {
      ensure(!positions.has(e.id), 'Contagem sem diferença gerou movimento de estoque.');
      chronology.set(lot.id, anchor);
    } else {
      const index = positions.get(e.id);
      ensure(
        index !== undefined &&
          logisticsMoves.delete(e.id) &&
          previousAtMovement.get(e.id) === e.previousMovementId,
        'Movimento logístico não localizado.',
      );
      const m = db.movements[index];
      ensure(
        m.at === e.at &&
          m.organizationId === e.organizationId &&
          m.unitId === lot.unitId &&
          m.lotId === lot.id &&
          m.logisticsKind === e.kind &&
          !m.originalMovementId &&
          !m.dispensationId &&
          !m.itemId &&
          !m.documentId &&
          !m.adjustmentKind &&
          m.destination === (segregated ? 'segregated' : 'stock') &&
          m.kind === (e.after > e.before ? 'entry' : 'exit') &&
          m.quantity === Math.abs(e.after - e.before),
        'Movimento logístico divergente.',
      );
      chronology.set(lot.id, index);
    }
  }
  ensure(!logisticsMoves.size, 'Movimento sem evento logístico.');
}
