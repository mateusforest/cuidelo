// Apenas a identificação logística necessária para conferir uma remessa fictícia.
export const networks = {
  aurora: ['aurora-central', 'aurora-centro', 'aurora-vila', 'aurora-upa', 'aurora-hospital'],
  horizonte: ['horizonte-centro', 'horizonte-hospital'],
  regional: ['regional-hospital'],
};
const field = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const exact = (o, keys) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => Object.hasOwn(o, k));
export const safeId = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(v);
const stamp = (v) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export const stockRole = (org, unit, role) =>
  Object.hasOwn(networks, org) &&
  networks[org].includes(unit) &&
  (role === 'pharmacy' || (role === 'admin' && unit !== 'aurora-central'));
export function validManifest(m) {
  return (
    exact(m, [
      'id',
      'organizationId',
      'unitId',
      'toUnitId',
      'lotId',
      'product',
      'presentation',
      'lot',
      'expiresAt',
      'medication',
      'quantity',
      'at',
      'role',
      'reference',
    ]) &&
    safeId(m.id) &&
    safeId(m.lotId) &&
    stockRole(m.organizationId, m.unitId, m.role) &&
    networks[m.organizationId].includes(m.toUnitId) &&
    m.unitId !== m.toUnitId &&
    field(m.product, 200) &&
    field(m.presentation, 350) &&
    field(m.lot, 100) &&
    field(m.reference, 200) &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.expiresAt) &&
    Number.isFinite(Date.parse(m.expiresAt)) &&
    new Date(m.expiresAt).toISOString().slice(0, 10) === m.expiresAt &&
    stamp(m.at) &&
    Number.isSafeInteger(m.quantity) &&
    m.quantity > 0 &&
    exact(m.medication, ['strength', 'form', 'quantityUnit']) &&
    Object.values(m.medication).every((v) => field(v, 100))
  );
}
export function validHistory(m, receipts) {
  if (!validManifest(m) || !Array.isArray(receipts)) return false;
  const seen = new Set();
  let total = 0,
    previous = m.at;
  for (const r of receipts) {
    if (
      !exact(r, ['requestId', 'quantity', 'reference', 'at', 'role']) ||
      !safeId(r.requestId) ||
      seen.has(r.requestId) ||
      !stockRole(m.organizationId, m.toUnitId, r.role) ||
      !Number.isSafeInteger(r.quantity) ||
      r.quantity < 1 ||
      !field(r.reference, 200) ||
      !stamp(r.at) ||
      r.at < previous
    )
      return false;
    seen.add(r.requestId);
    total += r.quantity;
    previous = r.at;
    if (!Number.isSafeInteger(total) || total > m.quantity) return false;
  }
  return true;
}
