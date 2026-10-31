import { careKey, type AlarmTarget, type CareScope } from '../domain/citizen-care';
import { pushSchedule } from '../domain/push-projection';
import type { CitizenView } from '../domain/citizen';
import { readDiary } from './citizen-care';

import { parseCitizenLink, type CitizenLink } from './citizen-links';
export type CitizenAccess = { example: 'ana' | 'joao' } | { link: CitizenLink };
export interface DeviceNotice {
  scope: CareScope;
  channel: string;
  zone: string;
  items: AlarmTarget[];
  due: number;
  id: string;
  access: CitizenAccess | null;
}
interface Profile {
  resumeLink?: CitizenLink;
  locked?: boolean;
  owner: string;
  want: boolean;
  revision: number;
  signature: string;
  confirmed: boolean;
  verifiedAt: number;
  testAt: number | null;
  acceptedAt: number | null;
  shownAt?: number | null;
  linkedGrant?: string;
}
export interface PushState {
  wanted: boolean;
  pending: boolean;
  testAt: number | null;
  acceptedAt: number | null;
  shownAt: number | null;
}
const endpoint = '/api/care-push';
const key = (scope: CareScope) => 'cuidelo.push.v1.' + careKey(scope);
const initial = (): Profile => ({
  owner: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join(''),
  want: false,
  revision: 0,
  signature: '',
  confirmed: false,
  verifiedAt: 0,
  testAt: null,
  acceptedAt: null,
});
function get(scope: CareScope): Profile | null {
  const raw = localStorage.getItem(key(scope));
  return raw ? JSON.parse(raw) : null;
}
function save(scope: CareScope, p: Profile) {
  localStorage.setItem(key(scope), JSON.stringify(p));
}
async function channelFor(owner: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('cuidelo-push-device:' + owner),
  );
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
export function guidanceDevice(scope: CareScope) {
  const p = get(scope);
  return p?.want && p.confirmed && !p.locked ? p.owner : undefined;
}
async function attachCurrentGrant(scope: CareScope, p: Profile) {
  if (!p.want || p.locked) return;
  const { activeReport } = await import('./report-sharing');
  const grant = await activeReport(scope);
  if (!grant || p.linkedGrant === grant.owner) return;
  const { citizenRequest } = await import('./citizen-links');
  await citizenRequest({ op: 'report.device', device: p.owner }, grant.owner);
  p.linkedGrant = grant.owner;
  save(scope, p);
}
export async function guidanceNoticeScope(channel: string) {
  if (!/^[a-f0-9]{32}$/.test(channel)) throw Error('Aviso inválido.');
  for (const k of Object.keys(localStorage).filter((k) => k.startsWith('cuidelo.push.v1.'))) {
    const [role, organization, unit, subject] = JSON.parse(k.slice('cuidelo.push.v1.'.length));
    const scope: CareScope = { role, organization, unit, subject },
      p = get(scope);
    if (
      p?.want &&
      !p.locked &&
      (subject.startsWith('example:') || p.resumeLink) &&
      (await channelFor(p.owner)) === channel
    )
      return scope;
  }
  throw Error('Aviso indisponível neste acesso. Abra as orientações no app da pessoa.');
}
export async function readDeviceNotice(channel: string, id: string): Promise<DeviceNotice> {
  const invalid = () => Error('Este aviso expirou, foi desativado ou pertence a outro aparelho.');
  if (![channel, id].every((v) => /^[a-f0-9]{32}$/.test(v))) throw invalid();
  const response = await (
    await caches.open('cuidelo-push-actions-v1')
  ).match('/cidadao/.avisos/' + channel + '/' + id);
  if (!response) throw invalid();
  const notice = await response.json();
  if (
    typeof notice.zone !== 'string' ||
    !Array.isArray(notice.items) ||
    !notice.items.length ||
    !Number.isSafeInteger(notice.due) ||
    notice.due < Date.now() - 7 * 86400000
  )
    throw invalid();
  for (const k of Object.keys(localStorage).filter((k) => k.startsWith('cuidelo.push.v1.'))) {
    const [role, organization, unit, subject] = JSON.parse(k.slice('cuidelo.push.v1.'.length));
    const scope: CareScope = { role, organization, unit, subject };
    const p = get(scope);
    if (!p?.want || (await channelFor(p.owner)) !== channel) continue;
    let access: CitizenAccess | null = null;
    if (!p.locked) {
      if (subject === 'example:ana' || subject === 'example:joao')
        access = { example: subject === 'example:ana' ? 'ana' : 'joao' };
      else if (
        p.resumeLink &&
        parseCitizenLink('#v1.' + p.resumeLink.reader + '.' + p.resumeLink.key)
      )
        access = { link: p.resumeLink };
    }
    return { scope, id, channel, zone: notice.zone, due: notice.due, items: notice.items, access };
  }
  throw invalid();
}
export async function forgetNoticeAccess(access: CitizenAccess) {
  if (!navigator.locks) return;
  for (const k of Object.keys(localStorage).filter((k) => k.startsWith('cuidelo.push.v1.'))) {
    const [role, organization, unit, subject] = JSON.parse(k.slice('cuidelo.push.v1.'.length));
    const scope: CareScope = { role, organization, unit, subject };
    await navigator.locks.request(k, () => {
      const p = get(scope);
      if (
        p &&
        ('example' in access
          ? subject === 'example:' + access.example
          : p.resumeLink?.reader === access.link.reader)
      ) {
        delete p.resumeLink;
        p.locked = true;
        save(scope, p);
      }
    });
  }
}
export function pushState(scope: CareScope): PushState {
  let p: Profile | null = null;
  try {
    p = get(scope);
  } catch {
    /* armazenamento bloqueado */
  }
  return {
    wanted: !!p?.want,
    pending: !!p && !p.confirmed,
    testAt: p?.testAt ?? null,
    acceptedAt: p?.acceptedAt ?? null,
    shownAt: p?.shownAt ?? null,
  };
}
async function call(op?: object, owner?: string) {
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 18000);
  try {
    const r = await fetch(endpoint, {
      method: op ? 'POST' : 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: abort.signal,
      ...(op
        ? {
            headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'application/json' },
            body: JSON.stringify(op),
          }
        : {}),
    });
    if (!r.headers.get('content-type')?.includes('application/json'))
      throw Error('O servidor de avisos está indisponível neste endereço.');
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'O servidor não confirmou a alteração.');
    return data;
  } catch (e) {
    if (e instanceof TypeError || (e instanceof Error && e.name === 'AbortError'))
      throw Error(
        'Sem confirmação do servidor. Confira a internet e reabra o app para sincronizar.',
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
function packed(key: string) {
  return Uint8Array.from(atob(key.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
}
export async function subscribePhone() {
  if (location.protocol === 'file:')
    throw Error('Abra cuidelo.vercel.app/cidadao para ativar Web Push.');
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (
    ios &&
    !matchMedia('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    throw Error(
      'No iPhone, toque em Compartilhar → Adicionar à Tela de Início. Abra o Cuidelo pelo ícone para ativar os avisos (iOS 16.4 ou posterior).',
    );
  if (
    !isSecureContext ||
    !('Notification' in window) ||
    !('PushManager' in window) ||
    !('serviceWorker' in navigator) ||
    !navigator.locks
  )
    throw Error(
      'Este navegador não oferece Web Push neste modo. Use um navegador compatível no endereço publicado.',
    );
  if ((await Notification.requestPermission()) !== 'granted')
    throw Error('Permita as notificações do Cuidelo nas configurações do navegador e do aparelho.');
  const { key: publicKey } = await call();
  if (typeof publicKey !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(publicKey))
    throw Error('Configuração de avisos indisponível.');
  const reg = await navigator.serviceWorker.register('/citizen-alarm-worker.js', {
    scope: '/cidadao/',
    updateViaCache: 'none',
  });
  // A primeira página pode ter sido aberta em /cidadao, fora do escopo /cidadao/.
  // Aguarde o registro solicitado mesmo quando a navegação interna já mudou a URL.
  if (reg.active?.state !== 'activated') {
    const worker = reg.installing ?? reg.waiting ?? reg.active;
    if (!worker) throw Error('Reabra o app para concluir a ativação dos avisos.');
    await new Promise<void>((resolve, reject) => {
      const finish = (ok: boolean) => {
        clearTimeout(timeout);
        worker.removeEventListener('statechange', changed);
        if (ok) resolve();
        else reject(Error('O aparelho não concluiu a ativação dos avisos. Tente novamente.'));
      };
      const changed = () => {
        if (worker.state === 'activated') finish(true);
        else if (worker.state === 'redundant') finish(false);
      };
      const timeout = setTimeout(() => finish(false), 20000);
      worker.addEventListener('statechange', changed);
      changed();
    });
  }
  try {
    const existing = await reg.pushManager.getSubscription();
    return (
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: packed(publicKey),
      }))
    );
  } catch {
    throw Error(
      'O serviço de notificações do aparelho não confirmou a inscrição. Confira as permissões e tente novamente.',
    );
  }
}
let checkedWorkerAt = 0;
export async function syncDevice(
  scope: CareScope,
  view: CitizenView,
  action: 'sync' | 'enable' | 'stop' = 'sync',
  sub?: PushSubscription,
  link?: CitizenLink,
) {
  if (action === 'sync') {
    try {
      if (!get(scope)) return;
    } catch {
      return;
    }
  }
  if (!navigator.locks) throw Error('Avisos em segundo plano indisponíveis neste navegador.');
  return navigator.locks.request(key(scope), async () => {
    const p = get(scope) ?? initial();
    if ('caches' in window && p.want) {
      const channel = await channelFor(p.owner);
      try {
        for (const kind of ['test', 'reminder']) {
          const reply = await caches.match('/cidadao/.receipt/' + channel + '/' + kind);
          if (reply) {
            const receipt = await reply.json();
            if (Number.isSafeInteger(receipt.shownAt))
              p.shownAt = Math.max(p.shownAt ?? 0, receipt.shownAt);
          }
        }
        if (p.shownAt) save(scope, p);
      } catch {
        /* Comprovante local opcional. */
      }
    }
    if (action === 'enable') {
      p.locked = false;
      p.resumeLink = link ? { reader: link.reader, key: link.key } : undefined;
    }
    if (action === 'stop') {
      delete p.resumeLink;
      p.locked = true;
    }
    const want = action === 'enable' ? true : action === 'stop' ? false : p.want;
    if (!want && !p.want && p.confirmed) return;
    let body: object = { op: 'stop' };
    if (want) {
      const reg = await navigator.serviceWorker.getRegistration('/cidadao/');
      if (reg && Date.now() - checkedWorkerAt > 3600000) {
        checkedWorkerAt = Date.now();
        void reg.update().catch(() => {});
      }
      const subscription = sub ?? (await reg?.pushManager.getSubscription());
      if (!subscription || Notification.permission !== 'granted') {
        if (action === 'enable') throw Error('Inscrição não confirmada pelo aparelho.');
        p.want = false;
        p.confirmed = false;
        p.signature = '';
        p.revision++;
        save(scope, p);
        await call({ op: 'stop', revision: p.revision }, p.owner);
        p.confirmed = true;
        save(scope, p);
        throw Error('A permissão de avisos mudou. Ative novamente para receber notificações.');
      }
      body = {
        op: 'sync',
        subscription: subscription.toJSON(),
        schedule: pushSchedule(
          await readDiary(scope),
          view,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
      };
    }
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body))),
      ),
      (v) => v.toString(16).padStart(2, '0'),
    ).join('');
    if (signature !== p.signature || want !== p.want || action === 'enable') {
      p.signature = signature;
      p.revision++;
      p.want = want;
      p.confirmed = false;
      save(scope, p);
    }
    if (p.confirmed && Date.now() - p.verifiedAt < 60000) {
      await attachCurrentGrant(scope, p);
      return;
    }
    const response = await call(
      p.confirmed ? { op: 'status' } : { ...body, revision: p.revision },
      p.owner,
    );
    if (want && !response.active) {
      p.want = false;
      p.signature = '';
      p.confirmed = true;
      save(scope, p);
      throw Error('A inscrição expirou. Ative novamente os avisos.');
    }
    Object.assign(p, {
      confirmed: true,
      verifiedAt: Date.now(),
      testAt: response.testAt,
      acceptedAt: response.acceptedAt,
    });
    save(scope, p);
    await attachCurrentGrant(scope, p);
  });
}
export async function schedulePushTest(scope: CareScope) {
  return navigator.locks.request(key(scope), async () => {
    const p = get(scope);
    if (!p?.want || !p.confirmed) throw Error('Ative e sincronize os avisos primeiro.');
    const result = await call({ op: 'test' }, p.owner);
    if (!result.testAt) throw Error('O teste não foi agendado.');
    p.testAt = result.testAt;
    p.verifiedAt = Date.now();
    save(scope, p);
    return result.testAt as number;
  });
}
