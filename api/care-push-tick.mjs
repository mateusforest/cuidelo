import { deliverGuidance } from '../server/guidance-notices.mjs';
import { blobMailbox } from '../server/report-mailbox.mjs';
import { consume } from '../server/care-push.mjs';
import { queue, pushRuntime } from '../server/care-push-runtime.mjs';
export default queue.handleNodeCallback(
  async (job) => {
    if (job?.kind === 'guidance') await deliverGuidance(job, blobMailbox, pushRuntime());
    else await consume(pushRuntime(), job);
  },
  {
    visibilityTimeoutSeconds: 45,
    // Uma falha temporária precisa voltar à fila dentro da janela de entrega do aviso.
    retry: (_error, { deliveryCount }) => ({ afterSeconds: Math.min(40, 5 * deliveryCount) }),
  },
);
