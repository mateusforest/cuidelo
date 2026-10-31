import { available, type Diary } from './citizen-care';
import type { CitizenView } from './citizen';

export function pushSchedule(d: Diary, view: CitizenView, zone: string) {
  return {
    zone,
    plans: d.plans
      .filter((p) => available(p, view))
      .map(({ start, end, times, pickup, renewal, advance }) => ({
        start,
        end,
        times: [...times],
        pickup,
        renewal,
        advance,
      })),
  };
}
