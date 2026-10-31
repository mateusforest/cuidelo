import type { Database, Organization, Unit } from '../domain/model';
import { addDays, dateKey } from '../domain/dates';
import { assignMissingTickets } from '../domain/queue';
import { seedVaccineLots } from '../domain/vaccination';
import { demoCpf } from '../domain/identification';

export function createSeed(now = new Date()): Database {
  const today = dateKey(now);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
  const organizations: Organization[] = [
    { id: 'aurora', name: 'Rede Aurora · demonstração', shortName: 'Rede Aurora' },
    { id: 'horizonte', name: 'Rede Horizonte · demonstração', shortName: 'Rede Horizonte' },
    { id: 'regional', name: 'Hospital Regional · demonstração', shortName: 'Hospital Regional' },
  ];
  const units: Unit[] = [
    {
      id: 'aurora-centro',
      organizationId: 'aurora',
      name: 'UBS Centro',
      kind: 'ubs',
      district: 'Região central',
    },
    {
      id: 'aurora-vila',
      organizationId: 'aurora',
      name: 'UBS Vila Nova',
      kind: 'ubs',
      district: 'Região oeste',
    },
    {
      id: 'aurora-upa',
      organizationId: 'aurora',
      name: 'UPA Norte',
      kind: 'upa',
      district: 'Região norte',
    },
    {
      id: 'aurora-hospital',
      organizationId: 'aurora',
      name: 'Hospital Municipal',
      kind: 'hospital',
      district: 'Região central',
    },
    {
      id: 'horizonte-centro',
      organizationId: 'horizonte',
      name: 'UBS Jardim',
      kind: 'ubs',
      district: 'Região central',
    },
    {
      id: 'horizonte-hospital',
      organizationId: 'horizonte',
      name: 'Hospital da Rede',
      kind: 'hospital',
      district: 'Região sul',
    },
    {
      id: 'regional-hospital',
      organizationId: 'regional',
      name: 'Hospital Regional',
      kind: 'hospital',
      district: 'Organização independente',
    },
  ];
  const db: Database = {
    schemaVersion: 11,
    queueAssessments: [],
    queueServiceEvents: [],
    dispensations: [],
    clinicalDocuments: [],
    workRecords: [],
    careSegments: [],
    kioskArrivals: [],
    vaccineLots: [],
    vaccineMovements: [],
    immunizations: [],
    vaccineVoids: [],
    vaccineRecalls: [],
    revision: 0,
    organizations,
    units,
    patients: [],
    appointments: [],
    encounters: [],
    notes: [],
    beds: [],
    admissions: [],
    lots: [],
    movements: [],
    referrals: [],
    audit: [],
    calls: [],
    intakes: [],
    addenda: [],
  };
  const names = [
    'Ana Clara Martins',
    'João Pedro Souza',
    'Lúcia Helena Costa',
    'Rafael Lima',
    'Beatriz Fernandes',
    'Carlos Eduardo Dias',
    'Helena Ribeiro',
    'Gabriel Santos',
    'Sofia Almeida',
    'Paulo Roberto Silva',
    'Mariana Oliveira',
    'Lucas Pereira',
  ];
  for (const org of organizations) {
    const orgUnits = units.filter((u) => u.organizationId === org.id);
    names.forEach((name, index) =>
      db.patients.push({
        id: `${org.id}-p${index + 1}`,
        organizationId: org.id,
        name: org.id === 'horizonte' ? name.replace(/ .*/, ' Monteiro') : name,
        cpf: demoCpf(organizations.indexOf(org) * 12 + index + 1),
        socialName: '',
        birthDate: [
          '1988-03-14',
          '1959-07-22',
          '1971-11-08',
          '1995-04-17',
          '2001-09-25',
          '1967-01-11',
          '2014-06-18',
          '1982-12-02',
          '1991-10-20',
          '1975-05-06',
          '1998-02-15',
          '1962-08-10',
        ][index],
        phone: '',
        record: `DEMO-${String(index + 1).padStart(4, '0')}`,
        allergies: index === 0 ? ['Penicilina — exemplo fictício'] : [],
      }),
    );
    orgUnits.forEach((unit, unitIndex) => {
      if (unit.kind !== 'hospital') {
        for (let i = 0; i < 4; i++)
          db.encounters.push({
            ticket: '',
            id: `${unit.id}-e${i}`,
            organizationId: org.id,
            unitId: unit.id,
            patientId: `${org.id}-p${((i + unitIndex * 2) % 8) + 1}`,
            service:
              unit.kind === 'upa'
                ? 'Pronto atendimento'
                : ['Consulta médica', 'Enfermagem', 'Consulta médica', 'Enfermagem'][i],
            priority: i === 1 ? 'priority' : 'routine',
            status: i === 2 ? 'in-care' : i === 3 ? 'completed' : 'waiting',
            arrivedAt: ago(20 + i * 12),
            ...(i >= 2 ? { startedAt: ago(15) } : {}),
            ...(i === 3 ? { completedAt: ago(5) } : {}),
          });
        const team = [
          ['Dra. Marina · demo', 'Enf. Camila · demo'],
          ['Dr. André · demo', 'Enf. Pedro · demo'],
          ['Dra. Renata · demo', 'Enf. Bruna · demo'],
        ][unitIndex % 3];
        for (let i = 0; i < 5; i++)
          db.appointments.push({
            id: `${unit.id}-a${i}`,
            organizationId: org.id,
            unitId: unit.id,
            patientId: `${org.id}-p${i + 5}`,
            professional: team[i % 2],
            service: i % 2 ? 'Enfermagem' : 'Consulta médica',
            date: today,
            time: `${String(9 + i + unitIndex * 2).padStart(2, '0')}:00`,
            duration: 30,
            status: 'scheduled',
          });
      } else {
        for (let i = 1; i <= 8; i++)
          db.beds.push({
            id: `${unit.id}-b${i}`,
            organizationId: org.id,
            unitId: unit.id,
            name: `Leito ${String(i).padStart(2, '0')}`,
            ward: i <= 4 ? 'Clínica médica' : 'Observação hospitalar',
            status: i <= 3 ? 'occupied' : i === 5 ? 'cleaning' : i === 8 ? 'blocked' : 'available',
            ...(i === 8 ? { reason: 'Manutenção preventiva — demonstração' } : {}),
          });
        for (let i = 1; i <= 3; i++)
          db.admissions.push({
            id: `${unit.id}-i${i}`,
            organizationId: org.id,
            unitId: unit.id,
            patientId: `${org.id}-p${i + 8}`,
            bedId: `${unit.id}-b${i}`,
            admittedAt: ago(1440 * i),
          });
      }
      [
        ['Paracetamol', '500 mg · comprimido', 'L-DEMO-01', 120, 30, 90],
        ['Soro fisiológico', '0,9% · 100 mL', 'L-DEMO-02', 18, 25, 15],
        ['Luva de procedimento', 'Tamanho M · unidade', 'L-DEMO-03', 240, 100, 365],
        ['Dipirona', '500 mg · comprimido', 'L-DEMO-04', 56, 20, 120],
        ['Gaze estéril', 'Pacote', 'L-DEMO-05', 10, 25, -1],
      ].forEach((item, index) =>
        db.lots.push({
          id: `${unit.id}-l${index}`,
          organizationId: org.id,
          unitId: unit.id,
          product: String(item[0]),
          presentation: String(item[1]),
          lot: String(item[2]),
          quantity: Number(item[3]),
          ...([0, 3].includes(index)
            ? { medication: { strength: '500 mg', form: 'comprimido', quantityUnit: 'comprimido' } }
            : {}),
          minimum: Number(item[4]),
          expiresAt: addDays(today, Number(item[5])),
        }),
      );
    });
    ['Cardiologia', 'Oftalmologia', 'Ortopedia'].forEach((specialty, index) =>
      db.referrals.push({
        id: `${org.id}-r${index}`,
        organizationId: org.id,
        unitId: orgUnits[0].id,
        patientId: `${org.id}-p${index + 1}`,
        specialty,
        destination: 'Centro de especialidades · demonstração',
        reason: 'Encaminhamento fictício para validação do fluxo.',
        status: 'requested',
        createdAt: ago(1440 * (index + 1)),
      }),
    );
  }
  assignMissingTickets(db.encounters);
  seedVaccineLots(db, now);
  return db;
}
