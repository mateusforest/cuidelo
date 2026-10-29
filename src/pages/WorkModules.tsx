import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ArrowRight, ClipboardCheck, Download } from 'lucide-react';
import { useApp } from '../app/context';
import { demoIdentities } from '../domain/access';
import { can, type Permission, type WorkRecord } from '../domain/model';
import { workModules, type WorkModule } from '../domain/work-modules';
import { dateKey, shortDate, clockTime } from '../domain/dates';
import {
  Button,
  Field,
  Modal,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  EmptyState,
  ActionForm,
  Badge,
} from '../components/ui';

const reportLinks: { id: string; title: string; description: string; permission: Permission }[] = [
  {
    id: 'prenatal-municipio',
    title: 'Pré-natal da rede',
    description: 'Acompanhamentos ativos e encontros registrados por unidade.',
    permission: 'manage',
  },
  {
    id: 'relatorios',
    title: 'Relatórios da operação',
    description: 'Conferir e exportar os indicadores locais da rede ou unidade.',
    permission: 'manage',
  },
  {
    id: 'campo-hoje',
    title: 'Meu dia no território',
    description: 'Visitas planejadas e pendências das famílias.',
    permission: 'territory',
  },
  {
    id: 'campo-mapa',
    title: 'Microáreas e roteiro',
    description: 'Organizar domicílios por microárea e planejar visitas.',
    permission: 'territory',
  },
  {
    id: 'campo-envios',
    title: 'Registros e sincronização',
    description: 'Conferir os registros locais e as dependências de envio.',
    permission: 'territory',
  },
  {
    id: 'campo-mes',
    title: 'Produção do agente',
    description: 'Visitas, ausências e famílias acompanhadas no período.',
    permission: 'territory',
  },
  {
    id: 'bo-resumo',
    title: 'Resumo da empresa',
    description: 'Carteira, contratos, recebimentos e implantação.',
    permission: 'business',
  },
  {
    id: 'bo-uso',
    title: 'Acompanhamento dos clientes',
    description: 'Unidades previstas, implantação e chamados da carteira.',
    permission: 'business',
  },
];
export function ModulesHub() {
  const { context } = useApp();
  const modules = workModules.filter((m) => can(context.role, m.permission));
  const groups = [...new Set(modules.map((m) => m.group))];
  return (
    <>
      <PageHeader
        eyebrow={context.role === 'business' ? 'ADMINISTRAÇÃO DA CUIDELO' : 'ÁREAS DE TRABALHO'}
        title={context.role === 'business' ? 'Operação da Cuidelo' : 'Módulos e acompanhamentos'}
        description={
          context.role === 'business'
            ? 'A carteira comercial fica separada dos dados de saúde das prefeituras.'
            : 'Registros, tarefas e acompanhamento conforme o acesso da sua sessão.'
        }
      />
      <div className="identity-grid">
        {reportLinks
          .filter((r) => can(context.role, r.permission))
          .map((r) => (
            <Link className="identity-card workspace-link" key={r.id} to={`/paineis/${r.id}`}>
              <ClipboardCheck size={25} />
              <h2>{r.title}</h2>
              <p>{r.description}</p>
              <ArrowRight size={20} />
            </Link>
          ))}
      </div>
      {groups.map((group) => (
        <section key={group}>
          <h2>{group}</h2>
          <div className="identity-grid">
            {modules
              .filter((m) => m.group === group)
              .map((m) => (
                <Link to={`/modulos/${m.id}`} className="identity-card workspace-link" key={m.id}>
                  <h2>{m.title}</h2>
                  <p>{m.description}</p>
                  <ArrowRight size={20} />
                </Link>
              ))}
          </div>
        </section>
      ))}
      {!groups.length && (
        <EmptyState
          title="Nenhum acompanhamento adicional neste perfil"
          description="Use os fluxos disponíveis no menu da sua unidade."
        />
      )}
    </>
  );
}
function recordTitle(
  r: WorkRecord,
  records: WorkRecord[],
  patients: { id: string; name: string; socialName: string }[],
): string {
  if (r.values.name) return r.values.name;
  if (r.values.patientId) {
    const p = patients.find((p) => p.id === r.values.patientId);
    return p?.socialName || p?.name || 'Pessoa do acompanhamento';
  }
  const reference = r.values.family || r.values.episode || r.values.client || r.values.contract;
  const parent = records.find((p) => p.id === reference);
  if (parent)
    return `${recordTitle(
      parent,
      records.filter((x) => x.id !== r.id),
      patients,
    )}${r.values.stage ? ' · ' + r.values.stage : ''}`;
  return r.values.reference || r.values.competence || r.values.audience || r.id.slice(0, 8);
}
export function WorkPage() {
  const { module: id } = useParams(),
    { context } = useApp();
  const m = workModules.find((m) => m.id === id);
  if (!m || !can(context.role, m.permission))
    return (
      <EmptyState
        title="Módulo indisponível nesta sessão"
        description="Escolha uma área autorizada no menu."
      />
    );
  return <ModuleEditor key={`${m.id}:${context.sessionId}:${context.unitId}`} module={m} />;
}
function ModuleEditor({ module: m }: { module: WorkModule }) {
  const { data, context, repository, notify } = useApp();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [editing, setEditing] = useState<WorkRecord | 'new' | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [transition, setTransition] = useState<{ record: WorkRecord; status: string } | null>(null);
  const records = data.workRecords.filter((r) => r.module === m.id),
    filtered = records
      .filter(
        (r) =>
          (status === 'all' || r.status === status) &&
          JSON.stringify(r.values)
            .toLocaleLowerCase('pt-BR')
            .includes(search.toLocaleLowerCase('pt-BR')),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = records.find((r) => r.id === detail),
    title = (r: WorkRecord) => recordTitle(r, data.workRecords, data.patients);
  const writable = (r: WorkRecord) =>
    (r.unitId === context.unitId || (context.role === 'manager' && context.unitId === 'all')) &&
    !m.sealed?.includes(r.status);
  return (
    <>
      <PageHeader
        eyebrow={m.group}
        title={m.title}
        description={m.description}
        action={
          <Button
            disabled={context.unitId === 'all' && !m.network}
            onClick={() => setEditing('new')}
          >
            <Plus size={18} />
            Novo registro
          </Button>
        }
      />
      <Notice>{m.limit}</Notice>
      <div className="flow-stats">
        {Object.entries(m.states).map(([key, label]) => (
          <article key={key}>
            <small>{label}</small>
            <strong>{records.filter((r) => r.status === key).length}</strong>
          </article>
        ))}
      </div>
      <Panel title="Registros e acompanhamento">
        <div className="table-toolbar">
          <SearchField value={search} onChange={setSearch} placeholder="Buscar registros" />
          <Field label="Situação">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todas</option>
              {Object.entries(m.states).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Unidade / escopo</th>
                <th>Situação</th>
                <th>Atualizado</th>
                <th>Acompanhamento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{title(r)}</strong>
                    {m.id === 'indicadores' && (
                      <small className="table-subtitle">
                        {(
                          (100 * Number(r.values.numerator)) /
                          Number(r.values.denominator)
                        ).toFixed(1)}
                        % · meta {r.values.target}%
                      </small>
                    )}
                    {r.values.date && (
                      <small className="table-subtitle">{shortDate(r.values.date)}</small>
                    )}
                  </td>
                  <td>
                    {r.unitId === 'office'
                      ? 'Cuidelo'
                      : r.unitId === 'all'
                        ? 'Toda a prefeitura'
                        : data.units.find((u) => u.id === r.unitId)?.name}
                  </td>
                  <td>
                    <Badge tone={m.sealed?.includes(r.status) ? 'neutral' : 'green'}>
                      {m.states[r.status]}
                    </Badge>
                  </td>
                  <td>
                    {shortDate(r.updatedAt.slice(0, 10))} · {clockTime(r.updatedAt)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button variant="secondary" onClick={() => setDetail(r.id)}>
                        Detalhes e histórico
                      </Button>
                      {writable(r) && (
                        <>
                          <Button variant="ghost" onClick={() => setEditing(r)}>
                            Editar
                          </Button>
                          {(m.transitions[r.status] ?? []).map((next) => (
                            <Button
                              key={next}
                              variant="secondary"
                              onClick={() => setTransition({ record: r, status: next })}
                            >
                              {m.states[next]}
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <EmptyState
            title="Nenhum registro neste filtro"
            description="Crie um registro fictício para testar este acompanhamento."
          />
        )}
      </Panel>
      {m.id === 'prenatal' && (
        <Link className="button secondary" to="/modulos/prenatal-consultas">
          Registrar encontros do pré-natal
        </Link>
      )}
      {m.id === 'familias' && (
        <Link className="button secondary" to="/modulos/visitas">
          Planejar e registrar visita
        </Link>
      )}
      {editing && (
        <RecordForm
          module={m}
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {transition && (
        <Modal
          title={`${m.states[transition.status]} · ${title(transition.record)}`}
          onClose={() => setTransition(null)}
        >
          <ActionForm
            submitLabel="Confirmar alteração"
            onClose={() => setTransition(null)}
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'work.transition',
                id: transition.record.id,
                status: transition.status,
                reason: String(f.get('reason') ?? ''),
              });
              notify('Situação atualizada com histórico preservado.');
            }}
          >
            <Field label="Resultado, evidência ou motivo">
              <textarea name="reason" required maxLength={4000} rows={4} />
            </Field>
            <Notice>
              Esta anotação é local. Não transmite informações nem executa ações em serviços
              externos.
            </Notice>
          </ActionForm>
        </Modal>
      )}
      {current && (
        <Modal title={title(current)} onClose={() => setDetail(null)}>
          <div className="modal-body">
            <dl className="definition-list">
              {m.fields.map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.type === 'patient'
                      ? data.patients.find((p) => p.id === current.values[f.key])?.name
                      : f.type === 'reference'
                        ? (() => {
                            const p = data.workRecords.find((r) => r.id === current.values[f.key]);
                            return p ? title(p) : 'Referência preservada';
                          })()
                        : current.values[f.key] || 'Não informado'}
                  </dd>
                </div>
              ))}
            </dl>
            <h3>Histórico de alterações</h3>
            {current.history.map((h, i) => (
              <article className="record-event" key={i}>
                <strong>{h.action}</strong>
                <small>
                  {shortDate(h.at.slice(0, 10))} · {clockTime(h.at)} ·{' '}
                  {demoIdentities(repository.directory()).find((i) => i.sessionId === h.actorId)
                    ?.name ?? 'Sessão de demonstração'}
                </small>
                <p>{h.reason || 'Criação do registro.'}</p>
                {h.previousValues && (
                  <details>
                    <summary>Dados anteriores preservados</summary>
                    <dl className="definition-list">
                      {m.fields.map((f) => (
                        <div key={f.key}>
                          <dt>{f.label}</dt>
                          <dd>{h.previousValues?.[f.key] || 'Não informado'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </article>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
function RecordForm({
  module: m,
  record,
  onClose,
}: {
  module: WorkModule;
  record?: WorkRecord;
  onClose: () => void;
}) {
  const { data, context, repository, notify, setDirty } = useApp();
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(m.fields.map((f) => [f.key, record?.values[f.key] ?? ''])),
    ),
    [reason, setReason] = useState('');
  const dirty = !!reason || m.fields.some((f) => values[f.key] !== (record?.values[f.key] ?? ''));
  const [baseRevision] = useState(repository.getRevision());
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const close = () => {
    if (dirty && !window.confirm('Descartar os dados ainda não salvos?')) return;
    setDirty(false);
    onClose();
  };
  return (
    <Modal title={record ? 'Editar registro' : 'Novo registro'} onClose={close}>
      <ActionForm
        onClose={() => {
          setDirty(false);
          onClose();
        }}
        onCancel={close}
        submitLabel="Salvar registro"
        onSubmit={async () => {
          await repository.execute(
            context,
            record
              ? { type: 'work.update', id: record.id, values, reason }
              : { type: 'work.create', module: m.id, values },
            baseRevision,
          );
          setDirty(false);
          notify('Registro salvo neste navegador.');
        }}
      >
        {m.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.optional ? 'Opcional' : undefined}>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                required={!f.optional}
                maxLength={4000}
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : ['select', 'reference', 'patient'].includes(f.type ?? '') ? (
              <select
                required={!f.optional}
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              >
                <option value="">Selecionar</option>
                {f.type === 'select'
                  ? f.options?.map((o) => <option key={o}>{o}</option>)
                  : f.type === 'patient'
                    ? data.patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.socialName || p.name} · {p.record}
                        </option>
                      ))
                    : data.workRecords
                        .filter(
                          (r) =>
                            r.module === f.reference &&
                            r.unitId === context.unitId &&
                            !['done', 'cancelled'].includes(r.status),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {recordTitle(r, data.workRecords, data.patients)}
                          </option>
                        ))}
              </select>
            ) : (
              <input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                min={f.min}
                max={f.max}
                step={f.type === 'number' ? 'any' : undefined}
                maxLength={4000}
                required={!f.optional}
                value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {record && (
          <Field label="Motivo da atualização">
            <textarea
              required
              rows={3}
              maxLength={4000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <Notice>{m.limit}</Notice>
      </ActionForm>
    </Modal>
  );
}
export function WorkReport() {
  const { report: id } = useParams(),
    { context } = useApp();
  const report = reportLinks.find((r) => r.id === id);
  if (!report || !can(context.role, report.permission))
    return (
      <EmptyState
        title="Painel indisponível nesta sessão"
        description="Escolha uma área autorizada no menu."
      />
    );
  return (
    <ReportBody
      key={`${id}:${context.sessionId}:${context.unitId}`}
      id={report.id}
      title={report.title}
      description={report.description}
    />
  );
}
function ReportBody({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const { data, context, repository, summary } = useApp();
  const [from, setFrom] = useState(dateKey().slice(0, 8) + '01'),
    [to, setTo] = useState(dateKey());
  const records = data.workRecords,
    visits = records.filter((r) => r.module === 'visitas'),
    families = records.filter((r) => r.module === 'familias'),
    business = context.role === 'business';
  const inPeriod = visits.filter((r) => r.values.date >= from && r.values.date <= to),
    planned = visits.filter((r) => r.status === 'planned');
  const metrics = repository.workMetrics(context);
  const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    sum = (module: string, status: string) =>
      records
        .filter((r) => r.module === module && r.status === status)
        .reduce((n, r) => n + Number(r.values.amount || 0), 0);
  const exportRows = (headers: string[], rows: unknown[][]) => {
    const text = [headers, ...rows]
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(';'),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cuidelo-${id}-${dateKey()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeader
        eyebrow={business ? 'GESTÃO DA EMPRESA' : 'ACOMPANHAMENTO'}
        title={title}
        description={description}
      />
      {id === 'prenatal-municipio' && (
        <>
          <Panel title="Acompanhamento por unidade">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Acompanhamentos abertos</th>
                    <th>Encontros concluídos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((r) => (
                    <tr key={r.unit}>
                      <td>{r.unit}</td>
                      <td>{r.prenatal}</td>
                      <td>{r.consultations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Notice>
            Visão agregada, sem prontuários. Conta apenas os acompanhamentos registrados nesta
            demonstração; não calcula cobertura populacional ou risco gestacional.
          </Notice>
        </>
      )}
      {id === 'relatorios' && (
        <>
          <Panel
            title="Movimento atual das unidades"
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  exportRows(
                    [
                      'Unidade',
                      'Chegadas hoje',
                      'Aguardando',
                      'Em cuidado',
                      'Leitos ocupados',
                      'Total de leitos',
                    ],
                    summary.units.map((s) => [
                      s.unit.name,
                      s.today,
                      s.waiting,
                      s.inCare,
                      s.occupied,
                      s.totalBeds,
                    ]),
                  )
                }
              >
                <Download size={17} />
                Exportar CSV
              </Button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Hoje</th>
                    <th>Em espera</th>
                    <th>Em cuidado</th>
                    <th>Ocupação</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.units.map((s) => (
                    <tr key={s.unit.id}>
                      <td>{s.unit.name}</td>
                      <td>{s.today}</td>
                      <td>{s.waiting}</td>
                      <td>{s.inCare}</td>
                      <td>
                        {s.occupied}/{s.totalBeds}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Link className="button secondary" to="/desempenho">
            Analisar tempos por período e profissional
          </Link>
        </>
      )}
      {id === 'campo-hoje' && (
        <>
          <div className="flow-stats">
            <article>
              <small>Visitas planejadas</small>
              <strong>{planned.length}</strong>
            </article>
            <article>
              <small>Planejadas para hoje</small>
              <strong>{planned.filter((r) => r.values.date === dateKey()).length}</strong>
            </article>
            <article>
              <small>Data planejada vencida</small>
              <strong>{planned.filter((r) => r.values.date < dateKey()).length}</strong>
            </article>
          </div>
          <Panel title="Roteiro planejado">
            <div className="panel-body">
              {planned
                .sort((a, b) => a.values.date.localeCompare(b.values.date))
                .map((r) => (
                  <article className="record-event" key={r.id}>
                    <strong>{recordTitle(r, records, data.patients)}</strong>
                    <p>
                      {shortDate(r.values.date)} · {r.values.priority} · {r.values.purpose}
                    </p>
                    <Link to="/modulos/visitas">Registrar resultado da visita</Link>
                  </article>
                ))}
              {!planned.length && <p>Nenhuma visita planejada.</p>}
            </div>
          </Panel>
          <Link className="button primary" to="/modulos/visitas">
            Planejar visita
          </Link>
        </>
      )}
      {id === 'campo-mapa' && (
        <>
          <Notice>
            Quadro territorial de demonstração. Os endereços são fictícios; não há GPS, mapa
            geográfico ou rota otimizada.
          </Notice>
          <div className="identity-grid">
            {[...new Set(families.map((r) => r.values.microarea))].map((area) => (
              <article className="identity-card" key={area}>
                <h2>Microárea {area}</h2>
                {families
                  .filter((r) => r.values.microarea === area)
                  .map((r) => (
                    <div key={r.id}>
                      <strong>{r.values.name}</strong>
                      <p>{r.values.address}</p>
                      <small>
                        {r.values.agent} · {r.values.members} moradores
                      </small>
                    </div>
                  ))}
                <Link to="/modulos/visitas">Planejar visitas desta microárea</Link>
              </article>
            ))}
          </div>
          <Link className="button primary" to="/modulos/familias">
            Cadastrar domicílio
          </Link>
        </>
      )}
      {id === 'campo-envios' && (
        <>
          <div className="flow-stats">
            <article>
              <small>Domicílios salvos localmente</small>
              <strong>{families.length}</strong>
            </article>
            <article>
              <small>Visitas registradas localmente</small>
              <strong>{visits.filter((r) => r.status === 'visited').length}</strong>
            </article>
          </div>
          <Notice tone="amber">
            Envio remoto indisponível. Não foi transmitido nenhum registro. O HTML armazena os dados
            apenas neste navegador; ele não oferece fila de sincronização segura entre dispositivos.
          </Notice>
          <Panel title="Últimas alterações locais">
            <div className="panel-body">
              {[...families, ...visits]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 20)
                .map((r) => (
                  <article className="record-event" key={r.id}>
                    <strong>{recordTitle(r, records, data.patients)}</strong>
                    <small>
                      Salvo em {shortDate(r.updatedAt.slice(0, 10))} · {clockTime(r.updatedAt)}
                    </small>
                  </article>
                ))}
            </div>
          </Panel>
        </>
      )}
      {id === 'campo-mes' && (
        <>
          <div className="access-filters">
            <Field label="Visitas a partir de">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Visitas até">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {from > to ? (
            <Notice tone="amber">Revise o período.</Notice>
          ) : (
            <>
              <div className="flow-stats">
                {[
                  ['Visitas registradas', inPeriod.filter((r) => r.status === 'visited').length],
                  ['Não encontrados', inPeriod.filter((r) => r.status === 'absent').length],
                  [
                    'Famílias visitadas',
                    new Set(
                      inPeriod.filter((r) => r.status === 'visited').map((r) => r.values.family),
                    ).size,
                  ],
                  ['Planejadas', inPeriod.filter((r) => r.status === 'planned').length],
                ].map(([label, value]) => (
                  <article key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <Notice>
                Período pela data planejada da visita. A conclusão e seu resultado ficam no
                histórico do registro. Indicadores da unidade, sem envio oficial.
              </Notice>
            </>
          )}
        </>
      )}
      {business && (
        <>
          <div className="flow-stats">
            <article>
              <small>Clientes cadastrados</small>
              <strong>{records.filter((r) => r.module === 'bo-municipios').length}</strong>
            </article>
            <article>
              <small>Contratos ativos · mensal</small>
              <strong>{money(sum('bo-contratos', 'active'))}</strong>
            </article>
            <article>
              <small>Recebimentos anotados</small>
              <strong>{money(sum('bo-recebimentos', 'recorded'))}</strong>
            </article>
            <article>
              <small>Valores em aberto</small>
              <strong>{money(sum('bo-recebimentos', 'open'))}</strong>
            </article>
          </div>
          <Panel title="Carteira e implantação">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Unidades previstas</th>
                    <th>Etapas concluídas</th>
                    <th>Chamados abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {records
                    .filter((r) => r.module === 'bo-municipios')
                    .map((r) => (
                      <tr key={r.id}>
                        <td>{r.values.name}</td>
                        <td>{r.values.units}</td>
                        <td>
                          {
                            records.filter(
                              (x) =>
                                x.module === 'bo-implantacao' &&
                                x.values.client === r.id &&
                                x.status === 'done',
                            ).length
                          }
                        </td>
                        <td>
                          {
                            records.filter(
                              (x) =>
                                x.module === 'bo-suporte' &&
                                x.values.client === r.id &&
                                !['done', 'cancelled'].includes(x.status),
                            ).length
                          }
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Notice>
            {id === 'bo-uso'
              ? 'A telemetria de uso real, contas ativas e disponibilidade ainda não está conectada. Este painel acompanha o que foi cadastrado na carteira e na implantação.'
              : 'Valores declarados manualmente, sem conciliação bancária, cobrança ou acesso aos prontuários das prefeituras.'}
          </Notice>
          <Link to="/modulos" className="button secondary">
            Abrir módulos da empresa
          </Link>
        </>
      )}
    </>
  );
}
