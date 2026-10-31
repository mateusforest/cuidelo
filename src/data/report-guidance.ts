import type { CareRepository } from './repository';
import type { Command, Context, ReportReview } from '../domain/model';
import { careKey, type CareScope } from '../domain/citizen-care';
import { patientGuidance, validGuidance, type PatientGuidance } from '../domain/report-review';
import {
  normalizeReportCode,
  legacyReceiptToken,
  reportCode,
  replyProof,
  reportCipherKey,
  reportReader,
  reportReference,
} from '../domain/report-code.mjs';
import {
  CitizenLinkError,
  type CitizenLink,
  citizenRequest,
  decryptCitizenPayload,
  encryptCitizenPayload,
} from './citizen-links';
import { retainedReport, readReport, tabReportCode } from './report-sharing';
import { rememberGuidanceRead, guidanceInbox, trackGuidance, mergeGuidance } from './citizen-care';

export type RevisionChange = (before: number, after: number) => void;
async function commit(repo: CareRepository, c: Context, cmd: Command, changed: RevisionChange) {
  const before = repo.getRevision(),
    id = await repo.execute(c, cmd, before);
  changed(before, repo.getRevision());
  return id;
}
export async function recordReview(
  repo: CareRepository,
  c: Context,
  eid: string,
  code: string,
  changed: RevisionChange,
) {
  const r = await readReport(repo, c, eid, code),
    e = repo.snapshot(c).encounters.find((e) => e.id === eid);
  if (!e) throw Error('Atendimento indisponível.');
  return commit(
    repo,
    c,
    {
      type: 'report.review',
      encounterId: eid,
      patientId: e.patientId,
      reportRef: r.ref,
      from: r.report.from,
      to: r.report.to,
    },
    changed,
  );
}
function ownReview(repo: CareRepository, c: Context, id: string) {
  const r = repo
    .snapshot(c)
    .reportReviews.find(
      (r) =>
        r.id === id &&
        r.organizationId === c.organizationId &&
        r.unitId === c.unitId &&
        r.actorId === c.sessionId,
    );
  if (!r || c.role !== 'clinical') throw Error('Orientação indisponível nesta sessão médica.');
  return r;
}
export async function recordGuidance(
  repo: CareRepository,
  c: Context,
  id: string,
  code: string,
  mid: string,
  text: string,
  changed: RevisionChange,
) {
  const r = ownReview(repo, c, id),
    active = await readReport(repo, c, r.encounterId, code);
  if (!active.canReply) throw Error('Peça à pessoa um novo código para receber orientações.');
  if (active.ref !== r.reportRef) throw Error('Abra a mesma cópia que foi revisada.');
  return commit(repo, c, { type: 'report.guidance', reviewId: id, messageId: mid, text }, changed);
}
interface Packet {
  token: string;
  body: {
    op: 'report.reply';
    sender: Context;
    id: string;
    proof: string;
    binding: string;
    digest: string;
    payload: string;
  };
}
const packetKey = (c: Context, r: ReportReview, id: string) =>
  'cuidelo.guidance.pending.' + JSON.stringify([c.organizationId, c.unitId, c.sessionId, r.id, id]);
