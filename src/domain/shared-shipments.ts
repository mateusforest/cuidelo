import { dateKey } from './dates';
import { identityFor, demoContext, demoIdentities } from './access';
import { can, type Context, type Database, type StockLot } from './model';
import { DomainError } from './errors';
import { validHistory, validManifest } from './shipment-wire.mjs';
import type { StockLogisticsEvent, StockShipment } from './pharmacy-logistics';

export type ShipmentRole = 'admin' | 'pharmacy';
export interface ShipmentManifest {
  id: string;
  organizationId: string;
  unitId: string;
  toUnitId: string;
  lotId: string;
  product: string;
  presentation: string;
  lot: string;
  expiresAt: string;
  medication: NonNullable<StockLot['medication']>;
  quantity: number;
  at: string;
  role: ShipmentRole;
  reference: string;
}
export interface OnlineReceipt {
  requestId: string;
  quantity: number;
  reference: string;
  at: string;
  role: ShipmentRole;
}
export interface TransferChannel {
  id: string;
  organizationId: string;
  unitId: string;
  manifest: ShipmentManifest;
  senderKey?: string;
  receiverKey?: string;
  code?: string;
  receipts: OnlineReceipt[];
}
export interface ChannelReply {
  code: string;
  manifest: ShipmentManifest;
  receipts: OnlineReceipt[];
}
export function requireStockSession(db: Database, c: Context) {
  identityFor(db, c);
  if (!can(c.role, 'stock') || c.unitId === 'all')
    throw new DomainError('Entre com uma sessão de estoque da unidade.', 'permission');
}
export function makeManifest(db: Database, c: Context, id: string): ShipmentManifest {
  requireStockSession(db, c);
  const s = db.stockLogistics.find(
    (e) => e.id === id && e.organizationId === c.organizationId && e.unitId === c.unitId,
  );
  const lot = s && db.lots.find((l) => l.id === s.lotId);
  if (s?.kind !== 'shipment' || !lot?.medication)
    throw new DomainError('Expedição não encontrada nesta unidade.');
  const actor = demoIdentities(db).find((a) => a.sessionId === s.authorId);
  if (!actor || (actor.role !== 'admin' && actor.role !== 'pharmacy'))
    throw new DomainError('Autoria da expedição inválida.');
  const m = {
    id: s.id,
    organizationId: s.organizationId,
    unitId: s.unitId,
    toUnitId: s.toUnitId,
    lotId: s.lotId,
    product: s.product,
    presentation: s.presentation,
    lot: s.lot,
    expiresAt: s.expiresAt,
    medication: lot.medication,
    quantity: s.quantity,
    at: s.at,
    role: actor.role as ShipmentRole,
    reference: s.reference,
  };
  if (!validManifest(m))
    throw new DomainError('Confira a identificação do lote antes de conectar a remessa.');
  return m;
}
export function channelShipment(db: Database, ch: TransferChannel): StockShipment {
  const m = ch.manifest;
  const author = identityFor(db, demoContext(m.organizationId, m.unitId, m.role));
  return {
    id: m.id,
    organizationId: m.organizationId,
    unitId: m.unitId,
    toUnitId: m.toUnitId,
    lotId: m.lotId,
    product: m.product,
    presentation: m.presentation,
    lot: m.lot,
    quantityUnit: m.medication.quantityUnit,
    expiresAt: m.expiresAt,
    kind: 'shipment',
    at: m.at,
    quantity: m.quantity,
    reference: m.reference,
    reason: 'Expedição compartilhada pela unidade de origem.',
    authorId: author.sessionId,
    author: author.name,
  };
}
export function networkEvents(db: Database): StockLogisticsEvent[] {
  if (!db.transferChannels.length) return db.stockLogistics;
  const events: StockLogisticsEvent[] = [...db.stockLogistics];
  const localIds = new Set(db.stockLogistics.map((e) => e.id));
  const applied = new Set(
    db.stockLogistics
      .filter((e) => e.kind === 'receipt')
      .map((e) => e.shipmentId + '/' + e.requestId),
  );
  for (const ch of db.transferChannels) {
    const m = ch.manifest,
      s = channelShipment(db, ch);
    if (!localIds.has(ch.id)) events.push(s);
    for (const r of ch.receipts) {
      if (applied.has(ch.id + '/' + r.requestId)) continue;
      const author = identityFor(db, demoContext(m.organizationId, m.toUnitId, r.role));
      const day = dateKey(new Date(r.at));
      events.push({
        ...s,
        id: 'online-' + r.requestId,
        kind: 'receipt',
        unitId: m.toUnitId,
        fromUnitId: m.unitId,
        shipmentId: m.id,
        at: r.at,
        quantity: r.quantity,
        destination: m.expiresAt < day ? 'segregated' : 'stock',
        authorId: author.sessionId,
        author: author.name,
        reference: r.reference,
      });
    }
  }
  return events;
}
export function validateChannels(db: Database) {
  for (const ch of db.transferChannels) {
    const m = ch.manifest;
    if (
      !validHistory(m, ch.receipts) ||
      ch.id !== m.id ||
      ch.organizationId !== m.organizationId ||
      ch.unitId !== m.unitId ||
      (!ch.senderKey && !ch.receiverKey) ||
      [ch.senderKey, ch.receiverKey].some((k) => k !== undefined && !/^[a-f0-9]{64}$/.test(k)) ||
      (ch.code !== undefined && !/^[a-f0-9]{32}$/.test(ch.code)) ||
      (ch.receiverKey && !ch.code) ||
      !db.units.some((u) => u.id === m.toUnitId && u.organizationId === m.organizationId)
    )
      throw new DomainError('Vínculo de remessa inválido.');
    if (
      ch.receiverKey &&
      ch.receipts.some(
        (r) =>
          !db.stockLogistics.some(
            (e) =>
              e.kind === 'receipt' &&
              e.shipmentId === m.id &&
              e.requestId === r.requestId &&
              e.quantity === r.quantity,
          ),
      )
    )
      throw new DomainError('Parcela conectada sem a correspondente entrada no estoque da UBS.');
    if (ch.senderKey) {
      const c = demoContext(m.organizationId, m.unitId, m.role);
      if (JSON.stringify(makeManifest(db, c, ch.id)) !== JSON.stringify(m))
        throw new DomainError('Publicação divergente da expedição original.');
    }
  }
}
