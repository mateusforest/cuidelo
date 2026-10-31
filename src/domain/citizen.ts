import type { Context, Database, AppointmentStatus } from './model';
import { can } from './model';
import { identityFor } from './access';
import { DomainError } from './errors';
import { validateDocumentContent, type DocumentContent } from './clinical-documents';

export type CitizenContent = Extract<
  DocumentContent,
  { kind: 'prescription' | 'exams' | 'certificate' }
>;
export interface CitizenAppointment {
  id: string;
  unit: string;
  service: string;
  professional: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  rescheduled: boolean;
}
export interface CitizenDocument {
  id: string;
  number: string;
  unit: string;
  professional: string;
  person: string;
  issuedAt: string;
  status: 'issued' | 'cancelled';
  content: CitizenContent;
}
export interface CitizenView {
  careScope?: { organization: string; subject: string };
  version: 1;
  person: string;
  organization: string;
  asOf: string;
  appointments: CitizenAppointment[];
  documents: CitizenDocument[];
}
const allowed = (content: DocumentContent): content is CitizenContent =>
  ['prescription', 'exams', 'certificate'].includes(content.kind);

// A equipe disponibiliza somente a leitura de uma pessoa da sua prefeitura.
export function citizenView(db: Database, c: Context, patientId: string, now: Date): CitizenView {
  identityFor(db, c);
  if (!can(c.role, 'clinical') || c.unitId === 'all')
    throw new DomainError(
      'Esta sessão não pode disponibilizar documentos do consultório.',
      'permission',
    );
  const patient = db.patients.find(
    (p) => p.id === patientId && p.organizationId === c.organizationId,
  );
  if (!patient) throw new DomainError('Pessoa não encontrada nesta prefeitura.', 'scope');
  const units = new Map(
    db.units.filter((u) => u.organizationId === c.organizationId).map((u) => [u.id, u.name]),
  );
  const belongs = (r: { organizationId: string; unitId: string; patientId: string }) =>
    r.organizationId === c.organizationId && r.patientId === patient.id && units.has(r.unitId);
  const appointments = db.appointments
    .filter(belongs)
    .map((a) => ({
      id: a.id,
      unit: units.get(a.unitId)!,
      service: a.service,
      professional: a.professional,
      date: a.date,
      time: a.time,
      duration: a.duration,
      status: a.status,
      rescheduled: !!a.reschedules?.length,
    }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const documents: CitizenDocument[] = [];
  for (const d of db.clinicalDocuments) {
    if (
      !belongs(d) ||
      !allowed(d.content) ||
      !d.number ||
      !d.identity ||
      !d.issuedAt ||
      (d.status !== 'issued' && d.status !== 'cancelled')
    )
      continue;
    const content = validateDocumentContent(d.content, true) as CitizenContent;
    documents.push({
      id: d.id,
      number: d.number,
      unit: d.identity.unit,
      professional: d.identity.professional,
      person: d.identity.socialName || d.identity.name,
      issuedAt: d.issuedAt,
      status: d.status,
      content,
    });
  }
  documents.sort(
    (a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number),
  );
  return {
    version: 1,
    person: patient.socialName || patient.name,
    organization: db.organizations.find((o) => o.id === c.organizationId)!.shortName,
    asOf: now.toISOString(),
    appointments,
    documents,
  };
}
