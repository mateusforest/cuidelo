import type { CareRepository } from './repository';
import { can, type Context } from '../domain/model';
import type { CitizenView } from '../domain/citizen';
import { validDay, validTime } from '../domain/dates';
import { validateDocumentContent } from '../domain/clinical-documents';

export interface CitizenLink {
  reader: string;
  key: string;
}
export interface SharedCitizenLink extends CitizenLink {
  writer: string;
  expires: number;
  url: string;
}
const endpoint = () =>
  location.protocol === 'file:' ? 'https://cuidelo.vercel.app/api/cidadao' : '/api/cidadao';
function encode(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
const decode = (s: string) =>
  Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
export function parseCitizenLink(fragment: string): CitizenLink | null {
  const m = /^#v1\.([a-f0-9]{64})\.([A-Za-z0-9_-]{43})$/.exec(fragment);
  return m ? { reader: m[1], key: m[2] } : null;
}
export class CitizenLinkError extends Error {
  constructor(
    message: string,
    readonly unavailable = false,
  ) {
    super(message);
  }
}
async function request(body: object, token = '') {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok)
      throw new CitizenLinkError(
        res.status === 410 || res.status === 404
          ? 'Este link expirou ou foi encerrado. Solicite um novo link à equipe.'
          : res.status === 429
            ? 'Limite de links atingido. Tente mais tarde.'
            : 'O serviço está indisponível. Tente novamente.',
        [404, 410].includes(res.status),
      );
    return await res.json();
  } catch (err) {
    if (err instanceof CitizenLinkError) throw err;
    throw new CitizenLinkError('Sem conexão com o serviço. Confira a internet e tente novamente.');
  } finally {
    clearTimeout(t);
  }
}
async function encryptView(view: CitizenView, bytes: Uint8Array<ArrayBuffer>) {
  const raw = new TextEncoder().encode(JSON.stringify(view));
  if (raw.byteLength > 119000) throw Error('Esta cópia excede o limite da demonstração.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw));
  const packet = new Uint8Array(iv.length + cipher.length);
  packet.set(iv);
  packet.set(cipher, iv.length);
  return encode(packet);
}
export async function publishCitizenLink(view: CitizenView): Promise<SharedCitizenLink> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const payload = await encryptView(view, bytes);
  const { writer, reader, expires } = await request({ op: 'create', payload });
  if (
    !/^[a-f0-9]{64}$/.test(reader) ||
    !/^[a-f0-9]{64}$/.test(writer) ||
    !Number.isSafeInteger(expires)
  )
    throw Error('Não foi possível criar o link.');
  const confirmation = await request({ op: 'read' }, reader);
  if (confirmation.payload !== payload || confirmation.expires !== expires)
    throw Error('Não foi possível confirmar a cópia.');
  const secret = encode(bytes);
  const origin = location.protocol === 'file:' ? 'https://cuidelo.vercel.app' : location.origin;
  return {
    reader,
    writer,
    key: secret,
    expires,
    url: origin + '/cidadao#v1.' + reader + '.' + secret,
  };
}
export const stopCitizenLink = (writer: string) => request({ op: 'stop' }, writer);
const string = (s: unknown) => typeof s === 'string' && s.length > 0 && s.length < 2000;
export async function openCitizenLink(
  link: CitizenLink,
): Promise<{ view: CitizenView; expires: number }> {
  const { payload, expires } = await request({ op: 'read' }, link.reader);
  try {
    if (
      !Number.isSafeInteger(expires) ||
      expires <= Date.now() ||
      typeof payload !== 'string' ||
      payload.length > 160000
    )
      throw Error();
    const bytes = decode(payload),
      key = await crypto.subtle.importKey('raw', decode(link.key), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    const v: CitizenView = JSON.parse(new TextDecoder().decode(plain));
    if (
      v.version !== 1 ||
      !string(v.person) ||
      !string(v.organization) ||
      !Number.isFinite(Date.parse(v.asOf)) ||
      !Array.isArray(v.documents) ||
      !Array.isArray(v.appointments)
    )
      throw Error();
    for (const a of v.appointments)
      if (
        ![a.id, a.service, a.unit, a.professional].every(string) ||
        !validDay(a.date) ||
        !validTime(a.time) ||
        !Number.isFinite(a.duration) ||
        !['scheduled', 'checked-in', 'cancelled'].includes(a.status)
      )
        throw Error();
    for (const d of v.documents) {
      if (
        ![d.id, d.number, d.unit, d.professional, d.person].every(string) ||
        !Number.isFinite(Date.parse(d.issuedAt)) ||
        !['issued', 'cancelled'].includes(d.status) ||
        !['prescription', 'exams', 'certificate'].includes(d.content.kind)
      )
        throw Error();
      validateDocumentContent(d.content, true);
    }
    return { view: v, expires };
  } catch {
    throw new CitizenLinkError(
      'Não foi possível abrir esta cópia. Solicite à equipe o link completo.',
      true,
    );
  }
}

const sharePrefix = (c: Context) =>
  'cuidelo.citizen.share.' + c.organizationId + '.' + c.sessionId + '.';
export const shareHandle = (c: Context, id: string) => sharePrefix(c) + id;
export function savedShare(handle: string): SharedCitizenLink | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(handle) ?? 'null');
    if (
      !s ||
      s.expires <= Date.now() ||
      !Number.isSafeInteger(s.expires) ||
      !/^[a-f0-9]{64}$/.test(s.writer) ||
      !parseCitizenLink('#v1.' + s.reader + '.' + s.key)
    )
      return null;
    return {
      ...s,
      url:
        (location.protocol === 'file:' ? 'https://cuidelo.vercel.app' : location.origin) +
        '/cidadao#v1.' +
        s.reader +
        '.' +
        s.key,
    };
  } catch {
    return null;
  }
}
export function startCitizenUpdates(repo: CareRepository, c: Context) {
  if (!can(c.role, 'clinical') || c.unitId === 'all') return;
  let disposed = false,
    busy = false;
  const sent = new Map<string, number>(),
    prefix = sharePrefix(c);
  const update = async () => {
    if (disposed || busy) return;
    busy = true;
    try {
      for (const handle of Object.keys(sessionStorage).filter((h) => h.startsWith(prefix))) {
        const share = savedShare(handle);
        if (!share) {
          sessionStorage.removeItem(handle);
          continue;
        }
        const revision = repo.getRevision();
        if (sent.get(share.writer) === revision) continue;
        const view = repo.citizenView(c, handle.slice(prefix.length));
        const payload = await encryptView(view, decode(share.key));
        if (disposed) return;
        try {
          await request({ op: 'update', revision, payload }, share.writer);
          sent.set(share.writer, revision);
        } catch (e) {
          if (e instanceof CitizenLinkError && e.unavailable) sessionStorage.removeItem(handle);
        }
      }
    } catch {
      /* A última cópia conserva seu horário. A estação tenta novamente enquanto o link é válido. */
    } finally {
      busy = false;
    }
  };
  const unsub = repo.subscribe(update);
  const timer = setInterval(update, 5000);
  void update();
  return () => {
    disposed = true;
    unsub();
    clearInterval(timer);
  };
}
