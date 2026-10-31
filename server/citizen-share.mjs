import { createHash, randomBytes } from 'node:crypto';

import { reportReader, reportCode, replyProof, reportBinding } from '../src/domain/report-code.mjs';

import { deviceKey, receipt, tracking } from './guidance-notices.mjs';
const hash = (v) => createHash('sha256').update(v).digest('hex');
const readKey = (writer) => hash('cuidelo-cidadao-v1:' + writer);
const lifetime = 30 * 60;
const failure = (status, message) => ({ status, body: { error: message } });

// Os canais de documentos e relatórios mantêm cópias cifradas em espaços distintos.
export async function citizenShare(op, token, body, cache, address, now = Date.now(), mailbox) {
  const report = typeof op === 'string' && op.startsWith('report.');
  if (report) {
    op = op.slice(7);
    if (
      ![
        'create',
        'read',
        'stop',
        'reply',
        'inbox',
        'device',
        'ack',
        'linkAck',
        'status',
        'legacyStatus',
      ].includes(op) ||
      !/^[a-f0-9]{64}$/.test(token)
    )
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
  if (report && ['ack', 'linkAck', 'status', 'legacyStatus'].includes(op))
    return receipt(
      op,
      token,
      body,
      cache,
      mailbox,
      async (owner) => hash(await reportReader(await reportCode(owner))),
      now,
    );
  const prefix = report ? 'report:' : 'view:';
  const readerFor = report ? async (w) => reportReader(await reportCode(w)) : readKey;
  if (
    report &&
    op === 'create' &&
    body.network !== undefined &&
    (typeof body.network !== 'string' || !/^[a-f0-9]{64}$/.test(body.network))
  )
    return failure(400, 'Rede inválida.');
  if (report && op === 'device') {
    const key = prefix + hash(await readerFor(token)),
      item = await cache.get(key);
    if (!item || item.expires <= now || (await cache.get('revoked:' + key)))
      return failure(410, 'Compartilhamento encerrado.');
    const device = deviceKey(body.device);
    if (!device) return failure(400, 'Aparelho inválido.');
    await cache.set('device:' + key, device, {
      ttl: Math.max(1, Math.ceil((item.expires - now) / 1000)),
    });
    return { status: 200, body: { linked: true } };
  }
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
      {
        payload: body.payload,
        expires,
        revision: 0,
        ...(!report && typeof body.binding === 'string' && /^[a-f0-9]{64}$/.test(body.binding)
          ? { binding: body.binding }
          : {}),
        ...(report
          ? {
              binding: body.binding,
              device: deviceKey(body.device),
              ...(body.network
                ? {
                    network: body.network,
                    replyProof: hash(await replyProof(await reportCode(token))),
                  }
                : {}),
            }
          : {}),
      },
      { ttl: lifetime },
    );
    return { status: 201, body: report ? { expires } : { writer, reader, expires } };
  }
  if (report && op === 'inbox') {
    if (!mailbox) return failure(503, 'Caixa de orientações indisponível.');
    const box = await mailbox.read(hash(await readerFor(token)));
    return {
      status: 200,
      body: {
        checkedAt: now,
        messages: box.messages.map(({ id, payload, sentAt, readAt }) => ({
          id,
          payload,
          sentAt,
          readAt,
        })),
      },
    };
  }
  if (report && op === 'reply') {
    if (!mailbox) return failure(503, 'Canal de orientações indisponível.');
    if (
      typeof body.payload !== 'string' ||
      !/^[-_A-Za-z0-9]{40,24000}$/.test(body.payload) ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(body.id) ||
      ![body.binding, body.proof, body.digest].every(
        (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v),
      )
    )
      return failure(400, 'Orientação inválida.');
    const sender = body.sender;
    if (
      sender?.role !== 'clinical' ||
      typeof sender.organizationId !== 'string' ||
      !/^[a-z0-9-]{1,80}$/.test(sender.organizationId) ||
      typeof sender.unitId !== 'string' ||
      !sender.unitId.startsWith(sender.organizationId + '-') ||
      !/^[a-z0-9-]{1,100}$/.test(sender.unitId) ||
      ![sender.unitId + ':clinical', sender.unitId + ':clinical:2'].includes(sender.sessionId)
    )
      return failure(403, 'Sessão médica de demonstração inválida.');
    const network = await reportBinding(sender.organizationId, 'guidance-network'),
      station = hash(JSON.stringify([sender.organizationId, sender.unitId, sender.sessionId]));
    if (hash(body.payload) !== body.digest) return failure(400, 'Envelope inválido.');
    const started = Date.now(),
      key = hash(token),
      grantKey = prefix + key,
      proof = hash(body.proof);
    for (let attempt = 0; attempt < 3; attempt++) {
      const box = await mailbox.read(key),
        prior = box.messages.find((m) => m.id === body.id);
      // Confirma o recebimento após perda de conexão, inclusive se o código já encerrou.
      if (prior)
        return prior.station === station &&
          prior.proof === proof &&
          prior.digest === body.digest &&
          prior.binding === body.binding
          ? { status: 200, body: { sentAt: prior.sentAt, tracking: tracking(key, prior) } }
          : failure(409, 'A orientação já foi registrada com outro conteúdo.');
      const item = await cache.get(grantKey);
      if (
        !item ||
        item.expires <= now + Math.max(0, Date.now() - started) ||
        (await cache.get('revoked:' + grantKey))
      )
        return failure(410, 'Compartilhamento encerrado ou expirado.');
      if (item.binding !== body.binding || item.replyProof !== proof || item.network !== network)
        return failure(403, 'Este código não autoriza esta orientação.');
      if (box.messages.length >= 40)
        return failure(409, 'Limite de orientações deste relatório atingido.');
      const sentAt = new Date(now).toISOString();
      const device = (await cache.get('device:' + grantKey)) || item.device;
      const saved = {
        id: body.id,
        payload: body.payload,
        digest: body.digest,
        binding: body.binding,
        station,
        proof,
        sentAt,
        linkPermit: randomBytes(32).toString('hex'),
        ...(device ? { device } : {}),
      };
      if (device) await mailbox.enqueue({ kind: 'guidance', box: key, id: body.id, at: now });

      try {
        await mailbox.save(key, [...box.messages, saved], box.etag);
        return { status: 201, body: { sentAt, tracking: tracking(key, saved) } };
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
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
        {
          ...item,
          ...(!item.binding &&
          typeof body.binding === 'string' &&
          /^[a-f0-9]{64}$/.test(body.binding)
            ? { binding: body.binding }
            : {}),
          payload: body.payload,
          expires: item.expires,
          revision: body.revision,
        },
        { ttl: Math.max(1, Math.ceil((item.expires - now) / 1000)) },
      );
    return { status: 200, body: { expires: item.expires } };
  }
  return {
    status: 200,
    body: {
      payload: item.payload,
      expires: item.expires,
      ...(report ? { canReply: !!item.replyProof } : {}),
    },
  };
}
export async function citizenRelay(req, res, cache, mailbox) {
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
        ({
          'report.reply': 7,
          'report.linkAck': 4,
          'report.status': 3,
          'report.legacyStatus': 2,
          'report.ack': 2,
          'report.device': 2,
          'report.read': 2,
          update: 3 + Number(Object.hasOwn(b, 'binding')),
          create: 2 + Number(Object.hasOwn(b, 'binding')),
          'report.create':
            3 + Number(Object.hasOwn(b, 'network')) + Number(Object.hasOwn(b, 'device')),
        }[b.op] ?? 1) ||
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
      Date.now(),
      mailbox,
    );
    return send(result.status, result.body);
  } catch {
    return send(503, { error: 'Acesso temporariamente indisponível.' });
  }
}
