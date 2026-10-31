import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';
import { tvRelay } from '../server/tv-relay.mjs';
export default function handler(req, res) {
  // A TV pode consultar outra instância. O adaptador em memória do SDK não atende esse contrato.
  const runtime = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
  if (
    !runtime?.cache &&
    !(process.env.RUNTIME_CACHE_ENDPOINT && process.env.RUNTIME_CACHE_HEADERS)
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Canal compartilhado indisponível.' }));
  }
  return tvRelay(
    req,
    res,
    getCache({
      namespace: 'cuidelo-demo-tv-v1',
      keyHashFunction: (key) => createHash('sha256').update(key).digest('hex'),
    }),
  );
}
