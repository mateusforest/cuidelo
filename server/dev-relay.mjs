import { deliverGuidance } from './guidance-notices.mjs';
import { memoryMailbox } from './report-mailbox.mjs';
import { developmentPush } from './dev-care-push.mjs';
import { citizenRelay } from './citizen-share.mjs';
import { tvRelay } from './tv-relay.mjs';
export function tvDevelopmentRelay() {
  const mailbox = memoryMailbox();
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
      const push = developmentPush(server);
      mailbox.enqueue = async (job) => {
        const attempt = () =>
          deliverGuidance(job, mailbox, push).catch(() => {
            if (Date.now() - job.at < 300000) setTimeout(attempt, 30000).unref();
          });
        setTimeout(attempt, 1000).unref();
      };

      server.middlewares.use('/api/cidadao', (req, res) => citizenRelay(req, res, cache, mailbox));
      server.middlewares.use('/api/tv', (req, res) => tvRelay(req, res, cache));
    },
  };
}
