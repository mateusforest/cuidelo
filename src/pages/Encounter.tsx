import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, Clock3, FileCheck2 } from 'lucide-react';
import { useApp } from '../app/context';
import { DoctorCall } from './PatientFlow';
import { emptySoap, type Soap } from '../domain/model';
import { ageAt, clockTime, shortDate } from '../domain/dates';
import { Avatar, Badge, Button, EmptyState, Field, Notice, Panel } from '../components/ui';
import { IntakeHistory, NoteAddenda } from '../components/ClinicalHistory';

const labels: Record<keyof Soap, { title: string; hint: string }> = {
  subjective: { title: 'S · Subjetivo', hint: 'Relato e contexto trazidos pela pessoa.' },
  objective: { title: 'O · Objetivo', hint: 'Observações e achados registrados pela equipe.' },
  assessment: { title: 'A · Avaliação', hint: 'Avaliação do profissional responsável.' },
  plan: { title: 'P · Plano', hint: 'Condutas e acompanhamento definidos pelo profissional.' },
};
export function EncounterPage() {
  const { id } = useParams();
  return <EncounterEditor key={id} id={id} />;
}
function EncounterEditor({ id }: { id?: string }) {
  const { data, context, repository, notify, setDirty } = useApp();
  const encounter = data.encounters.find((e) => e.id === id),
    patient = data.patients.find((p) => p.id === encounter?.patientId),
    note = data.notes.find((n) => n.encounterId === id);
  const [soap, setSoap] = useState<Soap>(note?.soap ?? emptySoap()),
    [baseline, setBaseline] = useState(JSON.stringify(note?.soap ?? emptySoap())),
    [baseRevision, setBaseRevision] = useState(repository.getRevision()),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const [addendumText, setAddendumText] = useState(''),
    [addendumReason, setAddendumReason] = useState('');
  const intakes = data.intakes.filter((r) => r.encounterId === id);
  const finalized = encounter?.status === 'completed',
    dirty = JSON.stringify(soap) !== baseline || !!(addendumText || addendumReason);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  if (!encounter || !patient)
    return (
      <EmptyState
        title="Atendimento não encontrado nesta unidade"
        description="Confira o contexto selecionado e abra o atendimento pela recepção."
        action={
          <Link className="button secondary" to="/recepcao">
            Voltar à recepção
          </Link>
        }
      />
    );
  const save = async (finalize = false) => {
    setPending(true);
    setError('');
    try {
      if (finalize && (!soap.assessment.trim() || !soap.plan.trim()))
        throw new Error('Preencha a avaliação e o plano antes de concluir.');
      await repository.execute(
        context,
        { type: 'note.save', encounterId: encounter.id, soap },
        baseRevision,
      );
      setBaseline(JSON.stringify(soap));
      setDirty(false);
      setBaseRevision(repository.getRevision());
      if (finalize) {
        await repository.execute(context, { type: 'note.finalize', encounterId: encounter.id });
        setBaseRevision(repository.getRevision());
      }
      notify(
        finalize
          ? 'Registro concluído no ambiente de demonstração.'
          : 'Rascunho salvo neste navegador.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const observe = async () => {
    setPending(true);
    try {
      if (dirty) throw new Error('Salve o rascunho antes de encaminhar à observação.');
      await repository.execute(context, { type: 'encounter.observe', id: encounter.id });
      setBaseRevision(repository.getRevision());
      notify('Atendimento encaminhado à observação.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const unit = data.units.find((u) => u.id === context.unitId);
  const canEdit = encounter.professionalId === context.sessionId;
  const addendum = async () => {
    if (!note) return;
    setPending(true);
    setError('');
    try {
      await repository.execute(context, {
        type: 'note.addendum',
        noteId: note.id,
        text: addendumText,
        reason: addendumReason,
      });
      setAddendumText('');
      setAddendumReason('');
      setDirty(false);
      notify('Complemento salvo. O registro original permanece preservado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Link className="back-link" to="/recepcao">
        <ArrowLeft size={16} />
        Recepção e atendimento
      </Link>
      <div className="patient-hero">
        <Avatar name={patient.socialName || patient.name} />
        <div>
          <span className="eyebrow">{patient.record} · ATENDIMENTO DE DEMONSTRAÇÃO</span>
          <h1>{patient.socialName || patient.name}</h1>
          <p>
            {ageAt(patient.birthDate)} anos · {shortDate(patient.birthDate)} · {encounter.service}
          </p>
        </div>
        <Badge tone={finalized ? 'green' : 'blue'}>
          {finalized
            ? 'Registro concluído'
            : encounter.status === 'observation'
              ? 'Em observação'
              : 'Em atendimento'}
        </Badge>
      </div>
      <div className="clinical-grid">
        <div>
          <DoctorCall
            encounter={encounter}
            onChange={(previousRevision) =>
              setBaseRevision((current) =>
                current === previousRevision ? repository.getRevision() : current,
              )
            }
          />
          <div className="clinical-record-links">
            <Link className="button secondary" to={`/escuta/${encounter.id}`}>
              Escuta e novas aferições
            </Link>
          </div>
          {intakes.length > 0 && (
            <Panel
              title="Escuta e sinais vitais"
              subtitle="Informações registradas pela equipe, com horário e autoria."
            >
              <IntakeHistory records={intakes} />
            </Panel>
          )}
          <Panel
            title="Registro do atendimento"
            subtitle="SOAP · campos preenchidos pelo profissional responsável."
            action={
              <span className="save-state">
                {finalized ? (
                  <>
                    <FileCheck2 size={15} />
                    Finalizado
                  </>
                ) : dirty ? (
                  'Alterações não salvas'
                ) : note ? (
                  `Salvo às ${clockTime(note.updatedAt)}`
                ) : (
                  'Novo registro'
                )}
              </span>
            }
          >
            {finalized && (
              <div className="panel-body">
                <Notice>
                  Registro preservado após a conclusão. Esta demonstração não possui assinatura
                  digital nem validade de prontuário operacional.
                </Notice>
              </div>
            )}
            <fieldset className="soap-fields" disabled={pending || finalized || !canEdit}>
              {(Object.keys(labels) as (keyof Soap)[]).map((key) => (
                <Field key={key} label={labels[key].title} hint={labels[key].hint}>
                  <textarea
                    aria-label={labels[key].title}
                    rows={5}
                    maxLength={10000}
                    value={soap[key]}
                    onChange={(e) => setSoap({ ...soap, [key]: e.target.value })}
                    placeholder="Registrar informação fictícia para testar o fluxo…"
                  />
                </Field>
              ))}
            </fieldset>
            {error && !finalized && (
              <div className="form-error" role="alert">
                {error}
                {error.includes('dados') && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Descartar as alterações deste formulário e carregar o último rascunho salvo?',
                        )
                      )
                        return;
                      const latest =
                        repository
                          .snapshot(context)
                          .notes.find((n) => n.encounterId === encounter.id)?.soap ?? emptySoap();
                      setSoap(latest);
                      setBaseline(JSON.stringify(latest));
                      setDirty(false);
                      setBaseRevision(repository.getRevision());
                      setError('');
                    }}
                  >
                    Recarregar rascunho salvo
                  </button>
                )}
              </div>
            )}
            {!finalized && (
              <div className="clinical-actions">
                <span>
                  <Clock3 size={15} />
                  Chegada às {clockTime(encounter.arrivedAt)}
                </span>
                <div>
                  <Button
                    variant="secondary"
                    disabled={pending || encounter.status === 'waiting' || !canEdit}
                    onClick={() => save()}
                  >
                    <Save size={16} />
                    Salvar rascunho
                  </Button>
                  <Button
                    disabled={pending || encounter.status === 'waiting' || !canEdit}
                    onClick={() => save(true)}
                  >
                    <CheckCircle2 size={16} />
                    Salvar e concluir
                  </Button>
                </div>
              </div>
            )}
          </Panel>
          {finalized && note && (
            <Panel
              title="Complementos do registro"
              subtitle="Acrescente informações ou correções com justificativa. O SOAP concluído permanece intacto."
            >
              <NoteAddenda items={data.addenda.filter((a) => a.noteId === note.id)} />
              <form
                className="clinical-addendum-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addendum();
                }}
              >
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <fieldset disabled={pending} className="intake-fields" style={{ padding: 0 }}>
                  <Field label="Motivo do complemento">
                    <input
                      value={addendumReason}
                      onChange={(e) => setAddendumReason(e.target.value)}
                      required
                      maxLength={1000}
                    />
                  </Field>
                  <Field label="Texto do complemento">
                    <textarea
                      value={addendumText}
                      onChange={(e) => setAddendumText(e.target.value)}
                      required
                      maxLength={10000}
                      rows={4}
                    />
                  </Field>
                  <Button type="submit">
                    <Save size={16} />
                    Registrar complemento
                  </Button>
                </fieldset>
              </form>
            </Panel>
          )}
        </div>
        <aside>
          <Panel title="Resumo da pessoa">
            <dl className="definition-list panel-body">
              <div>
                <dt>Nome civil</dt>
                <dd>{patient.name}</dd>
              </div>
              <div>
                <dt>Data de nascimento</dt>
                <dd>{shortDate(patient.birthDate)}</dd>
              </div>
              <div>
                <dt>Unidade</dt>
                <dd>{unit?.name}</dd>
              </div>
              <div>
                <dt>Contato</dt>
                <dd>{patient.phone || 'Não informado'}</dd>
              </div>
            </dl>
            <div className="panel-link">
              <Link to={`/pessoas/${patient.id}`}>
                Abrir histórico da pessoa
                <ArrowLeft size={14} className="rotate-arrow" />
              </Link>
            </div>
          </Panel>
          <Panel title="Alergias registradas">
            <div className="panel-body">
              {patient.allergies.length ? (
                patient.allergies.map((a) => (
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
          {unit?.kind !== 'ubs' && !finalized && (
            <Panel title="Continuidade do atendimento">
              <div className="panel-body">
                <p className="muted">Acompanhe a pessoa em observação na unidade.</p>
                <Button
                  variant="secondary"
                  disabled={pending || encounter.status !== 'in-care' || !canEdit}
                  onClick={observe}
                >
                  Encaminhar à observação
                </Button>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
