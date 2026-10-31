import { available, alarmStatus, type Diary } from './citizen-care';
import type { CitizenView } from './citizen';

export function pushSchedule(d: Diary, view: CitizenView, zone: string) {
  const latest = new Map<string, NonNullable<Diary['postponements']>[number]>();
  for (const s of d.postponements ?? []) latest.set(JSON.stringify([s.planId, s.kind, s.when]), s);
  const scheduled = [...latest.values()].filter(
    (s) => s.until >= Date.now() - 300000 && alarmStatus(d, view, s) === 'open',
  );
  return {
    zone,
    plans: d.plans
      .filter((p) => available(p, view))
      .map(({ id, start, end, times, pickup, renewal, advance }) => ({
        ref: id,
        later: scheduled
          .filter((s) => s.planId === id)
          .map(({ kind, when, until }) => ({ kind, when, until })),
        start,
        end,
        times: [...times],
        pickup,
        renewal,
        advance,
      })),
  };
}
