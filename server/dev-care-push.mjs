import webpush from 'web-push';
import { pushHttp, consume } from './care-push.mjs';
export function developmentPush(server) {
  const keys = webpush.generateVAPIDKeys(),
    records = new Map(),
    timers = new Map();
  const localOnly = {
    publicKey: keys.publicKey,
    async read(k) {
      return structuredClone(records.get(k));
    },
    async save(k, state, etag) {
      if (records.get(k)?.etag !== etag)
        throw Object.assign(Error('Revisão alterada'), { status: 409 });
      const tag = crypto.randomUUID();
      records.set(k, { state, etag: tag });
      return tag;
    },
    async enqueue(id, s, now) {
      if (!s.next) return;
      const k = [id, s.generation, s.next].join('/');
      if (timers.has(k)) return;
      const attempt = async () => {
        timers.delete(k);
        try {
          await consume(localOnly, { id, gen: s.generation, due: s.next });
        } catch {
          const retry = setTimeout(attempt, 15000);
          retry.unref();
          timers.set(k, retry);
        }
      };
      const timer = setTimeout(attempt, Math.min(3600000, Math.max(1, s.next - now)));
      timer.unref();
      timers.set(k, timer);
    },
    push(sub, message) {
      return webpush.sendNotification(sub, JSON.stringify(message), {
        vapidDetails: { ...keys, subject: 'https://cuidelo.vercel.app/cidadao' },
        TTL: 240,
        topic: message.id,
      });
    },
  };
  server.middlewares.use('/api/care-push', (req, res) => pushHttp(req, res, localOnly));
  server.httpServer?.on('close', () => {
    for (const t of timers.values()) clearTimeout(t);
  });
}
