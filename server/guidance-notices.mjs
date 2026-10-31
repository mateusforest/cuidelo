import { reportReference, reportCode, legacyReceiptToken } from '../src/domain/report-code.mjs';
import { createHash } from 'node:crypto';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const secret = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const uuid = (s) =>
  typeof s === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
export const deviceKey = (owner) => (secret(owner) ? hash('cuidelo-push-device:' + owner) : null);
export const tracking = (key, m) => ({
  box: key,
  token: hash('guidance-status-v1:' + key + m.id + m.station + m.proof),
  ...(m.linkPermit ? { permit: m.linkPermit } : {}),
});
const fail = (status, error) => ({ status, body: { error } });
export async function receipt(op, token, b, cache, mailbox, ownerKey, now) {
  if (!secret(token) || !uuid(b.id) || !mailbox) return fail(400, 'Comprovante inválido.');
  if (op === 'legacyStatus') {
    const result = await mailbox.read(hash('receipt-index:' + token));
    return {
      status: 200,
      body: { readAt: result.messages.find((m) => m.id === b.id)?.readAt ?? null },
    };
  }
  const key = op === 'ack' ? await ownerKey(token) : b.box;
  if (!secret(key)) return fail(400, 'Caixa inválida.');
  for (let i = 0; i < 4; i++) {
    const box = await mailbox.read(key),
      m = box.messages.find((m) => m.id === b.id);
    if (!m) return fail(404, 'Orientação indisponível nesta caixa.');
    if (op === 'status') {
      if (token !== tracking(key, m).token) return fail(403, 'Consulta de leitura não autorizada.');
      return { status: 200, body: { readAt: m.readAt ?? null } };
    }
    if (op === 'linkAck') {
      const vk = 'view:' + hash(token),
        link = await cache.get(vk);
      if (
        !link ||
        link.expires <= now ||
        (await cache.get('revoked:' + vk)) ||
        !secret(b.permit) ||
        b.permit !== m.linkPermit ||
        link.binding !== m.binding
      )
        return fail(403, 'Acesso da pessoa indisponível.');
    }
    const readAt = m.readAt ?? new Date(now).toISOString();
    const result = async () => {
      if (op === 'ack' && !m.linkPermit) {
        const permit = await legacyReceiptToken(
            await reportReference(await reportCode(token)),
            m.id,
          ),
          index = hash('receipt-index:' + permit);
        const old = await mailbox.read(index);
        if (!old.messages.length) await mailbox.save(index, [{ id: m.id, readAt }], old.etag);
      }
      return { status: 200, body: { readAt } };
    };
    if (m.readAt) return result();
    try {
      await mailbox.save(
        key,
        box.messages.map((x) => (x.id === m.id ? { ...x, readAt } : x)),
        box.etag,
      );
      return await result();
    } catch (e) {
      if (i === 3) throw e;
    }
  }
}
export async function deliverGuidance(job, mailbox, push, now = Date.now()) {
  if (
    !secret(job.box) ||
    !uuid(job.id) ||
    !Number.isSafeInteger(job.at) ||
    now - job.at >= 86400000
  )
    return;
  const box = await mailbox.read(job.box),
    m = box.messages.find((m) => m.id === job.id);
  if (!m) {
    if (now - job.at > 300000) return;
    throw Error('Aguardando gravação da orientação.');
  }
  if (!m.device || m.notified || m.readAt) return;
  if (m.lease > now) throw Error('Envio em andamento.');
  await mailbox.save(
    job.box,
    box.messages.map((x) => (x.id === m.id ? { ...x, lease: now + 30000 } : x)),
    box.etag,
  );
  const device = await push.read(m.device);
  if (device?.state?.subscription) {
    try {
      await push.push(device.state.subscription, {
        kind: 'guidance',
        id: m.id.replaceAll('-', ''),
        channel: m.device.slice(0, 32),
        messageId: m.id,
      });
    } catch (e) {
      if (![404, 410].includes(e.statusCode)) throw e;
    }
  }
  // A confirmação de leitura pode chegar enquanto o provedor aceita o aviso.
  for (let i = 0; i < 4; i++) {
    const latest = await mailbox.read(job.box);
    try {
      await mailbox.save(
        job.box,
        latest.messages.map((x) => (x.id === m.id ? { ...x, lease: 0, notified: true } : x)),
        latest.etag,
      );
      return;
    } catch (e) {
      if (i === 3) throw e;
    }
  }
}
