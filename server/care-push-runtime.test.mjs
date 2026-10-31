import { it, expect, vi } from 'vitest';
import { get, put } from '@vercel/blob';
import webpush from 'web-push';
import { pushRuntime } from './care-push-runtime.mjs';

vi.mock('@vercel/blob', () => ({ get: vi.fn(), put: vi.fn() }));

it('lê a versão original de uma inscrição longa para poder alterar ou cancelar a agenda', async () => {
  vi.stubEnv('CUIDELO_PUSH_KEY', webpush.generateVAPIDKeys().privateKey);
  try {
    const runtime = pushRuntime(),
      id = 'a'.repeat(64);
    let bytes;
    put.mockImplementation(async (_path, body, options) => {
      if (bytes && options.ifMatch !== '"versao"') throw Error('ETag incompatível');
      bytes = body;
      return { etag: '"versao"' };
    });
    get.mockImplementation(async (_path, options) => ({
      stream: new Response(bytes).body,
      blob: {
        etag: options.headers?.['accept-encoding'] === 'identity' ? '"versao"' : 'W/"versao"',
      },
    }));
    const record = {
      revision: 1,
      subscription: { endpoint: 'https://example.invalid/' + 'x'.repeat(1400) },
    };
    await runtime.save(id, record);
    const row = await runtime.read(id);
    expect(row.state).toEqual(record);
    await runtime.save(id, { revision: 2, next: null }, row.etag);
    expect((await runtime.read(id)).state).toEqual({ revision: 2, next: null });
  } finally {
    vi.unstubAllEnvs();
  }
});
