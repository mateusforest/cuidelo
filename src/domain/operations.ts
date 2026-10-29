import {
  can,
  roleNames,
  type Command,
  type Context,
  type Database,
  type Permission,
  type Scoped,
  type Snapshot,
  type Summary,
  type Encounter,
} from './model';
import { addDays, dateKey, minuteOfDay, validDay, validTime } from './dates';
import { DomainError } from './errors';
import { makeQueueCall, nextTicket } from './queue';
import { validateIntakeContent } from './intake';
import { applyVaccinationCommand, vaccinationSummary } from './vaccination';
export { DomainError } from './errors';
function ensure(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) throw new DomainError(message, code);
}
export function assertContext(db: Database, c: Context) {
  ensure(
    db.organizations.some((o) => o.id === c.organizationId),
    'Rede não encontrada.',
    'scope',
  );
  ensure(Object.hasOwn(roleNames, c.role), 'Perfil inválido.', 'permission');
  ensure(
    c.unitId === 'all'
      ? can(c.role, 'manage')
      : db.units.some((u) => u.id === c.unitId && u.organizationId === c.organizationId),
    'Selecione uma unidade desta rede.',
    'scope',
  );
}
function permit(c: Context, p: Permission) {
  ensure(can(c.role, p), 'Este perfil não tem acesso a esta operação.', 'permission');
}
function member<T extends Scoped & { unitId?: string }>(items: T[], id: string, c: Context): T {
  const item = items.find((x) => x.id === id && x.organizationId === c.organizationId);
  ensure(
    item && (!item.unitId || item.unitId === c.unitId),
    'Registro não encontrado nesta unidade.',
    'scope',
  );
  return item;
}
const required = (value: string, label: string, max = 2000) => {
  ensure(typeof value === 'string' && value.trim().length > 0, `${label} é obrigatório.`);
  ensure(value.length <= max, `${label} ultrapassa o limite de ${max} caracteres.`);
  return value.trim();
};

