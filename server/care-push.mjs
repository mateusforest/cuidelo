import { createHash, randomUUID, ECDH } from 'node:crypto';
import { validateSchedule, nextAlarm } from '../src/domain/push-schedule.mjs';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const error = (status, message) => Object.assign(new Error(message), { status });
const keyBytes = (value, n) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]+={0,2}$/.test(value) &&
  Buffer.from(value, 'base64url').length === n;
export function validateSubscription(s) {
  let url;
  try {
    url = new URL(s.endpoint);
  } catch {
    throw error(400, 'Inscrição inválida.');
  }
  const host = url.hostname;
  const known =
    host === 'fcm.googleapis.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.push.services.mozilla.com') ||
    host === 'push.services.mozilla.com' ||
    host.endsWith('.notify.windows.com') ||
    host.endsWith('.notify.live.net');
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !known ||
    url.pathname === '/' ||
    url.href.length > 3000 ||
    !keyBytes(s.keys?.p256dh, 65) ||
    !keyBytes(s.keys?.auth, 16)
  )
    throw error(400, 'Serviço de push ou inscrição incompatível.');
  try {
    ECDH.convertKey(Buffer.from(s.keys.p256dh, 'base64url'), 'prime256v1');
  } catch {
    throw error(400, 'Chave do aparelho inválida.');
  }
  return { endpoint: url.href, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
const earliest = (a, b) => (a && b ? Math.min(a, b) : a || b || null);
function info(v) {
  return {
    active: !!v?.subscription,
    nextAt: v?.next ?? null,
    testAt: v?.testAt ?? null,
    acceptedAt: v?.acceptedAt ?? null,
  };
}
export async function command(runtime, token, b, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw error(403, 'Credencial do aparelho inválida.');
  const id = hash('cuidelo-push-device:' + token),
    row = await runtime.read(id),
    old = row?.state;
  if (b.op === 'status') return info(old);
  if (b.op === 'test') {
    if (!old?.subscription) throw error(409, 'Ative primeiro os avisos neste aparelho.');
    if (old.testRequested && now - old.testRequested < 60000) {
      if (old.testAt > now) {
        await runtime.enqueue(id, old, now);
        return info(old);
      }
      throw error(429, 'Aguarde um minuto antes de outro teste.');
    }
    const testAt = Math.ceil((now + 60000) / 1000) * 1000;
    const state = {
      ...old,
      generation: randomUUID(),
      testRequested: now,
      leaseUntil: 0,
      testAt,
      next: earliest(old.next, testAt),
    };
    await runtime.save(id, state, row.etag);
    await runtime.enqueue(id, state, now);
    return info(state);
  }
  if (!['sync', 'stop'].includes(b.op) || !Number.isSafeInteger(b.revision) || b.revision < 1)
    throw error(400, 'Comando inválido.');
  if (old && old.revision > b.revision)
    throw error(409, 'A agenda do aparelho mudou. Reabra os avisos.');
  if (b.op === 'stop') {
    if (old?.revision === b.revision && !old.subscription) return info(null);
    await runtime.save(
      id,
      { revision: b.revision, generation: randomUUID(), next: null },
      row?.etag,
    );
    return info(null);
  }
  const subscription = validateSubscription(b.subscription);
  let schedule;
  try {
    schedule = validateSchedule(b.schedule);
  } catch {
    throw error(400, 'Confira o fuso, os horários e as datas da agenda.');
  }
  const signature = hash(JSON.stringify([subscription, schedule]));
  if (old && old.revision === b.revision) {
    if (old.signature !== signature) throw error(409, 'Esta revisão já foi substituída.');
    await runtime.enqueue(id, old, now);
    return info(old);
  }
  const testAt = old?.testAt > now ? old.testAt : null;
  const state = {
    revision: b.revision,
    generation: randomUUID(),
    subscription,
    schedule,
    signature,
    testAt,
    testRequested: old?.testRequested ?? null,
    next: earliest(nextAlarm(schedule, now), testAt),
    acceptedAt: old?.acceptedAt ?? null,
  };
  await runtime.save(id, state, row?.etag);
  await runtime.enqueue(id, state, now);
  return info(state);
}
export async function consume(runtime, job, now = Date.now()) {
  if (!job || !/^[a-f0-9]{64}$/.test(job.id) || !Number.isSafeInteger(job.due)) return;
  const row = await runtime.read(job.id),
    s = row?.state;
  if (!s?.subscription || s.generation !== job.gen || s.next !== job.due) return;
  if (now < s.next) {
    if (s.next - now < 3000) throw Error('Aguarde o instante agendado.');
    await runtime.enqueue(job.id, s, now);
    return;
  }
  let state = s,
    etag = row.etag;
  if (now - s.next < 300000 && s.deliveredDue !== s.next) {
    if (s.leaseUntil > now) throw Error('Entrega já em andamento.');
    // Dois consumidores concorrentes não devem disparar a mesma ocorrência.
    etag = await runtime.save(job.id, { ...s, leaseUntil: now + 30000 }, etag);
    try {
      await runtime.push(s.subscription, {
        channel: job.id.slice(0, 32),
        id: hash(job.id + ':' + s.next).slice(0, 32),
        kind: s.next === s.testAt ? 'test' : 'reminder',
      });
    } catch (e) {
      if ([404, 410].includes(e.statusCode)) {
        await runtime.save(
          job.id,
          { revision: s.revision, generation: randomUUID(), next: null },
          etag,
        );
        return;
      }
      throw e;
    }
    state = { ...s, leaseUntil: 0, acceptedAt: now, deliveredDue: s.next };
    etag = await runtime.save(job.id, state, etag);
  }
  const testAt = s.testAt > now ? s.testAt : null,
    next = { ...state, leaseUntil: 0, testAt, next: earliest(nextAlarm(s.schedule, now), testAt) };
  // Enfileirar antes de avançar o cursor permite repetir uma falha sem perder o próximo horário.
  await runtime.enqueue(job.id, next, now);
  await runtime.save(job.id, next, etag);
}
export async function pushHttp(req, res, runtime) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const reply = (s, b) => {
    res.statusCode = s;
    res.end(JSON.stringify(b));
  };
  if (req.method === 'GET') return reply(200, { key: runtime.publicKey });
  if (req.method !== 'POST') return reply(405, { error: 'Método indisponível.' });
  if (
    req.headers.origin &&
    req.headers.origin !== 'https://' + req.headers.host &&
    req.headers.origin !== 'http://' + req.headers.host
  )
    return reply(403, { error: 'Origem inválida.' });
  try {
    if (!String(req.headers['content-type']).startsWith('application/json'))
      throw error(415, 'Use JSON.');
    let body = req.body;
    if (body === undefined) {
      const chunks = [];
      let n = 0;
      for await (const c of req) {
        n += c.length;
        if (n > 20000) throw error(413, 'Agenda muito grande.');
        chunks.push(c);
      }
      body = Buffer.concat(chunks).toString();
    }
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        throw error(400, 'Mensagem inválida.');
      }
    }
    if (!body || JSON.stringify(body).length > 20000) throw error(400, 'Agenda inválida.');
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1] ?? '';
    if (runtime.limit) await runtime.limit(req, body.op, token);
    return reply(200, await command(runtime, token, body));
  } catch (e) {
    const status = e.status ?? (e.name === 'BlobPreconditionFailedError' ? 409 : 503);
    return reply(status, {
      error: e.status
        ? e.message
        : 'Não foi possível confirmar a agenda no servidor. Tente novamente.',
    });
  }
}
