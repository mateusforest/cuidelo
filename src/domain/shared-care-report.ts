import { careReport } from './care-report';
import { careKey, localDay, type CareScope, type Diary } from './citizen-care';
import type { CitizenView } from './citizen';
import type { Context, Encounter } from './model';
import { validDay, validTime } from './dates';
import { reportBinding } from './report-code.mjs';

export function reportSnapshot(d: Diary, view: CitizenView, from: string, to: string) {
  const { rows, ...counts } = careReport(d, view, from, to);
  return {
    version: 1 as const,
    person: view.person,
    from,
    to,
    counts,
    conditions: [...d.conditions],
    medicines: d.plans
      .filter(
        (p) =>
          p.start <= to &&
          (!p.end || p.end >= from) &&
          (!p.closedAt || localDay(new Date(p.closedAt)) >= from),
      )
      .map((p) => ({ name: p.medicine, times: p.times.join(', '), condition: p.condition })),
    rows: rows.map(({ day, time, source, title, detail }) => ({
      day,
      time,
      source,
      title,
      detail,
    })),
  };
}
export type SharedCareReport = ReturnType<typeof reportSnapshot>;
export async function citizenReportBinding(c: CareScope, v: CitizenView) {
  careKey(c);
  if (c.organization !== v.careScope?.organization || c.subject !== v.careScope.subject)
    throw Error('O relatório não pertence a esta pessoa.');
  if (c.subject.startsWith('example:')) {
    if (c.organization !== 'aurora') throw Error('Exemplo indisponível nesta rede.');
    return reportBinding('aurora', c.subject === 'example:ana' ? 'aurora-p1' : 'aurora-p2');
  }
  if (v.reportBinding && /^[a-f0-9]{64}$/.test(v.reportBinding)) return v.reportBinding;
  return reportBinding(c.organization, c.subject, true);
}
export function checkReportEncounter(c: Context, e: Encounter) {
  if (
    c.role !== 'clinical' ||
    c.unitId === 'all' ||
    e.organizationId !== c.organizationId ||
    e.unitId !== c.unitId ||
    !e.patientId
  )
    throw Error('Abra o atendimento desta pessoa no consultório da sua unidade.');
}
export function validateReport(value: unknown): SharedCareReport {
  const r = value as SharedCareReport;
  const str = (v: unknown) => typeof v === 'string',
    list = (v: unknown) => Array.isArray(v) && v.length <= 3000;
  if (
    !r ||
    r.version !== 1 ||
    !str(r.person) ||
    !validDay(r.from) ||
    !validDay(r.to) ||
    r.from > r.to ||
    !r.counts ||
    !['crises', 'taken', 'skipped', 'entries', 'postponed', 'pickups', 'renewals'].every((k) => {
      const n = r.counts[k as keyof typeof r.counts];
      return Number.isSafeInteger(n) && n >= 0;
    }) ||
    !list(r.conditions) ||
    !r.conditions.every(str) ||
    !list(r.medicines) ||
    !r.medicines.every((m) => m && [m.name, m.times, m.condition].every(str)) ||
    !list(r.rows) ||
    !r.rows.every(
      (row) =>
        row &&
        validDay(row.day) &&
        row.day >= r.from &&
        row.day <= r.to &&
        (row.time === '' || validTime(row.time)) &&
        ['Relato pessoal', 'Unidade de saúde'].includes(row.source) &&
        str(row.title) &&
        str(row.detail),
    )
  )
    throw Error('Não foi possível conferir esta cópia do relatório.');
  return r;
}
