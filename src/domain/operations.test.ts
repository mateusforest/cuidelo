import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { applyCommand, readSnapshot, readSummary } from './operations';
import type { Context, Command } from './model';

const now = new Date('2026-10-29T15:00:00Z');
const clinic: Context = { organizationId: 'aurora', unitId: 'aurora-centro', role: 'clinical' };
const admin: Context = { ...clinic, role: 'admin' };
const hospital: Context = { ...admin, unitId: 'aurora-hospital' };
const pharmacy: Context = { ...clinic, role: 'pharmacy' };
const soap = {
  subjective: 'Relato fictício.',
  objective: 'Registro de teste.',
  assessment: 'Avaliação fictícia.',
  plan: 'Plano fictício.',
};
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}

describe('contexto e permissões', () => {
  it('filtra registros por rede e bloqueia uma unidade de outra organização', () => {
    const db = createSeed(now),
      view = readSnapshot(db, clinic);
    expect(view.patients.length).toBeGreaterThan(0);
    expect(view.patients.every((p) => p.organizationId === 'aurora')).toBe(true);
    expect(view.encounters.every((e) => e.unitId === 'aurora-centro')).toBe(true);
    expect(() => readSnapshot(db, { ...clinic, unitId: 'horizonte-centro' })).toThrow(
      'unidade desta rede',
    );
  });
  it('rejeita identificador de pessoa de outra rede na gravação', () => {
    const db = createSeed(now);
    expect(() =>
      applyCommand(
        db,
        admin,
        {
          type: 'encounter.create',
          patientId: 'horizonte-p1',
          service: 'Teste',
          priority: 'routine',
        },
        now,
      ),
    ).toThrow('não encontrado');
  });
  it('rejeita identificador de atendimento de outra unidade', () => {
    expect(() =>
      applyCommand(createSeed(now), clinic, { type: 'encounter.start', id: 'aurora-vila-e0' }, now),
    ).toThrow('não encontrado');
  });
  it('recepção não recebe notas ou alergias nem pode registrar evolução', () => {
    const db = createSeed(now);
    applyCommand(db, clinic, { type: 'note.save', encounterId: 'aurora-centro-e2', soap }, now);
    const reception: Context = { ...clinic, role: 'reception' };
    const view = readSnapshot(db, reception);
    expect(view.notes).toEqual([]);
    expect(view.patients.every((p) => p.allergies.length === 0)).toBe(true);
    expect(() =>
      applyCommand(
        db,
        reception,
        { type: 'note.save', encounterId: 'aurora-centro-e2', soap },
        now,
      ),
    ).toThrow('não tem acesso');
  });
  it('gestão recebe indicadores agregados e não recebe cadastros ou internações identificadas', () => {
    const db = createSeed(now),
      manager: Context = { organizationId: 'aurora', unitId: 'all', role: 'manager' };
    const view = readSnapshot(db, manager);
    expect(view.patients).toEqual([]);
    expect(view.encounters).toEqual([]);
    expect(view.admissions).toEqual([]);
    expect(readSummary(db, manager, now).occupied).toBe(3);
  });
  it('alterar o resultado de uma leitura não modifica a base', () => {
    const db = createSeed(now);
    readSnapshot(db, admin).patients[0].name = 'Mudança externa';
    expect(db.patients[0].name).not.toBe('Mudança externa');
  });
});

