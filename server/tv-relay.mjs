import { createHash } from 'node:crypto';

// Only anonymous display fields cross this boundary. Rooms and scopes are fixed demo identifiers.
const scopes = {
  aurora: ['aurora-centro', 'aurora-vila', 'aurora-upa', 'aurora-hospital'],
  horizonte: ['horizonte-centro', 'horizonte-hospital'],
  regional: ['regional-hospital'],
};
const rooms = new Set([
  'recepcao-1',
  'escuta-1',
  'consultorio-1',
  'consultorio-2',
  'enfermagem-1',
  'vacina-1',
  'farmacia-1',
  'sala-3',
]);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const codeFor = (secret, org, unit) =>
  sha('cuidelo-tv-1:' + org + ':' + unit + ':' + secret)
    .slice(0, 16)
    .toUpperCase();
const obj = (o, keys) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => Object.hasOwn(o, k));
function validCall(c) {
  return (
    obj(c, ['id', 'ticket', 'roomId', 'calledAt']) &&
    typeof c.id === 'string' &&
    /^[a-f0-9-]{36}$/i.test(c.id) &&
    typeof c.ticket === 'string' &&
    /^A-\d{3,4}$/.test(c.ticket) &&
    rooms.has(c.roomId) &&
    typeof c.calledAt === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(c.calledAt) &&
    Number.isFinite(Date.parse(c.calledAt))
  );
}
async function body(req) {
  if (req.body !== undefined) {
    const s = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (s.length > 3500) throw Error();
    return JSON.parse(s);
  }
  const chunks = [];
  let bytes = 0;
  for await (const c of req) {
    bytes += c.length;
    if (bytes > 3500) throw Error();
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
export async function tvRelay(req, res, cache) {
  const send = (status, data) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (
    origin &&
    origin !== 'null' &&
    origin !== 'https://cuidelo.vercel.app' &&
    origin !== 'https://' + req.headers.host &&
    origin !== 'http://' + req.headers.host
  )
    return send(403, { error: 'Origem não permitida.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return send(204, null);
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
  let b;
  try {
    b = await body(req);
  } catch {
    return send(400, { error: 'Mensagem inválida.' });
  }
  const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    if (obj(b, ['op']) && b.op === 'read') {
      if (!/^[A-F0-9]{16}$/.test(token)) return send(400, { error: 'Código inválido.' });
      const item = await cache.get('screen:' + token);
      if (!item || item.ended || Date.now() - item.seen > 90000)
        return send(item?.ended ? 410 : 404, {
          error: item?.ended ? 'Pareamento encerrado.' : 'Estação não encontrada ou sem sinal.',
        });
      return send(200, {
        org: item.org,
        unit: item.unit,
        current: item.current,
        recent: item.recent,
      });
    }
    if (
      !/^[0-9a-f]{64}$/.test(token) ||
      !b ||
      !Object.hasOwn(scopes, b.org) ||
      !scopes[b.org].includes(b.unit)
    )
      return send(403, { error: 'Origem ou unidade inválida.' });
    const code = codeFor(token, b.org, b.unit),
      key = 'screen:' + code;
    if (b.op === 'stop' && obj(b, ['op', 'org', 'unit'])) {
      if (await cache.get(key))
        await cache.set(key, { ended: true }, { ttl: 120, name: 'TV encerrada' });
      return send(200, { ended: true });
    }
    if (
      !obj(b, ['op', 'org', 'unit', 'revision', 'current', 'recent']) ||
      b.op !== 'publish' ||
      !Number.isSafeInteger(b.revision) ||
      b.revision < 0 ||
      !(b.current === null || validCall(b.current)) ||
      !Array.isArray(b.recent) ||
      b.recent.length > 4 ||
      !b.recent.every(validCall)
    )
      return send(400, { error: 'Projeção de senhas inválida.' });
    const prev = await cache.get(key);
    if (prev?.ended) return send(410, { error: 'Pareamento encerrado.' });
    if (!prev) {
      const ip = String(
        req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? 'local',
      );
      const limit = 'create:' + sha(ip + ':' + Math.floor(Date.now() / 3600000));
      const count = Number(await cache.get(limit)) || 0;
      if (count >= 40)
        return send(429, { error: 'Limite de novos pareamentos. Tente mais tarde.' });
      await cache.set(limit, count + 1, { ttl: 3600, name: 'Limite de pareamentos' });
    }
    if (!prev || b.revision >= prev.revision) {
      await cache.set(
        key,
        {
          org: b.org,
          unit: b.unit,
          revision: b.revision,
          current: b.current,
          recent: b.recent,
          seen: Date.now(),
        },
        { ttl: 90, name: 'Últimas senhas da TV' },
      );
    }
    return send(200, { code });
  } catch {
    return send(503, { error: 'Transmissão temporariamente indisponível.' });
  }
}
