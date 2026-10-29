import type { Command, Context, Snapshot, Summary, Organization, Unit } from '../domain/model';
import type { DisplayFeed } from '../domain/queue';

// Este contrato separa a interface do adaptador de demonstração. O futuro
// adaptador remoto deverá validar identidade e autorização no servidor.
export interface CareRepository {
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
