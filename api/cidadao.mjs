import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';
import { citizenRelay } from '../server/citizen-share.mjs';
export default function handler(req, res) {
  // O celular pode consultar outra instância. O link requer armazenamento compartilhado.
  const runtime = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
  if (
    !runtime?.cache &&
    !(process.env.RUNTIME_CACHE_ENDPOINT && process.env.RUNTIME_CACHE_HEADERS)
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Canal compartilhado indisponível.' }));
  }
  return citizenRelay(
    req,
    res,
    getCache({
      namespace: 'cuidelo-demo-citizen-v1',
      keyHashFunction: (key) => createHash('sha256').update(key).digest('hex'),
    }),
  );
}
