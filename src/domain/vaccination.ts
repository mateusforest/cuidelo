import { recordRecallContact } from './continuity';
import {
  can,
  roleNames,
  type Context,
  type Database,
  type VaccinationCommand,
  type VaccinationSummary,
  type VaccineMovement,
} from './model';
import { dateKey, validDay, addDays } from './dates';
import { DomainError } from './errors';

function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new DomainError(message);
}
const required = (value: string, label: string, max = 160) => {
  ensure(
    typeof value === 'string' && value.trim() && value.length <= max,
    `${label}: preencha até ${max} caracteres.`,
  );
  return value.trim();
};
const optional = (value: string, label: string, max = 2000) => {
  ensure(
    typeof value === 'string' && value.length <= max,
    `${label}: limite de ${max} caracteres.`,
  );
  return value.trim();
};
const normalized = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
const quantity = (value: number) => {
  ensure(
    Number.isSafeInteger(value) && value > 0 && value <= 1000000,
    'Informe uma quantidade inteira entre 1 e 1.000.000 doses.',
  );
  return value;
};

export function applyVaccinationCommand(
  db: Database,
  c: Context,
  cmd: VaccinationCommand,
  now: Date,
  newId: () => string,
) {
  const stock = cmd.type === 'vaccine.lot.create' || cmd.type === 'vaccine.stock';
  ensure(
    can(c.role, stock ? 'vaccine.stock' : 'vaccination'),
    'Este perfil não tem acesso a esta operação.',
  );
  const at = now.toISOString(),
    today = dateKey(now),
    author = `${roleNames[c.role]} · demonstração`;
  const scope = { organizationId: c.organizationId, unitId: c.unitId };
  const member = <T extends { id: string; organizationId: string; unitId: string }>(
    items: T[],
    id: string,
  ) => {
    const item = items.find(
      (i) => i.id === id && i.organizationId === c.organizationId && i.unitId === c.unitId,
    );
    ensure(item, 'Registro não encontrado nesta unidade.');
    return item;
  };
  const patient = (id: string) => {
    const p = db.patients.find((p) => p.id === id && p.organizationId === c.organizationId);
    ensure(p, 'Pessoa não encontrada nesta rede.');
    return p;
  };
  const movement = (
    lotId: string,
    kind: VaccineMovement['kind'],
    count: number,
    reason: string,
    applicationId?: string,
  ) => {
    db.vaccineMovements.push({
      id: newId(),
      ...scope,
      lotId,
      kind,
      quantity: count,
      reason,
      recordedAt: at,
      author,
      ...(applicationId ? { applicationId } : {}),
    });
  };
  switch (cmd.type) {
    case 'vaccine.recall.contact': {
      return {
        entityId: recordRecallContact(db, c, cmd, now, newId),
        action: 'Contato de retorno vacinal registrado',
      };
    }
    case 'vaccine.lot.create': {
      const immunobiological = required(cmd.immunobiological, 'Imunobiológico'),
        manufacturer = required(cmd.manufacturer, 'Fabricante'),
        batch = required(cmd.batch, 'Lote', 80),
        count = quantity(cmd.quantity);
      ensure(
        validDay(cmd.expiresAt) && cmd.expiresAt >= today,
        'Informe uma validade a partir de hoje.',
      );
      ensure(
        !db.vaccineLots.some(
          (l) =>
            l.organizationId === c.organizationId &&
            l.unitId === c.unitId &&
            normalized(l.immunobiological) === normalized(immunobiological) &&
            normalized(l.manufacturer) === normalized(manufacturer) &&
            normalized(l.batch) === normalized(batch),
        ),
        'Este lote já está cadastrado. Registre uma entrada no lote existente.',
      );
      const id = newId();
      db.vaccineLots.push({
        id,
        ...scope,
        immunobiological,
        manufacturer,
        batch,
        expiresAt: cmd.expiresAt,
        quantity: count,
        status: 'available',
      });
      movement(id, 'receipt', count, 'Recebimento inicial do lote');
      return { entityId: id, action: 'Lote de imunobiológico cadastrado' };
    }
    case 'vaccine.stock': {
      const lot = member(db.vaccineLots, cmd.lotId),
        reason = required(cmd.reason, 'Motivo', 1000);
      if (cmd.kind === 'receipt' || cmd.kind === 'loss') {
        const count = quantity(cmd.quantity);
        if (cmd.kind === 'receipt') {
          ensure(lot.expiresAt >= today, 'Lote vencido não pode receber entradas.');
          ensure(lot.quantity + count <= 1000000, 'Saldo máximo de demonstração excedido.');
        } else ensure(lot.quantity >= count, 'Saldo insuficiente para registrar a perda.');
        lot.quantity += cmd.kind === 'receipt' ? count : -count;
        movement(lot.id, cmd.kind, count, reason);
      } else {
        ensure(cmd.kind === 'quarantine' || cmd.kind === 'release', 'Movimento inválido.');
        ensure(
          cmd.kind === 'quarantine' ? lot.status === 'available' : lot.status === 'quarantine',
          'A situação do lote já mudou. Revise o estoque.',
        );
        if (cmd.kind === 'release')
          ensure(lot.expiresAt >= today, 'Um lote vencido não pode ser liberado para uso.');
        lot.status = cmd.kind === 'quarantine' ? 'quarantine' : 'available';
        movement(lot.id, cmd.kind, 0, reason);
      }
      return { entityId: lot.id, action: 'Movimentação de imunobiológico registrada' };
    }
    case 'vaccine.record': {
      const p = patient(cmd.patientId);
      ensure(
        cmd.source === 'administered' || cmd.source === 'transcribed',
        'Origem do registro inválida.',
      );
      ensure(
        validDay(cmd.date) && cmd.date >= p.birthDate && cmd.date <= today,
        'A data da aplicação deve estar entre o nascimento e hoje.',
      );
      const lot =
        cmd.source === 'administered' ? member(db.vaccineLots, cmd.lotId ?? '') : undefined;
      if (lot) {
        ensure(
          cmd.date === today,
          'Aplicações com baixa de estoque são registradas no dia. O registro tardio de aplicações da unidade ainda precisa de reconciliação própria.',
        );
        ensure(lot.status === 'available', 'Lote em quarentena: aplicação bloqueada.');
        ensure(lot.expiresAt >= today, 'Lote vencido: aplicação bloqueada.');
        ensure(lot.quantity >= 1, 'Lote sem saldo disponível.');
      }
      const immunobiological =
        lot?.immunobiological ?? required(cmd.immunobiological, 'Imunobiológico');
      const dose = required(cmd.dose, 'Dose', 80);
      const entry = {
        id: newId(),
        ...scope,
        patientId: p.id,
        source: cmd.source,
        immunobiological,
        dose,
        date: cmd.date,
        batch: lot?.batch ?? optional(cmd.batch, 'Lote', 80),
        manufacturer: lot?.manufacturer ?? optional(cmd.manufacturer, 'Fabricante', 160),
        route: lot ? required(cmd.route, 'Via', 120) : optional(cmd.route, 'Via', 120),
        site: lot
          ? required(cmd.site, 'Local de aplicação', 120)
          : optional(cmd.site, 'Local de aplicação', 120),
        strategy: lot
          ? required(cmd.strategy, 'Estratégia', 120)
          : optional(cmd.strategy, 'Estratégia', 120),
        group: lot
          ? required(cmd.group, 'Grupo de atendimento', 160)
          : optional(cmd.group, 'Grupo de atendimento', 160),
        professional: lot
          ? required(cmd.professional, 'Profissional informado', 160)
          : optional(cmd.professional, 'Profissional informado', 160),
        institution: lot
          ? db.units.find((u) => u.id === c.unitId)!.name
          : required(cmd.institution, 'Origem do comprovante', 160),
        observations: optional(cmd.observations, 'Observações'),
        recordedAt: at,
        author,
        ...(lot ? { lotId: lot.id } : {}),
        ...(cmd.recallId ? { recallId: cmd.recallId } : {}),
      };
      const voidIds = new Set(db.vaccineVoids.map((v) => v.applicationId));
      ensure(
        !db.immunizations.some(
          (i) =>
            !voidIds.has(i.id) &&
            i.organizationId === c.organizationId &&
            i.patientId === p.id &&
            normalized(i.immunobiological) === normalized(immunobiological) &&
            normalized(i.dose) === normalized(dose) &&
            i.date === cmd.date,
        ),
        'Já existe registro dessa vacina, dose e data para esta pessoa na rede. Confira a caderneta antes de repetir.',
      );
      const recall = cmd.recallId ? member(db.vaccineRecalls, cmd.recallId) : undefined;
      if (recall) {
        ensure(recall.status === 'scheduled', 'Este aprazamento não está pendente.');
        ensure(
          recall.patientId === p.id &&
            normalized(recall.immunobiological) === normalized(immunobiological) &&
            normalized(recall.dose) === normalized(dose),
          'O aprazamento deve corresponder à mesma pessoa, vacina e dose.',
        );
      }
      db.immunizations.push(entry);
      if (lot) {
        lot.quantity -= 1;
        movement(lot.id, 'application', 1, 'Baixa por aplicação registrada', entry.id);
      }
      if (recall) {
        recall.status = 'completed';
        recall.applicationId = entry.id;
        recall.events.push({
          action: 'Atendido',
          date: recall.date,
          reason: 'Vinculado a registro de vacinação',
          recordedAt: at,
          author,
        });
      }
      return {
        entityId: entry.id,
        action: lot ? 'Aplicação de vacina registrada' : 'Histórico vacinal transcrito',
      };
    }
    case 'vaccine.void': {
      const entry = member(db.immunizations, cmd.applicationId),
        reason = required(cmd.reason, 'Motivo da anulação', 1000);
      ensure(
        !db.vaccineVoids.some((v) => v.applicationId === entry.id),
        'Este registro já foi anulado.',
      );
      const recall = entry.recallId ? member(db.vaccineRecalls, entry.recallId) : undefined;
      if (recall) {
        ensure(
          recall.applicationId === entry.id && recall.status === 'completed',
          'Vínculo do retorno inconsistente.',
        );
        ensure(
          !db.vaccineRecalls.some(
            (r) =>
              r.id !== recall.id &&
              r.organizationId === c.organizationId &&
              r.patientId === recall.patientId &&
              normalized(r.immunobiological) === normalized(recall.immunobiological) &&
              normalized(r.dose) === normalized(recall.dose) &&
              r.status === 'scheduled',
          ),
          'Há outro aprazamento pendente para esta vacina e dose. Revise os retornos antes de reabrir este.',
        );
      }
      const id = newId();
      db.vaccineVoids.push({
        id,
        ...scope,
        applicationId: entry.id,
        reason,
        recordedAt: at,
        author,
      });
      if (recall) {
        recall.status = 'scheduled';
        delete recall.applicationId;
        recall.events.push({
          action: 'Reaberto',
          date: recall.date,
          reason: 'Anulação do registro vinculado: ' + reason,
          recordedAt: at,
          author,
        });
      }
      return { entityId: id, action: 'Registro vacinal anulado com justificativa' };
    }
    case 'vaccine.recall.create': {
      patient(cmd.patientId);
      const immunobiological = required(cmd.immunobiological, 'Imunobiológico'),
        dose = required(cmd.dose, 'Dose', 80),
        reason = required(cmd.reason, 'Orientação registrada', 1000);
      ensure(validDay(cmd.date) && cmd.date >= today, 'Escolha uma data a partir de hoje.');
      ensure(
        !db.vaccineRecalls.some(
          (r) =>
            r.organizationId === c.organizationId &&
            r.patientId === cmd.patientId &&
            normalized(r.immunobiological) === normalized(immunobiological) &&
            normalized(r.dose) === normalized(dose) &&
            r.status === 'scheduled',
        ),
        'Já existe um aprazamento pendente para esta pessoa, vacina e dose na rede.',
      );
      const id = newId();
      db.vaccineRecalls.push({
        id,
        ...scope,
        patientId: cmd.patientId,
        immunobiological,
        dose,
        date: cmd.date,
        status: 'scheduled',
        events: [{ action: 'Criado', date: cmd.date, reason, recordedAt: at, author }],
      });
      return { entityId: id, action: 'Aprazamento vacinal registrado' };
    }
    case 'vaccine.recall.update': {
      const recall = member(db.vaccineRecalls, cmd.id),
        reason = required(cmd.reason, 'Motivo', 1000);
      ensure(recall.status === 'scheduled', 'Somente aprazamentos pendentes podem ser alterados.');
      ensure(cmd.action === 'reschedule' || cmd.action === 'cancel', 'Ação inválida.');
      if (cmd.action === 'reschedule') {
        ensure(validDay(cmd.date) && cmd.date >= today, 'Escolha uma data a partir de hoje.');
        recall.date = cmd.date;
      } else recall.status = 'cancelled';
      recall.events.push({
        action: cmd.action === 'reschedule' ? 'Reagendado' : 'Cancelado',
        date: recall.date,
        reason,
        recordedAt: at,
        author,
      });
      return { entityId: recall.id, action: 'Aprazamento vacinal atualizado' };
    }
  }
}

