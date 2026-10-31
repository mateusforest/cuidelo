import type { CareRepository } from './repository';
import type { Context } from '../domain/model';
import { careKey, type CareScope } from '../domain/citizen-care';
import type { CitizenView } from '../domain/citizen';
import {
  checkReportEncounter,
  citizenReportBinding,
  validateReport,
  type SharedCareReport,
} from '../domain/shared-care-report';
import {
  normalizeReportCode,
  reportCode,
  reportReader,
  reportCipherKey,
  reportBinding,
} from '../domain/report-code.mjs';
import {
  citizenRequest,
  CitizenLinkError,
  encryptCitizenPayload,
  decryptCitizenPayload,
} from './citizen-links';

interface Handle {
  owner: string;
  from: string;
  to: string;
  expires: number;
}
export interface ReportGrant extends Handle {
  code: string;
}
export function tabReportCode(c: Context, encounterId: string, value?: string | null): string {
  if (c.role !== 'clinical' || c.unitId === 'all') return '';
  const id =
    'cuidelo.report.read.v1.' +
    JSON.stringify([c.organizationId, c.unitId, c.sessionId, encounterId]);
  try {
    if (value === null) sessionStorage.removeItem(id);
    if (typeof value === 'string') sessionStorage.setItem(id, normalizeReportCode(value));
    return sessionStorage.getItem(id) ?? '';
  } catch {
    return '';
  }
}
const key = (scope: CareScope) => 'cuidelo.report.grant.v1.' + careKey(scope);
export async function activeReport(scope: CareScope): Promise<ReportGrant | null> {
  const raw = localStorage.getItem(key(scope));
  if (!raw) return null;
  const h: Handle = JSON.parse(raw);
  if (
    !/^[a-f0-9]{64}$/.test(h.owner) ||
    !Number.isSafeInteger(h.expires) ||
    h.expires <= Date.now()
  )
    return null;
  return { ...h, code: await reportCode(h.owner) };
}
export async function shareReport(scope: CareScope, view: CitizenView, report: SharedCareReport) {
  if (!navigator.locks || !crypto.subtle)
    throw Error('Abra o app publicado em um navegador compatível para compartilhar.');
  const binding = await citizenReportBinding(scope, view);
  if (report.person !== view.person)
    throw Error('O relatório não corresponde à pessoa deste diário.');
  validateReport(report);
  return navigator.locks.request(key(scope), async () => {
    const existing = await activeReport(scope);
    if (existing) throw Error('Encerre o código anterior antes de gerar outra cópia.');
    const owner = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const code = await reportCode(owner);
    const payload = await encryptCitizenPayload({ binding, report }, await reportCipherKey(code));
    const { expires } = await citizenRequest({ op: 'report.create', binding, payload }, owner);
    if (!Number.isSafeInteger(expires) || expires <= Date.now())
      throw Error('O servidor não confirmou o prazo do compartilhamento.');
    const handle = { owner, from: report.from, to: report.to, expires };
    try {
      localStorage.setItem(key(scope), JSON.stringify(handle));
    } catch {
      await citizenRequest({ op: 'report.stop' }, owner);
      throw Error('O aparelho não conseguiu guardar o controle deste código.');
    }
    return { ...handle, code };
  });
}
export async function stopReport(scope: CareScope, grant: ReportGrant) {
  await navigator.locks.request(key(scope), async () => {
    const current = await activeReport(scope);
    if (!current || current.owner !== grant.owner) return;
    try {
      await citizenRequest({ op: 'report.stop' }, current.owner);
    } catch (e) {
      if (!(e instanceof CitizenLinkError && e.unavailable)) throw e;
    }
    localStorage.removeItem(key(scope));
  });
}
export async function readReport(
  repo: CareRepository,
  c: Context,
  encounterId: string,
  input: string,
) {
  const e = repo.snapshot(c).encounters.find((row) => row.id === encounterId);
  if (!e) throw Error('Atendimento indisponível na sessão atual.');
  checkReportEncounter(c, e);
  const code = normalizeReportCode(input);
  const person = await repo.citizenView(c, e.patientId);
  const bindings = [await reportBinding(c.organizationId, e.patientId)];
  if (person.careScope)
    bindings.push(await reportBinding(c.organizationId, person.careScope.subject, true));
  const { payload, expires } = await citizenRequest(
    { op: 'report.read', bindings },
    await reportReader(code),
  );
  if (!Number.isSafeInteger(expires) || expires <= Date.now())
    throw Error('O compartilhamento expirou.');
  const packet = (await decryptCitizenPayload(payload, await reportCipherKey(code))) as {
    binding: string;
    report: unknown;
  };
  if (!packet || !bindings.includes(packet.binding))
    throw Error('Esta cópia não corresponde ao paciente aberto.');
  return { expires, report: validateReport(packet.report) };
}
