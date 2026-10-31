import { queue } from './care-push-runtime.mjs';
import { get, put } from '@vercel/blob';
// Apenas envelopes cifrados. A versão original do objeto é necessária para gravar sem perder envios concorrentes.
export const blobMailbox = {
  async enqueue(job) {
    await queue.send('cuidelo-care-alarms', job, {
      delaySeconds: 2,
      retentionSeconds: 86400,
      idempotencyKey: 'guidance-' + job.box + '-' + job.id + '-' + Math.floor(job.at / 300000),
    });
  },
  async read(key) {
    const r = await get('report-replies/v1/' + key + '.json', {
      access: 'private',
      useCache: false,
      headers: { 'accept-encoding': 'identity' },
    });
    return r
      ? { etag: r.blob.etag, messages: await new Response(r.stream).json() }
      : { messages: [] };
  },
  async save(key, messages, etag) {
    await put('report-replies/v1/' + key + '.json', JSON.stringify(messages), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: !!etag,
      ...(etag ? { ifMatch: etag } : {}),
    });
  },
};
export function memoryMailbox() {
  const rows = new Map();
  return {
    async read(k) {
      return rows.get(k) ?? { messages: [] };
    },
    async save(k, messages, etag) {
      if (rows.get(k)?.etag !== etag) throw Error('Versão mudou.');
      rows.set(k, { messages, etag: crypto.randomUUID() });
    },
  };
}
