import { expect, it } from 'vitest';
import { citizenShare } from './citizen-share.mjs';
import { reportCode, reportReader, normalizeReportCode } from '../src/domain/report-code.mjs';
it('serve a cópia imutável apenas para a pessoa vinculada até revogação ou expiração', async () => {
  const m = new Map(),
    cache = { get: async (k) => m.get(k), set: async (k, v) => m.set(k, v) };
  const owner = '3'.repeat(64),
    code = await reportCode(owner),
    reader = await reportReader(code),
    binding = '5'.repeat(64),
    payload = 'a'.repeat(60);
  expect(normalizeReportCode(code.toLowerCase().match(/.{4}/g).join('-'))).toBe(code);
  expect(() => normalizeReportCode('XXXX')).toThrow();
  const run = (op, k, b = {}, now = 1000) => citizenShare(op, k, b, cache, 'local', now);
  const created = await run('report.create', owner, { binding, payload });
  expect(created.status).toBe(201);
  expect(created.body).not.toHaveProperty('writer');
  expect((await run('report.create', owner, { binding, payload: 'b'.repeat(60) })).status).toBe(
    409,
  );
  expect((await run('report.read', reader, { bindings: [binding] })).body.payload).toBe(payload);
  expect(
    (await run('report.read', reader, { bindings: ['7'.repeat(64)] })).body,
  ).not.toHaveProperty('payload');
  expect((await run('report.read', reader, { bindings: [] })).status).toBe(400);
  expect((await run('read', reader)).status).toBe(410);
  expect((await run('report.stop', reader)).status).toBe(410);
  expect((await run('report.update', owner, { payload })).status).toBe(404);
  expect(
    (await run('report.read', reader, { bindings: [binding] }, created.body.expires)).status,
  ).toBe(410);
  expect((await run('report.stop', owner)).status).toBe(200);
  expect((await run('report.read', reader, { bindings: [binding] })).status).toBe(410);
  expect((await run('report.create', owner, { binding, payload })).status).toBe(410);
});
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
