import { DispensationHistory } from './DispensationHistory';
import { prescriptionProgress } from '../domain/pharmacy';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FilePlus2, FlaskConical, Pill, Printer } from 'lucide-react';
import { useApp } from '../app/context';
import { can, type Encounter } from '../domain/model';
import { demoIdentities } from '../domain/access';
import {
  documentNames,
  type ClinicalDocument,
  type DocumentContent,
  type DocumentKind,
  type MedicationLine,
  type ExamLine,
} from '../domain/clinical-documents';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import { ActionForm, Badge, Button, Field, Modal, Notice, Panel, valueOf } from './ui';
import '../styles/clinical-documents.css';

const blankMedication = (): MedicationLine => ({
  id: crypto.randomUUID(),
  medicine: '',
  strength: '',
  form: '',
  dose: '',
  route: '',
  frequency: '',
  duration: '',
  quantity: '',
  quantityUnit: '',
  instructions: '',
});
const blankExam = (): ExamLine => ({ id: crypto.randomUUID(), name: '', material: '', notes: '' });
const blankContent = (kind: DocumentKind): DocumentContent =>
  kind === 'attendance'
    ? { kind, from: '', until: '' }
    : kind === 'certificate'
      ? { kind, startDate: '', days: '' }
      : kind === 'prescription'
        ? { kind, items: [blankMedication()], orientations: '' }
        : kind === 'exams'
          ? { kind, items: [blankExam()], indication: '', priority: 'routine', priorityReason: '' }
          : {
              kind,
              specialty: '',
              destination: '',
              reason: '',
              summary: '',
              priority: 'routine',
              priorityReason: '',
            };
export const documentStatus = (s: ClinicalDocument['status']) =>
  ({
    draft: 'Rascunho',
    issued: 'Emitido na demonstração',
    cancelled: 'Cancelado',
    discarded: 'Rascunho descartado',
  })[s];

