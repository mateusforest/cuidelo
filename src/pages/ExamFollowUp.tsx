import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useApp } from '../app/context';
import { examState, type ClinicalDocument, type ExamEvent } from '../domain/clinical-documents';
import { dateKey, shortDate, clockTime } from '../domain/dates';
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
  const visible = entries.filter(
    (e) =>
      (filter === 'all' || e.state === filter) &&
      `${e.doc.identity?.name} ${e.doc.identity?.socialName} ${e.doc.number} ${e.item.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const identities = demoIdentities(repository.directory());
  return (
    <>
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
      <Notice>
        Registros locais preenchidos pela equipe. Agendamento não reserva vaga externa; resultados
        são transcritos manualmente, sem integração com laboratório, imagem ou laudo assinado.
      </Notice>
      <div className="flow-stats">
        {[
          [
            'Solicitados',
            entries.filter((e) => e.state === 'requested' && e.doc.status === 'issued').length,
          ],
          [
            'Agendados',
            entries.filter((e) => e.state === 'scheduled' && e.doc.status === 'issued').length,
          ],
          [
            'Aguardando revisão',
            entries.filter((e) => e.state === 'result' && e.doc.status === 'issued').length,
          ],
          [
            'Revisados',
            entries.filter((e) => e.state === 'reviewed' && e.doc.status === 'issued').length,
          ],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <Panel title="Pedidos da unidade">
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar pessoa, exame ou pedido"
          />
          <Field label="Etapa do exame">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todas as etapas</option>
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
      {action && (
        <Modal
          title={actionLabels[action.kind]}
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
                defaultValue={dateKey()}
                min={
                  action.kind === 'scheduled' ? dateKey() : dateKey(new Date(action.doc.issuedAt!))
                }
                max={action.kind === 'scheduled' ? undefined : dateKey()}
              />
            </Field>
            {action.kind === 'scheduled' && (
              <>
                <Field label="Horário do exame">
                  <input name="time" type="time" required />
                </Field>
                <Field label="Local do exame">
                  <input name="location" required maxLength={200} />
                </Field>
              </>
            )}
            <Field
              label={
                action.kind === 'result'
                  ? 'Resumo transcrito do resultado'
                  : action.kind === 'reviewed'
                    ? 'Revisão e plano de acompanhamento'
                    : 'Observação'
              }
            >
              <textarea
                name="note"
                required={action.kind === 'result' || action.kind === 'reviewed'}
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
    </>
  );
}
