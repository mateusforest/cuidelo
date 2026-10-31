import { expect, it } from 'vitest';
import { shipmentAction } from './shipment-relay.mjs';
const m = {
  id: 'expedicao-12345',
  organizationId: 'aurora',
  unitId: 'aurora-central',
  toUnitId: 'aurora-centro',
  lotId: 'aurora-central-cd01',
  product: 'Produto fictício',
  presentation: 'Apresentação fictícia',
  lot: 'L-01',
  expiresAt: '2028-12-31',
  medication: { strength: 'teste', form: 'teste', quantityUnit: 'unidade' },
  quantity: 6,
  at: '2026-10-31T12:00:00.000Z',
  role: 'pharmacy',
  reference: 'EXP-1',
};
function fixture() {
  const rows = new Map();
  const store = {
    async read(k) {
      return rows.get(k);
    },
    async save(k, v, etag) {
      if (rows.get(k)?.etag !== etag) return false;
      rows.set(k, { etag: crypto.randomUUID(), value: v });
      return true;
    },
  };
  const run = (op, unit, key, fields = {}) =>
    shipmentAction(
      store,
      { op, org: 'aurora', unit, role: 'pharmacy', ...fields },
      key,
      new Date('2026-10-31T14:00:00Z'),
    );
  return run;
}
it('somente a unidade vinculada e o aparelho que resgatou o código confirmam parcelas', async () => {
  const run = fixture(),
    owner = 'a'.repeat(64),
    dest = 'b'.repeat(64),
    other = 'c'.repeat(64);
  const { code } = await run('publish', m.unitId, owner, { manifest: m });
  expect((await run('publish', m.unitId, owner, { manifest: m })).code).toBe(code);
  await expect(
    run('publish', m.unitId, owner, { manifest: { ...m, quantity: 9 } }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(run('claim', 'aurora-vila', other, { code })).rejects.toMatchObject({ status: 403 });
  await expect(
    run('claim', 'horizonte-centro', other, { code, org: 'horizonte' }),
  ).rejects.toMatchObject({ status: 403 });
  await run('claim', m.toUnitId, dest, { code });
  await expect(run('claim', m.toUnitId, other, { code })).rejects.toMatchObject({ status: 403 });
  const args = { code, quantity: 4, reference: 'REC-1', requestId: 'rec-parcial-1', expected: 0 };
  const both = await Promise.allSettled([
    run('receive', m.toUnitId, dest, args),
    run('receive', m.toUnitId, dest, { ...args, requestId: 'rec-concorrente-2' }),
  ]);
  expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const r = (await run('source', m.unitId, owner)).receipts[0];
  expect(
    (await run('receive', m.toUnitId, dest, { ...args, requestId: r.requestId })).receipts,
  ).toHaveLength(1);
  for (const quantity of [0, -1, 2.5, 3])
    await expect(
      run('receive', m.toUnitId, dest, {
        ...args,
        quantity,
        requestId: 'nova-parcela-3',
        expected: 4,
      }),
    ).rejects.toThrow();
  await run('receive', m.toUnitId, dest, {
    ...args,
    quantity: 2,
    requestId: 'ultima-parcela-4',
    expected: 4,
  });
  expect((await run('source', m.unitId, owner)).receipts.map((r) => r.quantity)).toEqual([4, 2]);
  await expect(
    run('receive', m.toUnitId, dest, { ...args, requestId: 'excesso-5', quantity: 1, expected: 6 }),
  ).rejects.toMatchObject({ status: 409 });
});
