import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { command, consume, validateSubscription } from './care-push.mjs';
import { validateSchedule, nextAlarm } from '../src/domain/push-schedule.mjs';

const tz = 'America/Sao_Paulo',
  now = Date.parse('2026-10-31T10:59:00Z');
const plan = {
  times: ['08:00', '20:00'],
  start: '2026-10-31',
  end: '',
  pickup: '2026-11-03',
  renewal: '2026-11-07',
  advance: 3,
};
const owner = 'a'.repeat(64),
  schedule = { zone: tz, plans: [plan] };
const sub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example',
  keys: {
    p256dh: webpush.generateVAPIDKeys().publicKey,
    auth: randomBytes(16).toString('base64url'),
  },
};
function model() {
  const rows = new Map(),
    jobs = [];
  const runtime = {
    async read(k) {
      return structuredClone(rows.get(k));
    },
    async save(k, state, etag) {
      expect(rows.get(k)?.etag).toBe(etag);
      const tag = crypto.randomUUID();
      rows.set(k, { state: structuredClone(state), etag: tag });
      return tag;
    },
    async enqueue(id, s) {
      if (s.next) jobs.push({ id, gen: s.generation, due: s.next });
    },
    push: vi.fn(async () => {}),
  };
  return { runtime, jobs, rows };
}
describe('Web Push em segundo plano', () => {
  it('calcula horários locais, antecedência e dia de retirada e renovação sem importar calendário', () => {
    expect(nextAlarm(schedule, now)).toBe(Date.parse('2026-10-31T11:00:00Z'));
    const dates = { zone: tz, plans: [{ ...plan, times: [] }] };
    expect(
      [0, 3, 4, 7].map((_, i) => {
        let cursor = now;
        for (let n = 0; n <= i; n++) cursor = nextAlarm(dates, cursor);
        return new Date(cursor).toISOString();
      }),
    ).toEqual([
      '2026-10-31T12:00:00.000Z',
      '2026-11-03T12:00:00.000Z',
      '2026-11-04T12:00:00.000Z',
      '2026-11-07T12:00:00.000Z',
    ]);
    expect(nextAlarm({ zone: 'America/Manaus', plans: [plan] }, now)).toBe(
      Date.parse('2026-10-31T12:00:00Z'),
    );
    expect(
      nextAlarm(
        {
          zone: tz,
          plans: [{ ...plan, advance: 0, times: [], renewal: '', pickup: '2026-11-03' }],
        },
        now,
      ),
    ).toBe(Date.parse('2026-11-03T12:00Z'));
    expect(
      nextAlarm(
        {
          zone: 'America/New_York',
          plans: [
            {
              ...plan,
              start: '2026-03-08',
              end: '2026-03-09',
              times: ['02:30'],
              pickup: '',
              renewal: '',
            },
          ],
        },
        Date.parse('2026-03-08T05:00Z'),
      ),
    ).toBe(Date.parse('2026-03-09T06:30Z'));
  });
  it('recusa campos clínicos, horários inválidos e endereços de envio arbitrários', () => {
    expect(() =>
      validateSchedule({ ...schedule, plans: [{ ...plan, medicine: 'teste' }] }),
    ).toThrow();
    expect(() => validateSchedule({ ...schedule, zone: 'inválido' })).toThrow();
    expect(() =>
      validateSchedule({ ...schedule, plans: [{ ...plan, start: '2026-02-30' }] }),
    ).toThrow();
    for (const endpoint of [
      'https://fcm.googleapis.com.exemplo.com/x',
      'http://fcm.googleapis.com/x',
      'https://127.0.0.1/x',
      'https://user:pass@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:4433/x',
    ])
      expect(() => validateSubscription({ ...sub, endpoint })).toThrow();
  });
  it('acorda sem o cliente, descarta gerações antigas e não repete um evento confirmado', async () => {
    const { runtime, jobs } = model();
    await command(runtime, owner, { op: 'sync', subscription: sub, schedule, revision: 1 }, now);
    const early = jobs[0];
    await consume(runtime, early, now);
    expect(runtime.push).not.toHaveBeenCalled();
    await consume(runtime, early, early.due);
    expect(runtime.push).toHaveBeenCalledTimes(1);
    await consume(runtime, early, early.due);
    expect(runtime.push).toHaveBeenCalledTimes(1);
    const after = jobs.at(-1);
    await command(
      runtime,
      owner,
      { op: 'sync', subscription: sub, schedule: { zone: tz, plans: [] }, revision: 2 },
      now,
    );
    await consume(runtime, after, after.due);
    expect(runtime.push).toHaveBeenCalledTimes(1);
    expect((await command(runtime, 'b'.repeat(64), { op: 'status' }, now)).active).toBe(false);
    await expect(
      command(runtime, owner, { op: 'sync', subscription: sub, schedule, revision: 1 }, now),
    ).rejects.toThrow('mudou');
  });
  it('reserva uma ocorrência antes de enviá-la a partir de consumidores concorrentes', async () => {
    const { runtime, jobs } = model();
    await command(runtime, owner, { op: 'sync', subscription: sub, schedule, revision: 1 }, now);
    const { promise: started, resolve: start } = Promise.withResolvers();
    const { promise: release, resolve: finish } = Promise.withResolvers();
    runtime.push.mockImplementationOnce(() => {
      start();
      return release;
    });
    const job = jobs[0];
    const first = consume(runtime, job, job.due);
    await started;
    try {
      await expect(consume(runtime, job, job.due)).rejects.toThrow('Entrega já em andamento.');
    } finally {
      finish();
      await first;
    }
    await consume(runtime, job, job.due);
    expect(runtime.push).toHaveBeenCalledTimes(1);
  });
  it('retenta falhas transitórias, encerra inscrição expirada e não envia aviso atrasado', async () => {
    const { runtime, jobs } = model();
    await command(runtime, owner, { op: 'sync', subscription: sub, schedule, revision: 1 }, now);
    const j = jobs[0];
    runtime.push.mockRejectedValueOnce(Object.assign(Error(), { statusCode: 503 }));
    await expect(consume(runtime, j, j.due)).rejects.toThrow();
    await consume(runtime, j, j.due + 5 * 60000);
    expect(runtime.push).toHaveBeenCalledTimes(1);
    const next = jobs.at(-1);
    runtime.push.mockRejectedValueOnce(Object.assign(Error(), { statusCode: 410 }));
    await consume(runtime, next, next.due);
    expect((await command(runtime, owner, { op: 'status' }, now)).active).toBe(false);
  });
  it('repara o enfileiramento depois de falha, cancela teste pendente e preserva a desativação', async () => {
    const { runtime, jobs } = model();
    const sync = { op: 'sync', subscription: sub, schedule, revision: 1 };
    const real = runtime.enqueue;
    runtime.enqueue = vi.fn().mockRejectedValueOnce(Error('fila')).mockImplementation(real);
    await expect(command(runtime, owner, sync, now)).rejects.toThrow('fila');
    await command(runtime, owner, sync, now);
    expect(jobs).toHaveLength(1);
    const first = await command(runtime, owner, { op: 'test' }, now);
    expect(first.testAt).toBe(now + 60000);
    const j = jobs.at(-1);
    await command(runtime, owner, { op: 'stop', revision: 2 }, now);
    await consume(runtime, j, j.due);
    expect(runtime.push).not.toHaveBeenCalled();
    await expect(command(runtime, owner, sync, now)).rejects.toThrow();
  });
});
