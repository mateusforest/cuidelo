import { get, put } from '@vercel/blob';
import { QueueClient } from '@vercel/queue';
import { getCache } from '@vercel/functions';
import {
  createECDH,
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import webpush from 'web-push';

export const queue = new QueueClient({ region: 'gru1' });
const topic = 'cuidelo-care-alarms';
export function pushRuntime() {
  const secret = process.env.CUIDELO_PUSH_KEY;
  if (!secret) throw Error('Chave de push ausente.');
  const ec = createECDH('prime256v1');
  ec.setPrivateKey(Buffer.from(secret, 'base64url'));
  const publicKey = ec.getPublicKey().toString('base64url');
  const encryption = hkdfSync(
    'sha256',
    ec.getPrivateKey(),
    'cuidelo-v1',
    'private-push-schedules',
    32,
  );
  const path = (id) => 'care-push/v1/' + id + '.bin';
  return {
    publicKey,
    async read(id) {
      const result = await get(path(id), { access: 'private', useCache: false });
      if (!result) return null;
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer()),
        cipher = createDecipheriv('aes-256-gcm', encryption, bytes.subarray(0, 12));
      cipher.setAAD(Buffer.from(id));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return {
        etag: result.blob.etag,
        state: JSON.parse(
          Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(),
        ),
      };
    },
    async save(id, state, etag) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', encryption, iv);
      cipher.setAAD(Buffer.from(id));
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(state), 'utf8'),
        cipher.final(),
      ]);
      const result = await put(path(id), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: !!etag,
        ...(etag ? { ifMatch: etag } : {}),
        contentType: 'application/octet-stream',
      });
      return result.etag;
    },
    async enqueue(id, s, now) {
      if (!s.next) return;
      const wake = Math.min(s.next, (Math.floor(now / 3600000) + 18) * 3600000);
      const job = { id, gen: s.generation, due: s.next };
      await queue.send(topic, job, {
        delaySeconds: Math.max(1, Math.ceil((wake - now) / 1000)),
        retentionSeconds: 86400,
        idempotencyKey: [id, s.generation, s.next, wake].join('-'),
      });
    },
    push(subscription, message) {
      return webpush.sendNotification(subscription, JSON.stringify(message), {
        vapidDetails: {
          subject: 'https://cuidelo.vercel.app/cidadao',
          publicKey,
          privateKey: secret,
        },
        TTL: 240,
        urgency: 'high',
        topic: message.id,
        timeout: 10000,
      });
    },
    async limit(req, op) {
      if (!['sync', 'test', 'stop', 'status'].includes(op)) return;
      const ip = String(
        req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? 'local',
      );
      const cache = getCache({ namespace: 'cuidelo-push-limits' }),
        key = createHash('sha256')
          .update(ip + ':' + op + ':' + Math.floor(Date.now() / 3600000))
          .digest('hex');
      const count = Number(await cache.get(key)) || 0;
      if (count >= (op === 'test' ? 20 : 180))
        throw Object.assign(Error('Limite de solicitações de demonstração. Tente mais tarde.'), {
          status: 429,
        });
      await cache.set(key, count + 1, { ttl: 3600 });
    },
  };
}