export function vaccinationSummary(db: Database, c: Context, now: Date): VaccinationSummary {
  const today = dateKey(now),
    month = today.slice(0, 7),
    voidIds = new Set(db.vaccineVoids.map((v) => v.applicationId));
  const scoped = <T extends { organizationId: string; unitId: string }>(items: T[]) =>
    items.filter(
      (i) => i.organizationId === c.organizationId && (c.unitId === 'all' || i.unitId === c.unitId),
    );
  const records = scoped(db.immunizations).filter((i) => i.date.startsWith(month));
  const applied = records.filter((i) => i.source === 'administered' && !voidIds.has(i.id));
  const pending = scoped(db.vaccineRecalls).filter((r) => r.status === 'scheduled');
  return {
    month,
    applied: applied.length,
    transcribed: records.filter((i) => i.source === 'transcribed' && !voidIds.has(i.id)).length,
    voided: records.filter((i) => voidIds.has(i.id)).length,
    pending: pending.length,
    overdue: pending.filter((r) => r.date < today).length,
    byUnit: db.units
      .filter(
        (u) => u.organizationId === c.organizationId && (c.unitId === 'all' || u.id === c.unitId),
      )
      .map((u) => ({
        unitId: u.id,
        applied: applied.filter((i) => i.unitId === u.id).length,
        pending: pending.filter((r) => r.unitId === u.id).length,
        overdue: pending.filter((r) => r.unitId === u.id && r.date < today).length,
      })),
    byImmunobiological: [...new Set(applied.map((i) => i.immunobiological))].map((name) => ({
      name,
      applied: applied.filter((i) => i.immunobiological === name).length,
    })),
  };
}

export function seedVaccineLots(db: Database, now: Date) {
  for (const unit of db.units) {
    for (const [index, count, days] of [
      [0, 20, 180],
      [1, 5, 20],
      [2, 8, -1],
    ]) {
      const id = `${unit.id}-vac${index}`;
      db.vaccineLots.push({
        id,
        organizationId: unit.organizationId,
        unitId: unit.id,
        immunobiological: `Imunizante demonstração ${index === 1 ? 'B' : 'A'}`,
        manufacturer: 'Fabricante fictício',
        batch: `VAC-DEMO-0${index + 1}`,
        expiresAt: addDays(dateKey(now), days),
        quantity: count,
        status: 'available',
      });
      db.vaccineMovements.push({
        id: `${id}-receipt`,
        organizationId: unit.organizationId,
        unitId: unit.id,
        lotId: id,
        kind: 'receipt',
        quantity: count,
        reason: 'Saldo inicial fictício',
        recordedAt: now.toISOString(),
        author: 'Cenário de demonstração',
      });
    }
  }
}
