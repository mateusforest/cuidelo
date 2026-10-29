import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand } from './operations';
import { demoCpf, formatCpf, validCpf } from './identification';
import { issueKiosk, type KioskRequest } from './patient-flow';
import { readDisplay } from './queue';
const now = new Date('2026-10-29T15:00:00Z'),
  ctx = demoContext('aurora', 'aurora-centro', 'reception');
const request: KioskRequest = {
  organizationId: 'aurora',
  unitId: 'aurora-centro',
  service: 'Consulta',
  priority: 'routine',
  requestId: 'kiosk-identity-test',
};
describe('identificação e preferência no totem', () => {
  it('valida CPF numérico e formatado, rejeitando repetição e dígitos incorretos', () => {
    expect(validCpf(demoCpf(12))).toBe(true);
    expect(validCpf(formatCpf(demoCpf(12)))).toBe(true);
    for (const value of ['11111111111', '00000000000', '123', 'a12345678909', '00000001200'])
      expect(validCpf(value)).toBe(false);
  });
  it('identifica por CPF e nascimento sem devolver dados pessoais no recibo', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    const receipt = issueKiosk(
      db,
      {
        ...request,
        identification: { kind: 'cpf', value: formatCpf(p.cpf!), birthDate: p.birthDate },
      },
      now,
    );
    expect(receipt.needsIdentification).toBe(false);
    expect(db.encounters.at(-1)?.patientId).toBe(p.id);
    for (const value of [p.cpf!, p.name, p.birthDate, p.id])
      expect(JSON.stringify(receipt)).not.toContain(value);
    expect(() =>
      issueKiosk(
        db,
        {
          ...request,
          requestId: 'another-cpf-test',
          identification: { kind: 'cpf', value: p.cpf!, birthDate: '1990-01-01' },
        },
        now,
      ),
    ).toThrow('confirmar');
  });
  it('busca nome completo e social com tolerância a acentos/espaços, sem busca parcial', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    p.socialName = 'Lúcas Nome Social';
    expect(
      issueKiosk(
        db,
        {
          ...request,
          identification: {
            kind: 'name',
            value: '  lucas   nome social  ',
            birthDate: p.birthDate,
          },
        },
        now,
      ).needsIdentification,
    ).toBe(false);
    expect(() =>
      issueKiosk(
        db,
        {
          ...request,
          requestId: 'partial-name-test',
          identification: { kind: 'name', value: 'Lucas', birthDate: p.birthDate },
        },
        now,
      ),
    ).toThrow('nome completo');
    expect(() =>
      issueKiosk(
        db,
        {
          ...request,
          requestId: 'partial-name-second',
          identification: { kind: 'name', value: 'Lucas Pere', birthDate: p.birthDate },
        },
        now,
      ),
    ).toThrow('confirmar');
  });
  it('encaminha homônimos para conferência sem escolher o primeiro cadastro', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'aurora-p12')!;
    db.patients.push({ ...p, id: 'homonym', cpf: demoCpf(99), record: 'DEMO-0099' });
    expect(() =>
      issueKiosk(
        db,
        { ...request, identification: { kind: 'name', value: p.name, birthDate: p.birthDate } },
        now,
      ),
    ).toThrow('com segurança');
    expect(db.kioskArrivals).toHaveLength(0);
  });
  it('não identifica um CPF de outra prefeitura', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'horizonte-p12')!;
    expect(() =>
      issueKiosk(
        db,
        { ...request, identification: { kind: 'cpf', value: p.cpf!, birthDate: p.birthDate } },
        now,
      ),
    ).toThrow('confirmar');
  });
  it('preferência de senha sem identificação chega ao cadastro sem aparecer na TV/recibo', () => {
    const db = createSeed(now),
      receipt = issueKiosk(
        db,
        { ...request, priority: 'priority', preferenceReason: 'autism' },
        now,
      );
    const id = applyCommand(
      db,
      ctx,
      { type: 'kiosk.link', arrivalId: request.requestId, patientId: 'aurora-p12' },
      now,
    );
    expect(db.encounters.find((e) => e.id === id)).toMatchObject({
      priority: 'priority',
      preferenceReason: 'autism',
    });
    expect(JSON.stringify(receipt)).not.toContain('autism');
    applyCommand(db, ctx, { type: 'queue.call', encounterId: id, roomId: 'recepcao-1' }, now);
    expect(JSON.stringify(readDisplay(db, 'aurora', 'aurora-centro', now))).not.toContain('autism');
  });
  it('solicita preferência em senha aberta sem duplicar, sem rebaixar uma preferência existente', () => {
    const db = createSeed(now),
      p = db.patients.find((p) => p.id === 'aurora-p1')!,
      count = db.encounters.length;
    const identification = { kind: 'cpf' as const, value: p.cpf!, birthDate: p.birthDate };
    const a = issueKiosk(
      db,
      { ...request, identification, priority: 'priority', preferenceReason: 'mobility' },
      now,
    );
    expect(a.priority).toBe('priority');
    expect(db.encounters.length).toBe(count);
    const b = issueKiosk(
      db,
      { ...request, requestId: 'common-repeat-request', identification },
      now,
    );
    expect(b.ticket).toBe(a.ticket);
    expect(b.priority).toBe('priority');
    const revision = db.revision;
    expect(
      issueKiosk(
        db,
        { ...request, identification, priority: 'priority', preferenceReason: 'mobility' },
        now,
      ).ticket,
    ).toBe(a.ticket);
    expect(db.revision).toBe(revision);
  });
  it('não modifica a preferência de atendimento já iniciado e informa necessidade de conferência', () => {
    const db = createSeed(now),
      e = db.encounters.find((e) => e.id === 'aurora-centro-e2')!,
      p = db.patients.find((p) => p.id === e.patientId)!;
    e.priority = 'routine';
    const receipt = issueKiosk(
      db,
      {
        ...request,
        identification: { kind: 'name', value: p.name, birthDate: p.birthDate },
        priority: 'priority',
        preferenceReason: 'reception',
      },
      now,
    );
    expect(receipt.preferenceNeedsReview).toBe(true);
    expect(e.priority).toBe('routine');
  });
  it('rejeita motivo sem preferência e serviço que não faz parte do cenário da unidade', () => {
    const db = createSeed(now);
    expect(() => issueKiosk(db, { ...request, preferenceReason: 'pregnant' }, now)).toThrow(
      'preferencial',
    );
    expect(() =>
      issueKiosk(db, { ...request, unitId: 'aurora-upa', service: 'Vacinação' }, now),
    ).toThrow('serviço');
  });
  it('cadastro normaliza CPF e bloqueia duplicidade na prefeitura', () => {
    const db = createSeed(now),
      cpf = demoCpf(99),
      cmd = {
        type: 'patient.create' as const,
        name: 'Pessoa de Teste',
        socialName: '',
        phone: '',
        birthDate: '1990-01-01',
        cpf: formatCpf(cpf),
      };
    applyCommand(db, ctx, cmd, now);
    expect(db.patients.at(-1)?.cpf).toBe(cpf);
    expect(() => applyCommand(db, ctx, cmd, now)).toThrow('Já existe');
  });
  it('migra identificadores apenas dos exemplos reconhecidos e preserva registros personalizados', () => {
    const db = createSeed(now);
    for (const p of db.patients) delete p.cpf;
    db.patients[1].name = 'Cadastro alterado pelo teste';
    const old = JSON.stringify({ ...db, schemaVersion: 5 });
    const storage = { getItem: () => old, setItem: () => {} };
    const repo = new DemoRepository(storage, () => now),
      patients = repo.snapshot(ctx).patients;
    expect(repo.recoveryMessage).toBe('');
    expect(patients.find((p) => p.id === 'aurora-p1')?.cpf).toBe(demoCpf(1));
    expect(patients.find((p) => p.id === 'aurora-p2')?.cpf).toBeUndefined();
  });
  it('mantém CPF, senha e preferência depois de recarregar o armazenamento', async () => {
    let value: string | null = null;
    const storage = {
      getItem: (key: string) => (key === storageKey ? value : null),
      setItem: (_key: string, next: string) => {
        value = next;
      },
    };
    const repo = new DemoRepository(storage, () => now);
    await repo.issueTicket({ ...request, priority: 'priority', preferenceReason: 'reception' });
    const reloaded = new DemoRepository(storage, () => now);
    expect(reloaded.recoveryMessage).toBe('');
    expect(reloaded.snapshot(ctx).kioskArrivals[0].preferenceReason).toBe('reception');
    expect(reloaded.snapshot(ctx).patients[0].cpf).toBeDefined();
  });
});
