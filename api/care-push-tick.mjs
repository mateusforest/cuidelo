import { consume } from '../server/care-push.mjs';
import { queue, pushRuntime } from '../server/care-push-runtime.mjs';
export default queue.handleNodeCallback(async (job) => {
  await consume(pushRuntime(), job);
});
