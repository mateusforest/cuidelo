import { createHash, randomBytes } from 'node:crypto';

import { reportReader, reportCode } from '../src/domain/report-code.mjs';

const hash = (v) => createHash('sha256').update(v).digest('hex');
const readKey = (writer) => hash('cuidelo-cidadao-v1:' + writer);
const lifetime = 30 * 60;
const failure = (status, message) => ({ status, body: { error: message } });

// Os canais de documentos e relatórios mantêm cópias cifradas em espaços distintos.
export async function citizenShare(op, token, body, cache, address, now = Date.now()) {
  const report = typeof op === 'string' && op.startsWith('report.');
  if (report) {
    op = op.slice(7);
    if (!['create', 'read', 'stop'].includes(op) || !/^[a-f0-9]{64}$/.test(token))
      return failure(404, 'Acesso ao relatório indisponível.');
    if (
      op === 'create' &&
      (typeof body.binding !== 'string' || !/^[a-f0-9]{64}$/.test(body.binding))
    )
      return failure(400, 'Vínculo inválido.');
    if (
      op === 'read' &&
      (!Array.isArray(body.bindings) ||
        ![1, 2].includes(body.bindings.length) ||
        body.bindings.some((v) => typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)))
    )
      return failure(400, 'Vínculo inválido.');
  }
  const prefix = report ? 'report:' : 'view:';
  const readerFor = report ? async (w) => reportReader(await reportCode(w)) : readKey;
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
    const writer = report ? token : randomBytes(32).toString('hex'),
      reader = await readerFor(writer),
      expires = now + lifetime * 1000;
    const key = prefix + hash(reader);
    if (report) {
      if (await cache.get('revoked:' + key)) return failure(410, 'Compartilhamento encerrado.');
      const prior = await cache.get(key);
      if (prior)
        return prior.payload === body.payload &&
          prior.binding === body.binding &&
          prior.expires > now
          ? { status: 200, body: { expires: prior.expires } }
          : failure(409, 'Este compartilhamento já foi criado.');
    }
    await cache.set(
      key,
      { payload: body.payload, expires, revision: 0, ...(report ? { binding: body.binding } : {}) },
      { ttl: lifetime },
    );
    return { status: 201, body: report ? { expires } : { writer, reader, expires } };
  }
  if (!['read', 'stop', 'update'].includes(op) || !/^([a-f0-9]{64})$/.test(token))
    return failure(404, 'Link indisponível.');
  const key = prefix + hash(op === 'read' ? token : await readerFor(token)),
    item = await cache.get(key);
  if (!item?.payload || item.expires <= now || (await cache.get('revoked:' + key)))
    return failure(410, 'Este link expirou ou foi encerrado.');
  if (report && op === 'read' && !body.bindings.includes(item.binding))
    return failure(403, 'Este código não corresponde ao paciente deste atendimento.');
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
      Object.keys(b).length !==
        (['create', 'report.read'].includes(b.op)
          ? 2
          : ['update', 'report.create'].includes(b.op)
            ? 3
            : 1) ||
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
