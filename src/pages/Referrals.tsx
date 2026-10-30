import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Plus, CalendarDays, X } from 'lucide-react';
import { useApp } from '../app/context';
import type { Referral } from '../domain/model';
import { normalizedName } from '../domain/identification';
import { demoIdentities } from '../domain/access';
import { addDays, dateKey, shortDate, clockTime } from '../domain/dates';
import {
  ActionForm,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  UnitRequired,
  valueOf,
} from '../components/ui';

export function Referrals() {
  const { data, context, repository, notify } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [create, setCreate] = useState(false),
    [schedule, setSchedule] = useState<Referral | null>(null),
    [cancel, setCancel] = useState<Referral | null>(null);
  const [params, setParams] = useSearchParams();
  const [detail, setDetail] = useState<Referral | null>(null),
    [complete, setComplete] = useState<Referral | null>(null);
  const canResponse = context.role === 'clinical' || context.role === 'regulation';
  const scoped = data.referrals.filter(
    (r) =>
      r.unitId === context.unitId &&
      (!params.get('encaminhamento') || r.id === params.get('encaminhamento')),
  );
  const overdue = (r: Referral) =>
    r.status === 'scheduled' && !!r.appointmentDate && r.appointmentDate < dateKey();
  const list = scoped
    .filter((r) => {
      const person = data.patients.find((p) => p.id === r.patientId);
      return (
        (filter === 'all' || (filter === 'overdue' ? overdue(r) : r.status === filter)) &&
        normalizedName(
          `${r.specialty} ${person?.name} ${person?.socialName} ${r.destination}`,
        ).includes(normalizedName(search))
      );
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const identities = demoIdentities(repository.directory());
  return (
    <div className="operations-page regulation-workspace">
      <PageHeader
        eyebrow="CONTINUIDADE ENTRE SERVIÇOS"
        title="Regulação"
        description="Acompanhe solicitações e registre o encaminhamento para outros serviços."
        action={
          <Button disabled={context.unitId === 'all'} onClick={() => setCreate(true)}>
            <Plus size={18} />
            Novo encaminhamento
          </Button>
        }
      />
      <UnitRequired>
        <div className="continuity-metrics" aria-label="Situações da regulação">
          {(
            [
              ['requested', 'Aguardando vaga'],
              ['scheduled', 'Agendados'],
              ['overdue', 'Data prevista ultrapassada'],
              ['completed', 'Com retorno registrado'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
            >
              <span>{label}</span>
              <strong>
                {scoped.filter((r) => (key === 'overdue' ? overdue(r) : r.status === key)).length}
              </strong>
              <small>Ver encaminhamentos</small>
            </button>
          ))}
        </div>
        <Panel
          title="Encaminhamentos da unidade"
          subtitle="Solicitações, agenda e retorno do serviço no mesmo acompanhamento."
        >
          <div className="table-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar pessoa ou especialidade"
            />
            <Field label="Situação do encaminhamento">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todas as situações</option>
                <option value="requested">Solicitados</option>
                <option value="scheduled">Agendados</option>
                <option value="overdue">Data prevista ultrapassada</option>
                <option value="completed">Com retorno registrado</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </Field>
            <span className="result-count">{list.length} encaminhamentos </span>
          </div>
          {params.get('encaminhamento') && (
            <div className="panel-body">
              <button className="text-button" onClick={() => setParams({})}>
                Mostrar todos os encaminhamentos
              </button>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pessoa e especialidade</th>
                  <th>Destino</th>
                  <th>Solicitação</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{data.patients.find((p) => p.id === r.patientId)?.name}</strong>
                      <small className="cell-secondary">{r.specialty}</small>
                      {r.sourceDocumentId && (
                        <small className="cell-secondary">
                          Solicitado no consultório ·{' '}
                          {r.priority === 'urgent' ? 'Urgente' : 'Rotina'}
                        </small>
                      )}
                    </td>
                    <td>
                      {r.destination}
                      {overdue(r) && (
                        <small className="followup-alert">Conferir atendimento / retorno</small>
                      )}
                      {r.appointmentDate && (
                        <small className="cell-secondary">
                          {shortDate(r.appointmentDate)} às {r.appointmentTime}
                        </small>
                      )}
                    </td>
                    <td>{shortDate(r.createdAt)}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === 'scheduled' || r.status === 'completed'
                            ? 'green'
                            : r.status === 'requested'
                              ? 'amber'
                              : 'neutral'
                        }
                      >
                        {r.status === 'completed'
                          ? 'Concluído com retorno'
                          : r.status === 'scheduled'
                            ? 'Agendado'
                            : r.status === 'requested'
                              ? 'Solicitado'
                              : 'Cancelado'}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button variant="secondary" onClick={() => setDetail(r)}>
                          Detalhes
                        </Button>
                        {r.status === 'scheduled' && canResponse && (
                          <Button onClick={() => setComplete(r)}>Registrar retorno</Button>
                        )}
                        {(r.status === 'requested' || r.status === 'scheduled') && (
                          <Button variant="secondary" onClick={() => setSchedule(r)}>
                            <CalendarDays size={15} />
                            {r.status === 'scheduled' ? 'Reagendar' : 'Agendar'}
                          </Button>
                        )}
                        {r.status !== 'cancelled' && r.status !== 'completed' && (
                          <button
                            className="icon-button"
                            aria-label={`Cancelar encaminhamento de ${data.patients.find((p) => p.id === r.patientId)?.name}`}
                            onClick={() => setCancel(r)}
                          >
                            <X size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <EmptyState
              title="Nenhum encaminhamento encontrado"
              description="Revise a busca ou crie uma solicitação fictícia."
            />
          )}
        </Panel>
        <Notice>
          Agendamentos locais, sem reserva de vagas ou envio a serviços externos. Data prevista
          ultrapassada indica necessidade de conferência; não registra falta ou atendimento
          automaticamente.
        </Notice>
      </UnitRequired>
      {detail && (
        <Modal
          wide
          title="Detalhes do encaminhamento"
          description={data.patients.find((p) => p.id === detail.patientId)?.name}
          onClose={() => setDetail(null)}
        >
          <div className="panel-body document-body">
            <h3>{detail.specialty}</h3>
            <p>{detail.destination}</p>
            {detail.reason && (
              <section>
                <h3>Justificativa da solicitação</h3>
                <p>{detail.reason}</p>
              </section>
            )}
            {detail.sourceDocumentId && context.role === 'clinical' && (
              <Link
                className="button secondary"
                to={`/documentos/${detail.sourceDocumentId}`}
                target="_blank"
              >
                Ver solicitação médica preservada
              </Link>
            )}
            {detail.response && (
              <section>
                <h3>Contrarreferência · {shortDate(detail.response.date)}</h3>
                <p>{detail.response.summary}</p>
                <small>
                  Registrado em {shortDate(detail.response.at)} ·{' '}
                  {detail.response.actorId === context.sessionId
                    ? 'por você'
                    : 'por profissional autorizado da unidade'}
                </small>
              </section>
            )}
            {detail.cancellationReason && <p>Cancelamento: {detail.cancellationReason}</p>}
            {detail.history?.length && (
              <details className="document-history" open>
                <summary>Histórico da solicitação</summary>
                <ol>
                  {detail.history.map((h, i) => (
                    <li key={i}>
                      {shortDate(h.at)} ·{' '}
                      {
                        {
                          requested: 'Solicitado',
                          scheduled: 'Agendamento registrado',
                          rescheduled: 'Reagendamento registrado',
                          completed: 'Retorno registrado',
                          cancelled: 'Cancelado',
                        }[h.action]
                      }
                      {h.previousAppointment && (
                        <p>
                          Antes: {shortDate(h.previousAppointment.date)} às{' '}
                          {h.previousAppointment.time} · {h.previousAppointment.destination}
                        </p>
                      )}
                      {h.appointment && (
                        <p>
                          {h.previousAppointment ? 'Depois' : 'Agendado'}:{' '}
                          {shortDate(h.appointment.date)} às {h.appointment.time} ·{' '}
                          {h.appointment.destination}
                        </p>
                      )}
                      {h.note && <p>{h.note}</p>}
                      <small>
                        {clockTime(h.at)} ·{' '}
                        {identities.find((i) => i.sessionId === h.actorId)?.name ??
                          'Profissional da unidade'}
                      </small>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {context.role === 'admin' && detail.sourceDocumentId && (
              <Notice>
                Este perfil acompanha a operação da unidade. Justificativas clínicas e
                contrarreferências ficam disponíveis à equipe médica e à regulação.
              </Notice>
            )}
          </div>
        </Modal>
      )}
      {complete && (
        <Modal
          title="Registrar retorno do encaminhamento"
          description="Transcrição manual de contrarreferência recebida. Não há comunicação automática com outro serviço."
          onClose={() => setComplete(null)}
        >
          <ActionForm
            onClose={() => setComplete(null)}
            submitLabel="Concluir com contrarreferência"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'referral.complete',
                id: complete.id,
                date: valueOf(f, 'date'),
                summary: valueOf(f, 'summary'),
              });
              notify('Retorno registrado e preservado no histórico.');
            }}
          >
            <Field label="Data do atendimento no serviço">
              <input
                name="date"
                type="date"
                required
                min={complete.appointmentDate}
                max={dateKey()}
                defaultValue={dateKey()}
              />
            </Field>
            <Field label="Resumo da contrarreferência">
              <textarea name="summary" required maxLength={4000} rows={6} />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {create && (
        <Modal title="Novo encaminhamento" onClose={() => setCreate(false)}>
          <ActionForm
            onClose={() => setCreate(false)}
            submitLabel="Criar solicitação"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'referral.create',
                patientId: valueOf(f, 'patient'),
                specialty: valueOf(f, 'specialty'),
                destination: valueOf(f, 'destination'),
                reason: valueOf(f, 'reason'),
              });
              notify('Encaminhamento registrado.');
            }}
          >
            <Field label="Pessoa">
              <select name="patient" defaultValue="" required>
                <option value="" disabled>
                  Selecione uma pessoa fictícia
                </option>
                {data.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Especialidade">
              <select name="specialty">
                <option>Cardiologia</option>
                <option>Oftalmologia</option>
                <option>Ortopedia</option>
                <option>Neurologia</option>
                <option>Reabilitação</option>
              </select>
            </Field>
            <Field label="Serviço de destino">
              <input
                name="destination"
                maxLength={160}
                required
                defaultValue="Centro de especialidades · demonstração"
              />
            </Field>
            <Field label="Justificativa">
              <textarea name="reason" required rows={3} maxLength={2000} />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {schedule && (
        <Modal
          title={
            schedule.status === 'scheduled' ? 'Reagendar encaminhamento' : 'Registrar agendamento'
          }
          description="Registre uma vaga de demonstração, sem reserva em serviços externos."
          onClose={() => setSchedule(null)}
        >
          <ActionForm
            onClose={() => setSchedule(null)}
            submitLabel={
              schedule.status === 'scheduled' ? 'Salvar reagendamento' : 'Registrar agendamento'
            }
            onSubmit={async (f) => {
              const slot = {
                id: schedule.id,
                date: valueOf(f, 'date'),
                time: valueOf(f, 'time'),
                destination: valueOf(f, 'destination'),
              };
              await repository.execute(
                context,
                schedule.status === 'scheduled'
                  ? {
                      type: 'referral.reschedule',
                      ...slot,
                      reason: valueOf(f, 'reason'),
                      expectedHistoryCount: schedule.history?.length ?? 0,
                    }
                  : { type: 'referral.schedule', ...slot },
              );
              notify('Agendamento registrado no encaminhamento.');
            }}
          >
            {schedule.status === 'scheduled' && (
              <div className="followup-summary">
                <strong>Agendamento anterior</strong>
                <span>
                  {shortDate(schedule.appointmentDate!)} às {schedule.appointmentTime} ·{' '}
                  {schedule.destination}
                </span>
              </div>
            )}
            <div className="form-grid">
              <Field label="Data">
                <input
                  type="date"
                  name="date"
                  required
                  min={dateKey()}
                  defaultValue={
                    schedule.status === 'scheduled' && schedule.appointmentDate! >= dateKey()
                      ? schedule.appointmentDate
                      : addDays(dateKey(), 1)
                  }
                />
              </Field>
              <Field label="Horário">
                <input
                  type="time"
                  name="time"
                  required
                  defaultValue={schedule.appointmentTime ?? '09:00'}
                />
              </Field>
            </div>
            <Field label="Destino confirmado">
              <input
                name="destination"
                defaultValue={schedule.destination}
                maxLength={160}
                required
              />
            </Field>
            {schedule.status === 'scheduled' && (
              <Field label="Motivo do reagendamento">
                <textarea name="reason" required maxLength={1000} rows={3} />
              </Field>
            )}
          </ActionForm>
        </Modal>
      )}
      {cancel && (
        <Modal title="Cancelar encaminhamento" onClose={() => setCancel(null)}>
          <ActionForm
            onClose={() => setCancel(null)}
            submitLabel="Confirmar cancelamento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'referral.cancel',
                id: cancel.id,
                reason: valueOf(f, 'reason'),
              });
              notify('Encaminhamento cancelado.');
            }}
          >
            <Field label="Motivo">
              <textarea name="reason" required rows={3} maxLength={2000} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
