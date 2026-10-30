import { useState } from 'react';
import { Link } from 'react-router-dom';
import { normalizedName } from '../domain/identification';
import { ChevronLeft, ChevronRight, Plus, Check, X, CalendarDays } from 'lucide-react';
import { useApp } from '../app/context';
import { addDays, dateKey, shortDate } from '../domain/dates';
import type { Appointment } from '../domain/model';
import {
  ActionForm,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  UnitRequired,
  SearchField,
  valueOf,
} from '../components/ui';

export function Agenda() {
  const { data, context, repository, notify } = useApp();
  const [day, setDay] = useState(dateKey()),
    [professional, setProfessional] = useState('all'),
    [create, setCreate] = useState(false),
    [editing, setEditing] = useState<Appointment | null>(null),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [cancel, setCancel] = useState<Appointment | null>(null),
    [busy, setBusy] = useState('');
  const dayAppointments = data.appointments
    .filter((a) => a.date === day && (professional === 'all' || a.professional === professional))
    .sort((a, b) => a.time.localeCompare(b.time));
  const appointments = dayAppointments.filter((a) => {
    const p = data.patients.find((p) => p.id === a.patientId);
    return (
      (status === 'all' || a.status === status) &&
      normalizedName(`${p?.name} ${p?.socialName} ${a.service}`).includes(normalizedName(search))
    );
  });
  const closeForm = () => {
    setCreate(false);
    setEditing(null);
  };
  const professionals = [
    ...new Set([
      'Dra. Marina · demo',
      'Enf. Camila · demo',
      ...data.appointments.map((a) => a.professional),
    ]),
  ];
  const arrive = async (a: Appointment) => {
    setBusy(a.id);
    try {
      await repository.execute(context, { type: 'appointment.checkIn', id: a.id });
      notify('Chegada confirmada. A pessoa já aparece na recepção.');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="operations-page agenda-workspace">
      <PageHeader
        eyebrow="ORGANIZAÇÃO DO CUIDADO"
        title="Agenda da unidade"
        description="Organize horários, acompanhe confirmações e registre a chegada."
        action={
          <Button onClick={() => setCreate(true)} disabled={context.unitId === 'all'}>
            <Plus size={18} />
            Novo agendamento
          </Button>
        }
      />
      <UnitRequired>
        <Panel className="agenda-calendar">
          <div className="agenda-toolbar">
            <div className="date-controls">
              <button
                className="icon-button"
                aria-label="Dia anterior"
                onClick={() => setDay(addDays(day, -1))}
              >
                <ChevronLeft size={19} />
              </button>
              <label className="date-input">
                <CalendarDays size={17} />
                <input
                  type="date"
                  aria-label="Dia da agenda"
                  value={day}
                  onChange={(e) => e.target.value && setDay(e.target.value)}
                />
              </label>
              <button
                className="icon-button"
                aria-label="Próximo dia"
                onClick={() => setDay(addDays(day, 1))}
              >
                <ChevronRight size={19} />
              </button>
              <Button variant="ghost" onClick={() => setDay(dateKey())}>
                Hoje
              </Button>
            </div>
            <select
              aria-label="Filtrar profissional"
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
            >
              <option value="all">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </Panel>
        <div className="agenda-metrics desk-filters" aria-label="Situações da agenda">
          {[
            ['all', 'Agendamentos do dia'],
            ['scheduled', 'Aguardando chegada'],
            ['checked-in', 'Chegadas confirmadas'],
            ['cancelled', 'Cancelados'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={status === key}
              className={status === key ? 'selected' : ''}
              onClick={() => setStatus(key)}
            >
              <span>{label}</span>
              <strong>
                {dayAppointments.filter((a) => key === 'all' || a.status === key).length}
              </strong>
            </button>
          ))}
        </div>
        <Panel
          title={`Atendimentos · ${shortDate(day)}`}
          subtitle="Horários por profissional. Remarcações e cancelamentos preservam o histórico."
        >
          <div className="table-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar pessoa ou serviço na agenda"
            />
            <span className="result-count">{appointments.length} agendamentos neste filtro</span>
          </div>
          <div className="appointment-list">
            {appointments.map((a) => {
              const p = data.patients.find((p) => p.id === a.patientId);
              return (
                <article
                  key={a.id}
                  className={`appointment-row ${a.status === 'cancelled' ? 'cancelled' : ''}`}
                >
                  <div className="appointment-time">
                    <strong>{a.time}</strong>
                    <small>{a.duration} min</small>
                  </div>
                  <div className="appointment-person">
                    <Avatar name={p?.name ?? 'Pessoa'} small />
                    <div>
                      <strong>{p?.socialName || p?.name}</strong>
                      <small>
                        {a.service} · {a.professional}
                      </small>
                      {a.cancellationReason && <small>Motivo: {a.cancellationReason}</small>}
                      {!!a.reschedules?.length && (
                        <details className="appointment-history">
                          <summary>Histórico de remarcações ({a.reschedules.length})</summary>
                          {[...a.reschedules].reverse().map((h, i) => (
                            <div key={i}>
                              <strong>
                                {shortDate(h.before.date)} às {h.before.time} →{' '}
                                {shortDate(h.after.date)} às {h.after.time}
                              </strong>
                              <p>
                                {h.before.professional} → {h.after.professional}
                              </p>
                              <p>
                                {h.before.service} · {h.before.duration} min → {h.after.service} ·{' '}
                                {h.after.duration} min
                              </p>
                              <p>{h.reason}</p>
                              <small>
                                {shortDate(h.at)} · {h.author}
                              </small>
                            </div>
                          ))}
                        </details>
                      )}
                    </div>
                  </div>
                  <Badge
                    tone={
                      a.status === 'checked-in'
                        ? 'green'
                        : a.status === 'cancelled'
                          ? 'neutral'
                          : 'blue'
                    }
                  >
                    {a.status === 'checked-in'
                      ? 'Chegada confirmada'
                      : a.status === 'cancelled'
                        ? 'Cancelado'
                        : 'Agendado'}
                  </Badge>
                  <div className="row-actions">
                    {a.status === 'scheduled' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(a)}
                          aria-label={`Remarcar agendamento de ${p?.name}`}
                        >
                          Remarcar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => arrive(a)}
                          disabled={busy === a.id || day !== dateKey()}
                          aria-label={`Confirmar chegada de ${p?.name}`}
                        >
                          <Check size={16} />
                          Chegou
                        </Button>
                        <button
                          className="icon-button"
                          onClick={() => setCancel(a)}
                          aria-label={`Cancelar agendamento de ${p?.name}`}
                        >
                          <X size={17} />
                        </button>
                      </>
                    )}
                    {a.status === 'checked-in' && (
                      <Link className="button secondary" to="/recepcao">
                        Ver recepção
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!appointments.length && (
            <EmptyState
              title="Um dia com espaço para organizar"
              description={`Nenhum agendamento para ${shortDate(day)} neste filtro.`}
              action={
                <Button variant="secondary" onClick={() => setCreate(true)}>
                  <Plus size={16} />
                  Agendar neste dia
                </Button>
              }
            />
          )}
        </Panel>
      </UnitRequired>
      {(create || editing) && (
        <Modal
          title={editing ? 'Remarcar agendamento' : 'Novo agendamento'}
          description="Horários conflitantes da pessoa ou do profissional são bloqueados."
          onClose={closeForm}
        >
          <ActionForm
            onClose={closeForm}
            submitLabel={editing ? 'Confirmar remarcação' : 'Agendar atendimento'}
            onSubmit={async (f) => {
              const values = {
                professional: valueOf(f, 'professional'),
                service: valueOf(f, 'service'),
                date: valueOf(f, 'date'),
                time: valueOf(f, 'time'),
                duration: Number(valueOf(f, 'duration')),
              };
              await repository.execute(
                context,
                editing
                  ? {
                      type: 'appointment.reschedule',
                      id: editing.id,
                      values,
                      reason: valueOf(f, 'reason'),
                      expectedChangeCount: editing.reschedules?.length ?? 0,
                    }
                  : { type: 'appointment.create', patientId: valueOf(f, 'patient'), ...values },
              );
              setDay(values.date);
              setProfessional('all');
              setStatus('all');
              setSearch('');
              notify(
                editing
                  ? 'Agendamento remarcado. O horário anterior foi preservado no histórico.'
                  : 'Atendimento agendado.',
              );
            }}
          >
            {editing && (
              <div className="appointment-previous">
                <span>Agendamento atual</span>
                <strong>
                  {shortDate(editing.date)} · {editing.time} · {editing.duration} min
                </strong>
                <small>
                  {editing.professional} · {editing.service}
                </small>
              </div>
            )}
            <Field label="Pessoa">
              <select
                name="patient"
                required
                defaultValue={editing?.patientId ?? ''}
                disabled={!!editing}
              >
                <option value="" disabled>
                  Selecione uma pessoa fictícia
                </option>
                {data.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.socialName || p.name} · {p.record}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Profissional">
                <select
                  name="professional"
                  defaultValue={
                    editing?.professional ??
                    (professional !== 'all' ? professional : professionals[0])
                  }
                >
                  {professionals.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Serviço">
                <select name="service" defaultValue={editing?.service ?? 'Consulta médica'}>
                  {[
                    ...new Set([
                      'Consulta médica',
                      'Enfermagem',
                      'Retorno',
                      ...(editing ? [editing.service] : []),
                    ]),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid three">
              <Field label="Data">
                <input
                  type="date"
                  name="date"
                  defaultValue={
                    editing
                      ? editing.date < dateKey()
                        ? dateKey()
                        : editing.date
                      : day < dateKey()
                        ? dateKey()
                        : day
                  }
                  min={dateKey()}
                  required
                />
              </Field>
              <Field label="Horário">
                <input type="time" name="time" defaultValue={editing?.time ?? '14:00'} required />
              </Field>
              <Field label="Duração">
                <select name="duration" defaultValue={String(editing?.duration ?? 30)}>
                  {[...new Set([15, 20, 30, 40, 60, ...(editing ? [editing.duration] : [])])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {m} minutos
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {editing && (
              <Field label="Motivo da remarcação">
                <textarea name="reason" required maxLength={1000} rows={3} />
              </Field>
            )}
          </ActionForm>
        </Modal>
      )}
      {cancel && (
        <Modal
          title="Cancelar agendamento"
          description="A operação mantém o histórico e registra o motivo."
          onClose={() => setCancel(null)}
        >
          <ActionForm
            onClose={() => setCancel(null)}
            submitLabel="Confirmar cancelamento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'appointment.cancel',
                id: cancel.id,
                reason: valueOf(f, 'reason'),
              });
              notify('Agendamento cancelado.');
            }}
          >
            <Field label="Motivo do cancelamento">
              <textarea name="reason" rows={3} maxLength={2000} required />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
