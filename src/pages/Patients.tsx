import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ArrowLeft, ArrowUpRight, FileText, ShieldCheck } from 'lucide-react';
import { useApp } from '../app/context';
import { can } from '../domain/model';
import { IntakeHistory, NoteAddenda } from '../components/ClinicalHistory';
import { VaccineHistory } from '../components/VaccineHistory';
import { ageAt, dateKey, shortDate } from '../domain/dates';
import { cpfDigits, formatCpf } from '../domain/identification';
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
  valueOf,
} from '../components/ui';

export function Patients() {
  const { data, context, repository, notify } = useApp();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? ''),
    [create, setCreate] = useState(false);
  const normalized = search.toLocaleLowerCase('pt-BR');
  const patients = data.patients.filter(
    (p) =>
      `${p.name} ${p.socialName} ${p.record}`.toLocaleLowerCase('pt-BR').includes(normalized) ||
      (!!cpfDigits(search) && !!p.cpf?.includes(cpfDigits(search))),
  );
  return (
    <>
      <PageHeader
        eyebrow="CADASTRO E CONTINUIDADE"
        title="Pessoas e prontuários"
        description="Um cadastro na rede, com acesso conforme a função do profissional."
        action={
          can(context.role, 'patients.write') && (
            <Button onClick={() => setCreate(true)} disabled={context.unitId === 'all'}>
              <Plus size={18} />
              Cadastrar pessoa
            </Button>
          )
        }
      />
      {context.unitId === 'all' && can(context.role, 'patients.write') && (
        <Notice>Para cadastrar uma pessoa, selecione a unidade responsável no topo.</Notice>
      )}
      <Panel>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, CPF ou cadastro"
          />
          <span className="result-count">{patients.length} pessoas na rede</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Nascimento</th>
                <th>Cadastro</th>
                <th>Contato</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="person-link" to={`/pessoas/${p.id}`}>
                      <Avatar name={p.socialName || p.name} />
                      <span>
                        <strong>{p.socialName || p.name}</strong>
                        <small>
                          {p.socialName ? `Nome civil: ${p.name}` : 'Registro fictício'}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {shortDate(p.birthDate)}
                    <small className="cell-secondary">{ageAt(p.birthDate)} anos</small>
                  </td>
                  <td>
                    <span className="record-number">{p.record}</span>
                  </td>
                  <td>{p.phone || <span className="muted">Não informado</span>}</td>
                  <td>
                    <Link
                      className="row-link"
                      to={`/pessoas/${p.id}`}
                      aria-label={`Abrir cadastro de ${p.name}`}
                    >
                      Abrir
                      <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {patients.length === 0 && (
          <EmptyState
            title="Nenhuma pessoa encontrada"
            description="Confira a busca ou cadastre uma pessoa fictícia para testar o fluxo."
          />
        )}
      </Panel>
      {create && (
        <Modal
          title="Cadastrar pessoa"
          description="Use apenas informações fictícias neste ambiente."
          onClose={() => setCreate(false)}
        >
          <ActionForm
            onClose={() => setCreate(false)}
            submitLabel="Criar cadastro"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'patient.create',
                name: valueOf(f, 'name'),
                socialName: valueOf(f, 'socialName'),
                birthDate: valueOf(f, 'birthDate'),
                phone: valueOf(f, 'phone'),
                cpf: valueOf(f, 'cpf'),
              });
              notify('Cadastro criado na rede selecionada.');
            }}
          >
            <Field label="Nome completo">
              <input
                name="name"
                required
                maxLength={120}
                autoComplete="off"
                placeholder="Nome da pessoa fictícia"
              />
            </Field>
            <Field label="Nome social (opcional)">
              <input name="socialName" maxLength={120} autoComplete="off" />
            </Field>
            <Field
              label="CPF (opcional)"
              hint="Use somente um CPF fictício. Quem não tiver CPF pode se identificar pelo nome e nascimento."
            >
              <input
                name="cpf"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </Field>
            <div className="form-grid">
              <Field label="Data de nascimento">
                <input name="birthDate" type="date" required min="1850-01-01" max={dateKey()} />
              </Field>
              <Field label="Telefone (opcional)">
                <input
                  name="phone"
                  maxLength={30}
                  autoComplete="off"
                  placeholder="Contato de demonstração"
                />
              </Field>
            </div>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}

