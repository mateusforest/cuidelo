// Only wall-clock times, dates and lead times leave the diary. No clinical identifiers.
const dayMs = 86400000;
const dayOf = (n) => new Date(n).toISOString().slice(0, 10);
const dayShift = (day, n) => dayOf(Date.parse(day + 'T12:00:00Z') + n * dayMs);
const validDay = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d\d-\d\d$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  dayOf(Date.parse(s)) === s;
const validTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const formatter = (zone) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
export function validateSchedule(input) {
  if (
    !input ||
    Object.keys(input).some((k) => !['zone', 'plans'].includes(k)) ||
    typeof input.zone !== 'string' ||
    input.zone.length > 80 ||
    !Array.isArray(input.plans) ||
    input.plans.length > 40
  )
    throw Error('Agenda inválida ou acima de 40 lembretes.');
  formatter(input.zone);
  const refs = new Set();
  const plans = input.plans.map((p) => {
    if (
      !p ||
      Object.keys(p).some(
        (k) =>
          !['start', 'end', 'times', 'pickup', 'renewal', 'advance', 'ref', 'later'].includes(k),
      ) ||
      !validDay(p.start) ||
      !(p.end === '' || (validDay(p.end) && p.end >= p.start)) ||
      !(p.pickup === '' || validDay(p.pickup)) ||
      !(p.renewal === '' || validDay(p.renewal)) ||
      !Number.isInteger(p.advance) ||
      p.advance < 0 ||
      p.advance > 30 ||
      !Array.isArray(p.times) ||
      p.times.length > 8 ||
      !p.times.every(validTime)
    )
      throw Error('Datas ou horários inválidos.');
    if (p.ref !== undefined || p.later !== undefined) {
      if (
        typeof p.ref !== 'string' ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(p.ref) ||
        refs.has(p.ref) ||
        !Array.isArray(p.later ?? []) ||
        (p.later ?? []).length > 32 ||
        (p.later ?? []).some(
          (s) =>
            !s ||
            Object.keys(s).some((k) => !['kind', 'when', 'until'].includes(k)) ||
            !Number.isSafeInteger(s.until) ||
            s.until <= 0 ||
            s.until > 8640000000000000 ||
            !(s.kind === 'dose'
              ? typeof s.when === 'string' &&
                s.when.length === 16 &&
                s.when[10] === 'T' &&
                validDay(s.when.slice(0, 10)) &&
                p.times.includes(s.when.slice(11))
              : ['pickup', 'renewal'].includes(s.kind) && validDay(s.when) && s.when === p[s.kind]),
        )
      )
        throw Error('Identificação do aviso inválida.');
      refs.add(p.ref);
    }
    return {
      ...(p.ref ? { ref: p.ref, later: p.later ?? [] } : {}),
      start: p.start,
      end: p.end,
      times: [...new Set(p.times)].sort(),
      pickup: p.pickup,
      renewal: p.renewal,
      advance: p.advance,
    };
  });
  return { zone: input.zone, plans };
}
function instant(fmt, day, time) {
  const target = day + ' ' + time,
    utc = Date.parse(day + 'T' + time + ':00Z');
  let n = utc;
  for (let i = 0; i < 4; i++) {
    const actual = fmt.format(n);
    if (actual === target) return n;
    n += utc - Date.parse(actual.replace(' ', 'T') + ':00Z');
  }
  return Infinity; // A skipped local time (DST gap) is not shifted to another dose time.
}
export function nextAlarm(schedule, after) {
  const fmt = formatter(schedule.zone),
    today = fmt.format(after).slice(0, 10);
  let next = Infinity;
  for (const p of schedule.plans) {
    for (const s of p.later ?? []) if (s.until > after) next = Math.min(next, s.until);
    const first = p.start > today ? p.start : today;
    for (const time of p.times) {
      for (let i = 0; i < 3; i++) {
        const day = dayShift(first, i);
        if (p.end && day > p.end) break;
        const n = instant(fmt, day, time);
        if (n > after && Number.isFinite(n)) {
          next = Math.min(next, n);
          break;
        }
      }
    }
    for (const date of [p.pickup, p.renewal])
      if (date)
        for (const day of new Set([dayShift(date, -p.advance), date])) {
          const n = instant(fmt, day, '09:00');
          if (n > after) next = Math.min(next, n);
        }
  }
  return Number.isFinite(next) ? next : null;
}

// A fila pode acordar atrasada. O instante originalmente agendado determina a ocorrência.
export function alarmTargets(schedule, due) {
  const fmt = formatter(schedule.zone),
    stamp = fmt.format(due),
    [day, time] = stamp.split(' ');
  const result = [];
  for (const p of schedule.plans) {
    if (!p.ref) continue;
    const targets = new Map();
    const add = (kind, when) => targets.set(kind + '/' + when, { planId: p.ref, kind, when });
    if (instant(fmt, day, time) === due) {
      if (day >= p.start && (!p.end || day <= p.end) && p.times.includes(time))
        add('dose', day + 'T' + time);
      for (const kind of ['pickup', 'renewal'])
        if (
          time === '09:00' &&
          p[kind] &&
          (day === p[kind] || day === dayShift(p[kind], -p.advance))
        )
          add(kind, p[kind]);
    }
    for (const s of p.later ?? []) if (s.until === due) add(s.kind, s.when);
    result.push(...targets.values());
  }
  return result;
}