export function applyCommand(
  db: Database,
  c: Context,
  command: Command,
  now = new Date(),
  newId = () => crypto.randomUUID(),
): string {
  assertContext(db, c);
  ensure(c.unitId !== 'all', 'Selecione uma unidade para registrar uma operação.', 'scope');
  const at = now.toISOString(),
    today = dateKey(now);
  let entityId = '',
    action = '';
  const patient = (id: string) => member(db.patients, id, c);
  const encounter = (id: string) => member(db.encounters, id, c);
  const addEncounter = (patientId: string, service: string, priority: 'routine' | 'priority') => {
    patient(patientId);
    ensure(
      !db.encounters.some(
        (e) =>
          e.organizationId === c.organizationId &&
          e.unitId === c.unitId &&
          e.patientId === patientId &&
          e.status !== 'completed',
      ),
      'Esta pessoa já tem um atendimento aberto nesta unidade.',
      'conflict',
    );
    const e: Encounter = {
      ticket: nextTicket(db.encounters, c.organizationId, c.unitId, today),
      id: newId(),
      organizationId: c.organizationId,
      unitId: c.unitId,
      patientId,
      service: required(service, 'Serviço', 120),
      priority,
      status: 'waiting',
      arrivedAt: at,
    };
    db.encounters.push(e);
    return e.id;
  };
  switch (command.type) {
    case 'vaccine.lot.create':
    case 'vaccine.stock':
    case 'vaccine.record':
    case 'vaccine.void':
    case 'vaccine.recall.create':
    case 'vaccine.recall.update': {
      ({ entityId, action } = applyVaccinationCommand(db, c, command, now, newId));
      break;
    }
    case 'intake.record': {
      permit(c, 'clinical');
      const e = encounter(command.encounterId);
      const previous = db.intakes.filter((r) => r.encounterId === e.id);
      const original = command.correctionOf
        ? member(db.intakes, command.correctionOf, c)
        : undefined;
      if (original) {
        ensure(
          original.encounterId === e.id,
          'A correção deve pertencer ao mesmo atendimento.',
          'scope',
        );
        ensure(
          !previous.some((r) => r.correctionOf === original.id),
          'Este registro já possui uma correção. Abra a versão mais recente.',
          'conflict',
        );
      } else
        ensure(
          e.status !== 'completed',
          'O atendimento foi concluído. Somente correções de registros existentes são permitidas.',
          'immutable',
        );
      const content = validateIntakeContent(command.content);
      if (!previous.length)
        ensure(content.complaint, 'Informe o motivo da procura na escuta inicial.');
      const correctionReason = original
        ? required(command.correctionReason ?? '', 'Motivo da correção', 1000)
        : undefined;
      entityId = newId();
      db.intakes.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        patientId: e.patientId,
        encounterId: e.id,
        ...content,
        kind: original ? 'correction' : previous.length ? 'reassessment' : 'initial',
        recordedAt: at,
        author: `${roleNames[c.role]} · demonstração`,
        ...(original ? { correctionOf: original.id, correctionReason } : {}),
      });
      action = original
        ? 'Correção de escuta registrada'
        : previous.length
          ? 'Nova aferição registrada'
          : 'Escuta inicial registrada';
      break;
    }
    case 'note.addendum': {
      permit(c, 'clinical');
      const n = member(db.notes, command.noteId, c);
      ensure(
        n.status === 'final',
        'Conclua o registro antes de adicionar um complemento.',
        'conflict',
      );
      const text = required(command.text, 'Complemento', 10000),
        reason = required(command.reason, 'Motivo', 1000);
      entityId = newId();
      db.addenda.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        patientId: n.patientId,
        noteId: n.id,
        text,
        reason,
        recordedAt: at,
        author: `${roleNames[c.role]} · demonstração`,
      });
      action = 'Complemento de registro concluído adicionado';
      break;
    }
    case 'queue.call': {
      permit(c, 'queue');
      const e = encounter(command.encounterId);
      const call = makeQueueCall(db, e, command.roomId, now, newId());
      db.calls.push(call);
      entityId = call.id;
      action = `Senha ${call.ticket} chamada`;
      break;
    }
    case 'queue.recall': {
      permit(c, 'queue');
      const previous = member(db.calls, command.callId, c);
      const e = encounter(previous.encounterId);
      const call = makeQueueCall(db, e, previous.roomId, now, newId());
      db.calls.push(call);
      entityId = call.id;
      action = `Senha ${call.ticket} chamada novamente`;
      break;
    }
    case 'patient.create': {
      permit(c, 'patients.write');
      ensure(
        validDay(command.birthDate) &&
          command.birthDate <= today &&
          command.birthDate >= '1850-01-01',
        'Informe uma data de nascimento válida.',
      );
      ensure(
        command.phone.length <= 30 && command.socialName.length <= 120,
        'Revise o telefone e o nome social.',
      );
      entityId = newId();
      const sequence = db.patients.filter((p) => p.organizationId === c.organizationId).length + 1;
      db.patients.push({
        id: entityId,
        organizationId: c.organizationId,
        name: required(command.name, 'Nome', 120),
        socialName: command.socialName.trim(),
        birthDate: command.birthDate,
        phone: command.phone.trim(),
        record: `DEMO-${String(sequence).padStart(4, '0')}`,
        allergies: [],
      });
      action = 'Cadastro de pessoa criado';
      break;
    }
    case 'appointment.create': {
      permit(c, 'schedule');
      patient(command.patientId);
      ensure(validDay(command.date) && command.date >= today, 'Escolha uma data a partir de hoje.');
      ensure(validTime(command.time), 'Informe um horário válido.');
      ensure(
        Number.isInteger(command.duration) && command.duration >= 5 && command.duration <= 240,
        'Duração inválida.',
      );
      const professional = required(command.professional, 'Profissional', 120);
      const start = minuteOfDay(command.time),
        end = start + command.duration;
      ensure(end <= 24 * 60, 'O atendimento deve terminar no mesmo dia.');
      ensure(
        !db.appointments.some(
          (a) =>
            a.organizationId === c.organizationId &&
            a.status !== 'cancelled' &&
            a.date === command.date &&
            a.professional === professional &&
            start < minuteOfDay(a.time) + a.duration &&
            end > minuteOfDay(a.time),
        ),
        'Este profissional já tem um agendamento que ocupa esse horário.',
        'conflict',
      );
      ensure(
        !db.appointments.some(
          (a) =>
            a.organizationId === c.organizationId &&
            a.patientId === command.patientId &&
            a.status !== 'cancelled' &&
            a.date === command.date &&
            start < minuteOfDay(a.time) + a.duration &&
            end > minuteOfDay(a.time),
        ),
        'Esta pessoa já tem um agendamento que ocupa esse horário.',
        'conflict',
      );
      entityId = newId();
      db.appointments.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        patientId: command.patientId,
        professional,
        service: required(command.service, 'Serviço', 120),
        date: command.date,
        time: command.time,
        duration: command.duration,
        status: 'scheduled',
      });
      action = 'Agendamento criado';
      break;
    }
    case 'appointment.cancel': {
      permit(c, 'schedule');
      const a = member(db.appointments, command.id, c);
      ensure(
        a.status === 'scheduled',
        'Somente agendamentos pendentes podem ser cancelados.',
        'conflict',
      );
      a.cancellationReason = required(command.reason, 'Motivo');
      a.status = 'cancelled';
      entityId = a.id;
      action = 'Agendamento cancelado';
      break;
    }
    case 'appointment.checkIn': {
      permit(c, 'schedule');
      const a = member(db.appointments, command.id, c);
      ensure(
        a.status === 'scheduled',
        'A chegada já foi confirmada ou o agendamento foi cancelado.',
        'conflict',
      );
      ensure(a.date === today, 'Confirme a chegada no dia agendado.');
      entityId = addEncounter(a.patientId, a.service, 'routine');
      a.status = 'checked-in';
      action = 'Chegada confirmada';
      break;
    }
    case 'encounter.create': {
      permit(c, 'queue');
      ensure(
        command.priority === 'routine' || command.priority === 'priority',
        'Prioridade inválida.',
      );
      entityId = addEncounter(command.patientId, command.service, command.priority);
      action = 'Pessoa adicionada à recepção';
      break;
    }
    case 'encounter.start': {
      permit(c, 'clinical');
      const e = encounter(command.id);
      ensure(
        e.status === 'waiting' || e.status === 'observation',
        'Este atendimento já foi iniciado ou concluído.',
        'conflict',
      );
      e.status = 'in-care';
      e.startedAt ??= at;
      entityId = e.id;
      action = 'Atendimento iniciado';
      break;
    }
    case 'encounter.observe': {
      permit(c, 'clinical');
      const e = encounter(command.id);
      ensure(
        db.units.find((u) => u.id === c.unitId)?.kind !== 'ubs',
        'Observação disponível nos serviços de urgência e hospital.',
      );
      ensure(
        e.status === 'in-care',
        'Inicie o atendimento antes de encaminhar à observação.',
        'conflict',
      );
      e.status = 'observation';
      entityId = e.id;
      action = 'Atendimento encaminhado à observação';
      break;
    }
    case 'note.save': {
      permit(c, 'clinical');
      const e = encounter(command.encounterId);
      ensure(
        e.status === 'in-care' || e.status === 'observation',
        'O atendimento deve estar em andamento.',
        'conflict',
      );
      const existing = db.notes.find(
        (n) => n.encounterId === e.id && n.organizationId === c.organizationId,
      );
      ensure(
        !existing || existing.status === 'draft',
        'Um registro finalizado não pode ser alterado.',
        'immutable',
      );
      for (const value of Object.values(command.soap))
        ensure(
          typeof value === 'string' && value.length <= 10000,
          'Cada campo permite até 10.000 caracteres.',
        );
      const soap = {
        subjective: command.soap.subjective.trim(),
        objective: command.soap.objective.trim(),
        assessment: command.soap.assessment.trim(),
        plan: command.soap.plan.trim(),
      };
      ensure(
        Object.values(soap).some(Boolean),
        'Preencha ao menos um campo para salvar o rascunho.',
      );
      entityId = existing?.id ?? newId();
      if (existing)
        Object.assign(existing, {
          soap,
          updatedAt: at,
          author: `${roleNames[c.role]} · demonstração`,
        });
      else
        db.notes.push({
          id: entityId,
          organizationId: c.organizationId,
          unitId: c.unitId,
          patientId: e.patientId,
          encounterId: e.id,
          soap,
          status: 'draft',
          updatedAt: at,
          author: `${roleNames[c.role]} · demonstração`,
        });
      action = 'Rascunho clínico salvo';
      break;
    }
    case 'note.finalize': {
      permit(c, 'clinical');
      const e = encounter(command.encounterId);
      ensure(
        e.status === 'in-care' || e.status === 'observation',
        'Este atendimento não está em andamento.',
        'conflict',
      );
      const note = db.notes.find(
        (n) => n.encounterId === e.id && n.organizationId === c.organizationId,
      );
      ensure(note && note.status === 'draft', 'Salve o rascunho antes de concluir.');
      required(note.soap.assessment, 'Avaliação');
      required(note.soap.plan, 'Plano');
      note.status = 'final';
      note.finalizedAt = at;
      note.updatedAt = at;
      e.status = 'completed';
      e.completedAt = at;
      entityId = note.id;
      action = 'Registro de demonstração concluído (sem assinatura digital)';
      break;
    }
    case 'admission.create': {
      permit(c, 'beds');
      patient(command.patientId);
      const bed = member(db.beds, command.bedId, c);
      ensure(
        db.units.find((u) => u.id === c.unitId)?.kind === 'hospital',
        'Escolha uma unidade hospitalar.',
      );
      ensure(bed.status === 'available', 'Este leito não está disponível.', 'conflict');
      ensure(
        !db.admissions.some(
          (a) =>
            a.organizationId === c.organizationId &&
            a.patientId === command.patientId &&
            !a.dischargedAt,
        ),
        'Esta pessoa já possui uma internação ativa nesta rede.',
        'conflict',
      );
      entityId = newId();
      db.admissions.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        patientId: command.patientId,
        bedId: bed.id,
        admittedAt: at,
      });
      bed.status = 'occupied';
      delete bed.reason;
      action = 'Admissão hospitalar registrada';
      break;
    }
    case 'admission.discharge': {
      permit(c, 'beds');
      const admission = member(db.admissions, command.id, c);
      ensure(!admission.dischargedAt, 'Esta internação já foi encerrada.', 'conflict');
      admission.dischargeReason = required(command.reason, 'Motivo da saída');
      admission.dischargedAt = at;
      member(db.beds, admission.bedId, c).status = 'cleaning';
      entityId = admission.id;
      action = 'Saída registrada; leito aguardando higienização';
      break;
    }
    case 'bed.status': {
      permit(c, 'beds');
      const bed = member(db.beds, command.id, c);
      ensure(
        bed.status !== 'occupied',
        'Encerre a internação antes de alterar o leito.',
        'conflict',
      );
      ensure(
        ['available', 'cleaning', 'blocked'].includes(command.status),
        'Situação de leito inválida.',
      );
      bed.reason = required(command.reason, 'Justificativa');
      bed.status = command.status;
      entityId = bed.id;
      action = 'Situação do leito atualizada';
      break;
    }
    case 'stock.move': {
      permit(c, 'stock');
      const lot = member(db.lots, command.id, c);
      ensure(command.kind === 'entry' || command.kind === 'exit', 'Tipo de movimento inválido.');
      ensure(
        Number.isSafeInteger(command.quantity) && command.quantity > 0,
        'Informe uma quantidade inteira maior que zero.',
      );
      ensure(
        lot.expiresAt >= today,
        'Lote vencido: movimentação de uso bloqueada. Segregue o lote para o fluxo de perdas.',
        'expired',
      );
      const reason = required(command.reason, 'Motivo');
      if (command.kind === 'exit') {
        ensure(
          lot.expiresAt >= today,
          'Lote vencido: saída de uso bloqueada. Segregue o lote para o fluxo de perdas.',
          'expired',
        );
        ensure(lot.quantity >= command.quantity, 'Saldo insuficiente neste lote.', 'stock');
      }
      ensure(
        Number.isSafeInteger(lot.quantity + command.quantity),
        'Quantidade acima do limite permitido.',
      );
      lot.quantity += command.kind === 'entry' ? command.quantity : -command.quantity;
      entityId = newId();
      db.movements.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        lotId: lot.id,
        quantity: command.quantity,
        kind: command.kind,
        reason,
        at,
      });
      action =
        command.kind === 'entry' ? 'Entrada de estoque registrada' : 'Saída de estoque registrada';
      break;
    }
    case 'referral.create': {
      permit(c, 'regulation');
      patient(command.patientId);
      entityId = newId();
      db.referrals.push({
        id: entityId,
        organizationId: c.organizationId,
        unitId: c.unitId,
        patientId: command.patientId,
        specialty: required(command.specialty, 'Especialidade', 120),
        destination: required(command.destination, 'Destino', 160),
        reason: required(command.reason, 'Justificativa'),
        status: 'requested',
        createdAt: at,
      });
      action = 'Encaminhamento solicitado';
      break;
    }
    case 'referral.schedule': {
      permit(c, 'regulation');
      const r = member(db.referrals, command.id, c);
      ensure(
        r.status === 'requested',
        'Esta solicitação já foi agendada ou cancelada.',
        'conflict',
      );
      ensure(
        validDay(command.date) && command.date >= today && validTime(command.time),
        'Informe uma data e um horário válidos a partir de hoje.',
      );
      r.destination = required(command.destination, 'Destino', 160);
      r.appointmentDate = command.date;
      r.appointmentTime = command.time;
      r.status = 'scheduled';
      entityId = r.id;
      action = 'Agendamento de encaminhamento registrado';
      break;
    }
    case 'referral.cancel': {
      permit(c, 'regulation');
      const r = member(db.referrals, command.id, c);
      ensure(r.status !== 'cancelled', 'Solicitação já cancelada.');
      r.cancellationReason = required(command.reason, 'Motivo');
      r.status = 'cancelled';
      entityId = r.id;
      action = 'Encaminhamento cancelado';
      break;
    }
  }
  db.revision += 1;
  db.audit.push({
    id: newId(),
    organizationId: c.organizationId,
    unitId: c.unitId,
    at,
    actor: `${roleNames[c.role]} · demo`,
    action,
    entityId,
  });
  return entityId;
}