export function PatientDetails() {
  const { id } = useParams();
  const { data, context } = useApp();
  const p = data.patients.find((p) => p.id === id);
  if (!p)
    return (
      <EmptyState
        title="Cadastro não encontrado nesta rede"
        description="Confira a rede selecionada ou volte à lista de pessoas."
        action={
          <Link className="button secondary" to="/pessoas">
            Voltar à lista
          </Link>
        }
      />
    );
  const notes = data.notes
    .filter((n) => n.patientId === p.id && n.status === 'final')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const appointments = data.appointments.filter(
    (a) => a.patientId === p.id && a.status === 'scheduled',
  );
  return (
    <>
      <Link className="back-link" to="/pessoas">
        <ArrowLeft size={16} />
        Pessoas e prontuários
      </Link>
      <div className="patient-hero">
        <Avatar name={p.socialName || p.name} />
        <div>
          <span className="eyebrow">{p.record} · PESSOA FICTÍCIA</span>
          <h1>{p.socialName || p.name}</h1>
          <p>
            {ageAt(p.birthDate)} anos · Nascimento em {shortDate(p.birthDate)}
            {p.socialName ? ` · Nome civil: ${p.name}` : ''}
          </p>
        </div>
        <Badge tone="green">Cadastro na rede</Badge>
      </div>
      <div className="detail-grid">
        <div>
          <Panel
            title={
              can(context.role, 'clinical') ? 'Histórico de registros' : 'Informações cadastrais'
            }
            subtitle={
              can(context.role, 'clinical')
                ? 'Registros finalizados no ambiente de demonstração.'
                : 'Conteúdo compatível com o perfil selecionado.'
            }
          >
            {can(context.role, 'clinical') ? (
              notes.length ? (
                notes.map((n) => (
                  <article className="timeline-note" key={n.id}>
                    <div className="timeline-heading">
                      <span className="timeline-icon">
                        <FileText size={18} />
                      </span>
                      <div>
                        <strong>Registro de atendimento</strong>
                        <small>
                          {shortDate(n.updatedAt)} ·{' '}
                          {data.units.find((u) => u.id === n.unitId)?.name} · {n.author}
                        </small>
                      </div>
                      <Badge>Finalizado</Badge>
                    </div>
                    {Object.entries(n.soap).map(
                      ([key, value]) =>
                        value && (
                          <div className="note-text" key={key}>
                            <span>
                              {
                                (
                                  {
                                    subjective: 'Subjetivo',
                                    objective: 'Objetivo',
                                    assessment: 'Avaliação',
                                    plan: 'Plano',
                                  } as Record<string, string>
                                )[key]
                              }
                            </span>
                            <p>{value}</p>
                          </div>
                        ),
                    )}
                    <NoteAddenda items={data.addenda.filter((a) => a.noteId === n.id)} />
                  </article>
                ))
              ) : (
                <EmptyState
                  title="O histórico começa no atendimento"
                  description="Ao concluir um registro de demonstração, ele aparecerá aqui com sua autoria e unidade."
                />
              )
            ) : (
              <div className="panel-body">
                <Notice>
                  Este perfil pode consultar o cadastro, mas não visualiza as evoluções clínicas.
                </Notice>
                <dl className="definition-list">
                  <div>
                    <dt>Nome civil</dt>
                    <dd>{p.name}</dd>
                  </div>
                  <div>
                    <dt>Nome social</dt>
                    <dd>{p.socialName || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt>Contato</dt>
                    <dd>{p.phone || 'Não informado'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </Panel>
          {can(context.role, 'clinical') && (
            <Panel
              title="Histórico de escuta e aferições"
              subtitle="Registros da pessoa na rede selecionada, com a unidade de origem."
            >
              {data.intakes.some((r) => r.patientId === p.id) ? (
                <IntakeHistory
                  records={data.intakes.filter((r) => r.patientId === p.id)}
                  unitNames={Object.fromEntries(data.units.map((u) => [u.id, u.name]))}
                />
              ) : (
                <p className="panel-empty">Nenhuma escuta ou aferição registrada.</p>
              )}
            </Panel>
          )}
          {can(context.role, 'vaccination') && (
            <Panel
              title="Histórico de vacinação"
              subtitle="Registros e comprovantes da pessoa na mesma rede."
              action={
                <Link className="text-link" to={`/vacinacao?pessoa=${p.id}`}>
                  Abrir sala de vacinação
                </Link>
              }
            >
              <VaccineHistory
                records={data.immunizations.filter((i) => i.patientId === p.id)}
                voids={data.vaccineVoids}
                unitNames={Object.fromEntries(data.units.map((u) => [u.id, u.name]))}
              />
            </Panel>
          )}
          {can(context.role, 'clinical') &&
            data.workRecords.some(
              (r) => r.module === 'prenatal' && r.values.patientId === p.id,
            ) && (
              <Panel
                title="Histórico de pré-natal na prefeitura"
                subtitle="Acompanhamentos das unidades desta prefeitura. A edição continua na unidade de origem."
              >
                {data.workRecords
                  .filter((r) => r.module === 'prenatal' && r.values.patientId === p.id)
                  .map((r) => (
                    <article key={r.id} className="timeline-note">
                      <div className="timeline-heading">
                        <strong>
                          {data.units.find((u) => u.id === r.unitId)?.name} · início em{' '}
                          {shortDate(r.values.start)}
                        </strong>
                      </div>
                      <p>
                        Data provável do parto informada: {shortDate(r.values.expected)} ·{' '}
                        {r.values.responsible}
                      </p>
                      <p>{r.values.notes}</p>
                      {data.workRecords
                        .filter(
                          (c) =>
                            c.module === 'prenatal-consultas' &&
                            c.values.episode === r.id &&
                            c.status === 'done',
                        )
                        .map((c) => (
                          <div className="note-text" key={c.id}>
                            <strong>
                              {shortDate(c.values.date)} · semana informada: {c.values.week}
                            </strong>
                            <p>{c.values.assessment}</p>
                            <p>{c.values.plan}</p>
                          </div>
                        ))}
                      <Link to="/modulos/prenatal">
                        Ver acompanhamento e histórico de alterações
                      </Link>
                    </article>
                  ))}
              </Panel>
            )}
          <Panel title="Próximos agendamentos nesta unidade">
            {appointments.length ? (
              <div className="compact-list">
                {appointments.map((a) => (
                  <div key={a.id}>
                    <span className="time-square">{a.time}</span>
                    <div>
                      <strong>{a.service}</strong>
                      <small>
                        {shortDate(a.date)} · {a.professional}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-empty">Nenhum agendamento pendente no contexto selecionado.</p>
            )}
          </Panel>
        </div>
        <aside>
          <Panel title="Identificação">
            <dl className="definition-list panel-body">
              <div>
                <dt>CPF</dt>
                <dd>{p.cpf ? formatCpf(p.cpf) : 'Não informado'}</dd>
              </div>
              <div>
                <dt>Cadastro</dt>
                <dd>{p.record}</dd>
              </div>
              <div>
                <dt>Nascimento</dt>
                <dd>{shortDate(p.birthDate)}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{p.phone || 'Não informado'}</dd>
              </div>
            </dl>
          </Panel>
          {can(context.role, 'clinical') && (
            <Panel title="Alergias registradas">
              <div className="panel-body">
                {p.allergies.length ? (
                  p.allergies.map((a) => (
                    <Notice tone="amber" key={a}>
                      {a}
                    </Notice>
                  ))
                ) : (
                  <p className="muted">
                    Nenhuma informação registrada. Isso não confirma ausência de alergia.
                  </p>
                )}
              </div>
            </Panel>
          )}
          <div className="quiet-callout">
            <ShieldCheck size={22} />
            <h3>Contexto preservado</h3>
            <p>
              O histórico exibido pertence somente à rede selecionada. Nenhum registro é
              compartilhado entre redes neste ambiente.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
