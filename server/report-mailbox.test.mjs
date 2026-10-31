import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { citizenShare } from './citizen-share.mjs';
import { memoryMailbox } from './report-mailbox.mjs';
import { reportReader, reportCode, replyProof, reportBinding } from '../src/domain/report-code.mjs';
it('envios concorrentes, repetição após resposta perdida e busca privada após revogar/expirar', async () => {
  const rows = new Map(),
    cache = { get: async (k) => rows.get(k), set: async (k, v) => rows.set(k, v) },
    box = memoryMailbox();
  const run = (op, token, body = {}, now = 1000) =>
    citizenShare('report.' + op, token, body, cache, 'qa', now, box);
  const owner = 'a'.repeat(64),
    code = await reportCode(owner),
    reader = await reportReader(code),
    binding = 'b'.repeat(64);
  const created = await run('create', owner, {
    binding,
    network: await reportBinding('aurora', 'guidance-network'),
    payload: 'p'.repeat(64),
  });
  const payload = 'g'.repeat(80);
  const sender = {
    role: 'clinical',
    organizationId: 'aurora',
    unitId: 'aurora-centro',
    sessionId: 'aurora-centro:clinical',
  };
  const body = {
    sender,
    id: crypto.randomUUID(),
    binding,
    proof: await replyProof(code),
    payload,
    digest: createHash('sha256').update(payload).digest('hex'),
  };
  expect((await run('reply', reader, { ...body, binding: 'c'.repeat(64) })).status).toBe(403);
  expect((await run('reply', reader, { ...body, proof: 'd'.repeat(64) })).status).toBe(403);
  expect(
    (await run('reply', reader, { ...body, sender: { ...sender, role: 'reception' } })).status,
  ).toBe(403);
  expect(
    (
      await run('reply', reader, {
        ...body,
        sender: {
          role: 'clinical',
          organizationId: 'horizonte',
          unitId: 'horizonte-centro',
          sessionId: 'horizonte-centro:clinical',
        },
      })
    ).status,
  ).toBe(403);
  const second = { ...body, id: crypto.randomUUID() };
  expect(
    (await Promise.all([run('reply', reader, body), run('reply', reader, second)])).map(
      (x) => x.status,
    ),
  ).toEqual([201, 201]);
  expect((await run('inbox', reader)).body.messages).toEqual([]);
  await run('stop', owner);
  expect((await run('reply', reader, { ...body, id: crypto.randomUUID() })).status).toBe(410);
  expect((await run('reply', reader, body, created.body.expires + 1000)).status).toBe(200);
  const saved = await run('inbox', owner, {}, created.body.expires + 1000);
  expect(saved.body.messages.map((x) => x.id).sort()).toEqual([body.id, second.id].sort());
  expect(JSON.stringify(saved.body)).not.toMatch(/proof|digest|binding/);
});
