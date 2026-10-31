import { afterEach, describe, expect, it, vi } from 'vitest';
import { tvRelay } from './tv-relay.mjs';

const writer = 'c'.repeat(64),
  otherWriter = 'd'.repeat(64);
const frame = {
  op: 'publish',
  org: 'aurora',
  unit: 'aurora-centro',
  revision: 0,
  current: null,
  recent: [],
};
function relay() {
  const records = new Map();
  // Keep stale values here to exercise the deadline even if the cache retains the key.
  const cache = {
    get: async (key) => records.get(key),
    set: async (key, value) => {
      records.set(key, value);
    },
  };
  return async (token, body) => {
    let value;
    const res = {
      statusCode: 0,
      setHeader() {},
      end(text) {
        value = JSON.parse(text);
      },
    };
    await tvRelay(
      { method: 'POST', body, headers: { authorization: 'Bearer ' + token } },
      res,
      cache,
    );
    return { status: res.statusCode, value };
  };
}
afterEach(() => vi.useRealTimers());

describe('canal temporário de senhas', () => {
  it('retira o painel após 90 segundos sem sinal, aceita a reconexão e rejeita envio antigo depois do encerramento', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T15:00:00Z'));
    const request = relay(),
      {
        value: { code },
      } = await request(writer, frame);
    vi.advanceTimersByTime(90001);
    expect((await request(code, { op: 'read' })).status).toBe(404);
    expect((await request(writer, frame)).status).toBe(200);
    expect((await request(code, { op: 'read' })).status).toBe(200);
    await request(writer, { op: 'stop', org: frame.org, unit: frame.unit });
    expect((await request(writer, frame)).status).toBe(410);
  });
  it('separa estações e unidades e não recua o painel quando chega um envio atrasado', async () => {
    const request = relay();
    const call = {
      id: '75e35d89-8665-4fb6-b230-14e7c55711d4',
      ticket: 'A-003',
      roomId: 'escuta-1',
      calledAt: '2026-10-31T15:00:00.000Z',
    };
    const {
      value: { code },
    } = await request(writer, { ...frame, current: call, revision: 2 });
    const otherStation = await request(otherWriter, frame);
    const otherUnit = await request(writer, { ...frame, unit: 'aurora-vila' });
    expect(new Set([code, otherStation.value.code, otherUnit.value.code]).size).toBe(3);
    await request(writer, frame);
    expect((await request(code, { op: 'read' })).value.current).toEqual(call);
    expect((await request(otherStation.value.code, { op: 'read' })).value.current).toBeNull();
    expect((await request(otherUnit.value.code, { op: 'read' })).value.current).toBeNull();
  });
});