export function DocumentBody({ content }: { content: DocumentContent }) {
  if (content.kind === 'certificate')
    return (
      <div className="document-body">
        <h3>Período de afastamento</h3>
        <p>
          {content.days || '—'} dia(s) a partir de{' '}
          {content.startDate ? shortDate(content.startDate) : 'data pendente'}.
        </p>
      </div>
    );
  if (content.kind === 'attendance') {
    const stamp = (v: string) =>
      v ? shortDate(v.slice(0, 10)) + ' às ' + v.slice(11) : 'horário pendente';
    return (
      <div className="document-body">
        <h3>Período de comparecimento</h3>
        <p>
          De {stamp(content.from)} até {stamp(content.until)}.
        </p>
      </div>
    );
  }
  if (content.kind === 'prescription')
    return (
      <div className="document-body">
        <ol className="prescription-items">
          {content.items.map((item, index) => (
            <li key={item.id}>
              <h3>
                {index + 1}. {item.medicine || 'Medicamento não preenchido'}{' '}
                <span>
                  {item.strength} · {item.form}
                </span>
              </h3>
              <dl>
                <div>
                  <dt>Dose por administração</dt>
                  <dd>{item.dose || 'Não preenchida'}</dd>
                </div>
                <div>
                  <dt>Via</dt>
                  <dd>{item.route || 'Não preenchida'}</dd>
                </div>
                <div>
                  <dt>Frequência</dt>
                  <dd>{item.frequency || 'Não preenchida'}</dd>
                </div>
                <div>
                  <dt>Duração</dt>
                  <dd>{item.duration || 'Não preenchida'}</dd>
                </div>
                <div>
                  <dt>Quantidade prescrita</dt>
                  <dd>
                    {item.quantity || '—'} {item.quantityUnit}
                  </dd>
                </div>
              </dl>
              {item.instructions && (
                <p>
                  <strong>Orientação:</strong> {item.instructions}
                </p>
              )}
            </li>
          ))}
        </ol>
        {content.orientations && (
          <section>
            <h3>Orientações gerais</h3>
            <p>{content.orientations}</p>
          </section>
        )}
      </div>
    );
  if (content.kind === 'exams')
    return (
      <div className="document-body">
        <section>
          <h3>Indicação</h3>
          <p>{content.indication || 'Não preenchida'}</p>
        </section>
        <p>
          <strong>Prioridade informada:</strong>{' '}
          {content.priority === 'urgent' ? 'Urgente' : 'Rotina'}
          {content.priorityReason && ` · ${content.priorityReason}`}
        </p>
        <ol className="exam-print-items">
          {content.items.map((item) => (
            <li key={item.id}>
              <strong>{item.name || 'Exame não preenchido'}</strong>
              {item.material && <span>Material / região: {item.material}</span>}
              {item.notes && <p>{item.notes}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  return (
    <div className="document-body">
      <dl>
        <div>
          <dt>Especialidade / serviço solicitado</dt>
          <dd>{content.specialty || 'Não preenchido'}</dd>
        </div>
        <div>
          <dt>Destino solicitado</dt>
          <dd>{content.destination || 'Não preenchido'}</dd>
        </div>
        <div>
          <dt>Prioridade informada</dt>
          <dd>
            {content.priority === 'urgent' ? 'Urgente' : 'Rotina'}
            {content.priorityReason && ` · ${content.priorityReason}`}
          </dd>
        </div>
      </dl>
      <section>
        <h3>Justificativa</h3>
        <p>{content.reason || 'Não preenchida'}</p>
      </section>
      {content.summary && (
        <section>
          <h3>Resumo para continuidade do cuidado</h3>
          <p>{content.summary}</p>
        </section>
      )}
    </div>
  );
}

export function EncounterDocuments({
  encounter,
  onChanged,
  onDirtyChange,
}: {
  encounter: Encounter;
  onChanged: (previous: number) => void;
  onDirtyChange: (value: boolean) => void;
}) {
  const { data, context, repository, notify } = useApp();
  const [editor, setEditor] = useState<{
      kind: DocumentKind;
      doc?: ClinicalDocument;
      copy?: DocumentContent;
    } | null>(null),
    [reviewId, setReviewId] = useState(''),
    [action, setAction] = useState<{ doc: ClinicalDocument; discard: boolean } | null>(null);
  const docs = data.clinicalDocuments.filter((d) => d.encounterId === encounter.id);
  const canCreate =
    context.role === 'clinical' &&
    encounter.professionalId === context.sessionId &&
    ['in-care', 'observation'].includes(encounter.status);
  const review = data.clinicalDocuments.find((d) => d.id === reviewId),
    patient = data.patients.find((p) => p.id === encounter.patientId)!;
  const closeEditor = () => {
    setEditor(null);
    onDirtyChange(false);
  };
  const identities = demoIdentities(repository.directory());
  const draftCount = docs.filter((d) => d.status === 'draft').length;
  return (
    <Panel
      title="Documentos do consultório"
      subtitle="Documentos vinculados a este atendimento e preservados no histórico da pessoa."
      className="clinical-documents-panel"
    >
      <div className="document-launchers">
        {(
          [
            {
              kind: 'prescription',
              label: 'Nova receita',
              detail: 'Medicamentos e orientações',
              Icon: Pill,
            },
            {
              kind: 'exams',
              label: 'Pedir exames',
              detail: 'Itens, indicação e acompanhamento',
              Icon: FlaskConical,
            },
            {
              kind: 'certificate',
              label: 'Emitir atestado',
              detail: 'Período de afastamento',
              Icon: FilePlus2,
            },
            {
              kind: 'attendance',
              label: 'Declarar comparecimento',
              detail: 'Datas e horários na unidade',
              Icon: FilePlus2,
            },
            {
              kind: 'referral',
              label: 'Encaminhar',
              detail: 'Solicitação ligada à regulação',
              Icon: ClipboardList,
            },
          ] as const
        ).map(({ kind, label, detail, Icon }) => (
          <button
            key={kind}
            aria-label={label}
            disabled={!canCreate}
            onClick={() => {
              const stamp = (iso: string) => dateKey(new Date(iso)) + 'T' + clockTime(iso);
              const copy =
                kind === 'attendance'
                  ? {
                      kind,
                      from: stamp(encounter.arrivedAt),
                      until: stamp(new Date().toISOString()),
                    }
                  : blankContent(kind);
              setEditor({ kind, copy });
            }}
          >
            <Icon size={23} />
            <strong>{label}</strong>
            <span>{detail}</span>
          </button>
        ))}
      </div>
      {!canCreate && (
        <p className="document-caption">
          {encounter.status === 'completed'
            ? 'Atendimento concluído. Os documentos emitidos permanecem disponíveis.'
            : context.role !== 'clinical'
              ? 'Nesta versão, a emissão é feita pelo perfil médico. A enfermagem consulta os documentos emitidos.'
              : 'Inicie ou assuma o atendimento para criar documentos.'}
        </p>
      )}
      {draftCount > 0 && (
        <div className="panel-body">
          <Notice tone="amber">
            {draftCount} documento(s) em rascunho. Revise e emita ou descarte antes de concluir o
            atendimento.
          </Notice>
        </div>
      )}
      <div className="clinical-document-list">
        {[...docs].reverse().map((doc) => (
          <article key={doc.id} data-testid={`document-${doc.id}`}>
            <div className="clinical-document-heading">
              <span className="document-kind-icon">
                <FilePlus2 size={20} />
              </span>
              <div>
                <strong>
                  {documentNames[doc.content.kind]} · {doc.number ?? 'rascunho'}
                </strong>
                <small>
                  {shortDate(doc.updatedAt)} · {clockTime(doc.updatedAt)} ·{' '}
                  {doc.content.kind === 'referral'
                    ? doc.content.specialty || 'Especialidade pendente'
                    : 'items' in doc.content
                      ? `${doc.content.items.length} item(ns)`
                      : documentNames[doc.content.kind]}
                </small>
              </div>
              <Badge
                tone={
                  doc.status === 'issued' ? 'green' : doc.status === 'draft' ? 'amber' : 'neutral'
                }
              >
                {documentStatus(doc.status)}
              </Badge>
            </div>
            {doc.content.kind === 'prescription' && doc.issuedAt && (
              <p className="document-caption">
                Farmácia:{' '}
                {data.dispensations.some((d) => d.documentId === doc.id)
                  ? prescriptionProgress(doc, data.dispensations).items.every(
                      (i) => i.remaining === 0,
                    )
                    ? 'entrega concluída'
                    : 'entrega parcial registrada'
                  : 'nenhuma entrega registrada'}
                {doc.status === 'cancelled' ? ' · novas entregas bloqueadas' : ''}
              </p>
            )}
            <div className="row-actions document-row-actions">
              <Button variant="secondary" onClick={() => setReviewId(doc.id)}>
                {doc.status === 'draft' ? 'Revisar documento' : 'Ver documento'}
              </Button>
              {doc.status === 'draft' && canCreate && doc.authorId === context.sessionId && (
                <Button
                  variant="secondary"
                  onClick={() => setEditor({ kind: doc.content.kind, doc })}
                >
                  Editar rascunho
                </Button>
              )}
              {doc.status === 'draft' && canCreate && (
                <button className="text-button" onClick={() => setAction({ doc, discard: true })}>
                  Descartar rascunho
                </button>
              )}
              {doc.number && (
                <Link className="button secondary" target="_blank" to={`/documentos/${doc.id}`}>
                  <Printer size={15} />
                  Abrir impressão
                </Link>
              )}
              {doc.status === 'issued' && doc.content.kind === 'exams' && (
                <Link className="button secondary" to={`/exames?pedido=${doc.id}`}>
                  Acompanhar exames
                </Link>
              )}
              {doc.status === 'issued' && doc.referralId && can(context.role, 'regulation') && (
                <Link
                  className="button secondary"
                  to={`/regulacao?encaminhamento=${doc.referralId}`}
                >
                  Ver na regulação
                </Link>
              )}
              {canCreate && doc.status !== 'draft' && (
                <button
                  className="text-button"
                  onClick={() => setEditor({ kind: doc.content.kind, copy: doc.content })}
                >
                  Copiar para novo rascunho
                </button>
              )}
              {doc.status === 'issued' &&
                doc.authorId === context.sessionId &&
                context.role === 'clinical' && (
                  <button
                    className="text-button"
                    onClick={() => setAction({ doc, discard: false })}
                  >
                    Cancelar documento
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
      {!docs.length && (
        <p className="panel-empty">
          As receitas, os pedidos e os encaminhamentos criados aqui aparecem nesta lista.
        </p>
      )}
      <p className="document-caption">
        Demonstração com preenchimento pelo profissional. Sem assinatura digital, validação de
        interações ou envio a farmácias e laboratórios.
      </p>
      {editor && (
        <DocumentEditor
          encounter={encounter}
          initial={editor.doc?.content ?? editor.copy ?? blankContent(editor.kind)}
          doc={editor.doc}
          onClose={closeEditor}
          onChanged={onChanged}
          onDirtyChange={onDirtyChange}
          onSaved={(id) => {
            closeEditor();
            setReviewId(id);
          }}
        />
      )}
      {review && (
        <Modal
          wide
          title={`${documentNames[review.content.kind]} · revisão`}
          description={
            review.identity
              ? `${review.identity.socialName || review.identity.name} · ${review.identity.unit}`
              : `${patient.socialName || patient.name} · confira todos os itens antes da emissão.`
          }
          onClose={() => setReviewId('')}
        >
          <div className="panel-body">
            <Badge tone={review.status === 'issued' ? 'green' : 'amber'}>
              {documentStatus(review.status)}
            </Badge>
            <DocumentBody content={review.content} />
            {review.status === 'cancelled' || review.status === 'discarded' ? (
              <Notice tone="amber">{review.history.at(-1)?.reason}</Notice>
            ) : null}
            <details className="document-history">
              <summary>Histórico do documento</summary>
              <ol>
                {review.history.map((h, i) => (
                  <li key={i}>
                    {shortDate(h.at)} · {clockTime(h.at)} ·{' '}
                    {
                      {
                        created: 'Rascunho criado',
                        updated: 'Rascunho atualizado',
                        issued: 'Emissão de demonstração',
                        cancelled: 'Cancelado',
                        discarded: 'Descartado',
                      }[h.action]
                    }
                    {h.reason && ` · ${h.reason}`} ·{' '}
                    {identities.find((i) => i.sessionId === h.actorId)?.name}
                  </li>
                ))}
              </ol>
            </details>
          </div>
          {review.status === 'draft' && canCreate && review.authorId === context.sessionId ? (
            <ActionForm
              onClose={() => setReviewId('')}
              submitLabel="Emitir demonstração"
              onSubmit={async (f) => {
                const previous = repository.getRevision();
                await repository.execute(context, {
                  type: 'document.issue',
                  id: review.id,
                  expectedVersion: review.version,
                  reviewed: f.get('reviewed') === 'on',
                });
                onChanged(previous);
                notify('Documento emitido na demonstração. O conteúdo foi preservado.');
              }}
            >
              {review.content.kind === 'prescription' && (
                <Notice>
                  {patient.allergies.length
                    ? `Alergias registradas: ${patient.allergies.join('; ')}`
                    : 'Não há informação de alergias no cadastro; isso não confirma ausência de alergia.'}
                </Notice>
              )}
              <label className="document-check">
                <input name="reviewed" type="checkbox" required />
                Revisei a pessoa, os itens e as orientações
                {review.content.kind === 'prescription'
                  ? ', incluindo as informações de alergias'
                  : ''}
              </label>
              <Notice>
                Documento de teste, sem assinatura e sem validade para atendimento real.
              </Notice>
            </ActionForm>
          ) : (
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setReviewId('')}>
                Fechar documento
              </Button>
              {review.number && (
                <Link className="button primary" target="_blank" to={`/documentos/${review.id}`}>
                  Abrir impressão
                </Link>
              )}
            </div>
          )}
        </Modal>
      )}
      {action && (
        <Modal
          title={action.discard ? 'Descartar rascunho' : 'Cancelar documento'}
          description="O conteúdo e a justificativa permanecerão no histórico."
          onClose={() => setAction(null)}
        >
          <ActionForm
            onClose={() => setAction(null)}
            submitLabel={action.discard ? 'Confirmar descarte' : 'Confirmar cancelamento'}
            onSubmit={async (f) => {
              const previous = repository.getRevision();
              await repository.execute(context, {
                type: action.discard ? 'document.discard' : 'document.cancel',
                id: action.doc.id,
                expectedVersion: action.doc.version,
                reason: valueOf(f, 'reason'),
              });
              onChanged(previous);
              notify('Situação atualizada; histórico preservado.');
            }}
          >
            <Field label="Justificativa">
              <textarea name="reason" required maxLength={1000} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </Panel>
  );
}

function DocumentEditor({
  encounter,
  initial,
  doc,
  onClose,
  onSaved,
  onChanged,
  onDirtyChange,
}: {
  encounter: Encounter;
  initial: DocumentContent;
  doc?: ClinicalDocument;
  onClose: () => void;
  onSaved: (id: string) => void;
  onChanged: (previous: number) => void;
  onDirtyChange: (value: boolean) => void;
}) {
  const { context, repository, notify } = useApp();
  const [content, setContent] = useState<DocumentContent>(() => structuredClone(initial)),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const dirty = JSON.stringify(content) !== JSON.stringify(initial);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const close = () => {
    if (
      !pending &&
      (!dirty || window.confirm('Descartar as alterações não salvas deste documento?'))
    )
      onClose();
  };
  const patchMedication = (id: string, key: keyof MedicationLine, value: string) => {
    if (content.kind === 'prescription')
      setContent({
        ...content,
        items: content.items.map((i) => (i.id === id ? { ...i, [key]: value } : i)),
      });
  };
  const patchExam = (id: string, key: keyof ExamLine, value: string) => {
    if (content.kind === 'exams')
      setContent({
        ...content,
        items: content.items.map((i) => (i.id === id ? { ...i, [key]: value } : i)),
      });
  };
  const fields: [keyof MedicationLine, string, number][] = [
    ['medicine', 'Medicamento', 200],
    ['strength', 'Concentração', 100],
    ['form', 'Apresentação', 100],
    ['dose', 'Dose por administração', 200],
    ['route', 'Via de administração', 100],
    ['frequency', 'Frequência', 200],
    ['duration', 'Duração', 200],
    ['quantity', 'Quantidade', 8],
    ['quantityUnit', 'Unidade da quantidade', 100],
    ['instructions', 'Orientação do item', 1000],
  ];
  return (
    <Modal
      wide
      title={`${doc ? 'Editar' : 'Criar'} ${documentNames[content.kind].toLocaleLowerCase('pt-BR')}`}
      description="Salve como rascunho e revise antes de emitir. Preencha somente dados fictícios."
      onClose={close}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError('');
          const previous = repository.getRevision();
          try {
            const id = await repository.execute(context, {
              type: 'document.save',
              id: doc?.id,
              expectedVersion: doc?.version ?? 0,
              encounterId: encounter.id,
              content,
            });
            onChanged(previous);
            onDirtyChange(false);
            notify('Rascunho salvo. Revise para emitir.');
            onSaved(id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset className="form-fields document-editor-fields" disabled={pending}>
          {content.kind === 'prescription' && (
            <>
              {content.items.map((item, index) => (
                <section className="document-edit-item" key={item.id}>
                  <div className="document-item-heading">
                    <h3>Medicamento {index + 1}</h3>
                    <button
                      type="button"
                      className="text-button"
                      disabled={content.items.length === 1}
                      onClick={() =>
                        setContent({
                          ...content,
                          items: content.items.filter((i) => i.id !== item.id),
                        })
                      }
                    >
                      Remover medicamento {index + 1}
                    </button>
                  </div>
                  <div className="form-grid">
                    {fields.map(([key, label, max]) => (
                      <Field key={key} label={`${label} · item ${index + 1}`}>
                        <input
                          value={item[key]}
                          maxLength={max}
                          inputMode={key === 'quantity' ? 'numeric' : undefined}
                          onChange={(e) => patchMedication(item.id, key, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                </section>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={content.items.length >= 20}
                onClick={() =>
                  setContent({ ...content, items: [...content.items, blankMedication()] })
                }
              >
                Adicionar medicamento
              </Button>
              <Field label="Orientações gerais">
                <textarea
                  value={content.orientations}
                  maxLength={3000}
                  rows={3}
                  onChange={(e) => setContent({ ...content, orientations: e.target.value })}
                />
              </Field>
              <Notice>
                As doses, vias, frequências e durações são registradas pelo profissional. Não há
                cálculo, sugestão terapêutica ou validação de interação medicamentosa nesta versão.
                Receituários especiais ainda não estão disponíveis.
              </Notice>
            </>
          )}
          {content.kind === 'exams' && (
            <>
              {content.items.map((item, index) => (
                <section className="document-edit-item" key={item.id}>
                  <div className="document-item-heading">
                    <h3>Exame {index + 1}</h3>
                    <button
                      type="button"
                      className="text-button"
                      disabled={content.items.length === 1}
                      onClick={() =>
                        setContent({
                          ...content,
                          items: content.items.filter((i) => i.id !== item.id),
                        })
                      }
                    >
                      Remover exame {index + 1}
                    </button>
                  </div>
                  <Field label={`Nome do exame · item ${index + 1}`}>
                    <input
                      value={item.name}
                      maxLength={200}
                      onChange={(e) => patchExam(item.id, 'name', e.target.value)}
                    />
                  </Field>
                  <Field label={`Material ou região · item ${index + 1}`}>
                    <input
                      value={item.material}
                      maxLength={200}
                      onChange={(e) => patchExam(item.id, 'material', e.target.value)}
                    />
                  </Field>
                  <Field label={`Observações · item ${index + 1}`}>
                    <textarea
                      value={item.notes}
                      maxLength={1000}
                      onChange={(e) => patchExam(item.id, 'notes', e.target.value)}
                    />
                  </Field>
                </section>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={content.items.length >= 20}
                onClick={() => setContent({ ...content, items: [...content.items, blankExam()] })}
              >
                Adicionar exame
              </Button>
              <Field label="Indicação do pedido">
                <textarea
                  value={content.indication}
                  maxLength={3000}
                  onChange={(e) => setContent({ ...content, indication: e.target.value })}
                />
              </Field>
            </>
          )}
          {content.kind === 'referral' && (
            <>
              <div className="form-grid">
                <Field label="Especialidade ou serviço solicitado">
                  <input
                    value={content.specialty}
                    maxLength={160}
                    onChange={(e) => setContent({ ...content, specialty: e.target.value })}
                  />
                </Field>
                <Field label="Destino solicitado">
                  <input
                    value={content.destination}
                    maxLength={200}
                    onChange={(e) => setContent({ ...content, destination: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Justificativa do encaminhamento">
                <textarea
                  value={content.reason}
                  maxLength={3000}
                  rows={4}
                  onChange={(e) => setContent({ ...content, reason: e.target.value })}
                />
              </Field>
              <Field label="Resumo para continuidade do cuidado">
                <textarea
                  value={content.summary}
                  maxLength={4000}
                  rows={4}
                  onChange={(e) => setContent({ ...content, summary: e.target.value })}
                />
              </Field>
              <Notice>
                A emissão cria uma solicitação na regulação desta unidade. Vagas externas e envio ao
                SUS não estão conectados.
              </Notice>
            </>
          )}
          {content.kind === 'certificate' && (
            <>
              <Field label="Data de início do afastamento">
                <input
                  type="date"
                  value={content.startDate}
                  onChange={(e) => setContent({ ...content, startDate: e.target.value })}
                />
              </Field>
              <Field label="Dias de afastamento">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={content.days}
                  onChange={(e) => setContent({ ...content, days: e.target.value })}
                />
              </Field>
            </>
          )}
          {content.kind === 'attendance' && (
            <>
              <Field label="Início do comparecimento">
                <input
                  type="datetime-local"
                  value={content.from}
                  onChange={(e) => setContent({ ...content, from: e.target.value })}
                />
              </Field>
              <Field label="Fim do comparecimento">
                <input
                  type="datetime-local"
                  value={content.until}
                  onChange={(e) => setContent({ ...content, until: e.target.value })}
                />
              </Field>
            </>
          )}
          {(content.kind === 'exams' || content.kind === 'referral') && (
            <>
              <Field label="Prioridade informada pelo médico">
                <select
                  value={content.priority}
                  onChange={(e) =>
                    setContent({ ...content, priority: e.target.value as 'routine' | 'urgent' })
                  }
                >
                  <option value="routine">Rotina</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
              {content.priority === 'urgent' && (
                <Field label="Justificativa da prioridade">
                  <textarea
                    value={content.priorityReason}
                    maxLength={1000}
                    onChange={(e) => setContent({ ...content, priorityReason: e.target.value })}
                  />
                </Field>
              )}
            </>
          )}
        </fieldset>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={pending} onClick={close}>
            Voltar sem salvar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar documento em rascunho'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PatientDocumentHistory({ patientId }: { patientId: string }) {
  const { data } = useApp();
  const docs = data.clinicalDocuments
    .filter((d) => d.patientId === patientId && !!d.issuedAt)
    .sort((a, b) => b.issuedAt!.localeCompare(a.issuedAt!));
  return (
    <Panel
      title="Documentos clínicos da prefeitura"
      subtitle="Documentos emitidos nas unidades desta prefeitura; alterações permanecem restritas à unidade de origem."
    >
      <div className="clinical-document-list">
        {docs.map((doc) => (
          <article key={doc.id}>
            <div className="clinical-document-heading">
              <div>
                <strong>
                  {documentNames[doc.content.kind]} · {doc.number}
                </strong>
                <small>
                  {shortDate(doc.issuedAt!)} · {doc.identity?.unit} · {doc.identity?.professional}
                </small>
              </div>
              <Badge tone={doc.status === 'cancelled' ? 'amber' : 'green'}>
                {documentStatus(doc.status)}
              </Badge>
            </div>
            <Link className="button secondary" to={`/documentos/${doc.id}`} target="_blank">
              Ver documento preservado
            </Link>
            {doc.content.kind === 'prescription' && (
              <details className="document-history">
                <summary>Entregas da farmácia</summary>
                <DispensationHistory document={doc} />
              </details>
            )}
            {doc.examEvents.length > 0 && (
              <details className="document-history">
                <summary>Resultados e acompanhamento dos exames</summary>
                <ol>
                  {doc.examEvents.map((event) => (
                    <li key={event.id}>
                      <strong>
                        {doc.content.kind === 'exams'
                          ? doc.content.items.find((item) => item.id === event.itemId)?.name
                          : ''}{' '}
                        · {shortDate(event.date)} ·{' '}
                        {
                          {
                            scheduled: 'Agendado',
                            performed: 'Realizado',
                            result: 'Resultado registrado',
                            reviewed: 'Revisão médica',
                          }[event.kind]
                        }
                      </strong>
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {doc.referralId && data.referrals.find((r) => r.id === doc.referralId)?.response && (
              <div className="referral-response">
                <strong>
                  Retorno do serviço ·{' '}
                  {shortDate(data.referrals.find((r) => r.id === doc.referralId)!.response!.date)}
                </strong>
                <p>{data.referrals.find((r) => r.id === doc.referralId)!.response!.summary}</p>
              </div>
            )}
          </article>
        ))}
      </div>
      {!docs.length && <p className="panel-empty">Nenhum documento emitido para esta pessoa.</p>}
    </Panel>
  );
}
