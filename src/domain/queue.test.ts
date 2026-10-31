import { demoContext } from './access';
import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository, storageKey } from '../data/demo-repository';
import { applyCommand } from './operations';
import { nextTicket, readDisplay } from './queue';
import type { Context } from './model';

const now = new Date('2026-10-29T15:00:00Z');
const context: Context = demoContext('aurora', 'aurora-centro', 'reception');
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}

describe('senhas e projeção da TV', () => {
  it('emite senha única por unidade e dia, sem reutilizar uma senha concluída', () => {
    const db = createSeed(now);
    const id = applyCommand(
      db,
      context,
      {
        type: 'encounter.create',
        patientId: 'aurora-p6',
        service: 'Consulta',
        priority: 'routine',
      },
      now,
    );
    const created = db.encounters.find((e) => e.id === id)!;
    const keys = db.encounters.map((e) => `${e.organizationId}:${e.unitId}:${e.ticket}`);
    expect(new Set(keys).size).toBe(keys.length);
    const first = created.ticket;
    created.status = 'completed';
    expect(
      nextTicket(db.encounters, context.organizationId, context.unitId, '2026-10-29'),
    ).not.toBe(first);
    expect(nextTicket(db.encounters, context.organizationId, context.unitId, '2026-10-30')).toBe(
      'A-001',
    );
  });
  it('publica chamada e rechamada sem nome, prontuário ou identificadores da pessoa', () => {
    const db = createSeed(now);
    const encounter = db.encounters.find(
      (e) => e.unitId === context.unitId && e.status === 'waiting',
    )!;
    const id = applyCommand(
      db,
      context,
      { type: 'queue.call', encounterId: encounter.id, roomId: 'consultorio-2' },
      now,
    );
    const first = readDisplay(db, context.organizationId, context.unitId, now);
    expect(first.current?.room).toBe('Consultório 02');
    expect(first.current?.ticket).toBe(encounter.ticket);
    expect(Object.keys(first.current!).sort()).toEqual([
      'calledAt',
      'direction',
      'id',
      'room',
      'ticket',
    ]);
    const repeated = applyCommand(
      db,
      context,
      { type: 'queue.recall', callId: id },
      new Date(now.getTime() + 1000),
    );
    const latest = readDisplay(db, context.organizationId, context.unitId, now);
    expect(latest.current?.id).toBe(repeated);
    expect(latest.recent).toHaveLength(0);
    expect(encounter.status).toBe('waiting');
    expect(readDisplay(db, 'horizonte', 'horizonte-centro', now).current).toBeNull();
    expect(() => readDisplay(db, 'horizonte', context.unitId, now)).toThrow('não encontrado');
  });
  it('bloqueia chamada de outra unidade, perfil sem permissão, sala desconhecida e atendimento concluído', () => {
    const db = createSeed(now);
    expect(() =>
      applyCommand(
        db,
        context,
        { type: 'queue.call', encounterId: 'aurora-vila-e0', roomId: 'consultorio-2' },
        now,
      ),
    ).toThrow('não encontrado');
    const e = db.encounters.find((e) => e.unitId === context.unitId && e.status === 'waiting')!;
    expect(() =>
      applyCommand(
        db,
        demoContext(context.organizationId, context.unitId, 'pharmacy'),
        { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-2' },
        now,
      ),
    ).toThrow('não tem acesso');
    expect(() =>
      applyCommand(
        db,
        context,
        { type: 'queue.call', encounterId: e.id, roomId: 'sala-inventada' },
        now,
      ),
    ).toThrow('local de atendimento');
    e.status = 'completed';
    expect(() =>
      applyCommand(
        db,
        context,
        { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-2' },
        now,
      ),
    ).toThrow('concluído');
  });
  it('não exibe chamadas do dia anterior nem permite rechamá-las', () => {
    const db = createSeed(now),
      e = db.encounters.find((e) => e.unitId === context.unitId && e.status === 'waiting')!;
    const id = applyCommand(
      db,
      context,
      { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-2' },
      now,
    );
    const tomorrow = new Date('2026-10-30T15:00:00Z');
    expect(readDisplay(db, context.organizationId, context.unitId, tomorrow).current).toBeNull();
    expect(() => applyCommand(db, context, { type: 'queue.recall', callId: id }, tomorrow)).toThrow(
      'emitidas hoje',
    );
  });
  it('migra a base anterior sem apagar cadastros e mantém senhas estáveis após gravar', async () => {
    const storage = new MemoryStorage(),
      old = JSON.parse(JSON.stringify(createSeed(now)));
    old.schemaVersion = 1;
    delete old.calls;
    old.encounters.forEach((e: Record<string, unknown>) => delete e.ticket);
    storage.setItem(storageKey, JSON.stringify(old));
    const repo = new DemoRepository(storage, () => now);
    expect(repo.recoveryMessage).toBe('');
    const view = repo.snapshot(context);
    expect(view.patients.length).toBe(
      old.patients.filter((p: { organizationId: string }) => p.organizationId === 'aurora').length,
    );
    const e = view.encounters.find((e) => e.status === 'waiting')!;
    await repo.execute(context, { type: 'queue.call', encounterId: e.id, roomId: 'escuta-1' });
    const saved = JSON.parse(storage.getItem(storageKey)!);
    expect(saved.schemaVersion).toBe(13);
    const restored = new DemoRepository(storage, () => now);
    expect(restored.display(context.organizationId, context.unitId).current?.ticket).toBe(e.ticket);
    expect(saved.patients).toEqual(old.patients);
  });
  it('atualiza a outra janela por leitura da revisão persistida', async () => {
    const storage = new MemoryStorage(),
      a = new DemoRepository(storage, () => now),
      b = new DemoRepository(storage, () => now);
    const e = a.snapshot(context).encounters.find((e) => e.status === 'waiting')!;
    await a.execute(context, { type: 'queue.call', encounterId: e.id, roomId: 'consultorio-2' });
    expect(b.display(context.organizationId, context.unitId).current).toBeNull();
    b.refresh();
    expect(b.display(context.organizationId, context.unitId).current?.ticket).toBe(e.ticket);
  });
});
