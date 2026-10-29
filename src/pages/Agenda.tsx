import { useState } from 'react';
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
  valueOf,
} from '../components/ui';

export function Agenda() {
  const { data, context, repository, notify } = useApp();
  const [day, setDay] = useState(dateKey()),
    [professional, setProfessional] = useState('all'),
    [create, setCreate] = useState(false),
    [cancel, setCancel] = useState<Appointment | null>(null),
    [busy, setBusy] = useState('');
  const appointments = data.appointments
    .filter((a) => a.date === day && (professional === 'all' || a.professional === professional))
    .sort((a, b) => a.time.localeCompare(b.time));
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
    <>
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
        <Panel>
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
          <div className="agenda-summary">
            <span>{appointments.length} agendamentos</span>
            <span>{appointments.filter((a) => a.status === 'scheduled').length} pendentes</span>
            <span>
              {appointments.filter((a) => a.status === 'checked-in').length} chegadas confirmadas
            </span>
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
      {create && (
        <Modal
          title="Novo agendamento"
          description="Horários conflitantes da pessoa ou do profissional são bloqueados."
          onClose={() => setCreate(false)}
        >
          <ActionForm
            onClose={() => setCreate(false)}
            submitLabel="Agendar atendimento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'appointment.create',
                patientId: valueOf(f, 'patient'),
                professional: valueOf(f, 'professional'),
                service: valueOf(f, 'service'),
                date: valueOf(f, 'date'),
                time: valueOf(f, 'time'),
                duration: Number(valueOf(f, 'duration')),
              });
              setDay(valueOf(f, 'date'));
              notify('Atendimento agendado.');
            }}
          >
            <Field label="Pessoa">
              <select name="patient" required defaultValue="">
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
                <select name="professional">
                  {professionals.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Serviço">
                <select name="service">
                  <option>Consulta médica</option>
                  <option>Enfermagem</option>
                  <option>Retorno</option>
                </select>
              </Field>
            </div>
            <div className="form-grid three">
              <Field label="Data">
                <input
                  type="date"
                  name="date"
                  defaultValue={day < dateKey() ? dateKey() : day}
                  min={dateKey()}
                  required
                />
              </Field>
              <Field label="Horário">
                <input type="time" name="time" defaultValue="14:00" required />
              </Field>
              <Field label="Duração">
                <select name="duration" defaultValue="30">
                  {[15, 20, 30, 40, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minutos
                    </option>
                  ))}
                </select>
              </Field>
            </div>
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
    </>
  );
}
