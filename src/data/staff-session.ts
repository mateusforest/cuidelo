// Preferência temporária da demonstração. Não concede autorização em servidor.
export const entryKey = 'cuidelo.demo.entry.v1';
export const activityKey = entryKey + '.activity';
const idle = 15 * 60 * 1000,
  shift = 8 * 60 * 60 * 1000;
export interface StaffVisit {
  id: string;
  ticket: string;
  opened: number;
  seen: number;
}
export function startVisit(id: string, now = Date.now()): StaffVisit {
  return { id, ticket: crypto.randomUUID(), opened: now, seen: now };
}
export function deadline(v: StaffVisit) {
  return Math.min(v.opened + shift, v.seen + idle);
}
export function savedVisit(id: string, now = Date.now()): StaffVisit | null {
  try {
    const v = JSON.parse(localStorage.getItem(entryKey) ?? 'null') as StaffVisit | null;
    const activity = JSON.parse(localStorage.getItem(activityKey) ?? 'null');
    if (v && activity?.ticket === v.ticket && Number.isSafeInteger(activity.seen))
      v.seen = Math.max(v.seen, activity.seen);
    if (
      !v ||
      v.id !== id ||
      typeof v.ticket !== 'string' ||
      !Number.isSafeInteger(v.opened) ||
      !Number.isSafeInteger(v.seen) ||
      v.opened > v.seen ||
      v.seen > now ||
      deadline(v) <= now
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
export function clearReportCodes() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith('cuidelo.report.read.v1.')) sessionStorage.removeItem(key);
  } catch {
    /* Sem armazenamento de sessão. */
  }
}
