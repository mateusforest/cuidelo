export type Role =
  | 'manager'
  | 'reception'
  | 'clinical'
  | 'nursing'
  | 'pharmacy'
  | 'regulation'
  | 'admin'
  | 'acs'
  | 'business';
export type Permission =
  | 'patients.read'
  | 'patients.write'
  | 'schedule'
  | 'queue'
  | 'clinical'
  | 'beds'
  | 'stock'
  | 'vaccination'
  | 'vaccine.stock'
  | 'regulation'
  | 'network'
  | 'performance'
  | 'devices'
  | 'territory'
  | 'outreach'
  | 'quality'
  | 'business'
  | 'manage';
export type UnitKind = 'ubs' | 'upa' | 'hospital';
export interface Context {
  sessionId: string;
  organizationId: string;
  unitId: string;
  role: Role;
}
export interface Scoped {
  id: string;
  organizationId: string;
}
export interface Organization {
  id: string;
  name: string;
  shortName: string;
}
export interface Unit extends Scoped {
  name: string;
  kind: UnitKind;
  district: string;
}
export interface Patient extends Scoped {
  cpf?: string;
  name: string;
  socialName: string;
  birthDate: string;
  phone: string;
  record: string;
  allergies: string[];
}
export type AppointmentStatus = 'scheduled' | 'checked-in' | 'cancelled';
export interface Appointment extends Scoped {
  unitId: string;
  patientId: string;
  professional: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  cancellationReason?: string;
}
export type EncounterStatus = 'waiting' | 'in-care' | 'observation' | 'completed';
export interface ReceptionTracking {
  receptionRequired?: boolean;
  receptionEvents?: { at: string; actorId: string; kind: 'absent' | 'returned'; reason: string }[];
  receptionStartedAt?: string;
  receptionStartedBy?: string;
  receptionHold?: { at: string; actorId: string; reason: string };
  receptionChecks?: import('./reception').ReceptionCheck[];
}
export interface Encounter extends Scoped, ReceptionTracking {
  preferenceReason?: import('./kiosk-options').PreferenceReason;
  source?: 'reception' | 'kiosk';
  intakeStartedAt?: string;
  intakeCompletedAt?: string;
  professionalId?: string;
  ticket: string;
  unitId: string;
  patientId: string;
  service: string;
  priority: 'routine' | 'priority';
  status: EncounterStatus;
  arrivedAt: string;
  startedAt?: string;
  completedAt?: string;
}
export interface Soap {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
export interface ClinicalNote extends Scoped {
  encounterId: string;
  patientId: string;
  unitId: string;
  soap: Soap;
  status: 'draft' | 'final';
  updatedAt: string;
  author: string;
  finalizedAt?: string;
}
export interface Vitals {
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}
export interface IntakeContent {
  complaint: string;
  observations: string;
  vitals: Vitals;
}
export interface IntakeRecord extends Scoped, IntakeContent {
  unitId: string;
  patientId: string;
  encounterId: string;
  kind: 'initial' | 'reassessment' | 'correction';
  recordedAt: string;
  author: string;
  correctionOf?: string;
  correctionReason?: string;
}
export interface NoteAddendum extends Scoped {
  unitId: string;
  patientId: string;
  noteId: string;
  text: string;
  reason: string;
  recordedAt: string;
  author: string;
}
export type BedStatus = 'available' | 'occupied' | 'cleaning' | 'blocked';
export interface Bed extends Scoped {
  unitId: string;
  name: string;
  ward: string;
  status: BedStatus;
  reason?: string;
}
export interface Admission extends Scoped {
  unitId: string;
  patientId: string;
  bedId: string;
  admittedAt: string;
  dischargedAt?: string;
  dischargeReason?: string;
}
export interface StockLot extends Scoped {
  unitId: string;
  product: string;
  presentation: string;
  lot: string;
  expiresAt: string;
  quantity: number;
  minimum: number;
}
export interface StockMovement extends Scoped {
  unitId: string;
  lotId: string;
  quantity: number;
  kind: 'entry' | 'exit';
  reason: string;
  at: string;
}
export interface Referral extends Scoped {
  encounterId?: string;
  sourceDocumentId?: string;
  priority?: 'routine' | 'urgent';
  history?: {
    at: string;
    actorId: string;
    action: 'requested' | 'scheduled' | 'cancelled' | 'completed';
    note: string;
  }[];
  response?: { date: string; summary: string; at: string; actorId: string };
  unitId: string;
  patientId: string;
  specialty: string;
  destination: string;
  reason: string;
  status: 'requested' | 'scheduled' | 'cancelled' | 'completed';
  createdAt: string;
  appointmentDate?: string;
  appointmentTime?: string;
  cancellationReason?: string;
}
export interface AuditEvent extends Scoped {
  unitId: string;
  at: string;
  actor: string;
  action: string;
  entityId: string;
}
export interface QueueCall extends Scoped {
  unitId: string;
  encounterId?: string;
  arrivalId?: string;
  ticket: string;
  roomId: string;
  calledAt: string;
}
export interface VaccineLot extends Scoped {
  unitId: string;
  immunobiological: string;
  manufacturer: string;
  batch: string;
  expiresAt: string;
  quantity: number;
  status: 'available' | 'quarantine';
}
export interface VaccineMovement extends Scoped {
  unitId: string;
  lotId: string;
  kind: 'receipt' | 'application' | 'loss' | 'quarantine' | 'release';
  quantity: number;
  reason: string;
  recordedAt: string;
  author: string;
  applicationId?: string;
}
export interface Immunization extends Scoped {
  unitId: string;
  patientId: string;
  source: 'administered' | 'transcribed';
  immunobiological: string;
  dose: string;
  date: string;
  lotId?: string;
  batch: string;
  manufacturer: string;
  route: string;
  site: string;
  strategy: string;
  group: string;
  professional: string;
  institution: string;
  observations: string;
  recordedAt: string;
  author: string;
  recallId?: string;
}
export interface VaccineVoid extends Scoped {
  unitId: string;
  applicationId: string;
  reason: string;
  recordedAt: string;
  author: string;
}
export interface VaccineRecall extends Scoped {
  unitId: string;
  patientId: string;
  immunobiological: string;
  dose: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  applicationId?: string;
  events: { action: string; date: string; reason: string; recordedAt: string; author: string }[];
}
export type VaccinationCommand =
  | {
      type: 'vaccine.lot.create';
      immunobiological: string;
      manufacturer: string;
      batch: string;
      expiresAt: string;
      quantity: number;
    }
  | {
      type: 'vaccine.stock';
      lotId: string;
      kind: 'receipt' | 'loss' | 'quarantine' | 'release';
      quantity: number;
      reason: string;
    }
  | {
      type: 'vaccine.record';
      patientId: string;
      source: Immunization['source'];
      lotId?: string;
      immunobiological: string;
      batch: string;
      manufacturer: string;
      dose: string;
      date: string;
      route: string;
      site: string;
      strategy: string;
      group: string;
      professional: string;
      institution: string;
      observations: string;
      recallId?: string;
    }
  | { type: 'vaccine.void'; applicationId: string; reason: string }
  | {
      type: 'vaccine.recall.create';
      patientId: string;
      immunobiological: string;
      dose: string;
      date: string;
      reason: string;
    }
  | {
      type: 'vaccine.recall.update';
      id: string;
      action: 'reschedule' | 'cancel';
      date: string;
      reason: string;
    };
export interface VaccinationSummary {
  month: string;
  applied: number;
  transcribed: number;
  voided: number;
  overdue: number;
  pending: number;
  byUnit: { unitId: string; applied: number; pending: number; overdue: number }[];
  byImmunobiological: { name: string; applied: number }[];
}
export interface Database {
  clinicalDocuments: import('./clinical-documents').ClinicalDocument[];
  schemaVersion: 8;
  workRecords: WorkRecord[];
  careSegments: CareSegment[];
  kioskArrivals: KioskArrival[];
  vaccineLots: VaccineLot[];
  vaccineMovements: VaccineMovement[];
  immunizations: Immunization[];
  vaccineVoids: VaccineVoid[];
  vaccineRecalls: VaccineRecall[];
  revision: number;
  organizations: Organization[];
  units: Unit[];
  patients: Patient[];
  appointments: Appointment[];
  encounters: Encounter[];
  notes: ClinicalNote[];
  beds: Bed[];
  admissions: Admission[];
  lots: StockLot[];
  movements: StockMovement[];
  referrals: Referral[];
  audit: AuditEvent[];
  calls: QueueCall[];
  intakes: IntakeRecord[];
  addenda: NoteAddendum[];
}
export interface Snapshot {
  clinicalDocuments: import('./clinical-documents').ClinicalDocument[];
  calls: QueueCall[];
  workRecords: WorkRecord[];
  careSegments: CareSegment[];
  kioskArrivals: KioskArrival[];
  vaccineLots: VaccineLot[];
  vaccineMovements: VaccineMovement[];
  immunizations: Immunization[];
  vaccineVoids: VaccineVoid[];
  vaccineRecalls: VaccineRecall[];
  intakes: IntakeRecord[];
  addenda: NoteAddendum[];
  organizations: Organization[];
  units: Unit[];
  patients: Patient[];
  appointments: Appointment[];
  encounters: Encounter[];
  notes: ClinicalNote[];
  beds: Bed[];
  admissions: Admission[];
  lots: StockLot[];
  movements: StockMovement[];
  referrals: Referral[];
  audit: AuditEvent[];
}
export interface FlowCounts {
  reception: number;
  triageWaiting: number;
  triageActive: number;
  careWaiting: number;
  absent: number;
}
export interface UnitSummary {
  flow: FlowCounts;
  unit: Unit;
  today: number;
  waiting: number;
  inCare: number;
  occupied: number;
  totalBeds: number;
}
export interface Summary {
  flow: FlowCounts;
  vaccination: VaccinationSummary;
  today: number;
  waiting: number;
  inCare: number;
  completed: number;
  occupied: number;
  totalBeds: number;
  stockAlerts: number;
  pendingReferrals: number;
  units: UnitSummary[];
}
export type Command =
  | import('./clinical-documents').ClinicalDocumentCommand
  | { type: 'referral.complete'; id: string; date: string; summary: string }
  | import('./reception').ReceptionCommand
  | VaccinationCommand
  | { type: 'work.create'; module: string; values: Record<string, string> }
  | { type: 'work.transition'; id: string; status: string; reason: string }
  | { type: 'work.update'; id: string; values: Record<string, string>; reason: string }
  | { type: 'intake.start'; encounterId: string }
  | { type: 'kiosk.link'; arrivalId: string; patientId: string }
  | {
      type: 'intake.record';
      encounterId: string;
      content: IntakeContent;
      correctionOf?: string;
      correctionReason?: string;
    }
  | { type: 'note.addendum'; noteId: string; text: string; reason: string }
  | { type: 'queue.call'; encounterId: string; roomId: string }
  | { type: 'queue.recall'; callId: string }
  | {
      type: 'patient.create';
      name: string;
      socialName: string;
      birthDate: string;
      phone: string;
      cpf?: string;
    }
  | {
      type: 'appointment.create';
      patientId: string;
      professional: string;
      service: string;
      date: string;
      time: string;
      duration: number;
    }
  | { type: 'appointment.cancel'; id: string; reason: string }
  | { type: 'appointment.checkIn'; id: string }
  | {
      type: 'encounter.create';
      patientId: string;
      service: string;
      priority: 'routine' | 'priority';
    }
  | { type: 'encounter.start'; id: string }
  | { type: 'encounter.observe'; id: string }
  | { type: 'note.save'; encounterId: string; soap: Soap }
  | { type: 'note.finalize'; encounterId: string }
  | { type: 'admission.create'; patientId: string; bedId: string }
  | { type: 'admission.discharge'; id: string; reason: string }
  | { type: 'bed.status'; id: string; status: 'available' | 'cleaning' | 'blocked'; reason: string }
  | { type: 'stock.move'; id: string; kind: 'entry' | 'exit'; quantity: number; reason: string }
  | {
      type: 'referral.create';
      patientId: string;
      specialty: string;
      destination: string;
      reason: string;
    }
  | { type: 'referral.schedule'; id: string; date: string; time: string; destination: string }
  | { type: 'referral.cancel'; id: string; reason: string };

export const roleNames: Record<Role, string> = {
  manager: 'Prefeitura · gestão da rede',
  reception: 'Recepção',
  clinical: 'Equipe médica',
  nursing: 'Enfermagem',
  pharmacy: 'Farmácia',
  regulation: 'Regulação',
  admin: 'Administração da unidade',
  acs: 'Agente de saúde',
  business: 'Operação da Cuidelo',
};
export const unitKindNames: Record<UnitKind, string> = {
  ubs: 'Atenção primária',
  upa: 'Urgência e emergência',
  hospital: 'Hospital',
};
export const permissions: Record<Role, readonly Permission[]> = {
  manager: ['manage', 'network', 'performance', 'devices', 'outreach', 'quality'],
  business: ['business'],
  acs: ['patients.read', 'territory'],
  reception: ['patients.read', 'patients.write', 'schedule', 'queue'],
  clinical: [
    'performance',
    'patients.read',
    'schedule',
    'queue',
    'clinical',
    'beds',
    'regulation',
    'vaccination',
    'vaccine.stock',
  ],
  nursing: [
    'performance',
    'patients.read',
    'schedule',
    'queue',
    'clinical',
    'beds',
    'vaccination',
    'vaccine.stock',
  ],
  pharmacy: ['stock', 'vaccine.stock'],
  regulation: ['patients.read', 'regulation', 'schedule'],
  admin: [
    'territory',
    'outreach',
    'quality',
    'performance',
    'devices',
    'vaccine.stock',
    'patients.read',
    'patients.write',
    'schedule',
    'queue',
    'beds',
    'stock',
    'regulation',
    'manage',
  ],
};
export function can(role: Role, permission: Permission) {
  return permissions[role]?.includes(permission) ?? false;
}
export const emptySoap = (): Soap => ({ subjective: '', objective: '', assessment: '', plan: '' });

export interface WorkRecord extends Scoped {
  unitId: string;
  module: string;
  values: Record<string, string>;
  status: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  history: {
    at: string;
    actorId: string;
    action: string;
    reason: string;
    previousValues?: Record<string, string>;
  }[];
}

export interface CareSegment extends Scoped {
  unitId: string;
  encounterId: string;
  professionalId: string;
  startedAt: string;
  endedAt?: string;
  endReason?: 'observation' | 'completed';
}
export interface KioskArrival extends Scoped, ReceptionTracking {
  preferenceNeedsReview?: boolean;
  preferenceReason?: import('./kiosk-options').PreferenceReason;
  unitId: string;
  ticket: string;
  service: string;
  priority: 'routine' | 'priority';
  arrivedAt: string;
  encounterId?: string;
}
