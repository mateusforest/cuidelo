import { get, put, BlobPreconditionFailedError, BlobError } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';
import { shipmentHttp } from '../server/shipment-relay.mjs';
const path = (key) => 'shipment-demo/v1/' + key + '.json';
const store = {
  async read(key) {
    const result = await get(path(key), {
      access: 'private',
      useCache: false,
      headers: { 'accept-encoding': 'identity' },
    });
    return result
      ? { etag: result.blob.etag, value: await new Response(result.stream).json() }
      : null;
  },
  async save(key, value, etag) {
    try {
      await put(path(key), JSON.stringify(value), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: !!etag,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return true;
    } catch (e) {
      if (
        e instanceof BlobPreconditionFailedError ||
        (!etag && e instanceof BlobError && /already exists/i.test(e.message))
      )
        return false;
      throw e;
    }
  },
};
export default (req, res) =>
  shipmentHttp(req, res, {
    ...store,
    async beforeCreate() {
      const address = String(
        req.headers['x-vercel-forwarded-for'] ?? req.socket?.remoteAddress ?? 'local',
      );
      const key = createHash('sha256')
        .update(address + ':' + Math.floor(Date.now() / 3600000))
        .digest('hex');
      const cache = getCache({ namespace: 'cuidelo-remessas-limites' });
      const count = Number(await cache.get(key)) || 0;
      if (count >= 60)
        throw Object.assign(
          new Error('Limite de novas remessas de demonstração atingido. Tente mais tarde.'),
          { status: 429 },
        );
      await cache.set(key, count + 1, { ttl: 3600 });
    },
  });
