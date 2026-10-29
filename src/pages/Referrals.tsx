import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Plus, CalendarDays, X } from 'lucide-react';
import { useApp } from '../app/context';
import type { Referral } from '../domain/model';
import { addDays, dateKey, shortDate } from '../domain/dates';
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
    [create, setCreate] = useState(false),
    [schedule, setSchedule] = useState<Referral | null>(null),
    [cancel, setCancel] = useState<Referral | null>(null);
  const [params, setParams] = useSearchParams();
  const [detail, setDetail] = useState<Referral | null>(null),
    [complete, setComplete] = useState<Referral | null>(null);
  const canResponse = context.role === 'clinical' || context.role === 'regulation';
  const list = data.referrals
    .filter(
      (r) =>
        r.unitId === context.unitId &&
        (!params.get('encaminhamento') || r.id === params.get('encaminhamento')),
    )
    .filter((r) =>
      `${r.specialty} ${data.patients.find((p) => p.id === r.patientId)?.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
    );
  return (
    <>
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
        <Notice>
          Os agendamentos desta demonstração são registros locais. Eles não reservam vagas nem
          enviam solicitações a sistemas externos.
        </Notice>
        <Panel>
          <div className="table-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar pessoa ou especialidade"
            />
            <span className="result-count">
              {
                data.referrals.filter(
                  (r) => r.unitId === context.unitId && r.status === 'requested',
                ).length
              }{' '}
              solicitações pendentes
            </span>
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
                        {r.status === 'requested' && (
                          <Button variant="secondary" onClick={() => setSchedule(r)}>
                            <CalendarDays size={15} />
                            Agendar
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
                          completed: 'Retorno registrado',
                          cancelled: 'Cancelado',
                        }[h.action]
                      }
                      {h.note && <p>{h.note}</p>}
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
          title="Registrar agendamento"
          description="Registre uma vaga de demonstração, sem reserva em serviços externos."
          onClose={() => setSchedule(null)}
        >
          <ActionForm
            onClose={() => setSchedule(null)}
            submitLabel="Registrar agendamento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'referral.schedule',
                id: schedule.id,
                date: valueOf(f, 'date'),
                time: valueOf(f, 'time'),
                destination: valueOf(f, 'destination'),
              });
              notify('Agendamento registrado no encaminhamento.');
            }}
          >
            <div className="form-grid">
              <Field label="Data">
                <input
                  type="date"
                  name="date"
                  required
                  min={dateKey()}
                  defaultValue={addDays(dateKey(), 1)}
                />
              </Field>
              <Field label="Horário">
                <input type="time" name="time" required defaultValue="09:00" />
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
    </>
  );
}
