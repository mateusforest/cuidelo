import { expect, it } from 'vitest';
import { citizenShare } from './citizen-share.mjs';
it('separa leitores e emissores, expira em 30 minutos e impede reativar uma cópia encerrada', async () => {
  const records = new Map(),
    cache = { get: async (k) => records.get(k), set: async (k, v) => records.set(k, v) };
  const packet = 'a'.repeat(60),
    second = 'b'.repeat(60);
  const run = (op, token = '', props = {}, time = 1000) =>
    citizenShare(op, token, { op, ...props }, cache, 'teste', time);
  const { reader, writer, expires } = (await run('create', '', { payload: packet })).body;
  const other = (await run('create', '', { payload: second })).body;
  expect((await run('read', reader)).body).toEqual({ payload: packet, expires });
  expect((await run('read', other.reader)).body.payload).toBe(second);
  expect((await run('read', writer)).status).toBe(410);
  expect((await run('stop', reader)).status).toBe(410);
  expect((await run('update', reader, { payload: second, revision: 3 })).status).toBe(410);
  expect((await run('update', writer, { payload: second, revision: 3 })).status).toBe(200);
  await run('update', writer, { payload: packet, revision: 2 });
  expect((await run('read', reader)).body.payload).toBe(second);
  expect((await run('read', reader, {}, expires)).status).toBe(410);
  await run('stop', writer);
  expect((await run('read', reader)).status).toBe(410);
  expect((await run('update', writer, { payload: packet, revision: 4 })).status).toBe(410);
  expect((await run('read', other.reader)).status).toBe(200);
});
