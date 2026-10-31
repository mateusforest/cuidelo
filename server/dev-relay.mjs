import { tvRelay } from './tv-relay.mjs';
export function tvDevelopmentRelay() {
  const records = new Map();
  const cache = {
    async get(key) {
      const v = records.get(key);
      if (!v || v.expires < Date.now()) {
        records.delete(key);
        return undefined;
      }
      return v.value;
    },
    async set(key, value, { ttl }) {
      records.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
  };
  return {
    name: 'cuidelo-local-tv-relay',
    configureServer(server) {
      server.middlewares.use('/api/tv', (req, res) => tvRelay(req, res, cache));
    },
  };
}
