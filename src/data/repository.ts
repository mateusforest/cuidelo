import type { Command, Context, Snapshot, Summary, Organization, Unit } from '../domain/model';
import type { DisplayFeed } from '../domain/queue';
import type { KioskRequest, TicketReceipt, PerformanceReport } from '../domain/patient-flow';

// Este contrato separa a interface do adaptador de demonstração. O futuro
// adaptador remoto deverá validar identidade e autorização no servidor.
export interface CareRepository {
  workMetrics(
    context: Context,
  ): { unit: string; prenatal: number; consultations: number; families: number; visits: number }[];
  issueTicket(request: KioskRequest): Promise<TicketReceipt>;
  performance(context: Context, from: string, to: string): PerformanceReport;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
  refresh(): void;
  display(organizationId: string, unitId: string): DisplayFeed;
  directory(): { organizations: Organization[]; units: Unit[] };
  snapshot(context: Context): Snapshot;
  summary(context: Context): Summary;
  execute(context: Context, command: Command, expectedRevision?: number): Promise<string>;
  reset(context: Context): Promise<void>;
  readonly persistent: boolean;
  readonly recoveryMessage: string;
}
