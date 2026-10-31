import type { Context } from '../domain/model';
import type { ChannelReply } from '../domain/shared-shipments';
import { validHistory } from '../domain/shipment-wire.mjs';
export const stationSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
export async function shipmentRequest(
  c: Context,
  token: string,
  command: Record<string, unknown>,
): Promise<ChannelReply> {
  const url =
    location.protocol === 'file:' ? 'https://cuidelo.vercel.app/api/remessas' : '/api/remessas';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ...command, org: c.organizationId, unit: c.unitId, role: c.role }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'O canal de remessas está indisponível.');
    if (!/^[a-f0-9]{32}$/.test(value.code) || !validHistory(value.manifest, value.receipts))
      throw new Error('Resposta inválida do canal de remessas.');
    return value;
  } catch (e) {
    if (
      e instanceof TypeError ||
      (e instanceof Error && (e.name === 'AbortError' || e.name === 'SyntaxError'))
    )
      throw new Error(
        'Sem confirmação do servidor. Verifique a conexão e atualize a remessa antes de repetir.',
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
