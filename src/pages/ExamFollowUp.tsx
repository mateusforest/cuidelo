import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlaskConical, CalendarDays } from 'lucide-react';
import { useApp } from '../app/context';
import { examState, type ClinicalDocument, type ExamEvent } from '../domain/clinical-documents';
import { dateKey, shortDate, clockTime } from '../domain/dates';
import { normalizedName } from '../domain/identification';
import { lastExamSchedule, examDateOverdue } from '../domain/continuity';
import { demoIdentities } from '../domain/access';
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
  valueOf,
} from '../components/ui';
import '../styles/clinical-documents.css';

const statusLabels = {
  requested: 'Solicitado',
  scheduled: 'Agendado',
  performed: 'Realizado',
  result: 'Resultado registrado',
  reviewed: 'Revisado pelo médico',
};
const actionLabels: Record<ExamEvent['kind'], string> = {
  scheduled: 'Registrar agendamento',
  performed: 'Registrar realização',
  result: 'Registrar resultado',
  reviewed: 'Revisar resultado',
};
export function ExamFollowUp() {
  const { data, context, repository, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [action, setAction] = useState<{
      doc: ClinicalDocument;
      itemId: string;
      name: string;
      kind: ExamEvent['kind'];
    } | null>(null);
  const docs = data.clinicalDocuments.filter(
    (d) =>
      d.unitId === context.unitId &&
      d.content.kind === 'exams' &&
      !!d.issuedAt &&
      (!params.get('pedido') || d.id === params.get('pedido')),
  );
  const entries = docs.flatMap((doc) =>
    doc.content.kind === 'exams'
      ? doc.content.items.map((item) => ({ doc, item, state: examState(doc, item.id) }))
      : [],
  );
  const visible = entries.filter((e) => {
    const matches =
      filter === 'all' ||
      (filter === 'cancelled'
        ? e.doc.status === 'cancelled'
        : e.doc.status === 'issued' &&
          (filter === 'overdue'
            ? examDateOverdue(e.doc, e.item.id, dateKey())
            : e.state === filter));
    return (
      matches &&
      normalizedName(
        `${e.doc.identity?.name} ${e.doc.identity?.socialName} ${e.doc.number} ${e.item.name}`,
      ).includes(normalizedName(search))
    );
  });
  const identities = demoIdentities(repository.directory());
  return (
    <div className="operations-page exams-workspace">
      <PageHeader
        eyebrow="CONTINUIDADE DO CONSULTÓRIO"
        title="Exames e resultados"
        description="Acompanhe cada exame solicitado, registre resultados recebidos e a revisão médica."
        action={
          <Link className="button secondary" to="/consultorio">
            Voltar ao consultório
          </Link>
        }
      />
      <div className="continuity-metrics" aria-label="Etapas dos exames">
        {(
          [
            ['requested', 'Aguardando agendamento'],
            ['scheduled', 'Agendados'],
            ['result', 'Aguardando revisão'],
            ['overdue', 'Data prevista ultrapassada'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
          >
            <span>{label}</span>
            <strong>
              {
                entries.filter(
                  (e) =>
                    e.doc.status === 'issued' &&
                    (key === 'overdue'
                      ? examDateOverdue(e.doc, e.item.id, dateKey())
                      : e.state === key),
                ).length
              }
            </strong>
            <small>Ver exames</small>
          </button>
        ))}
      </div>
      <Panel
        title="Pedidos da unidade"
        subtitle="Acompanhe a próxima etapa de cada exame, do agendamento à revisão."
      >
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar pessoa, exame ou pedido"
          />
          <Field label="Etapa do exame">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todas as etapas</option>
              <option value="overdue">Data prevista ultrapassada</option>
              <option value="cancelled">Pedidos cancelados</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {params.get('pedido') && (
            <button className="text-button" onClick={() => setParams({})}>
              Mostrar todos os pedidos
            </button>
          )}
        </div>
        <div className="exam-followup-list">
          {visible.map(({ doc, item, state }) => (
            <article key={doc.id + item.id} data-testid={`exam-${item.id}`}>
              <div className="clinical-document-heading">
                <span className="document-kind-icon">
                  <FlaskConical size={22} />
                </span>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {doc.identity?.socialName || doc.identity?.name} · {doc.number} ·{' '}
                    {shortDate(doc.issuedAt!)}
                  </small>
                </div>
                <Badge
                  tone={
                    doc.status === 'cancelled' ? 'amber' : state === 'reviewed' ? 'green' : 'blue'
                  }
                >
                  {doc.status === 'cancelled' ? 'Pedido cancelado' : statusLabels[state]}
                </Badge>
              </div>
              {lastExamSchedule(doc, item.id) && (
                <div className="followup-summary">
                  <CalendarDays size={18} />
                  <div>
                    <strong>Último agendamento registrado</strong>
                    <span>
                      {shortDate(lastExamSchedule(doc, item.id)!.date)} às{' '}
                      {lastExamSchedule(doc, item.id)!.time} ·{' '}
                      {lastExamSchedule(doc, item.id)!.location}
                    </span>
                  </div>
                  {examDateOverdue(doc, item.id, dateKey()) && (
                    <small className="followup-alert">
                      Data prevista ultrapassada · conferir situação
                    </small>
                  )}
                </div>
              )}
              {doc.content.kind === 'exams' && (
                <p className="exam-indication">
                  <strong>Indicação:</strong> {doc.content.indication} ·{' '}
                  {doc.content.priority === 'urgent' ? 'Prioridade urgente informada' : 'Rotina'}
                </p>
              )}
              <div className="row-actions">
                {doc.status === 'issued' && (
                  <>
                    {['requested', 'scheduled'].includes(state) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setAction({ doc, itemId: item.id, name: item.name, kind: 'scheduled' })
                        }
                      >
                        {state === 'scheduled' ? 'Reagendar' : 'Registrar agendamento'}
                      </Button>
                    )}
                    {['requested', 'scheduled'].includes(state) && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setAction({ doc, itemId: item.id, name: item.name, kind: 'performed' })
                        }
                      >
                        Registrar realização
                      </Button>
                    )}
                    {state !== 'reviewed' && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setAction({ doc, itemId: item.id, name: item.name, kind: 'result' })
                        }
                      >
                        {state === 'result' ? 'Complementar resultado' : 'Registrar resultado'}
                      </Button>
                    )}
                    {state === 'result' && context.role === 'clinical' && (
                      <Button
                        onClick={() =>
                          setAction({ doc, itemId: item.id, name: item.name, kind: 'reviewed' })
                        }
                      >
                        Revisar resultado
                      </Button>
                    )}
                  </>
                )}
                <Link className="button secondary" target="_blank" to={`/documentos/${doc.id}`}>
                  Ver pedido
                </Link>
              </div>
              {doc.examEvents.some((e) => e.itemId === item.id) && (
                <details
                  className="document-history"
                  open={state === 'result' || state === 'reviewed'}
                >
                  <summary>Histórico e resultado deste exame</summary>
                  <ol>
                    {doc.examEvents
                      .filter((e) => e.itemId === item.id)
                      .map((event) => (
                        <li key={event.id}>
                          <strong>
                            {statusLabels[event.kind]} · {shortDate(event.date)} {event.time}
                          </strong>
                          {event.location && <p>Local: {event.location}</p>}
                          {event.note && <p>{event.note}</p>}
                          <small>
                            {identities.find((i) => i.sessionId === event.actorId)?.name} ·
                            registrado {shortDate(event.at)} às {clockTime(event.at)}
                          </small>
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </article>
          ))}
        </div>
        {!visible.length && (
          <EmptyState
            title="Nenhum exame neste filtro"
            description="Emita um pedido no consultório ou ajuste a busca para acompanhar os exames."
          />
        )}
      </Panel>
      <Notice>
        Registros locais preenchidos pela equipe. Agendamento não reserva vaga externa; resultados
        são transcritos manualmente, sem integração com laboratório, imagem ou laudo assinado. Data
        ultrapassada não confirma ausência ou realização.
      </Notice>
      {action && (
        <Modal
          title={
            action.kind === 'scheduled' && examState(action.doc, action.itemId) === 'scheduled'
              ? 'Reagendar exame'
              : actionLabels[action.kind]
          }
          description={`${action.doc.identity?.socialName || action.doc.identity?.name} · ${action.name}`}
          onClose={() => setAction(null)}
        >
          <ActionForm
            onClose={() => setAction(null)}
            submitLabel="Salvar acompanhamento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'exam.event',
                id: action.doc.id,
                expectedVersion: action.doc.version,
                itemId: action.itemId,
                kind: action.kind,
                date: valueOf(f, 'date'),
                time: valueOf(f, 'time'),
                location: valueOf(f, 'location'),
                note: valueOf(f, 'note'),
              });
              notify('Etapa registrada; histórico anterior preservado.');
            }}
          >
            {action.kind === 'scheduled' && lastExamSchedule(action.doc, action.itemId) && (
              <div className="followup-summary">
                <strong>Agendamento anterior</strong>
                <span>
                  {shortDate(lastExamSchedule(action.doc, action.itemId)!.date)} às{' '}
                  {lastExamSchedule(action.doc, action.itemId)!.time} ·{' '}
                  {lastExamSchedule(action.doc, action.itemId)!.location}
                </span>
              </div>
            )}
            <Field
              label={
                action.kind === 'scheduled'
                  ? 'Data do agendamento'
                  : action.kind === 'reviewed'
                    ? 'Data da revisão'
                    : 'Data da realização / resultado'
              }
            >
              <input
                name="date"
                type="date"
                required
                defaultValue={
                  action.kind === 'scheduled' &&
                  (lastExamSchedule(action.doc, action.itemId)?.date ?? '') >= dateKey()
                    ? lastExamSchedule(action.doc, action.itemId)!.date
                    : dateKey()
                }
                min={
                  action.kind === 'scheduled' ? dateKey() : dateKey(new Date(action.doc.issuedAt!))
                }
                max={action.kind === 'scheduled' ? undefined : dateKey()}
              />
            </Field>
            {action.kind === 'scheduled' && (
              <>
                <Field label="Horário do exame">
                  <input
                    name="time"
                    type="time"
                    required
                    defaultValue={lastExamSchedule(action.doc, action.itemId)?.time}
                  />
                </Field>
                <Field label="Local do exame">
                  <input
                    name="location"
                    required
                    maxLength={200}
                    defaultValue={lastExamSchedule(action.doc, action.itemId)?.location}
                  />
                </Field>
              </>
            )}
            <Field
              label={
                action.kind === 'result'
                  ? 'Resumo transcrito do resultado'
                  : action.kind === 'reviewed'
                    ? 'Revisão e plano de acompanhamento'
                    : action.kind === 'scheduled' &&
                        examState(action.doc, action.itemId) === 'scheduled'
                      ? 'Motivo do reagendamento'
                      : 'Observação'
              }
            >
              <textarea
                name="note"
                required={
                  action.kind === 'result' ||
                  action.kind === 'reviewed' ||
                  (action.kind === 'scheduled' &&
                    examState(action.doc, action.itemId) === 'scheduled')
                }
                rows={5}
                maxLength={5000}
              />
            </Field>
            {action.kind === 'result' && (
              <Notice>
                Registre o conteúdo fictício recebido. Este campo não substitui o laudo de origem
                nem gera interpretação automática.
              </Notice>
            )}
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