export async function sendGuidance(
  repo: CareRepository,
  c: Context,
  rid: string,
  id: string,
  changed: RevisionChange,
) {
  return navigator.locks.request(
    'cuidelo.send-guidance.' + JSON.stringify([c.organizationId, c.unitId, c.sessionId, rid, id]),
    async () => {
      const r = ownReview(repo, c, rid),
        m = r.messages.find((m) => m.id === id);
      if (!m) throw Error('Orientação não encontrada no prontuário.');
      const key = packetKey(c, r, id);
      if (m.sentAt) {
        localStorage.removeItem(key);
        return;
      }
      const saved = localStorage.getItem(key);
      let packet: Packet;
      if (saved) packet = JSON.parse(saved);
      else {
        const code = normalizeReportCode(tabReportCode(c, r.encounterId));
        if ((await reportReference(code)) !== r.reportRef)
          throw Error('Reabra o código desta revisão para tentar o envio.');
        const active = await readReport(repo, c, r.encounterId, code);
        const message = patientGuidance(r, m);
        const payload = await encryptCitizenPayload(
          { ref: r.reportRef, message },
          await reportCipherKey(code),
        );
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))),
          (v) => v.toString(16).padStart(2, '0'),
        ).join('');
        packet = {
          token: await reportReader(code),
          body: {
            op: 'report.reply',
            sender: c,
            id,
            proof: await replyProof(code),
            binding: active.binding,
            digest,
            payload,
          },
        };
        localStorage.setItem(key, JSON.stringify(packet));
      }
      const { sentAt, tracking } = await citizenRequest(packet.body, packet.token);
      if (typeof sentAt !== 'string' || !Number.isFinite(Date.parse(sentAt)))
        throw Error('Sem confirmação do envio.');
      await commit(
        repo,
        c,
        { type: 'report.sent', reviewId: rid, messageId: id, sentAt, tracking },
        changed,
      );
      localStorage.removeItem(key);
    },
  );
}
export async function syncGuidance(scope: CareScope) {
  return navigator.locks.request('cuidelo.guidance.sync.' + careKey(scope), async () => {
    const current = retainedReport(scope);
    if (current) await trackGuidance(scope, current.owner, current.expires);
    const box = await guidanceInbox(scope);
    const failures = await Promise.allSettled(
      box.handles
        .filter((h) => !h.settled)
        .map(async (h) => {
          const result = await citizenRequest({ op: 'report.inbox' }, h.owner);
          if (!Array.isArray(result.messages) || !Number.isSafeInteger(result.checkedAt))
            throw Error('Resposta inválida.');
          const code = await reportCode(h.owner);
          const ref = await reportReference(code),
            cipher = await reportCipherKey(code);
          const rows: PatientGuidance[] = [];
          for (const envelope of result.messages) {
            const existing = box.messages.find((m) => m.id === envelope.id);
            if (existing) {
              if (
                !existing.readAt &&
                envelope.readAt &&
                Number.isFinite(Date.parse(envelope.readAt))
              )
                rows.push({ ...existing, readAt: envelope.readAt });
              continue;
            }
            const opened = (await decryptCitizenPayload(envelope.payload, cipher)) as {
              ref: string;
              message: PatientGuidance;
            };
            if (
              opened?.ref !== ref ||
              !validGuidance(opened.message) ||
              opened.message.id !== envelope.id
            )
              throw Error('Não foi possível conferir a orientação.');
            rows.push({ ...opened.message, readAt: envelope.readAt });
          }
          await mergeGuidance(scope, h.owner, rows, result.checkedAt);
        }),
    );
    if (failures.some((v) => v.status === 'rejected'))
      throw Error('Não foi possível atualizar todas as orientações. Tente novamente com internet.');
  });
}

export async function confirmGuidanceRead(
  scope: CareScope,
  message: PatientGuidance,
  link?: CitizenLink,
) {
  if (!validGuidance(message)) throw Error('Orientação inválida.');
  const box = await guidanceInbox(scope);
  let result: { readAt: string } | undefined;
  if (box.messages.some((m) => m.id === message.id)) {
    for (const h of [...box.handles].reverse()) {
      try {
        result = await citizenRequest({ op: 'report.ack', id: message.id }, h.owner);
        break;
      } catch (e) {
        if (!(e instanceof CitizenLinkError && e.unavailable)) throw e;
      }
    }
  }
  if (!result && link && message.ack)
    result = await citizenRequest(
      { op: 'report.linkAck', id: message.id, ...message.ack },
      link.reader,
    );
  if (!result || !Number.isFinite(Date.parse(result.readAt)))
    throw Error(
      'Abra esta orientação no aparelho que compartilhou o relatório para confirmar a leitura.',
    );
  await rememberGuidanceRead(scope, message.id, result.readAt);
  return result.readAt;
}
export async function syncReadReceipts(
  repo: CareRepository,
  c: Context,
  encounterId: string,
  changed: RevisionChange,
) {
  if (c.role !== 'clinical') return;
  const rows = repo
    .snapshot(c)
    .reportReviews.filter((r) => r.encounterId === encounterId && r.unitId === c.unitId);
  for (const r of rows)
    for (const m of r.messages) {
      if (m.readAt || !m.sentAt) continue;
      const { readAt } = m.tracking
        ? await citizenRequest(
            { op: 'report.status', id: m.id, box: m.tracking.box },
            m.tracking.token,
          )
        : await citizenRequest(
            { op: 'report.legacyStatus', id: m.id },
            await legacyReceiptToken(r.reportRef, m.id),
          );
      if (readAt)
        await commit(
          repo,
          c,
          { type: 'report.confirmed', reviewId: r.id, messageId: m.id, readAt },
          changed,
        );
    }
}
