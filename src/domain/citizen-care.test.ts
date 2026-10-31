import { describe, it, expect } from 'vitest';
import { readCitizenExample } from '../data/citizen-examples';
import {
  applyCare,
  freshDiary,
  reminders,
  dueReminders,
  localDay,
  localStamp,
  type CareCommand,
  type CareScope,
} from './citizen-care';
import { careCalendar } from './care-calendar';
import { careReport } from './care-report';
const now = new Date(2026, 9, 31, 8, 0),
  view = readCitizenExample('ana', now),
  scope: CareScope = { role: 'citizen', unit: 'personal', ...view.careScope };
const plan: Extract<CareCommand, { type: 'plan' }> = {
  type: 'plan',
  medicine: 'Medicamento fictício',
  condition: 'Condição fictícia',
  times: ['20:00', '08:00'],
  start: '2026-10-31',
  end: '2026-11-20',
  pickup: '2026-11-03',
  renewal: '2026-11-09',
  advance: 3,
  source: null,
};
describe('acompanhamento diário', () => {
  it('adia a ocorrência original, registra uma única dose depois da meia-noite e preserva histórico', () => {
    const d = freshDiary(),
      start = new Date('2026-11-01T02:59:00Z');
    applyCare(scope, d, { ...plan, times: ['23:59'] }, view, start);
    const target = { planId: d.plans[0].id, kind: 'dose' as const, when: '2026-10-31T23:59' };
    const cmd = {
      type: 'respond' as const,
      target,
      noticeId: 'a'.repeat(32),
      due: start.getTime(),
      zone: 'America/Sao_Paulo',
      action: 'later' as const,
      minutes: 10,
    };
    expect(() => applyCare({ ...scope, subject: 'example:joao' }, d, cmd, view, start)).toThrow();
    applyCare(scope, d, cmd, view, start);
    expect(d.doses).toHaveLength(0);
    expect(() => applyCare(scope, d, cmd, view, start)).toThrow();
    const next = new Date(d.postponements![0].until),
      confirm = {
        ...cmd,
        action: 'confirm' as const,
        noticeId: 'b'.repeat(32),
        due: next.getTime(),
      };
    applyCare(scope, d, confirm, view, next);
    expect(d.doses).toMatchObject([
      { slot: target.when, recordedAt: next.toISOString(), taken: true },
    ]);
    expect(() => applyCare(scope, d, confirm, view, next)).toThrow();
    expect(d.postponements).toHaveLength(1);
  });
  it('um aviso antigo não confirma a nova data da farmácia, outra receita ou uma dose futura', () => {
    const d = freshDiary();
    applyCare(scope, d, plan, view, now);
    const cmd = {
      type: 'respond' as const,
      target: { planId: d.plans[0].id, kind: 'renewal' as const, when: plan.renewal },
      zone: 'UTC',
      noticeId: 'a'.repeat(32),
      due: now.getTime(),
      action: 'confirm' as const,
      next: '2026-12-01',
    };
    applyCare(scope, d, cmd, view, now);
    expect(() => applyCare(scope, d, cmd, view, now)).toThrow();
    expect(d.steps).toHaveLength(1);
    expect(() =>
      applyCare(
        scope,
        d,
        { ...cmd, target: { ...cmd.target, kind: 'dose', when: '2026-11-01T08:00' } },
        view,
        now,
      ),
    ).toThrow();
    applyCare(scope, d, { type: 'close', planId: cmd.target.planId }, view, now);
    expect(() =>
      applyCare(
        scope,
        d,
        { ...cmd, target: { ...cmd.target, kind: 'pickup', when: plan.pickup } },
        view,
        now,
      ),
    ).toThrow();
  });
  it('guarda relatos com autoria pessoal e recusa datas futuras, intensidade inválida e outra pessoa', () => {
    const d = freshDiary(),
      cmd = {
        type: 'entry' as const,
        at: localStamp(now),
        kind: 'crisis' as const,
        condition: 'Ansiedade',
        intensity: 'Intensa',
        duration: '12',
        text: 'Relato fictício.',
      };
    expect(() => applyCare({ ...scope, subject: 'example:joao' }, d, cmd, view, now)).toThrow();
    expect(() => applyCare({ ...scope, organization: 'outra' }, d, cmd, view, now)).toThrow();
    expect(() => applyCare(scope, d, { ...cmd, at: '2026-10-31T09:00' }, view, now)).toThrow();
    expect(() => applyCare(scope, d, { ...cmd, intensity: 'inventada' }, view, now)).toThrow();
    applyCare(scope, d, cmd, view, now);
    expect(d.conditions).toEqual(['Ansiedade']);
    expect(d.entries[0].duration).toBe('12');
  });
  it('distingue não tomado de sem registro, preserva a correção e bloqueia registro duplicado', () => {
    const d = freshDiary();
    applyCare(scope, d, plan, view, now);
    const planId = d.plans[0].id,
      slot = localStamp(now),
      dose = { type: 'dose' as const, planId, slot, taken: true };
    expect(() => applyCare(scope, d, { ...dose, slot: '2026-10-31T20:00' }, view, now)).toThrow();
    applyCare(scope, d, dose, view, now);
    expect(() => applyCare(scope, d, dose, view, now)).toThrow();
    const change = {
      type: 'correct-dose' as const,
      planId,
      slot,
      count: 0,
      reason: 'Toque engano de teste',
    };
    applyCare(scope, d, change, view, now);
    expect(() => applyCare(scope, d, change, view, now)).toThrow();
    expect(d.doses[0].taken).toBe(true);
    expect(careReport(d, view, localDay(now), localDay(now))).toMatchObject({
      taken: 0,
      skipped: 1,
    });
    expect(
      reminders(d, view, now)
        .filter((r) => r.kind === 'dose')
        .map((r) => r.when),
    ).toEqual(['2026-10-31T20:00']);
  });
  it('respeita antecedência, nova data manual, deduplicação dos avisos e encerramento', () => {
    const d = freshDiary();
    applyCare(scope, d, plan, view, now);
    const p = d.plans[0],
      due = dueReminders(d, view, now);
    expect(due.map((r) => r.kind)).toEqual(['dose', 'pickup']);
    expect(dueReminders(d, view, new Date(2026, 9, 31, 8, 7)).some((r) => r.kind === 'dose')).toBe(
      false,
    );
    applyCare(scope, d, { type: 'notifications', enabled: true }, view, now);
    const claim = { type: 'claim' as const, key: due[0].key };
    expect(applyCare(scope, d, claim, view, now)).toBe(true);
    expect(applyCare(scope, d, claim, view, now)).toBe(false);
    const step = {
      type: 'step' as const,
      planId: p.id,
      kind: 'pickup' as const,
      date: '2026-10-31',
      next: '2026-11-30',
    };
    applyCare(scope, d, step, view, now);
    expect(() => applyCare(scope, d, step, view, now)).toThrow();
    expect(d.steps[0].previous).toBe('2026-11-03');
    expect(dueReminders(d, view, now).some((r) => r.kind === 'pickup')).toBe(false);
    applyCare(scope, d, { type: 'close', planId: p.id }, view, now);
    expect(reminders(d, view, now)).toEqual([]);
    expect(careReport(d, view, '2026-10-01', '2026-10-31').pickups).toBe(1);
  });
  it('suspende receita cancelada ou ausente inclusive no calendário e não infere horários da receita', () => {
    const v = structuredClone(view),
      doc = v.documents.find((d) => d.content.kind === 'prescription')!;
    if (doc.content.kind !== 'prescription') throw Error();
    const d = freshDiary();
    applyCare(
      scope,
      d,
      { ...plan, source: { docId: doc.id, itemId: doc.content.items[0].id } },
      v,
      now,
    );
    expect(d.plans[0].medicine).toBe(doc.content.items[0].medicine);
    doc.status = 'cancelled';
    expect(reminders(d, v, now)).toEqual([]);
    expect(() => careCalendar(d.plans[0], v, now)).toThrow();
    expect(() =>
      applyCare(
        scope,
        d,
        { type: 'dose', planId: d.plans[0].id, slot: localStamp(now), taken: true },
        v,
        now,
      ),
    ).toThrow();
    v.documents = [];
    expect(reminders(d, v, now)).toEqual([]);
  });
  it('gera horários locais e alarmes de calendário sem duplicar horários e sem dados pessoais', () => {
    const d = freshDiary();
    expect(() => applyCare(scope, d, { ...plan, times: ['08:00', '08:00'] }, view, now)).toThrow();
    applyCare(scope, d, plan, view, now);
    expect(() => applyCare(scope, d, plan, view, now)).toThrow();
    const ics = careCalendar(d.plans[0], view, now);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('RRULE:FREQ=DAILY;UNTIL=20261120T080000');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).not.toContain(view.person);
    expect(() => careReport(d, view, '2026-11-01', '2026-10-01')).toThrow();
  });
});
