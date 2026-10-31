import { it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { readCitizenExample } from '../data/citizen-examples';
import { demoContext } from './access';
import {
  checkReportEncounter,
  citizenReportBinding,
  reportSnapshot,
  validateReport,
} from './shared-care-report';
import { freshDiary, type CareScope } from './citizen-care';
import { reportBinding } from './report-code.mjs';
it('valida rede, unidade e perfil e usa o vínculo estável ou o vínculo legado da estação', async () => {
  const now = new Date(),
    v = readCitizenExample('ana', now),
    c: CareScope = { role: 'citizen', unit: 'personal', ...v.careScope };
  expect(await citizenReportBinding(c, v)).toBe(await reportBinding('aurora', 'aurora-p1'));
  await expect(citizenReportBinding({ ...c, subject: 'example:joao' }, v)).rejects.toThrow();
  const shared = { ...c, subject: 'share:' + crypto.randomUUID() },
    w = { ...v, careScope: shared };
  expect(await citizenReportBinding(shared, w)).toBe(
    await reportBinding('aurora', shared.subject, true),
  );
  expect(await citizenReportBinding(shared, { ...w, reportBinding: '7'.repeat(64) })).toBe(
    '7'.repeat(64),
  );
  const e = createSeed(now).encounters.find((e) => e.id === 'aurora-centro-e0')!,
    doctor = demoContext('aurora', 'aurora-centro', 'clinical');
  expect(() => checkReportEncounter(doctor, e)).not.toThrow();
  for (const other of [
    { ...doctor, role: 'reception' as const },
    { ...doctor, unitId: 'aurora-vila' },
    { ...doctor, organizationId: 'horizonte' },
  ])
    expect(() => checkReportEncounter(other, e)).toThrow();
  const snap = reportSnapshot(freshDiary(), v, '2026-01-01', '2026-01-31');
  expect(validateReport(snap)).toEqual(snap);
  expect(() =>
    validateReport({ ...snap, rows: [{ source: 'Relato pessoal', day: '2027-01-01' }] }),
  ).toThrow();
});
