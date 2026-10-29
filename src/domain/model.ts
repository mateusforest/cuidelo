export type Role =
  'manager' | 'reception' | 'clinical' | 'nursing' | 'pharmacy' | 'regulation' | 'admin';
export type Permission =
  | 'patients.read'
  | 'patients.write'
  | 'schedule'
  | 'queue'
  | 'clinical'
  | 'beds'
  | 'stock'
  | 'regulation'
  | 'manage';
export type UnitKind = 'ubs' | 'upa' | 'hospital';
export interface Context {
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
export interface Encounter extends Scoped {
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
  unitId: string;
  patientId: string;
  specialty: string;
  destination: string;
  reason: string;
  status: 'requested' | 'scheduled' | 'cancelled';
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
export interface Database {
  schemaVersion: 1;
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
}
export interface Snapshot {
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
export interface UnitSummary {
  unit: Unit;
  today: number;
  waiting: number;
  inCare: number;
  occupied: number;
  totalBeds: number;
}
export interface Summary {
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
  | { type: 'patient.create'; name: string; socialName: string; birthDate: string; phone: string }
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
  manager: 'Gestão municipal',
  reception: 'Recepção',
  clinical: 'Equipe médica',
  nursing: 'Enfermagem',
  pharmacy: 'Farmácia',
  regulation: 'Regulação',
  admin: 'Administração',
};
export const unitKindNames: Record<UnitKind, string> = {
  ubs: 'Atenção primária',
  upa: 'Urgência e emergência',
  hospital: 'Hospital',
};
export const permissions: Record<Role, readonly Permission[]> = {
  manager: ['manage'],
  reception: ['patients.read', 'patients.write', 'schedule', 'queue'],
  clinical: ['patients.read', 'schedule', 'queue', 'clinical', 'beds', 'regulation'],
  nursing: ['patients.read', 'schedule', 'queue', 'clinical', 'beds'],
  pharmacy: ['stock'],
  regulation: ['patients.read', 'regulation', 'schedule'],
  admin: [
    'patients.read',
    'patients.write',
    'schedule',
    'queue',
    'clinical',
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
