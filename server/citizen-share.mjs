import { createHash, randomBytes } from 'node:crypto';

const hash = (v) => createHash('sha256').update(v).digest('hex');
const readKey = (writer) => hash('cuidelo-cidadao-v1:' + writer);
const lifetime = 30 * 60;
const failure = (status, message) => ({ status, body: { error: message } });

// O servidor recebe apenas a cópia cifrada. A chave de abertura permanece no fragmento do link.
export async function citizenShare(op, token, body, cache, address, now = Date.now()) {
  if (op === 'create' || op === 'update') {
    if (
      typeof body.payload !== 'string' ||
      !/^[-_A-Za-z0-9]+$/.test(body.payload) ||
      body.payload.length < 40 ||
      body.payload.length > 160000
    )
      return failure(400, 'Cópia inválida ou muito grande.');
  }
  if (op === 'create') {
    const bucket = 'limit:' + hash(address + ':' + Math.floor(now / 3600000)),
      count = Number(await cache.get(bucket)) || 0;
    if (count >= 30) return failure(429, 'Limite de links por hora atingido.');
    await cache.set(bucket, count + 1, { ttl: 3600 });
    const writer = randomBytes(32).toString('hex'),
      reader = readKey(writer),
      expires = now + lifetime * 1000;
    await cache.set(
      'view:' + hash(reader),
      { payload: body.payload, expires, revision: 0 },
      { ttl: lifetime },
    );
    return { status: 201, body: { writer, reader, expires } };
  }
  if (!['read', 'stop', 'update'].includes(op) || !/^([a-f0-9]{64})$/.test(token))
    return failure(404, 'Link indisponível.');
  const key = 'view:' + hash(op === 'read' ? token : readKey(token)),
    item = await cache.get(key);
  if (!item?.payload || item.expires <= now || (await cache.get('revoked:' + key)))
    return failure(410, 'Este link expirou ou foi encerrado.');
  if (op === 'stop') {
    await cache.set('revoked:' + key, true, {
      ttl: Math.max(1, Math.ceil((item.expires - now) / 1000)),
    });
    return { status: 200, body: { ended: true } };
  }
  if (op === 'update') {
    if (!Number.isSafeInteger(body.revision) || body.revision < 0)
      return failure(400, 'Versão inválida.');
    if (body.revision >= item.revision)
      await cache.set(
        key,
        { payload: body.payload, expires: item.expires, revision: body.revision },
        { ttl: Math.max(1, Math.ceil((item.expires - now) / 1000)) },
      );
    return { status: 200, body: { expires: item.expires } };
  }
  return { status: 200, body: { payload: item.payload, expires: item.expires } };
}
export async function citizenRelay(req, res, cache) {
  const send = (status, obj) => {
    res.statusCode = status;
    res.end(JSON.stringify(obj));
  };
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (
    origin &&
    origin !== 'null' &&
    origin !== 'https://' + req.headers.host &&
    origin !== 'http://' + req.headers.host
  )
    return send(403, { error: 'Origem não permitida.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return send(204, null);
  if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
  let b;
  try {
    if (req.body === undefined) {
      let n = 0;
      const chunks = [];
      for await (const chunk of req) {
        n += chunk.length;
        if (n > 161000) throw Error();
        chunks.push(chunk);
      }
      b = JSON.parse(Buffer.concat(chunks).toString());
    } else b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (
      !b ||
      typeof b !== 'object' ||
      !Object.hasOwn(b, 'op') ||
      Object.keys(b).length !== (b.op === 'create' ? 2 : b.op === 'update' ? 3 : 1) ||
      JSON.stringify(b).length > 161000
    )
      throw Error();
  } catch {
    return send(400, { error: 'Mensagem inválida.' });
  }
  try {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1] ?? '';
    const result = await citizenShare(
      b.op,
      token,
      b,
      cache,
      String(req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? 'local'),
    );
    return send(result.status, result.body);
  } catch {
    return send(503, { error: 'Acesso temporariamente indisponível.' });
  }
}