export function readSnapshot(db: Database, c: Context): Snapshot {
  assertContext(db, c);
  const org = <T extends Scoped>(items: T[]) =>
    items.filter((x) => x.organizationId === c.organizationId);
  const unit = <T extends Scoped & { unitId: string }>(items: T[]) =>
    org(items).filter((x) => c.unitId === 'all' || x.unitId === c.unitId);
  const has = (p: Permission) => can(c.role, p);
  return structuredClone({
    organizations: db.organizations,
    units: org(db.units),
    patients: has('patients.read')
      ? org(db.patients).map((p) => ({ ...p, allergies: has('clinical') ? p.allergies : [] }))
      : [],
    appointments: has('schedule') ? unit(db.appointments) : [],
    encounters: has('queue') ? unit(db.encounters) : [],
    notes: has('clinical') ? org(db.notes) : [],
    intakes: has('clinical') ? org(db.intakes) : [],
    addenda: has('clinical') ? org(db.addenda) : [],
    vaccineLots: has('vaccine.stock') ? unit(db.vaccineLots) : [],
    vaccineMovements: has('vaccine.stock') ? unit(db.vaccineMovements) : [],
    immunizations: has('vaccination') ? org(db.immunizations) : [],
    vaccineVoids: has('vaccination') ? org(db.vaccineVoids) : [],
    vaccineRecalls: has('vaccination') ? org(db.vaccineRecalls) : [],
    beds: has('beds') || has('manage') ? unit(db.beds) : [],
    admissions: has('beds') ? unit(db.admissions) : [],
    lots: has('stock') ? unit(db.lots) : [],
    movements: has('stock') ? unit(db.movements) : [],
    referrals: has('regulation') ? unit(db.referrals) : [],
    audit: has('manage') ? unit(db.audit).slice(-150).reverse() : [],
  });
}
export function readSummary(db: Database, c: Context, now = new Date()): Summary {
  assertContext(db, c);
  const today = dateKey(now);
  const units = db.units.filter(
    (u) => u.organizationId === c.organizationId && (c.unitId === 'all' || u.id === c.unitId),
  );
  const included = new Set(units.map((u) => u.id));
  const scoped = <T extends Scoped & { unitId: string }>(items: T[]) =>
    items.filter((x) => x.organizationId === c.organizationId && included.has(x.unitId));
  const encounters = scoped(db.encounters),
    beds = scoped(db.beds);
  return {
    vaccination: vaccinationSummary(db, c, now),
    today: encounters.filter((e) => dateKey(new Date(e.arrivedAt)) === today).length,
    waiting: encounters.filter((e) => e.status === 'waiting').length,
    inCare: encounters.filter((e) => e.status === 'in-care' || e.status === 'observation').length,
    completed: encounters.filter((e) => e.completedAt && dateKey(new Date(e.completedAt)) === today)
      .length,
    occupied: beds.filter((b) => b.status === 'occupied').length,
    totalBeds: beds.length,
    stockAlerts: scoped(db.lots).filter(
      (l) => l.quantity > 0 && (l.quantity < l.minimum || l.expiresAt <= addDays(today, 30)),
    ).length,
    pendingReferrals: scoped(db.referrals).filter((r) => r.status === 'requested').length,
    units: units.map((unit) => ({
      unit,
      today: encounters.filter(
        (e) => e.unitId === unit.id && dateKey(new Date(e.arrivedAt)) === today,
      ).length,
      waiting: encounters.filter((e) => e.unitId === unit.id && e.status === 'waiting').length,
      inCare: encounters.filter(
        (e) => e.unitId === unit.id && (e.status === 'in-care' || e.status === 'observation'),
      ).length,
      occupied: beds.filter((b) => b.unitId === unit.id && b.status === 'occupied').length,
      totalBeds: beds.filter((b) => b.unitId === unit.id).length,
    })),
  };
}
