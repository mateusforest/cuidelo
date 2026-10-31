import type { CareRepository } from './repository';
import { can, type Context } from '../domain/model';
import { roomsForUnit, type DisplayCall, type DisplayFeed } from '../domain/queue';

const endpoint = () =>
  location.protocol === 'file:' ? 'https://cuidelo.vercel.app/api/tv' : '/api/tv';
const key = (c: Pick<Context, 'organizationId' | 'unitId'>) =>
  'cuidelo.tv.station.' + c.organizationId + '.' + c.unitId;
const changed = 'cuidelo-tv-channel';
export const formattedCode = (v: string) => v.match(/.{1,4}/g)?.join('-') ?? '';
export const normalizeCode = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();
type Pair = { writer: string; code: string };
export function channelState(c: Context): { pair: Pair | null; failed: boolean } {
  try {
    const raw = localStorage.getItem(key(c));
    return {
      pair: raw ? JSON.parse(raw) : null,
      failed: localStorage.getItem(key(c) + '.failed') === '1',
    };
  } catch {
    return { pair: null, failed: false };
  }
}
export function onChannelChange(fn: () => void) {
  window.addEventListener(changed, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(changed, fn);
    window.removeEventListener('storage', fn);
  };
}
function announce() {
  window.dispatchEvent(new Event(changed));
}
async function request(token: string, body: unknown, signal?: AbortSignal) {
  const controller = new AbortController(),
    abort = () => controller.abort();
  const timer = setTimeout(abort, 9000);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const e = new Error(
        res.status === 410
          ? 'Transmissão encerrada na estação.'
          : res.status === 404
            ? 'Estação não encontrada ou sem sinal.'
            : 'Falha na comunicação com o painel.',
      );
      throw e;
    }
    return await res.json();
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError'))
      throw new Error('Sem conexão com o painel de senhas.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
const scope = (c: Context) => ({ org: c.organizationId, unit: c.unitId });
function packet(repo: CareRepository, c: Context) {
  const unit = repo
    .directory()
    .units.find((u) => u.id === c.unitId && u.organizationId === c.organizationId);
  if (!unit) throw Error('Escolha a unidade da estação.');
  const feed = repo.display(c.organizationId, c.unitId),
    rooms = roomsForUnit(unit);
  const call = (v: DisplayCall) => ({
    id: v.id,
    ticket: v.ticket,
    roomId: rooms.find((r) => r.name === v.room)!.id,
    calledAt: v.calledAt,
  });
  return {
    op: 'publish',
    ...scope(c),
    revision: repo.getRevision(),
    current: feed.current ? call(feed.current) : null,
    recent: feed.recent.map(call),
  };
}
async function lock<T>(c: Context, fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(key(c), fn) : fn();
}
function canSend(c: Context) {
  return c.unitId !== 'all' && (can(c.role, 'queue') || c.role === 'pharmacy');
}
export async function enableChannel(repo: CareRepository, c: Context) {
  if (!canSend(c)) throw Error('Selecione uma estação de atendimento vinculada a uma unidade.');
  return lock(c, async () => {
    const existing = channelState(c).pair;
    if (existing) return existing;
    const writer = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const response = await request(writer, packet(repo, c));
    if (!/^[A-F0-9]{16}$/.test(response.code)) throw Error('O canal de TV não respondeu.');
    const confirmation = await request(response.code, { op: 'read' });
    if (confirmation.org !== c.organizationId || confirmation.unit !== c.unitId)
      throw Error('Canal não confirmado pela TV.');
    const pair = { writer, code: response.code };
    localStorage.setItem(key(c), JSON.stringify(pair));
    localStorage.removeItem(key(c) + '.failed');
    announce();
    return pair;
  });
}
export async function stopChannel(c: Context) {
  if (!canSend(c)) throw Error('Sessão sem acesso a esta estação.');
  await lock(c, async () => {
    const pair = channelState(c).pair;
    if (!pair) return;
    await request(pair.writer, { op: 'stop', ...scope(c) });
    localStorage.removeItem(key(c));
    localStorage.removeItem(key(c) + '.last');
    localStorage.removeItem(key(c) + '.failed');
    announce();
  });
}
export function startBroadcast(repo: CareRepository, c: Context) {
  if (!canSend(c)) return;
  let busy = false,
    disposed = false,
    retryAfter = 0;
  const run = async () => {
    const path =
      location.protocol === 'file:' ? location.hash.slice(1).split('?')[0] : location.pathname;
    if (
      disposed ||
      busy ||
      ['/tv', '/painel', '/totem'].includes(path) ||
      Date.now() < retryAfter ||
      !channelState(c).pair
    )
      return;
    busy = true;
    try {
      await lock(c, async () => {
        const pair = channelState(c).pair;
        if (!pair || disposed) return;
        repo.refresh();
        const data = packet(repo, c);
        const signature = JSON.stringify([data.current, data.recent]);
        const previous = JSON.parse(localStorage.getItem(key(c) + '.last') ?? 'null');
        if (
          previous?.code === pair.code &&
          previous.signature === signature &&
          Date.now() - previous.at < 20000
        )
          return;
        await request(pair.writer, data);
        localStorage.setItem(
          key(c) + '.last',
          JSON.stringify({ code: pair.code, signature, at: Date.now() }),
        );
        if (channelState(c).failed) {
          localStorage.removeItem(key(c) + '.failed');
          announce();
        }
      });
    } catch {
      retryAfter = Date.now() + 5000;
      if (channelState(c).pair && !channelState(c).failed) {
        try {
          localStorage.setItem(key(c) + '.failed', '1');
          announce();
        } catch {
          /* armazenamento indisponível */
        }
      }
    } finally {
      busy = false;
    }
  };
  const unsubscribe = repo.subscribe(run);
  const timer = setInterval(run, 2000);
  window.addEventListener(changed, run);
  void run();
  return () => {
    disposed = true;
    unsubscribe();
    clearInterval(timer);
    window.removeEventListener(changed, run);
  };
}
export async function receiveChannel(
  repo: CareRepository,
  code: string,
  signal?: AbortSignal,
): Promise<DisplayFeed> {
  const p = await request(normalizeCode(code), { op: 'read' }, signal);
  const directory = repo.directory(),
    u = directory.units.find((v) => v.id === p.unit && v.organizationId === p.org),
    org = directory.organizations.find((o) => o.id === p.org);
  if (!u || !org || !Array.isArray(p.recent) || p.recent.length > 4)
    throw Error('Painel inválido.');
  const rooms = roomsForUnit(u);
  const decode = (c: {
    id: string;
    ticket: string;
    roomId: string;
    calledAt: string;
  }): DisplayCall => {
    const room = rooms.find((r) => r.id === c.roomId);
    if (!room || !/^A-\d{3,4}$/.test(c.ticket) || !Number.isFinite(Date.parse(c.calledAt)))
      throw Error('Chamada inválida.');
    return {
      id: c.id,
      ticket: c.ticket,
      calledAt: c.calledAt,
      room: room.name,
      direction: room.direction,
    };
  };
  return {
    unitName: u.name,
    organizationName: org.shortName,
    current: p.current ? decode(p.current) : null,
    recent: p.recent.map(decode),
  };
}
