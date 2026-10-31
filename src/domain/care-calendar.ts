import { addDays } from './dates';
import { available, localDay, localClock, type CarePlan } from './citizen-care';
import type { CitizenView } from './citizen';
const esc = (v: string) =>
  v
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
function folded(text: string) {
  const encoder = new TextEncoder();
  let s = '',
    length = 0;
  for (const c of text) {
    const n = encoder.encode(c).length;
    if (length + n > 75) {
      s += '\r\n ';
      length = 1;
    }
    s += c;
    length += n;
  }
  return s;
}
export function careCalendar(plan: CarePlan, view: CitizenView, now: Date) {
  if (!available(plan, view)) throw Error('Lembrete indisponível para exportar.');
  const today = localDay(now),
    day = (s: string) => s.replaceAll('-', ''),
    stamp = (date: string, time: string) => day(date) + 'T' + time.replace(':', '') + '00';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cuidelo//Dia a dia de demonstracao//PT-BR',
    'CALSCALE:GREGORIAN',
  ];
  const event = (id: string, start: string, title: string, trigger: string, rule?: string) => {
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + plan.id + '-' + id + '@cuidelo.demo',
      'DTSTAMP:' +
        now
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, ''),
      'DTSTART:' + start,
      'DURATION:PT1M',
      'SUMMARY:' + esc(title + ' · ' + plan.medicine + ' (demonstração)'),
      ...(rule ? [rule] : []),
    );
    const triggers = trigger === 'PT0M' ? [trigger] : [trigger, 'PT0M'];
    for (const alarm of triggers)
      lines.push(
        'BEGIN:VALARM',
        'TRIGGER:' + alarm,
        'ACTION:DISPLAY',
        'DESCRIPTION:Lembrete pessoal do Cuidelo',
        'END:VALARM',
      );
    lines.push('END:VEVENT');
  };
  for (const time of plan.times) {
    const next = time < localClock(now) ? addDays(today, 1) : today;
    const start = plan.start > next ? plan.start : next;
    if (!plan.end || plan.end >= start)
      event(
        time.replace(':', ''),
        stamp(start, time),
        'Horário de medicação',
        'PT0M',
        'RRULE:FREQ=DAILY' + (plan.end ? ';UNTIL=' + stamp(plan.end, time) : ''),
      );
  }
  for (const [kind, title] of [
    ['pickup', 'Retirada'],
    ['renewal', 'Renovação'],
  ] as const) {
    if (plan[kind] && plan[kind] >= today)
      event(
        kind,
        stamp(plan[kind], '09:00'),
        title,
        plan.advance ? '-P' + plan.advance + 'D' : 'PT0M',
      );
  }
  if (!lines.includes('BEGIN:VEVENT'))
    throw Error('Não há datas futuras para adicionar ao calendário.');
  return [...lines, 'END:VCALENDAR', ''].map(folded).join('\r\n');
}
