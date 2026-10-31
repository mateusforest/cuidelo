import { identityFor } from './access';
import { ownCare } from './patient-flow';
import { validDay } from './dates';
import { DomainError } from './errors';
import type { Command, Context, Database, ReportReview, GuidanceMessage } from './model';

type ReviewCommand = Extract<
  Command,
  { type: 'report.review' | 'report.guidance' | 'report.sent' }
>;
const validPeriod = (from: string, to: string) => validDay(from) && validDay(to) && from <= to;
const validRef = (v: string) => /^[a-f0-9]{64}$/.test(v);
export const messageId = (v: string) =>
  typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export const guidanceText = (v: string) => typeof v === 'string' && !!v.trim() && v.length <= 3000;
const date = (v: string) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function applyReportReview(
  db: Database,
  c: Context,
  cmd: ReviewCommand,
  at: string,
  newId: () => string,
) {
  const actor = identityFor(db, c);
  if (c.role !== 'clinical')
    throw new DomainError('Somente a equipe médica registra a revisão.', 'permission');
  const review =
    cmd.type === 'report.review'
      ? undefined
      : db.reportReviews.find(
          (r) =>
            r.id === cmd.reviewId &&
            r.organizationId === c.organizationId &&
            r.unitId === c.unitId &&
            r.actorId === c.sessionId,
        );
  const eid = cmd.type === 'report.review' ? cmd.encounterId : review?.encounterId;
  const e = db.encounters.find(
    (e) => e.id === eid && e.organizationId === c.organizationId && e.unitId === c.unitId,
  );
  if (!e || e.status === 'closed-without-care')
    throw new DomainError('Atendimento indisponível nesta sessão.', 'scope');
  if (cmd.type === 'report.review') {
    ownCare(e, c);
    if (e.patientId !== cmd.patientId || !validPeriod(cmd.from, cmd.to) || !validRef(cmd.reportRef))
      throw new DomainError('Confira o paciente e o período do relatório.');
    const prior = db.reportReviews.find(
      (r) => r.encounterId === e.id && r.actorId === c.sessionId && r.reportRef === cmd.reportRef,
    );
    if (prior) return { id: prior.id, action: '' };
    const id = newId();
    db.reportReviews.push({
      id,
      organizationId: c.organizationId,
      unitId: c.unitId,
      patientId: e.patientId,
      encounterId: e.id,
      actorId: c.sessionId,
      author: actor.name,
      unit: db.units.find((u) => u.id === c.unitId)!.name,
      reviewedAt: at,
      from: cmd.from,
      to: cmd.to,
      reportRef: cmd.reportRef,
      messages: [],
    });
    return { id, action: 'Revisão do relatório do Dia a dia registrada' };
  }
  if (!review || e.patientId !== review.patientId || !messageId(cmd.messageId))
    throw new DomainError('Revisão indisponível neste atendimento.');
  const m = review.messages.find((m) => m.id === cmd.messageId);
  if (cmd.type === 'report.guidance') {
    ownCare(e, c);
    if (!guidanceText(cmd.text))
      throw new DomainError('Escreva uma orientação de até 3.000 caracteres.');
    if (m) {
      if (m.text !== cmd.text.trim())
        throw new DomainError('Esta orientação já possui outro texto.');
      return { id: m.id, action: '' };
    }
    if (
      db.reportReviews.some(
        (other) => other.id !== review.id && other.messages.some((m) => m.id === cmd.messageId),
      )
    )
      throw new DomainError('Identificador de orientação já utilizado.');
    review.messages.push({ id: cmd.messageId, text: cmd.text.trim(), at });
    return { id: cmd.messageId, action: 'Orientação ao cidadão registrada no prontuário' };
  }
  if (!m || !date(cmd.sentAt)) throw new DomainError('Confirmação de envio inválida.');
  if (m.sentAt) return { id: m.id, action: '' };
  m.sentAt = cmd.sentAt;
  return { id: m.id, action: 'Envio da orientação ao app confirmado' };
}
export function validateReviews(db: Database) {
  const seen = new Set<string>(),
    messages = new Set<string>();
  for (const r of db.reportReviews) {
    const e = db.encounters.find(
      (e) =>
        e.id === r.encounterId &&
        e.organizationId === r.organizationId &&
        e.unitId === r.unitId &&
        e.patientId === r.patientId,
    );
    const unique = JSON.stringify([r.organizationId, r.encounterId, r.reportRef, r.actorId]);
    if (
      !e ||
      seen.has(unique) ||
      !validPeriod(r.from, r.to) ||
      !validRef(r.reportRef) ||
      !date(r.reviewedAt) ||
      !r.author?.trim() ||
      !r.unit?.trim() ||
      !r.actorId?.trim() ||
      !Array.isArray(r.messages) ||
      new Set(r.messages.map((m) => m.id)).size !== r.messages.length ||
      r.messages.some(
        (m) =>
          !messageId(m.id) ||
          !guidanceText(m.text) ||
          !date(m.at) ||
          (m.sentAt !== undefined && !date(m.sentAt)),
      )
    )
      throw Error('Registro de revisão do relatório inválido.');
    for (const m of r.messages) {
      if (messages.has(m.id)) throw Error('Orientação duplicada.');
      messages.add(m.id);
    }
    seen.add(unique);
  }
}
export function patientGuidance(r: ReportReview, m: GuidanceMessage) {
  return {
    id: m.id,
    text: m.text,
    at: m.at,
    author: r.author,
    unit: r.unit,
    from: r.from,
    to: r.to,
  };
}
export type PatientGuidance = ReturnType<typeof patientGuidance>;
export function validGuidance(g: PatientGuidance) {
  return (
    !!g &&
    messageId(g.id) &&
    guidanceText(g.text) &&
    date(g.at) &&
    typeof g.author === 'string' &&
    !!g.author.trim() &&
    g.author.length <= 200 &&
    typeof g.unit === 'string' &&
    !!g.unit.trim() &&
    g.unit.length <= 200 &&
    validPeriod(g.from, g.to)
  );
}
