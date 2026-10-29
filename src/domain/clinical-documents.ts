import type { Context, Database, Encounter, Scoped } from './model';
import { can } from './model';
import { demoIdentities, identityFor } from './access';
import { DomainError } from './errors';
import { dateKey, validDay, validTime } from './dates';

export interface MedicationLine {
  id: string;
  medicine: string;
  strength: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  quantityUnit: string;
  instructions: string;
}
export interface ExamLine {
  id: string;
  name: string;
  material: string;
  notes: string;
}
export type DocumentContent =
  | { kind: 'prescription'; items: MedicationLine[]; orientations: string }
  | {
      kind: 'exams';
      items: ExamLine[];
      indication: string;
      priority: 'routine' | 'urgent';
      priorityReason: string;
    }
  | {
      kind: 'referral';
      specialty: string;
      destination: string;
      reason: string;
      summary: string;
      priority: 'routine' | 'urgent';
      priorityReason: string;
    };
export type DocumentKind = DocumentContent['kind'];
export const documentNames: Record<DocumentKind, string> = {
  prescription: 'Receita',
  exams: 'Pedido de exames',
  referral: 'Encaminhamento',
};
export interface DocumentIdentity {
  name: string;
  socialName: string;
  birthDate: string;
  cpf: string;
  record: string;
  organization: string;
  unit: string;
  professional: string;
}
export interface ExamEvent {
  id: string;
  itemId: string;
  kind: 'scheduled' | 'performed' | 'result' | 'reviewed';
  at: string;
  actorId: string;
  date: string;
  time: string;
  location: string;
  note: string;
}
export interface ClinicalDocument extends Scoped {
  unitId: string;
  patientId: string;
  encounterId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'draft' | 'issued' | 'cancelled' | 'discarded';
  content: DocumentContent;
  number?: string;
  issuedAt?: string;
  identity?: DocumentIdentity;
  referralId?: string;
  history: {
    at: string;
    actorId: string;
    action: 'created' | 'updated' | 'issued' | 'cancelled' | 'discarded';
    reason: string;
  }[];
  examEvents: ExamEvent[];
}
export type ClinicalDocumentCommand =
  | {
      type: 'document.save';
      encounterId: string;
      id?: string;
      expectedVersion: number;
      content: DocumentContent;
    }
  | { type: 'document.issue'; id: string; expectedVersion: number; reviewed: boolean }
  | { type: 'document.cancel'; id: string; expectedVersion: number; reason: string }
  | { type: 'document.discard'; id: string; expectedVersion: number; reason: string }
  | {
      type: 'exam.event';
      id: string;
      expectedVersion: number;
      itemId: string;
      kind: ExamEvent['kind'];
      date: string;
      time: string;
      location: string;
      note: string;
    };

