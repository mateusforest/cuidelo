import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock3, ArrowRight, HeartPulse, Monitor } from 'lucide-react';
import { can, type EncounterStatus } from '../domain/model';
import { clockTime, minutesWaiting } from '../domain/dates';
import { useApp } from '../app/context';
import { ReceptionDesk } from './ReceptionDesk';
import { preferenceLabel } from '../domain/kiosk-options';
import {
  ActionForm,
  Avatar,
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

const statusNames: Record<EncounterStatus, string> = {
  waiting: 'Em espera',
  'in-care': 'Em atendimento',
  observation: 'Em observação',
  completed: 'Concluído',
};
export function Reception() {
  const { data, context, repository, notify } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EncounterStatus | 'all'>('all'),
    [search, setSearch] = useState(''),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(''),
    [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const unit = data.units.find((u) => u.id === context.unitId),
    urgent = unit?.kind === 'upa';
  const list = data.encounters
    .filter(
      (e) =>
        (filter === 'all' || e.status === filter) &&
        data.patients
          .find((p) => p.id === e.patientId)
          ?.name.toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => {
      const statusOrder = { waiting: 0, 'in-care': 1, observation: 2, completed: 3 };
      return (
        statusOrder[a.status] - statusOrder[b.status] ||
        (a.priority === 'priority' ? -1 : 0) - (b.priority === 'priority' ? -1 : 0) ||
        a.arrivedAt.localeCompare(b.arrivedAt)
      );
    });
  const attend = async (id: string, status: EncounterStatus) => {
    setBusy(id);
    try {
      if (status === 'waiting') await repository.execute(context, { type: 'encounter.start', id });
      navigate(`/atendimento/${id}`);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageHeader
        eyebrow={urgent ? 'URGÊNCIA E EMERGÊNCIA' : 'PORTA DE ENTRADA'}
        title={urgent ? 'Acolhimento e atendimento' : 'Recepção e atendimento'}
        description="Acompanhe a chegada, a espera e a continuidade de cada atendimento."
        action={
          <div className="row-actions">
            <Link className="button secondary" to="/senhas">
              <Monitor size={18} />
              Painel de senhas
            </Link>
            <Button onClick={() => setCreate(true)} disabled={context.unitId === 'all'}>
              <Plus size={18} />
              Registrar chegada
            </Button>
          </div>
        }
      />
      <UnitRequired>
        {can(context.role, 'patients.write') ? (
          <ReceptionDesk key={context.sessionId + context.unitId} />
        ) : (
          <>
            {urgent && (
              <Notice>
                <HeartPulse size={16} /> O fluxo de observação está disponível para demonstração. A
                classificação clínica de risco depende de protocolo aprovado e ainda não está
                implementada.
              </Notice>
            )}
            <div className="queue-stats">
              {(['waiting', 'in-care', 'observation', 'completed'] as const).map((s) => (
                <button
                  className={filter === s ? 'selected' : ''}
                  key={s}
                  onClick={() => setFilter(filter === s ? 'all' : s)}
                >
                  <span>{statusNames[s]}</span>
                  <strong>{data.encounters.filter((e) => e.status === s).length}</strong>
                </button>
              ))}
            </div>
            <Panel>
              <div className="table-toolbar">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar pessoa na fila"
                />
                <button
                  className="text-button"
                  onClick={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                >
                  Mostrar todos
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Senha</th>
                      <th>Pessoa</th>
                      <th>Serviço</th>
                      <th>Chegada</th>
                      <th>Situação</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => {
                      const p = data.patients.find((p) => p.id === e.patientId);
                      return (
                        <tr key={e.id}>
                          <td>
                            <strong className="queue-ticket-small">{e.ticket}</strong>
                          </td>
                          <td>
                            <Link className="person-link" to={`/pessoas/${p?.id}`}>
                              <Avatar name={p?.name ?? 'Pessoa'} />
                              <span>
                                <strong>{p?.socialName || p?.name}</strong>
                                <small>
                                  {p?.record}
                                  {e.priority === 'priority'
                                    ? ` · Preferencial: ${preferenceLabel(e.preferenceReason)}`
                                    : ''}
                                </small>
                              </span>
                            </Link>
                          </td>
                          <td>{e.service}</td>
                          <td>
                            <span>{clockTime(e.arrivedAt)}</span>
                            {e.status === 'waiting' && (
                              <small className="cell-secondary wait">
                                <Clock3 size={12} />
                                {minutesWaiting(e.arrivedAt, now)} min de espera
                              </small>
                            )}
                          </td>
                          <td>
                            <Badge
                              tone={
                                e.status === 'waiting'
                                  ? 'amber'
                                  : e.status === 'completed'
                                    ? 'green'
                                    : 'blue'
                              }
                            >
                              {statusNames[e.status]}
                            </Badge>
                          </td>
                          <td>
                            {can(context.role, 'clinical') ? (
                              <div className="row-actions">
                                <Link className="button secondary" to={`/escuta/${e.id}`}>
                                  {data.intakes.some((r) => r.encounterId === e.id)
                                    ? 'Ver escuta'
                                    : e.status === 'completed'
                                      ? 'Ver aferições'
                                      : 'Escuta inicial'}
                                </Link>
                                <Button
                                  variant={e.status === 'waiting' ? 'primary' : 'secondary'}
                                  onClick={() => attend(e.id, e.status)}
                                  disabled={busy === e.id}
                                >
                                  {e.status === 'waiting'
                                    ? 'Atender'
                                    : e.status === 'completed'
                                      ? 'Ver registro'
                                      : 'Continuar'}
                                  <ArrowRight size={15} />
                                </Button>
                              </div>
                            ) : (
                              <Link className="row-link" to={`/pessoas/${p?.id}`}>
                                Ver cadastro
                                <ArrowRight size={14} />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!list.length && (
                <EmptyState
                  title="Nenhum atendimento neste filtro"
                  description="Ajuste a busca ou registre uma chegada para testar o percurso."
                />
              )}
            </Panel>
          </>
        )}
      </UnitRequired>
      {create && (
        <Modal
          title="Registrar chegada"
          description="A pessoa será incluída na fila da unidade selecionada."
          onClose={() => setCreate(false)}
        >
          <ActionForm
            onClose={() => setCreate(false)}
            submitLabel="Adicionar à recepção"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'encounter.create',
                patientId: valueOf(f, 'patient'),
                service: valueOf(f, 'service'),
                priority: valueOf(f, 'priority') as 'routine' | 'priority',
              });
              notify('Chegada registrada.');
            }}
          >
            <Field label="Pessoa">
              <select name="patient" required defaultValue="">
                <option value="" disabled>
                  Selecione uma pessoa fictícia
                </option>
                {data.patients.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.socialName || p.name} · {p.record}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serviço">
              <select name="service">
                {urgent ? (
                  <option>Pronto atendimento</option>
                ) : (
                  <>
                    <option>Consulta médica</option>
                    <option>Enfermagem</option>
                    <option>Retorno</option>
                  </>
                )}
              </select>
            </Field>
            <Field
              label="Prioridade de atendimento"
              hint="Prioridade administrativa informada pela equipe; não é classificação clínica de risco."
            >
              <select name="priority">
                <option value="routine">Ordem de chegada</option>
                <option value="priority">Atendimento prioritário informado</option>
              </select>
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
