import { it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { demoContext } from './access';
import { applyCommand, readSnapshot } from './operations';
import { citizenView } from './citizen';
import { validateReviews } from './report-review';
it('registra autoria, limita por paciente, médico e unidade e preserva o SOAP concluído', () => {
  const db = createSeed(),
    c = demoContext('aurora', 'aurora-centro', 'clinical'),
    eid = 'aurora-centro-e0';
  const cmd = {
    type: 'report.review',
    encounterId: eid,
    patientId: 'aurora-p1',
    from: '2026-10-01',
    to: '2026-10-31',
    reportRef: 'a'.repeat(64),
  } as const;
  expect(() => applyCommand(db, c, cmd)).toThrow();
  applyCommand(db, c, { type: 'encounter.start', id: eid });
  expect(() => applyCommand(db, { ...c, sessionId: c.sessionId + ':2' }, cmd)).toThrow();
  expect(() => applyCommand(db, c, { ...cmd, patientId: 'aurora-p2' })).toThrow();
  expect(() => applyCommand(db, demoContext('aurora', 'aurora-vila', 'clinical'), cmd)).toThrow();
  expect(() =>
    applyCommand(db, demoContext('horizonte', 'horizonte-centro', 'clinical'), cmd),
  ).toThrow();
  applyCommand(db, c, {
    type: 'note.finalize',
    encounterId: eid,
    record: {
      soap: {
        subjective: '',
        objective: '',
        assessment: 'Avaliação fictícia',
        plan: 'Plano fictício',
      },
      coding: { codes: [], reason: 'Motivo fictício' },
    },
  });
  const notes = structuredClone(db.notes);
  const id = applyCommand(db, c, cmd),
    mid = crypto.randomUUID();
  expect(applyCommand(db, c, cmd)).toBe(id);
  const msg = {
    type: 'report.guidance',
    reviewId: id,
    messageId: mid,
    text: 'Orientação fictícia.',
  } as const;
  applyCommand(db, c, msg);
  applyCommand(db, c, msg);
  expect(() => applyCommand(db, c, { ...msg, text: 'Texto substituído' })).toThrow();
  expect(() => applyCommand(db, c, { ...msg, text: '   ' })).toThrow();
  expect(citizenView(db, c, 'aurora-p1', new Date()).guidance).toHaveLength(0);
  applyCommand(db, c, {
    type: 'report.sent',
    reviewId: id,
    messageId: mid,
    sentAt: new Date().toISOString(),
  });
  expect(citizenView(db, c, 'aurora-p1', new Date()).guidance).toMatchObject([
    { id: mid, text: msg.text },
  ]);
  expect(citizenView(db, c, 'aurora-p2', new Date()).guidance).toHaveLength(0);
  expect(db.reportReviews[0].messages).toHaveLength(1);
  expect(db.reportReviews[0].actorId).toBe(c.sessionId);
  expect(
    readSnapshot(db, demoContext('aurora', 'aurora-centro', 'reception')).reportReviews,
  ).toHaveLength(0);
  expect(
    readSnapshot(db, demoContext('horizonte', 'horizonte-centro', 'clinical')).reportReviews,
  ).toHaveLength(0);
  expect(db.notes).toEqual(notes);
  expect(() => validateReviews(db)).not.toThrow();
});
