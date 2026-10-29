import { roleNames, type Context, type Organization, type Role, type Unit } from './model';
import { DomainError } from './errors';
type Directory = { organizations: Organization[]; units: Unit[] };
export interface DemoIdentity extends Context {
  name: string;
}
export function demoContext(
  organizationId: string,
  unitId: string,
  role: Role,
  second = false,
): Context {
  return {
    organizationId,
    unitId,
    role,
    sessionId:
      role === 'manager' ? `${organizationId}:manager` : `${unitId}:${role}${second ? ':2' : ''}`,
  };
}
export function demoIdentities(directory: Directory): DemoIdentity[] {
  return [
    { ...demoContext('cuidelo', 'office', 'business'), name: 'Operação da Cuidelo · demonstração' },
    ...directory.organizations.flatMap((o) => [
      { ...demoContext(o.id, 'all', 'manager'), name: `Gestão municipal · ${o.shortName}` },
      ...directory.units
        .filter((u) => u.organizationId === o.id)
        .flatMap((u) => [
          ...(
            ['reception', 'clinical', 'nursing', 'pharmacy', 'regulation', 'admin', 'acs'] as Role[]
          ).map((role) => ({
            ...demoContext(o.id, u.id, role),
            name:
              role === 'clinical'
                ? 'Dra. Marina · demonstração'
                : role === 'nursing'
                  ? 'Enf. Camila · demonstração'
                  : `${roleNames[role]} · demonstração`,
          })),
          { ...demoContext(o.id, u.id, 'clinical', true), name: 'Dr. André · demonstração' },
        ]),
    ]),
  ];
}
export function identityFor(directory: Directory, context: Context): DemoIdentity {
  const identity = demoIdentities(directory).find((i) => i.sessionId === context.sessionId);
  if (
    !identity ||
    identity.role !== context.role ||
    identity.organizationId !== context.organizationId
  )
    throw new DomainError('A sessão não permite este perfil ou esta prefeitura.', 'permission');
  if (identity.role !== 'manager' && identity.unitId !== context.unitId)
    throw new DomainError('Esta sessão está vinculada a uma única unidade.', 'scope');
  return identity;
}
