import { expect, it, vi } from 'vitest';
import { entryKey, activityKey, startVisit, savedVisit } from './staff-session';
it('ignora acessos antigos e atividade de sessão anterior; o limite absoluto prevalece mesmo com interação', () => {
  const raw = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => raw.get(k) ?? null });
  try {
    raw.set(entryKey, 'perfil-antigo');
    expect(savedVisit('perfil-antigo')).toBeNull();
    const now = 1000,
      v = startVisit('ubs:clinical', now);
    raw.set(entryKey, JSON.stringify(v));
    raw.set(activityKey, JSON.stringify({ ticket: 'antigo', seen: now + 900000 }));
    expect(savedVisit(v.id, now + 900000)).toBeNull();
    const end = now + 8 * 3600000;
    raw.set(activityKey, JSON.stringify({ ticket: v.ticket, seen: end - 1000 }));
    expect(savedVisit(v.id, end - 1)?.ticket).toBe(v.ticket);
    expect(savedVisit(v.id, end)).toBeNull();
    raw.delete(entryKey);
    expect(savedVisit(v.id, now + 10000)).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