function ensure(value: unknown, message: string, code = 'conflict'): asserts value {
  if (!value) throw new DomainError(message, code);
}
function text(value: unknown, label: string, max: number, required = false): string {
  ensure(
    typeof value === 'string' && value.length <= max,
    `${label}: limite de ${max} caracteres.`,
    'validation',
  );
  ensure(
    !required || !!value.trim(),
    `Preencha ${label.toLocaleLowerCase('pt-BR')} antes de emitir.`,
    'validation',
  );
  return value.trim();
}
export function validateDocumentContent(raw: DocumentContent, complete = false): DocumentContent {
  ensure(
    raw && ['prescription', 'exams', 'referral'].includes(raw.kind),
    'Tipo de documento inválido.',
  );
  if (raw.kind === 'referral') {
    ensure(['routine', 'urgent'].includes(raw.priority), 'Informe a prioridade do encaminhamento.');
    return {
      kind: raw.kind,
      specialty: text(raw.specialty, 'Especialidade', 160, complete),
      destination: text(raw.destination, 'Destino', 200, complete),
      reason: text(raw.reason, 'Justificativa', 3000, complete),
      summary: text(raw.summary, 'Resumo para o serviço', 4000),
      priority: raw.priority,
      priorityReason: text(
        raw.priorityReason,
        'Justificativa da prioridade',
        1000,
        complete && raw.priority === 'urgent',
      ),
    };
  }
  ensure(
    Array.isArray(raw.items) && raw.items.length >= 1 && raw.items.length <= 20,
    'Inclua de 1 a 20 itens.',
  );
  ensure(
    raw.items.every((i) => i && typeof i.id === 'string' && /^[\w-]{1,80}$/.test(i.id)) &&
      new Set(raw.items.map((i) => i.id)).size === raw.items.length,
    'Itens com identificação inválida ou repetida.',
  );
  if (raw.kind === 'prescription')
    return {
      kind: raw.kind,
      orientations: text(raw.orientations, 'Orientações gerais', 3000),
      items: raw.items.map((i) => {
        const quantity = text(i.quantity, 'Quantidade', 8, complete);
        ensure(
          !quantity ||
            (/^\d+$/.test(quantity) && Number(quantity) > 0 && Number(quantity) <= 99999),
          'A quantidade deve ser um número inteiro entre 1 e 99999.',
        );
        return {
          id: i.id,
          medicine: text(i.medicine, 'Medicamento', 200, complete),
          strength: text(i.strength, 'Concentração', 100, complete),
          form: text(i.form, 'Apresentação', 100, complete),
          dose: text(i.dose, 'Dose por administração', 200, complete),
          route: text(i.route, 'Via de administração', 100, complete),
          frequency: text(i.frequency, 'Frequência', 200, complete),
          duration: text(i.duration, 'Duração', 200, complete),
          quantity,
          quantityUnit: text(i.quantityUnit, 'Unidade da quantidade', 100, complete),
          instructions: text(i.instructions, 'Orientação do item', 1000),
        };
      }),
    };
  ensure(['routine', 'urgent'].includes(raw.priority), 'Informe a prioridade do pedido.');
  const names = raw.items
    .map((i) => text(i.name, 'Nome do exame', 200, complete).toLocaleLowerCase('pt-BR'))
    .filter(Boolean);
  ensure(new Set(names).size === names.length, 'Há exames repetidos no mesmo pedido.');
  return {
    kind: raw.kind,
    indication: text(raw.indication, 'Indicação do pedido', 3000, complete),
    priority: raw.priority,
    priorityReason: text(
      raw.priorityReason,
      'Justificativa da prioridade',
      1000,
      complete && raw.priority === 'urgent',
    ),
    items: raw.items.map((i) => ({
      id: i.id,
      name: text(i.name, 'Nome do exame', 200, complete),
      material: text(i.material, 'Material ou região', 200),
      notes: text(i.notes, 'Observação do exame', 1000),
    })),
  };
}
export function examState(doc: ClinicalDocument, itemId: string): ExamEvent['kind'] | 'requested' {
  return doc.examEvents.filter((e) => e.itemId === itemId).at(-1)?.kind ?? 'requested';
}
function member(db: Database, c: Context, id: string) {
  const doc = db.clinicalDocuments.find(
    (d) => d.id === id && d.organizationId === c.organizationId && d.unitId === c.unitId,
  );
  ensure(doc, 'Documento não encontrado nesta unidade.', 'scope');
  return doc;
}
function activeOwner(e: Encounter, c: Context) {
  ensure(
    c.role === 'clinical',
    'A emissão de documentos desta versão está disponível no perfil médico.',
    'permission',
  );
  ensure(
    e.professionalId === c.sessionId,
    'Assuma este atendimento antes de registrar documentos.',
    'permission',
  );
  ensure(
    e.status === 'in-care' || e.status === 'observation',
    'O atendimento precisa estar em andamento.',
  );
}
export function cancelReferralDocument(
  db: Database,
  referralId: string,
  c: Context,
  reason: string,
  at: string,
) {
  const doc = db.clinicalDocuments.find((d) => d.referralId === referralId);
  if (doc && doc.status === 'issued') {
    doc.status = 'cancelled';
    doc.updatedAt = at;
    doc.version++;
    doc.history.push({ at, actorId: c.sessionId, action: 'cancelled', reason });
  }
}
export function applyDocumentCommand(
  db: Database,
  c: Context,
  cmd: ClinicalDocumentCommand,
  now: Date,
  newId: () => string,
) {
  const at = now.toISOString();
  if (cmd.type === 'document.save') {
    const e = db.encounters.find(
      (e) =>
        e.id === cmd.encounterId && e.organizationId === c.organizationId && e.unitId === c.unitId,
    );
    ensure(e, 'Atendimento não encontrado nesta unidade.', 'scope');
    activeOwner(e, c);
    const content = validateDocumentContent(cmd.content),
      existing = cmd.id ? member(db, c, cmd.id) : undefined;
    if (existing) {
      ensure(
        existing.encounterId === e.id && existing.authorId === c.sessionId,
        'Este rascunho pertence a outro atendimento ou profissional.',
        'permission',
      );
      ensure(
        existing.status === 'draft',
        'O conteúdo emitido está preservado. Crie outro documento.',
        'immutable',
      );
      ensure(
        existing.version === cmd.expectedVersion,
        'O documento mudou. Reabra a versão atual antes de salvar.',
      );
      ensure(existing.content.kind === content.kind, 'O tipo do documento não pode ser alterado.');
      existing.content = content;
      existing.version++;
      existing.updatedAt = at;
      existing.history.push({ at, actorId: c.sessionId, action: 'updated', reason: '' });
      return { entityId: existing.id, action: 'Rascunho de documento clínico atualizado' };
    }
    ensure(cmd.expectedVersion === 0, 'Reabra o formulário para criar o documento.');
    const doc: ClinicalDocument = {
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      patientId: e.patientId,
      encounterId: e.id,
      authorId: c.sessionId,
      createdAt: at,
      updatedAt: at,
      version: 1,
      status: 'draft',
      content,
      history: [{ at, actorId: c.sessionId, action: 'created', reason: '' }],
      examEvents: [],
    };
    db.clinicalDocuments.push(doc);
    return { entityId: doc.id, action: 'Rascunho de documento clínico criado' };
  }
  const doc = member(db, c, cmd.id);
  ensure(
    doc.version === cmd.expectedVersion,
    'O documento mudou. Reabra a versão atual antes de continuar.',
  );
  if (cmd.type === 'exam.event') {
    ensure(can(c.role, 'clinical'), 'Este perfil não acompanha resultados clínicos.', 'permission');
    ensure(
      doc.status === 'issued' && doc.content.kind === 'exams',
      'Somente pedidos de exames emitidos podem ser acompanhados.',
    );
    ensure(
      doc.content.items.some((i) => i.id === cmd.itemId),
      'Exame não encontrado neste pedido.',
    );
    ensure(
      ['scheduled', 'performed', 'result', 'reviewed'].includes(cmd.kind),
      'Etapa de exame inválida.',
    );
    const state = examState(doc, cmd.itemId),
      events = doc.examEvents.filter((e) => e.itemId === cmd.itemId);
    const note = text(
      cmd.note,
      'Registro do acompanhamento',
      5000,
      cmd.kind === 'result' || cmd.kind === 'reviewed',
    );
    const date = text(cmd.date, 'Data', 10),
      time = text(cmd.time, 'Horário', 5),
      location = text(cmd.location, 'Local', 200);
    ensure(validDay(date), 'Informe uma data válida.');
    ensure(date >= dateKey(new Date(doc.issuedAt!)), 'A data não pode ser anterior ao pedido.');
    if (cmd.kind === 'scheduled') {
      ensure(['requested', 'scheduled'].includes(state), 'O exame já avançou além do agendamento.');
      ensure(
        date >= dateKey(now) && validTime(time) && !!location,
        'Informe data a partir de hoje, horário e local do agendamento.',
      );
    } else {
      ensure(date <= dateKey(now), 'Não é possível registrar realização ou resultado no futuro.');
      if (cmd.kind === 'performed')
        ensure(
          ['requested', 'scheduled'].includes(state),
          'A realização já foi registrada ou há resultado disponível.',
        );
      if (cmd.kind === 'result')
        ensure(
          state !== 'reviewed',
          'O resultado já foi revisado. Registre um novo pedido para complementação.',
        );
      if (cmd.kind === 'reviewed') {
        ensure(
          c.role === 'clinical',
          'A revisão do resultado nesta versão é feita pelo perfil médico.',
          'permission',
        );
        ensure(state === 'result', 'Registre o resultado antes da revisão.');
      }
      const previous = events.filter((e) => e.kind !== 'scheduled').at(-1);
      ensure(
        !previous || date >= previous.date,
        'A data não pode anteceder a última etapa registrada.',
      );
    }
    doc.examEvents.push({
      id: newId(),
      itemId: cmd.itemId,
      kind: cmd.kind,
      at,
      actorId: c.sessionId,
      date,
      time,
      location,
      note,
    });
    doc.version++;
    doc.updatedAt = at;
    return { entityId: doc.id, action: 'Acompanhamento de exame registrado' };
  }
  const e = db.encounters.find((e) => e.id === doc.encounterId)!;
  if (cmd.type === 'document.discard') {
    activeOwner(e, c);
    ensure(doc.status === 'draft', 'Somente rascunhos podem ser descartados.');
    const reason = text(cmd.reason, 'Motivo do descarte', 1000, true);
    doc.status = 'discarded';
    doc.version++;
    doc.updatedAt = at;
    doc.history.push({ at, actorId: c.sessionId, action: 'discarded', reason });
    return { entityId: doc.id, action: 'Rascunho clínico descartado com justificativa' };
  }
  ensure(
    c.role === 'clinical' && doc.authorId === c.sessionId,
    'Somente o médico autor pode emitir ou cancelar este documento.',
    'permission',
  );
  if (cmd.type === 'document.cancel') {
    ensure(doc.status === 'issued', 'Somente documentos emitidos podem ser cancelados.');
    const reason = text(cmd.reason, 'Motivo do cancelamento', 1000, true);
    ensure(
      !doc.examEvents.some((e) => ['performed', 'result', 'reviewed'].includes(e.kind)),
      'Este pedido possui realização ou resultado. O histórico deve ser preservado; registre um novo pedido para complementação.',
    );
    const referral = doc.referralId ? db.referrals.find((r) => r.id === doc.referralId) : undefined;
    ensure(
      referral?.status !== 'completed',
      'O encaminhamento já foi concluído com contrarreferência.',
    );
    if (referral) {
      referral.status = 'cancelled';
      referral.cancellationReason = reason;
      (referral.history ??= []).push({
        at,
        actorId: c.sessionId,
        action: 'cancelled',
        note: reason,
      });
    }
    doc.status = 'cancelled';
    doc.version++;
    doc.updatedAt = at;
    doc.history.push({ at, actorId: c.sessionId, action: 'cancelled', reason });
    return { entityId: doc.id, action: 'Documento clínico cancelado; conteúdo preservado' };
  }
  activeOwner(e, c);
  ensure(doc.status === 'draft', 'Este documento já foi emitido ou descartado.');
  ensure(cmd.reviewed === true, 'Confirme a revisão dos dados e dos itens antes de emitir.');
  const content = validateDocumentContent(doc.content, true);
  const patient = db.patients.find(
    (p) => p.id === e.patientId && p.organizationId === c.organizationId,
  )!;
  const prefix = { prescription: 'RX', exams: 'EX', referral: 'EN' }[content.kind];
  const sequence =
    1 +
    Math.max(
      0,
      ...db.clinicalDocuments
        .filter(
          (d) =>
            d.organizationId === c.organizationId && d.content.kind === content.kind && d.number,
        )
        .map((d) => Number(d.number!.split('-')[2])),
    );
  const number = `DEMO-${prefix}-${String(sequence).padStart(4, '0')}`;
  const identity: DocumentIdentity = {
    name: patient.name,
    socialName: patient.socialName,
    birthDate: patient.birthDate,
    cpf: patient.cpf ?? '',
    record: patient.record,
    organization: db.organizations.find((o) => o.id === c.organizationId)!.name,
    unit: db.units.find((u) => u.id === c.unitId)!.name,
    professional: identityFor(db, c).name,
  };
  if (content.kind === 'referral') {
    const referralId = newId();
    db.referrals.push({
      id: referralId,
      organizationId: c.organizationId,
      unitId: c.unitId,
      patientId: e.patientId,
      encounterId: e.id,
      sourceDocumentId: doc.id,
      specialty: content.specialty,
      destination: content.destination,
      reason: content.reason,
      status: 'requested',
      createdAt: at,
      priority: content.priority,
      history: [{ at, actorId: c.sessionId, action: 'requested', note: '' }],
    });
    doc.referralId = referralId;
  }
  Object.assign(doc, {
    content,
    status: 'issued',
    number,
    identity,
    issuedAt: at,
    updatedAt: at,
    version: doc.version + 1,
  });
  doc.history.push({
    at,
    actorId: c.sessionId,
    action: 'issued',
    reason: 'Revisão confirmada na demonstração',
  });
  return {
    entityId: doc.id,
    action: `${documentNames[content.kind]} emitido na demonstração (sem assinatura)`,
  };
}

