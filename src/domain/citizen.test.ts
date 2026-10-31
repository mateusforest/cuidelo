import { describe, it, expect } from 'vitest';
import { readCitizenExample } from '../data/citizen-examples';
import { createSeed } from '../data/seed';
import { demoContext } from './access';
import { citizenView } from './citizen';
import { applyCommand } from './operations';

const now = new Date('2026-10-31T15:00:00Z'),
  unit = 'aurora-centro',
  med = demoContext('aurora', unit, 'clinical');
describe('leitura individual da agenda e dos documentos', () => {
  it('oferece roteiros distintos gerados com o mesmo fluxo da equipe', () => {
    const a = readCitizenExample('ana', now),
      b = readCitizenExample('joao', now);
    expect(a.documents.map((d) => d.content.kind).sort()).toEqual([
      'certificate',
      'exams',
      'prescription',
    ]);
    expect(a.appointments.map((v) => v.status)).toEqual(['cancelled', 'scheduled', 'scheduled']);
    expect(b.person).toBe('João Pedro Souza');
    expect(b.documents).toEqual([]);
    expect(b.appointments).toHaveLength(1);
  });
  it('isola pessoa e prefeitura, inclui as unidades da rede e omite dados internos', () => {
    const db = createSeed(now),
      p = 'aurora-p1',
      id = unit + '-e0';
    for (const role of ['reception', 'pharmacy', 'admin', 'manager'] as const)
      expect(() =>
        citizenView(db, demoContext('aurora', role === 'manager' ? 'all' : unit, role), p, now),
      ).toThrow();
    expect(() => citizenView(db, med, 'horizonte-p1', now)).toThrow();
    expect(() => citizenView(db, { ...med, unitId: 'aurora-vila' }, p, now)).toThrow();
    applyCommand(db, med, { type: 'encounter.start', id }, now);
    const draft = () =>
      applyCommand(
        db,
        med,
        {
          type: 'document.save',
          encounterId: id,
          expectedVersion: 0,
          content: { kind: 'certificate', startDate: '2026-10-31', days: '2' },
        },
        now,
      );
    const issued = draft();
    draft();
    applyCommand(
      db,
      med,
      { type: 'document.issue', id: issued, expectedVersion: 1, reviewed: true },
      now,
    );
    const excluded = applyCommand(
      db,
      med,
      {
        type: 'document.save',
        encounterId: id,
        expectedVersion: 0,
        content: { kind: 'attendance', from: '2026-10-31T11:00', until: '2026-10-31T11:55' },
      },
      now,
    );
    applyCommand(
      db,
      med,
      { type: 'document.issue', id: excluded, expectedVersion: 1, reviewed: true },
      now,
    );
    const view = citizenView(db, med, p, now);
    expect(view.documents).toHaveLength(1);
    expect(view.documents[0].id).toBe(issued);
    expect(citizenView(db, med, 'aurora-p2', now).documents).toEqual([]);
    expect(view.documents[0]).not.toHaveProperty('history');
    expect(view).not.toHaveProperty('notes');
    expect(JSON.stringify(view)).not.toMatch(
      /cpf|birthDate|examEvents|justificativa interna|encounterId|patientId/,
    );
    const otherUnit = citizenView(db, med, 'aurora-p5', now);
    expect(new Set(otherUnit.appointments.map((a) => a.unit)).size).toBe(3);
    applyCommand(
      db,
      med,
      { type: 'document.cancel', id: issued, expectedVersion: 2, reason: 'justificativa interna' },
      now,
    );
    expect(citizenView(db, med, p, now).documents[0].status).toBe('cancelled');
    expect(JSON.stringify(citizenView(db, med, p, now))).not.toContain('justificativa interna');
  });
});