describe('agenda e atendimento', () => {
  const appointment: Command = {
    type: 'appointment.create',
    patientId: 'aurora-p12',
    professional: 'Dra. Marina · demo',
    service: 'Consulta médica',
    date: '2026-10-29',
    time: '09:15',
    duration: 30,
  };
  it('impede sobreposição de horário do profissional', () =>
    expect(() => applyCommand(createSeed(now), admin, appointment, now)).toThrow(
      'profissional já tem',
    ));
  it('impede sobreposição de horário da pessoa, mesmo com outro profissional', () =>
    expect(() =>
      applyCommand(
        createSeed(now),
        admin,
        { ...appointment, patientId: 'aurora-p5', professional: 'Outro profissional · demo' },
        now,
      ),
    ).toThrow('pessoa já tem'));
  it('permite horários adjacentes sem sobreposição', () =>
    expect(() =>
      applyCommand(createSeed(now), admin, { ...appointment, time: '09:30' }, now),
    ).not.toThrow());
  it('confirma chegada uma única vez e gera um atendimento', () => {
    const db = createSeed(now),
      initial = db.encounters.length;
    applyCommand(db, admin, { type: 'appointment.checkIn', id: 'aurora-centro-a0' }, now);
    expect(db.encounters.length).toBe(initial + 1);
    expect(() =>
      applyCommand(db, admin, { type: 'appointment.checkIn', id: 'aurora-centro-a0' }, now),
    ).toThrow('chegada já foi confirmada');
  });
  it('impede chegada duplicada para uma pessoa com atendimento aberto', () =>
    expect(() =>
      applyCommand(
        createSeed(now),
        admin,
        {
          type: 'encounter.create',
          patientId: 'aurora-p1',
          service: 'Consulta',
          priority: 'routine',
        },
        now,
      ),
    ).toThrow('já tem um atendimento aberto'));
  it('não permite confirmar a chegada de agendamento cancelado', () => {
    const db = createSeed(now);
    applyCommand(
      db,
      admin,
      { type: 'appointment.cancel', id: 'aurora-centro-a0', reason: 'Teste' },
      now,
    );
    expect(() =>
      applyCommand(db, admin, { type: 'appointment.checkIn', id: 'aurora-centro-a0' }, now),
    ).toThrow('cancelado');
  });
  it('não conclui um registro sem avaliação e plano', () => {
    const db = createSeed(now);
    applyCommand(
      db,
      clinic,
      { type: 'note.save', encounterId: 'aurora-centro-e2', soap: { ...soap, plan: '' } },
      now,
    );
    expect(() =>
      applyCommand(db, clinic, { type: 'note.finalize', encounterId: 'aurora-centro-e2' }, now),
    ).toThrow('Plano é obrigatório');
  });
  it('preserva a nota finalizada e encerra o atendimento', () => {
    const db = createSeed(now);
    applyCommand(db, clinic, { type: 'note.save', encounterId: 'aurora-centro-e2', soap }, now);
    applyCommand(db, clinic, { type: 'note.finalize', encounterId: 'aurora-centro-e2' }, now);
    expect(db.notes[0].status).toBe('final');
    expect(db.encounters.find((e) => e.id === 'aurora-centro-e2')?.status).toBe('completed');
    expect(() =>
      applyCommand(
        db,
        clinic,
        { type: 'note.save', encounterId: 'aurora-centro-e2', soap: { ...soap, plan: 'Alterado' } },
        now,
      ),
    ).toThrow();
    expect(db.notes[0].soap.plan).toBe(soap.plan);
  });
});

