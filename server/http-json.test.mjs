import { it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readCommand } from './http-json.mjs';
const fields = { read: [], write: ['value'] };
const req = (body) => ({ body, headers: { 'content-type': 'application/json; charset=utf-8' } });
it('rejeita comandos, tipos e campos inesperados e limita bytes antes de tocar no armazenamento', async () => {
  for (const body of [[], null, 'x', { op: 'constructor' }, { op: 'read', cpf: 'fictício' }])
    await expect(readCommand(req(body), 300, fields)).rejects.toMatchObject({ status: 400 });
  await expect(
    readCommand({ ...req({ op: 'read' }), headers: { 'content-type': 'text/plain' } }, 300, fields),
  ).rejects.toMatchObject({ status: 415 });
  const body = { op: 'write', value: 'á'.repeat(15) };
  expect(JSON.stringify(body).length).toBeLessThanOrEqual(40);
  await expect(readCommand(req(body), 40, fields)).rejects.toMatchObject({ status: 413 });
  const stream = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    headers: req(body).headers,
  });
  await expect(readCommand(stream, 40, fields)).rejects.toMatchObject({ status: 413 });
  await expect(readCommand(req({ op: 'read' }), 300, fields)).resolves.toEqual({ op: 'read' });
});
