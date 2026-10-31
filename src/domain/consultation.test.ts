import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { DemoRepository } from '../data/demo-repository';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { assessmentCoding, clinicalCatalog } from './consultation';
import { currentStay } from './unit-queue';
import type { DocumentContent } from './clinical-documents';

const at = new Date('2026-10-31T15:00:00Z'),
  unit = 'aurora-centro',
  id = unit + '-e0',
  doctor = demoContext('aurora', unit, 'clinical'),
  other = demoContext('aurora', 'aurora-vila', 'clinical');
const soap = {
  subjective: 'Relato fictício',
  objective: '',
  assessment: 'Avaliação demonstrativa',
  plan: 'Plano fictício',
};
const coding = { codes: [clinicalCatalog[0]], reason: '' };
function started() {
  const db = createSeed(at);
  applyCommand(db, doctor, { type: 'queue.call', roomId: 'consultorio-1', encounterId: id }, at);
  applyCommand(db, doctor, { type: 'encounter.start', id }, at);
  return db;
}
describe('conclusão da consulta no prontuário', () => {
  it('valida a classificação e a justificativa sem cruzar CID e CIAP automaticamente', () => {
    const entries = clinicalCatalog.filter((c) => c.code === 'R05');
    expect(assessmentCoding({ codes: entries, reason: '' }, true).codes).toHaveLength(2);
    expect(() => assessmentCoding({ codes: [entries[0], entries[0]], reason: '' })).toThrow(
      'já está',
    );
    expect(() =>
      assessmentCoding({ codes: [{ ...entries[0], code: '99A' }], reason: '' }),
    ).toThrow();
    expect(() => assessmentCoding({ codes: [], reason: '' }, true)).toThrow('justifique');
    expect(assessmentCoding({ codes: [], reason: ' Justificativa fictícia ' }, true).reason).toBe(
      'Justificativa fictícia',
    );
  });
  it('mantém SOAP, sala e cronômetro intactos quando a conclusão falha; depois finaliza uma única vez', () => {
    const db = started(),
      e = db.encounters.find((e) => e.id === id)!;
    applyCommand(
      db,
      doctor,
      {
        type: 'note.save',
        encounterId: id,
        soap: { ...soap, assessment: 'Rascunho original' },
        coding,
      },
      at,
    );
    const doc = applyCommand(
      db,
      doctor,
      {
        type: 'document.save',
        encounterId: id,
        expectedVersion: 0,
        content: { kind: 'certificate', startDate: '', days: '' },
      },
      at,
    );
    const before = structuredClone(db);
    const cmd = { type: 'note.finalize' as const, encounterId: id, record: { soap, coding } };
    expect(() => applyCommand(db, doctor, cmd, at)).toThrow('documentos em rascunho');
    expect(db).toEqual(before);
    expect(readSnapshot(db, other).notes).toEqual([]);
    applyCommand(
      db,
      doctor,
      { type: 'document.discard', id: doc, expectedVersion: 1, reason: 'Teste' },
      at,
    );
    for (const c of [
      other,
      demoContext('horizonte', 'horizonte-centro', 'clinical'),
      demoContext('aurora', unit, 'reception'),
      demoContext('aurora', unit, 'clinical', true),
    ])
      expect(() => applyCommand(db, c, cmd, at)).toThrow();
    applyCommand(db, doctor, cmd, at);
    expect(readSnapshot(db, other).notes[0]).toMatchObject({ status: 'final', soap, coding });
    expect(readSnapshot(db, demoContext('aurora', unit, 'reception')).notes).toHaveLength(0);
    expect(
      readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical')).notes,
    ).toHaveLength(0);
    expect(currentStay(e)).toBeUndefined();
    expect(db.careSegments.at(-1)?.endedAt).toBe(at.toISOString());
    expect(() => applyCommand(db, doctor, cmd, at)).toThrow();
    expect(db.notes).toHaveLength(1);
  });
  it('recusa períodos inválidos e não registra emissão nem numeração quando o comparecimento termina no futuro', () => {
    const db = started();
    const save = (content: DocumentContent) =>
      applyCommand(
        db,
        doctor,
        { type: 'document.save', encounterId: id, expectedVersion: 0, content },
        at,
      );
    expect(() => save({ kind: 'certificate', startDate: '2026-02-30', days: '2' })).toThrow();
    expect(() =>
      save({ kind: 'attendance', from: '2026-10-31T10:30', until: '2026-10-31T09:00' }),
    ).toThrow();
    const docId = save({ kind: 'attendance', from: '2026-10-31T11:00', until: '2026-11-01T12:30' });
    expect(() =>
      applyCommand(
        db,
        doctor,
        { type: 'document.issue', id: docId, expectedVersion: 1, reviewed: true },
        at,
      ),
    ).toThrow('futuro');
    expect(db.clinicalDocuments[0].status).toBe('draft');
    expect(db.clinicalDocuments[0].number).toBeUndefined();
  });
  it('registra a decisão justificada de concluir sem codificação e rejeita chamada médica por outro responsável', () => {
    const db = started(),
      another = demoContext('aurora', unit, 'clinical', true);
    expect(() =>
      applyCommand(
        db,
        another,
        { type: 'queue.call', encounterId: id, roomId: 'consultorio-1' },
        at,
      ),
    ).toThrow('atendimento em curso');
    applyCommand(
      db,
      doctor,
      {
        type: 'note.finalize',
        encounterId: id,
        record: { soap, coding: { codes: [], reason: 'Motivo fictício registrado pelo médico.' } },
      },
      at,
    );
    expect(readSnapshot(db, other).notes[0].coding?.reason).toContain('Motivo fictício');
  });
  it('preserva o SOAP finalizado sem códigos no formato anterior', () => {
    const db = started();
    applyCommand(
      db,
      doctor,
      { type: 'note.finalize', encounterId: id, record: { soap, coding } },
      at,
    );
    delete db.notes[0].coding;
    const raw = JSON.stringify({ ...db, schemaVersion: 12 });
    const repo = new DemoRepository({ getItem: () => raw, setItem: () => {} }, () => at);
    expect(repo.recoveryMessage).toBe('');
    expect(repo.snapshot(doctor).notes[0]).toEqual(db.notes[0]);
  });
  it.each<DocumentContent>([
    { kind: 'certificate', days: '2', startDate: '2026-10-31' },
    { kind: 'attendance', from: '2026-10-31T09:00', until: '2026-10-31T09:40' },
  ])('preserva a emissão e o cancelamento de $kind ao recarregar', (content) => {
    const db = started();
    const docId = applyCommand(
      db,
      doctor,
      { type: 'document.save', encounterId: id, expectedVersion: 0, content },
      at,
    );
    expect(() =>
      applyCommand(
        db,
        demoContext('aurora', unit, 'nursing'),
        { type: 'document.issue', id: docId, expectedVersion: 1, reviewed: true },
        at,
      ),
    ).toThrow();
    applyCommand(
      db,
      doctor,
      { type: 'document.issue', id: docId, expectedVersion: 1, reviewed: true },
      at,
    );
    const repo = () =>
      new DemoRepository({ getItem: () => JSON.stringify(db), setItem: () => {} }, () => at);
    expect(repo().recoveryMessage).toBe('');
    expect(repo().snapshot(other).clinicalDocuments[0]).toMatchObject({
      content,
      status: 'issued',
    });
    applyCommand(
      db,
      doctor,
      { type: 'document.cancel', id: docId, expectedVersion: 2, reason: 'Correção fictícia' },
      at,
    );
    expect(repo().snapshot(other).clinicalDocuments[0]).toMatchObject({
      content,
      status: 'cancelled',
    });
  });
});