describe('internação e estoque', () => {
  it('um leito não recebe duas admissões simultâneas', () => {
    const db = createSeed(now);
    applyCommand(
      db,
      hospital,
      { type: 'admission.create', patientId: 'aurora-p5', bedId: 'aurora-hospital-b4' },
      now,
    );
    expect(() =>
      applyCommand(
        db,
        hospital,
        { type: 'admission.create', patientId: 'aurora-p6', bedId: 'aurora-hospital-b4' },
        now,
      ),
    ).toThrow('não está disponível');
  });
  it('uma pessoa não ocupa dois leitos ativos na rede', () =>
    expect(() =>
      applyCommand(
        createSeed(now),
        hospital,
        { type: 'admission.create', patientId: 'aurora-p9', bedId: 'aurora-hospital-b4' },
        now,
      ),
    ).toThrow('internação ativa'));
  it('saída envia o leito para higienização e exige liberação antes de nova admissão', () => {
    const db = createSeed(now);
    applyCommand(
      db,
      hospital,
      { type: 'admission.discharge', id: 'aurora-hospital-i1', reason: 'Saída de teste' },
      now,
    );
    expect(db.beds.find((b) => b.id === 'aurora-hospital-b1')?.status).toBe('cleaning');
    expect(() =>
      applyCommand(
        db,
        hospital,
        { type: 'admission.create', patientId: 'aurora-p6', bedId: 'aurora-hospital-b1' },
        now,
      ),
    ).toThrow('não está disponível');
    applyCommand(
      db,
      hospital,
      {
        type: 'bed.status',
        id: 'aurora-hospital-b1',
        status: 'available',
        reason: 'Higienização fictícia concluída',
      },
      now,
    );
    expect(() =>
      applyCommand(
        db,
        hospital,
        { type: 'admission.create', patientId: 'aurora-p6', bedId: 'aurora-hospital-b1' },
        now,
      ),
    ).not.toThrow();
  });
  it('bloqueia saldo negativo, frações e lotes vencidos', () => {
    expect(() =>
      applyCommand(
        createSeed(now),
        pharmacy,
        {
          type: 'stock.move',
          id: 'aurora-centro-l0',
          kind: 'exit',
          quantity: 121,
          reason: 'Teste',
        },
        now,
      ),
    ).toThrow('Saldo insuficiente');
    expect(() =>
      applyCommand(
        createSeed(now),
        pharmacy,
        {
          type: 'stock.move',
          id: 'aurora-centro-l0',
          kind: 'entry',
          quantity: 1.5,
          reason: 'Teste',
        },
        now,
      ),
    ).toThrow('quantidade inteira');
    expect(() =>
      applyCommand(
        createSeed(now),
        pharmacy,
        { type: 'stock.move', id: 'aurora-centro-l4', kind: 'exit', quantity: 1, reason: 'Teste' },
        now,
      ),
    ).toThrow('Lote vencido');
  });
  it('cada movimento altera o saldo e deixa referência de auditoria', () => {
    const db = createSeed(now);
    const id = applyCommand(
      db,
      pharmacy,
      {
        type: 'stock.move',
        id: 'aurora-centro-l0',
        kind: 'exit',
        quantity: 5,
        reason: 'Transferência fictícia',
      },
      now,
    );
    expect(db.lots.find((l) => l.id === 'aurora-centro-l0')?.quantity).toBe(115);
    expect(db.movements[0].id).toBe(id);
    expect(db.audit[0].entityId).toBe(id);
  });
});

describe('persistência de demonstração', () => {
  it('recupera cadastros após recriar o adaptador', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now);
    await repo.execute(admin, {
      type: 'patient.create',
      name: 'Pessoa Teste',
      socialName: '',
      birthDate: '1990-01-01',
      phone: '',
    });
    expect(
      new DemoRepository(storage, () => now)
        .snapshot(admin)
        .patients.some((p) => p.name === 'Pessoa Teste'),
    ).toBe(true);
  });
  it('não aplica uma operação nem auditoria quando a gravação falha', async () => {
    const storage = new MemoryStorage(),
      repo = new DemoRepository(storage, () => now),
      before = repo.snapshot(admin);
    storage.setItem = () => {
      throw new Error('Quota');
    };
    await expect(
      repo.execute(admin, {
        type: 'patient.create',
        name: 'Falha de teste',
        socialName: '',
        birthDate: '1990-01-01',
        phone: '',
      }),
    ).rejects.toThrow('alteração não foi aplicada');
    expect(repo.snapshot(admin)).toEqual(before);
  });
  it('rejeita uma revisão antiga de outra aba, preservando a alteração mais recente', async () => {
    const storage = new MemoryStorage(),
      a = new DemoRepository(storage, () => now),
      b = new DemoRepository(storage, () => now);
    await a.execute(admin, {
      type: 'patient.create',
      name: 'Pessoa da aba A',
      socialName: '',
      birthDate: '1990-01-01',
      phone: '',
    });
    await expect(
      b.execute(admin, {
        type: 'patient.create',
        name: 'Pessoa da aba B',
        socialName: '',
        birthDate: '1990-01-01',
        phone: '',
      }),
    ).rejects.toThrow('outra ação ou aba');
    expect(b.snapshot(admin).patients.some((p) => p.name === 'Pessoa da aba A')).toBe(true);
  });
  it('preserva armazenamento incompatível até a redefinição explícita por administração', async () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey, '{"schemaVersion":999}');
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBeTruthy();
    await expect(
      repo.execute(admin, {
        type: 'patient.create',
        name: 'Teste',
        socialName: '',
        birthDate: '1990-01-01',
        phone: '',
      }),
    ).rejects.toThrow('Redefina');
    expect(storage.getItem(storageKey)).toBe('{"schemaVersion":999}');
    await expect(repo.reset(clinic)).rejects.toThrow('Administração');
    await repo.reset(admin);
    expect(repo.recoveryMessage).toBe('');
  });
});
