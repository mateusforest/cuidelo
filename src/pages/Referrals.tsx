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
  const list = data.referrals.filter((r) =>
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
              {data.referrals.filter((r) => r.status === 'requested').length} solicitações pendentes
            </span>
          </div>
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
                          r.status === 'scheduled'
                            ? 'green'
                            : r.status === 'requested'
                              ? 'amber'
                              : 'neutral'
                        }
                      >
                        {r.status === 'scheduled'
                          ? 'Agendado'
                          : r.status === 'requested'
                            ? 'Solicitado'
                            : 'Cancelado'}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        {r.status === 'requested' && (
                          <Button variant="secondary" onClick={() => setSchedule(r)}>
                            <CalendarDays size={15} />
                            Agendar
                          </Button>
                        )}
                        {r.status !== 'cancelled' && (
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
