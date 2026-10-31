import { it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { memoryMailbox } from './report-mailbox.mjs';
import { citizenShare } from './citizen-share.mjs';
import { deliverGuidance, deviceKey } from './guidance-notices.mjs';
import { replyProof, reportReader, reportCode, reportBinding } from '../src/domain/report-code.mjs';
it('avisa sem conteúdo clínico e confirma somente a mensagem escolhida pela pessoa, inclusive após revogação', async () => {
  const owner = '1'.repeat(64),
    device = '2'.repeat(64),
    binding = '3'.repeat(64),
    code = await reportCode(owner),
    reader = await reportReader(code);
  const cacheRows = new Map(),
    cache = { get: async (k) => cacheRows.get(k), set: async (k, v) => cacheRows.set(k, v) };
  const box = memoryMailbox(),
    jobs = [];
  box.enqueue = async (job) => jobs.push(job);
  const run = (op, t, b = {}, now = 100000) => citizenShare(op, t, b, cache, 'test', now, box);
  await run('report.create', owner, {
    network: await reportBinding('aurora', 'guidance-network'),
    binding,
    payload: 'q'.repeat(80),
    device,
  });
  const sender = {
      role: 'clinical',
      unitId: 'aurora-centro',
      organizationId: 'aurora',
      sessionId: 'aurora-centro:clinical',
    },
    payload = 'x'.repeat(100);
  const body = {
    id: crypto.randomUUID(),
    payload,
    digest: createHash('sha256').update(payload).digest('hex'),
    binding,
    proof: await replyProof(code),
    sender,
  };
  const first = await run('report.reply', reader, body);
  const secondId = crypto.randomUUID(),
    second = await run('report.reply', reader, { ...body, id: secondId });
  expect(jobs).toHaveLength(2);
  expect(JSON.stringify(jobs)).not.toContain(payload);
  expect((await run('report.reply', reader, body)).body.tracking).toEqual(first.body.tracking);
  expect(jobs).toHaveLength(2);
  const push = {
    read: vi.fn(async () => ({ state: { subscription: { demo: true } } })),
    push: vi.fn(),
  };
  await deliverGuidance(jobs[0], box, push, 100100);
  await deliverGuidance(jobs[0], box, push, 100110);
  expect(push.push.mock.calls.map((v) => v[1])).toEqual([
    {
      kind: 'guidance',
      channel: deviceKey(device).slice(0, 32),
      messageId: body.id,
      id: body.id.replaceAll('-', ''),
    },
  ]);
  push.read.mockResolvedValue({ state: { next: null } });
  await deliverGuidance(jobs[1], box, push, 100110);
  expect(push.push).toHaveBeenCalledTimes(1);
  const track = first.body.tracking,
    params = { box: track.box, id: body.id };
  expect((await run('report.status', track.token, params)).body.readAt).toBeNull();
  expect((await run('report.ack', reader, { id: body.id })).status).toBe(404);
  expect((await run('report.status', track.token, { ...params, id: secondId })).status).toBe(403);
  await run('report.stop', owner);
  const ack = await run('report.ack', owner, { id: body.id }, 2000000);
  expect(ack.status).toBe(200);
  expect((await run('report.ack', owner, { id: body.id }, 3000000)).body).toEqual(ack.body);
  expect((await run('report.status', track.token, params)).body).toEqual(ack.body);
  const link = await run('create', '', { payload: 'z'.repeat(80), binding }),
    track2 = second.body.tracking;
  const confirm = { box: track2.box, id: secondId, permit: track2.permit };
  expect(
    (await run('report.linkAck', link.body.reader, { ...confirm, permit: track.permit })).status,
  ).toBe(403);
  expect((await run('report.linkAck', link.body.reader, confirm)).status).toBe(200);
  await run('stop', link.body.writer);
  expect((await run('report.linkAck', link.body.reader, confirm)).status).toBe(403);
});
