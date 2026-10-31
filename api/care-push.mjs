import { pushHttp } from '../server/care-push.mjs';
import { pushRuntime } from '../server/care-push-runtime.mjs';
export default function handler(req, res) {
  let runtime;
  try {
    runtime = pushRuntime();
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'O envio de avisos ainda não foi configurado.' }));
  }
  return pushHttp(req, res, runtime);
}
