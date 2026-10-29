export const timeZone = 'America/Sao_Paulo';
export function dateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function addDays(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dateKey(d);
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
  );
}
export function validTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function minuteOfDay(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function clockTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}
export function shortDate(day: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(day.length === 10 ? `${day}T12:00:00-03:00` : day));
}
export function ageAt(birthDate: string, now = new Date()) {
  const today = dateKey(now);
  const age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return age - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}
export function minutesWaiting(iso: string, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60000));
}
