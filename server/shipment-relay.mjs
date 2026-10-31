import { createHash } from 'node:crypto';
import { validManifest, safeId, stockRole } from '../src/domain/shipment-wire.mjs';
const hash = (v) => createHash('sha256').update(v).digest('hex');
const validKey = (k) => typeof k === 'string' && /^[a-f0-9]{64}$/.test(k);
const validCode = (k) => typeof k === 'string' && /^[a-f0-9]{32}$/.test(k);
const fail = (status, message) => Object.assign(new Error(message), { status });
const deny = () => fail(403, 'Código, aparelho ou unidade não autorizados para esta remessa.');

export async function shipmentAction(store, body, token, now = new Date()) {
  if (!validKey(token) || !body || !stockRole(body.org, body.unit, body.role)) throw deny();
  const { op, org, unit, role } = body;
  const sending = op === 'publish' || op === 'source';
  const code = sending ? hash('cuidelo-remessa-v1:' + token).slice(0, 32) : body.code;
  if (!validCode(code)) throw deny();
  const path = hash('shipment:' + code);
  for (let attempt = 0; attempt < 6; attempt++) {
    const old = await store.read(path);
    const row = old?.value;
    let next;
    if (op === 'publish') {
      const m = body.manifest;
      if (
        !validManifest(m) ||
        m.organizationId !== org ||
        m.unitId !== unit ||
        m.at > new Date(now.getTime() + 300000).toISOString()
      )
        throw fail(400, 'Identificação ou data da expedição inválida.');
      if (row && (row.owner !== hash(token) || JSON.stringify(row.manifest) !== JSON.stringify(m)))
        throw fail(409, 'Esta publicação já pertence a outra expedição.');
      if (!row) {
        if (attempt === 0) await store.beforeCreate?.();
        next = { owner: hash(token), receiver: null, manifest: m, receipts: [] };
      }
    } else {
      if (!row || row.manifest.organizationId !== org) throw deny();
      if (sending) {
        if (row.owner !== hash(token) || row.manifest.unitId !== unit) throw deny();
      } else {
        if (row.manifest.toUnitId !== unit || (row.receiver && row.receiver !== hash(token)))
          throw deny();
        if (op === 'claim') {
          if (!row.receiver) next = { ...row, receiver: hash(token) };
        } else if (op !== 'inspect') {
          if (row.receiver !== hash(token)) throw deny();
          if (op === 'receive') {
            const { requestId, quantity, reference, expected } = body;
            if (
              !safeId(requestId) ||
              !Number.isSafeInteger(quantity) ||
              quantity <= 0 ||
              typeof reference !== 'string' ||
              !reference.trim() ||
              reference.length > 200 ||
              !Number.isSafeInteger(expected) ||
              expected < 0
            )
              throw fail(400, 'Confira quantidade e referência do recebimento.');
            const previous = row.receipts.find((r) => r.requestId === requestId);
            if (previous) {
              if (
                previous.quantity !== quantity ||
                previous.role !== role ||
                previous.reference !== reference.trim()
              )
                throw fail(409, 'Identificação já utilizada em outro recebimento.');
            } else {
              const received = row.receipts.reduce((sum, r) => sum + r.quantity, 0);
              if (received !== expected || quantity > row.manifest.quantity - received)
                throw fail(
                  409,
                  'O saldo em trânsito mudou. Atualize a remessa antes de confirmar.',
                );
              const at = new Date(
                Math.max(+now, Date.parse(row.receipts.at(-1)?.at ?? row.manifest.at)),
              ).toISOString();
              next = {
                ...row,
                receipts: [
                  ...row.receipts,
                  { requestId, quantity, reference: reference.trim(), at, role },
                ],
              };
            }
          } else if (op !== 'status') throw fail(400, 'Operação inválida.');
        }
      }
    }
    if (next && !(await store.save(path, next, old?.etag))) continue;
    const result = next ?? row;
    return { code, manifest: result.manifest, receipts: result.receipts };
  }
  throw fail(409, 'Outra estação está atualizando a remessa. Tente novamente.');
}
export async function shipmentHttp(req, res, store) {
  const send = (status, data) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (
    origin &&
    !['null', 'https://' + req.headers.host, 'http://' + req.headers.host].includes(origin)
  )
    return send(403, { error: 'Origem não permitida.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return send(204, null);
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
  try {
    let b = req.body;
    if (b === undefined) {
      let bytes = 0;
      const chunks = [];
      for await (const c of req) {
        bytes += c.length;
        if (bytes > 8192) throw fail(413, 'Mensagem muito grande.');
        chunks.push(c);
      }
      b = Buffer.concat(chunks).toString();
    }
    if (typeof b === 'string') b = JSON.parse(b);
    if (!b || JSON.stringify(b).length > 8192) throw fail(400, 'Mensagem inválida.');
    if (b.op === 'health' && Object.keys(b).length === 1) {
      await store.read('availability');
      return send(200, { service: 'remessas', available: true });
    }
    return send(
      200,
      await shipmentAction(
        store,
        b,
        /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1],
      ),
    );
  } catch (e) {
    return send(e.status ?? (e instanceof SyntaxError ? 400 : 503), {
      error: e.status ? e.message : 'Não foi possível consultar o canal de remessas.',
    });
  }
}
