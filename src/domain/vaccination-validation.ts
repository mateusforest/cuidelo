import type { Database } from './model';
import { validDay } from './dates';

export function validateVaccinationDatabase(db: Database) {
  const check = (ok: unknown) => {
    if (!ok) throw new Error('Invalid vaccination data');
  };
  const text = (value: unknown, max = 2000, mandatory = false) =>
    typeof value === 'string' && value.length <= max && (!mandatory || value.trim().length > 0);
  const instant = (value: unknown) =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));
  const same = (
    a: { organizationId: string; unitId: string },
    b: { organizationId: string; unitId: string },
  ) => a.organizationId === b.organizationId && a.unitId === b.unitId;
  for (const l of db.vaccineLots) {
    check(
      text(l.immunobiological, 160, true) &&
        text(l.manufacturer, 160, true) &&
        text(l.batch, 80, true) &&
        validDay(l.expiresAt) &&
        Number.isSafeInteger(l.quantity) &&
        l.quantity >= 0 &&
        l.quantity <= 1000000 &&
        ['available', 'quarantine'].includes(l.status),
    );
    const balance = db.vaccineMovements
      .filter((m) => m.lotId === l.id)
      .reduce(
        (n, m) =>
          n +
          (m.kind === 'receipt'
            ? m.quantity
            : m.kind === 'loss' || m.kind === 'application'
              ? -m.quantity
              : 0),
        0,
      );
    check(balance === l.quantity);
  }
  for (const m of db.vaccineMovements) {
    check(
      db.vaccineLots.some((l) => l.id === m.lotId && same(l, m)) &&
        ['receipt', 'application', 'loss', 'quarantine', 'release'].includes(m.kind) &&
        Number.isSafeInteger(m.quantity) &&
        (m.kind === 'quarantine' || m.kind === 'release' ? m.quantity === 0 : m.quantity > 0) &&
        text(m.reason, 1000, true) &&
        text(m.author, 160, true) &&
        instant(m.recordedAt),
    );
    check(
      m.kind === 'application'
        ? m.quantity === 1 &&
            db.immunizations.some(
              (i) =>
                i.id === m.applicationId &&
                i.lotId === m.lotId &&
                same(i, m) &&
                i.source === 'administered',
            )
        : !m.applicationId,
    );
  }
  for (const i of db.immunizations) {
    check(
      ['administered', 'transcribed'].includes(i.source) &&
        text(i.immunobiological, 160, true) &&
        text(i.dose, 80, true) &&
        validDay(i.date) &&
        instant(i.recordedAt) &&
        text(i.author, 160, true) &&
        text(i.observations, 2000),
    );
    check(
      text(i.batch, 80, i.source === 'administered') &&
        text(i.manufacturer, 160, i.source === 'administered') &&
        text(i.professional, 160, i.source === 'administered') &&
        text(i.institution, 160, true),
    );
    for (const value of [i.route, i.site, i.strategy])
      check(text(value, 120, i.source === 'administered'));
    check(text(i.group, 160, i.source === 'administered'));
    if (i.source === 'administered') {
      check(
        db.vaccineLots.some(
          (l) =>
            l.id === i.lotId &&
            same(l, i) &&
            l.batch === i.batch &&
            l.manufacturer === i.manufacturer &&
            l.immunobiological === i.immunobiological,
        ),
      );
      check(
        db.vaccineMovements.filter((m) => m.applicationId === i.id && m.kind === 'application')
          .length === 1,
      );
    } else check(!i.lotId);
    if (i.recallId)
      check(
        db.vaccineRecalls.some(
          (r) =>
            r.id === i.recallId &&
            same(r, i) &&
            r.patientId === i.patientId &&
            r.immunobiological.toLocaleLowerCase('pt-BR') ===
              i.immunobiological.toLocaleLowerCase('pt-BR') &&
            r.dose.toLocaleLowerCase('pt-BR') === i.dose.toLocaleLowerCase('pt-BR'),
        ),
      );
  }
  check(new Set(db.vaccineVoids.map((v) => v.applicationId)).size === db.vaccineVoids.length);
  for (const v of db.vaccineVoids)
    check(
      db.immunizations.some((i) => i.id === v.applicationId && same(i, v)) &&
        text(v.reason, 1000, true) &&
        text(v.author, 160, true) &&
        instant(v.recordedAt),
    );
  for (const r of db.vaccineRecalls) {
    check(
      text(r.immunobiological, 160, true) &&
        text(r.dose, 80, true) &&
        validDay(r.date) &&
        ['scheduled', 'completed', 'cancelled'].includes(r.status),
    );
    check(
      Array.isArray(r.events) &&
        r.events.length > 0 &&
        r.events.every(
          (e) =>
            text(e.action, 80, true) &&
            validDay(e.date) &&
            text(e.reason, 1200, true) &&
            text(e.author, 160, true) &&
            instant(e.recordedAt),
        ),
    );
    check(
      r.status === 'completed'
        ? db.immunizations.some(
            (i) =>
              i.id === r.applicationId &&
              i.recallId === r.id &&
              same(i, r) &&
              i.patientId === r.patientId &&
              !db.vaccineVoids.some((v) => v.applicationId === i.id),
          )
        : !r.applicationId,
    );
  }
}
