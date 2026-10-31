import { shortDate, validDay } from './dates';
import {
  kinds,
  milestoneNames,
  localDay,
  localClock,
  effectiveTaken,
  type Diary,
} from './citizen-care';
import { documentNames } from './clinical-documents';
import type { CitizenView } from './citizen';

export interface CareReportRow {
  key: string;
  day: string;
  time: string;
  source: 'Relato pessoal' | 'Unidade de saúde';
  title: string;
  detail: string;
}
export function careReport(d: Diary, view: CitizenView, from: string, to: string) {
  if (!validDay(from) || !validDay(to) || from > to)
    throw Error('Confira o início e o fim do período.');
  const inside = (day: string) => day >= from && day <= to,
    rows: CareReportRow[] = [],
    plans = new Map(d.plans.map((p) => [p.id, p]));
  const entries = d.entries.filter((e) => inside(e.at.slice(0, 10))),
    doses = d.doses.filter((e) => inside(e.slot.slice(0, 10))),
    steps = d.steps.filter((s) => inside(s.date));
  for (const e of entries)
    rows.push({
      key: e.id,
      day: e.at.slice(0, 10),
      time: e.at.slice(11),
      source: 'Relato pessoal',
      title: kinds[e.kind] + (e.condition ? ' · ' + e.condition : ''),
      detail: [e.intensity, e.duration ? e.duration + ' min' : '', e.text]
        .filter(Boolean)
        .join(' · '),
    });
  for (const a of doses)
    rows.push({
      key: a.planId + a.slot,
      day: a.slot.slice(0, 10),
      time: a.slot.slice(11),
      source: 'Relato pessoal',
      title: plans.get(a.planId)!.medicine,
      detail:
        (effectiveTaken(a) ? 'Informou que tomou' : 'Informou que não tomou') +
        ' · horário previsto ' +
        a.slot.slice(11) +
        ' · registro às ' +
        localClock(new Date(a.recordedAt)) +
        (a.corrections
          ?.map(
            (c) =>
              ' · correção em ' +
              shortDate(localDay(new Date(c.at))) +
              ' às ' +
              localClock(new Date(c.at)) +
              ': ' +
              (c.taken ? 'tomei' : 'não tomei') +
              ' (' +
              c.reason +
              ')',
          )
          .join('') || ''),
    });
  for (const s of steps)
    rows.push({
      key: s.planId + s.kind + s.date,
      day: s.date,
      time: '',
      source: 'Relato pessoal',
      title: milestoneNames[s.kind] + ' · ' + plans.get(s.planId)!.medicine,
      detail: s.next
        ? 'Próxima data informada: ' + shortDate(s.next)
        : 'Sem próxima data informada',
    });
  for (const a of view.appointments.filter((a) => inside(a.date)))
    rows.push({
      key: a.id,
      day: a.date,
      time: a.time,
      source: 'Unidade de saúde',
      title: a.service,
      detail:
        a.unit +
        ' · ' +
        { scheduled: 'Agendado', cancelled: 'Cancelado', 'checked-in': 'Chegada confirmada' }[
          a.status
        ],
    });
  for (const doc of view.documents) {
    const day = localDay(new Date(doc.issuedAt));
    if (inside(day))
      rows.push({
        key: doc.id,
        day,
        time: '',
        source: 'Unidade de saúde',
        title: documentNames[doc.content.kind],
        detail:
          doc.unit +
          ' · ' +
          doc.number +
          ' · ' +
          (doc.status === 'issued' ? 'Emitido' : 'Cancelado'),
      });
  }
  return {
    rows: rows.sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time)),
    crises: entries.filter((e) => e.kind === 'crisis').length,
    entries: entries.length,
    taken: doses.filter((e) => effectiveTaken(e)).length,
    skipped: doses.filter((e) => !effectiveTaken(e)).length,
    pickups: steps.filter((s) => s.kind === 'pickup').length,
    renewals: steps.filter((s) => s.kind === 'renewal').length,
  };
}