export function validateClinicalDocuments(db: Database) {
  const identities = demoIdentities(db),
    date = (s: unknown) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  const numbers = new Set<string>();
  for (const doc of db.clinicalDocuments) {
    ensure(
      db.encounters.some(
        (e) =>
          e.id === doc.encounterId &&
          e.organizationId === doc.organizationId &&
          e.unitId === doc.unitId &&
          e.patientId === doc.patientId,
      ),
      'Invalid clinical document link',
    );
    ensure(
      identities.some(
        (i) =>
          i.sessionId === doc.authorId &&
          i.role === 'clinical' &&
          i.organizationId === doc.organizationId &&
          i.unitId === doc.unitId,
      ),
      'Invalid clinical document author',
    );
    ensure(
      Number.isSafeInteger(doc.version) &&
        doc.version > 0 &&
        date(doc.createdAt) &&
        date(doc.updatedAt) &&
        doc.updatedAt >= doc.createdAt,
      'Invalid clinical document version',
    );
    ensure(
      ['draft', 'issued', 'cancelled', 'discarded'].includes(doc.status),
      'Invalid clinical document state',
    );
    validateDocumentContent(doc.content, doc.status === 'issued' || doc.status === 'cancelled');
    ensure(
      Array.isArray(doc.history) && doc.history.length > 0 && Array.isArray(doc.examEvents),
      'Invalid clinical document history',
    );
    for (const h of doc.history)
      ensure(
        date(h.at) &&
          typeof h.reason === 'string' &&
          ['created', 'updated', 'issued', 'cancelled', 'discarded'].includes(h.action) &&
          identities.some(
            (i) =>
              i.sessionId === h.actorId &&
              i.organizationId === doc.organizationId &&
              i.unitId === doc.unitId,
          ),
        'Invalid document history event',
      );
    ensure(
      doc.version === doc.history.length + doc.examEvents.length &&
        doc.history[0].action === 'created' &&
        doc.history[0].at === doc.createdAt,
      'Invalid document revision history',
    );
    const finalAction = {
      draft: ['created', 'updated'],
      issued: ['issued'],
      cancelled: ['cancelled'],
      discarded: ['discarded'],
    }[doc.status];
    ensure(finalAction.includes(doc.history.at(-1)!.action), 'Invalid document final state');
    ensure(
      doc.history.every(
        (h, i) =>
          h.at >= doc.createdAt &&
          h.at <= doc.updatedAt &&
          (!i || h.at >= doc.history[i - 1].at) &&
          (!['cancelled', 'discarded'].includes(h.action) || !!h.reason.trim()),
      ),
      'Invalid document chronology',
    );
    if (doc.status === 'issued' || doc.status === 'cancelled') {
      ensure(
        !!doc.number &&
          /^DEMO-(RX|EX|EN)-\d{4,}$/.test(doc.number) &&
          date(doc.issuedAt) &&
          !!doc.identity,
        'Invalid issued document',
      );
      const key = doc.organizationId + ':' + doc.number;
      ensure(!numbers.has(key), 'Duplicate clinical document number');
      numbers.add(key);
      ensure(
        [
          'name',
          'socialName',
          'birthDate',
          'cpf',
          'record',
          'organization',
          'unit',
          'professional',
        ].every((k) => typeof doc.identity![k as keyof DocumentIdentity] === 'string'),
        'Invalid document identity',
      );
      ensure(
        doc.number!.startsWith(
          `DEMO-${{ prescription: 'RX', exams: 'EX', referral: 'EN' }[doc.content.kind]}-`,
        ) &&
          doc.issuedAt! >= doc.createdAt &&
          doc.issuedAt! <= doc.updatedAt &&
          doc.history.filter((h) => h.action === 'issued').length === 1,
        'Invalid document issuance',
      );
    } else
      ensure(
        !doc.number && !doc.issuedAt && !doc.identity && !doc.referralId && !doc.examEvents.length,
        'Unexpected data in draft',
      );
    if (doc.content.kind === 'referral' && (doc.status === 'issued' || doc.status === 'cancelled'))
      ensure(
        db.referrals.some(
          (r) =>
            r.id === doc.referralId &&
            r.sourceDocumentId === doc.id &&
            r.organizationId === doc.organizationId &&
            r.unitId === doc.unitId &&
            r.patientId === doc.patientId &&
            r.encounterId === doc.encounterId,
        ),
        'Invalid document referral',
      );
    ensure(doc.content.kind === 'referral' || !doc.referralId, 'Unexpected referral link');
    ensure(
      new Set(doc.examEvents.map((e) => e.id)).size === doc.examEvents.length,
      'Duplicate exam events',
    );
    const previousByItem = new Map<string, ExamEvent[]>();
    for (const event of doc.examEvents) {
      ensure(
        doc.content.kind === 'exams' &&
          doc.content.items.some((i) => i.id === event.itemId) &&
          typeof event.id === 'string' &&
          !!event.id &&
          date(event.at) &&
          event.at >= doc.issuedAt! &&
          event.at <= doc.updatedAt &&
          validDay(event.date) &&
          event.date >= dateKey(new Date(doc.issuedAt!)) &&
          typeof event.note === 'string' &&
          event.note.length <= 5000 &&
          typeof event.location === 'string' &&
          event.location.length <= 200 &&
          typeof event.time === 'string' &&
          ['scheduled', 'performed', 'result', 'reviewed'].includes(event.kind) &&
          identities.some(
            (i) =>
              i.sessionId === event.actorId &&
              can(i.role, 'clinical') &&
              (event.kind !== 'reviewed' || i.role === 'clinical') &&
              i.organizationId === doc.organizationId &&
              i.unitId === doc.unitId,
          ),
        'Invalid exam event',
      );
      const previous = previousByItem.get(event.itemId) ?? [],
        state = previous.at(-1)?.kind ?? 'requested';
      ensure(
        event.kind === 'scheduled'
          ? ['requested', 'scheduled'].includes(state) &&
              validTime(event.time) &&
              !!event.location.trim() &&
              event.date >= dateKey(new Date(event.at))
          : event.date <= dateKey(new Date(event.at)),
        'Invalid exam date or schedule',
      );
      if (event.kind === 'performed')
        ensure(['requested', 'scheduled'].includes(state), 'Invalid exam performance');
      if (event.kind === 'result' || event.kind === 'reviewed')
        ensure(
          !!event.note.trim() &&
            (event.kind === 'reviewed' ? state === 'result' : state !== 'reviewed'),
          'Invalid exam result or review',
        );
      const actual = previous.filter((e) => e.kind !== 'scheduled').at(-1);
      ensure(
        !actual || event.kind === 'scheduled' || event.date >= actual.date,
        'Invalid exam chronology',
      );
      previousByItem.set(event.itemId, [...previous, event]);
    }
  }
  for (const r of db.referrals) {
    if (r.sourceDocumentId)
      ensure(
        db.clinicalDocuments.some(
          (d) =>
            d.id === r.sourceDocumentId &&
            d.referralId === r.id &&
            d.organizationId === r.organizationId &&
            d.unitId === r.unitId &&
            d.patientId === r.patientId &&
            (r.status === 'cancelled' ? d.status === 'cancelled' : d.status === 'issued'),
        ),
        'Invalid clinical referral source',
      );
    if (r.priority !== undefined)
      ensure(['routine', 'urgent'].includes(r.priority), 'Invalid referral priority');
    if (r.history !== undefined)
      ensure(
        Array.isArray(r.history) &&
          r.history.every(
            (h) =>
              date(h.at) &&
              ['requested', 'scheduled', 'cancelled', 'completed'].includes(h.action) &&
              typeof h.note === 'string' &&
              identities.some(
                (i) =>
                  i.sessionId === h.actorId &&
                  can(i.role, 'regulation') &&
                  i.unitId === r.unitId &&
                  i.organizationId === r.organizationId,
              ),
          ),
        'Invalid referral history',
      );
    if (r.status === 'completed')
      ensure(
        !!r.response &&
          validDay(r.response.date) &&
          r.response.date >= r.appointmentDate! &&
          date(r.response.at) &&
          r.response.date <= dateKey(new Date(r.response.at)) &&
          typeof r.response.summary === 'string' &&
          !!r.response.summary.trim() &&
          r.response.summary.length <= 4000 &&
          identities.some(
            (i) =>
              i.sessionId === r.response!.actorId &&
              ['clinical', 'regulation'].includes(i.role) &&
              i.unitId === r.unitId &&
              i.organizationId === r.organizationId,
          ),
        'Invalid referral response',
      );
    else ensure(!r.response, 'Unexpected referral response');
  }
}
