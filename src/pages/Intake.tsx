import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardCheck, HeartPulse, Save } from 'lucide-react';
import { useApp } from '../app/context';
import type { IntakeRecord, Vitals } from '../domain/model';
import { activeIntakes, vitalFields, intakeQueueState } from '../domain/intake';
import { readyForIntake, lastReceptionCheck } from '../domain/reception';
import { TriageCall } from '../components/TriageCall';
import { LiveDuration, duration } from './PatientFlow';
import { normalizedName } from '../domain/identification';
import { ageAt, clockTime, dateKey, shortDate } from '../domain/dates';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  UnitRequired,
} from '../components/ui';
import { IntakeHistory } from '../components/ClinicalHistory';
import '../styles/intake.css';

export function IntakeQueue() {
  const { data } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('pending'),
    [day, setDay] = useState('');
  const hasRecord = (id: string) => data.intakes.some((r) => r.encounterId === id);
  const dated = data.encounters.filter((e) => !day || dateKey(new Date(e.arrivedAt)) === day);
  const stage = (e: (typeof data.encounters)[number]) => intakeQueueState(e, hasRecord(e.id));
  const stageLabel = {
    pending: 'Aguardando escuta',
    active: 'Em escuta',
    recorded: 'Registrada',
    completed: 'Atendimento concluído',
    other: 'Fora da fila de escuta',
  };
  const list = dated
    .filter((e) => {
      const p = data.patients.find((p) => p.id === e.patientId);
      return (
        (filter === 'all' || stage(e) === filter) &&
        normalizedName(`${p?.name} ${p?.socialName} ${e.ticket}`).includes(normalizedName(search))
      );
    })
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  return (
    <div className="operations-page intake-workspace">
      <PageHeader
        eyebrow="ACOLHIMENTO E CONTINUIDADE"
        title="Escuta e sinais vitais"
        description="Registre o motivo da procura e as aferições. A equipe acompanha as informações no atendimento."
        action={
          <Link className="button secondary" to="/recepcao">
            Ver recepção <ArrowRight size={16} />
          </Link>
        }
      />
      <UnitRequired>
        <div className="desk-filters intake-stats">
          {(
            [
              ['pending', 'Aguardando escuta', dated.filter((e) => stage(e) === 'pending').length],
              ['active', 'Em escuta', dated.filter((e) => stage(e) === 'active').length],
              [
                'recorded',
                'Com escuta registrada',
                dated.filter((e) => stage(e) === 'recorded').length,
              ],
              ['all', 'Todos os atendimentos', dated.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              className={filter === key ? 'selected' : ''}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
        <Panel
          title="Pessoas da unidade"
          subtitle="A lista acompanha o atendimento; o registro da escuta não inicia nem encerra a consulta."
        >
          <div className="table-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome ou senha"
            />
            <Field label="Data da chegada (opcional)">
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <span className="result-count">{list.length} atendimentos</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Senha / pessoa</th>
                  <th>Serviço</th>
                  <th>Chegada / tempo</th>
                  <th>Escuta</th>
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
                        <div className="person-link">
                          <Avatar name={p?.socialName || p?.name || ''} />
                          <span>
                            <strong>{p?.socialName || p?.name}</strong>
                            <small>
                              {e.ticket} · {p?.record}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>{e.service}</td>
                      <td>
                        {clockTime(e.arrivedAt)}
                        <small className="cell-secondary">{shortDate(e.arrivedAt)}</small>
                        {stage(e) === 'active' && e.intakeStartedAt ? (
                          <small className="intake-time">
                            <LiveDuration since={e.intakeStartedAt} /> em escuta
                          </small>
                        ) : stage(e) === 'pending' ? (
                          <small className="intake-time">
                            <LiveDuration since={lastReceptionCheck(e)?.at ?? e.arrivedAt} />{' '}
                            aguardando escuta
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <Badge
                          tone={
                            stage(e) === 'recorded'
                              ? 'green'
                              : stage(e) === 'active'
                                ? 'blue'
                                : 'neutral'
                          }
                        >
                          {stageLabel[stage(e)]}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          className={`button ${stage(e) === 'pending' || stage(e) === 'active' ? 'primary' : 'secondary'}`}
                          to={`/escuta/${e.id}`}
                        >
                          {stage(e) === 'active'
                            ? 'Continuar escuta'
                            : stage(e) === 'pending'
                              ? 'Registrar escuta'
                              : stage(e) === 'other'
                                ? 'Ver encaminhamento'
                                : 'Abrir histórico'}
                          <ArrowRight size={15} />
                        </Link>
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
              description="Escolha outro filtro ou registre uma chegada na recepção."
            />
          )}
        </Panel>
        <Notice>
          A classificação clínica de risco ainda depende de protocolo validado. Estas telas
          registram informações e não definem prioridade clínica ou conduta.
        </Notice>
      </UnitRequired>
    </div>
  );
}

export function IntakePage() {
  const { id } = useParams();
  return <IntakeEditor key={id} id={id} />;
}
function IntakeEditor({ id }: { id?: string }) {
  const { data, context, repository, notify, setDirty } = useApp();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const encounter = data.encounters.find((e) => e.id === id),
    patient = data.patients.find((p) => p.id === encounter?.patientId);
  const records = data.intakes.filter((r) => r.encounterId === id),
    latest = activeIntakes(records).at(-1);
  const [complaint, setComplaint] = useState(''),
    [observations, setObservations] = useState(''),
    [values, setValues] = useState<Partial<Record<keyof Vitals, string>>>({}),
    [correcting, setCorrecting] = useState<IntakeRecord | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [baseRevision, setBaseRevision] = useState(repository.getRevision());
  const dirty = !!(complaint || observations || Object.values(values).some(Boolean) || reason),
    completed = encounter?.status === 'completed';
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  if (encounter?.status === 'closed-without-care')
    return (
      <EmptyState
        title="Chegada encerrada sem atendimento"
        description="O motivo e a autoria ficam no percurso da senha na recepção."
      />
    );
  if (!encounter || !patient)
    return (
      <EmptyState
        title="Atendimento não encontrado nesta unidade"
        description="Selecione a unidade correspondente ou abra uma pessoa pela fila de escuta."
        action={
          <Link className="button secondary" to="/escuta">
            Voltar à escuta
          </Link>
        }
      />
    );
  if (!records.length && !readyForIntake(encounter))
    return (
      <>
        <PageHeader
          title="Conferência da recepção pendente"
          description="A pessoa precisa ser conferida e encaminhada à triagem antes de iniciar esta etapa."
        />
        <Link className="button secondary" to="/recepcao">
          Voltar à recepção
        </Link>
      </>
    );
  const clear = () => {
    setComplaint('');
    setObservations('');
    setValues({});
    setCorrecting(null);
    setReason('');
    setError('');
    setDirty(false);
    setBaseRevision(repository.getRevision());
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const vitals: Vitals = {};
      for (const f of vitalFields) if (values[f.key]?.trim()) vitals[f.key] = Number(values[f.key]);
      await repository.execute(
        context,
        {
          type: 'intake.record',
          encounterId: encounter.id,
          content: { complaint, observations, vitals },
          ...(correcting ? { correctionOf: correcting.id, correctionReason: reason } : {}),
        },
        baseRevision,
      );
      clear();
      notify(
        correcting
          ? 'Correção registrada. O conteúdo anterior foi preservado.'
          : 'Escuta e aferições salvas neste navegador.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const correct = (r: IntakeRecord) => {
    if (dirty && !window.confirm('Descartar este formulário para registrar uma correção?')) return;
    setCorrecting(r);
    setComplaint(r.complaint);
    setObservations(r.observations);
    setReason('');
    setError('');
    setValues(Object.fromEntries(Object.entries(r.vitals).map(([k, v]) => [k, String(v)])));
    setBaseRevision(repository.getRevision());
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector<HTMLInputElement>('[name="correctionReason"]')?.focus();
    });
  };
  const openConsultation = async () => {
    setBusy(true);
    try {
      if (encounter.status === 'waiting')
        await repository.execute(context, { type: 'encounter.start', id: encounter.id });
      navigate(`/atendimento/${encounter.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="operations-page intake-editor-workspace">
      <Link className="back-link" to="/escuta">
        <ArrowLeft size={16} />
        Escuta e sinais vitais
      </Link>
      <div className="patient-hero">
        <Avatar name={patient.socialName || patient.name} />
        <div>
          <span className="eyebrow">
            {encounter.ticket} · {patient.record} · PESSOA FICTÍCIA
          </span>
          <h1>{patient.socialName || patient.name}</h1>
          <p>
            {ageAt(patient.birthDate)} anos · {encounter.service} · Chegada às{' '}
            {clockTime(encounter.arrivedAt)}
          </p>
        </div>
        <Badge tone={records.length ? 'green' : 'amber'}>
          {records.length
            ? 'Escuta registrada'
            : completed
              ? 'Sem escuta registrada'
              : encounter.intakeStartedAt
                ? 'Em escuta'
                : 'Aguardando escuta'}
        </Badge>
      </div>
      <div className="care-steps">
        <span className="done">1 · Chegada registrada</span>
        <span className={records.length ? 'done' : 'active'}>2 · Escuta e aferições</span>
        <span>3 · Atendimento e acompanhamento</span>
      </div>
      <div className="triage-timing" aria-label="Tempos desta escuta">
        <span>
          <small>Chegada à unidade</small>
          <strong>{clockTime(encounter.arrivedAt)}</strong>
        </span>
        <span>
          <small>Início da escuta</small>
          <strong>
            {encounter.intakeStartedAt ? clockTime(encounter.intakeStartedAt) : 'Não iniciado'}
          </strong>
        </span>
        <span>
          <small>
            {encounter.intakeCompletedAt
              ? 'Duração da escuta inicial'
              : encounter.intakeStartedAt
                ? 'Tempo em escuta'
                : 'Espera pela escuta'}
          </small>
          <strong>
            {encounter.intakeStartedAt ? (
              encounter.intakeCompletedAt ? (
                duration(
                  (Date.parse(encounter.intakeCompletedAt) -
                    Date.parse(encounter.intakeStartedAt)) /
                    60000,
                )
              ) : completed ? (
                'Sem medição completa'
              ) : (
                <LiveDuration since={encounter.intakeStartedAt} />
              )
            ) : records.length || completed ? (
              'Sem medição completa'
            ) : (
              <LiveDuration since={lastReceptionCheck(encounter)?.at ?? encounter.arrivedAt} />
            )}
          </strong>
        </span>
      </div>
      {!completed && (
        <TriageCall
          encounter={encounter}
          onChange={() => setBaseRevision(repository.getRevision())}
        />
      )}
      {lastReceptionCheck(encounter) && (
        <Notice>
          Identificação e preferência conferidas na recepção às{' '}
          {clockTime(lastReceptionCheck(encounter)!.at)}. A triagem clínica e a avaliação de risco
          são responsabilidade da equipe assistencial.
        </Notice>
      )}
      <div className="intake-grid">
        <div>
          {!completed || correcting ? (
            <Panel
              title={
                correcting
                  ? 'Corrigir informações registradas'
                  : records.length
                    ? 'Nova aferição ou observação'
                    : 'Registrar escuta inicial'
              }
              subtitle="Preencha somente o que foi informado ou aferido. Campos vazios permanecem sem registro."
            >
              <form ref={formRef} onSubmit={save}>
                {!records.length &&
                  !encounter.intakeStartedAt &&
                  encounter.status === 'waiting' && (
                    <div className="panel-body">
                      <Notice>
                        Registre o início quando a pessoa entrar na sala. O tempo da escuta termina
                        ao salvar a primeira avaliação.
                      </Notice>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await repository.execute(context, {
                              type: 'intake.start',
                              encounterId: encounter.id,
                            });
                            setBaseRevision(repository.getRevision());
                            notify('Início da escuta registrado.');
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Iniciar escuta
                      </Button>
                    </div>
                  )}
                {encounter.intakeStartedAt && (
                  <p className="panel-body">
                    Escuta iniciada às {clockTime(encounter.intakeStartedAt)}
                    {encounter.intakeCompletedAt
                      ? ` · primeira avaliação salva às ${clockTime(encounter.intakeCompletedAt)}`
                      : ' · em andamento'}
                  </p>
                )}
                <fieldset
                  className="intake-fields"
                  disabled={
                    busy ||
                    (!records.length &&
                      !encounter.intakeStartedAt &&
                      encounter.status === 'waiting')
                  }
                >
                  {correcting && (
                    <>
                      <Notice>
                        A correção gera uma nova versão com motivo e autoria. O registro anterior
                        permanece visível no histórico.
                      </Notice>
                      <Field label="Motivo da correção">
                        <input
                          name="correctionReason"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          required
                          maxLength={1000}
                        />
                      </Field>
                    </>
                  )}
                  <Field
                    label="Motivo da procura"
                    hint={
                      records.length
                        ? 'Informe um novo relato, se houver. As medidas anteriores continuam no histórico.'
                        : 'Relato apresentado pela pessoa nesta chegada.'
                    }
                  >
                    <textarea
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      required={!records.length}
                      maxLength={2000}
                      rows={3}
                      placeholder="Descreva o relato fictício para testar o fluxo…"
                    />
                  </Field>
                  <div className="measurement-heading">
                    <HeartPulse size={20} />
                    <div>
                      <h3>Sinais vitais e medidas</h3>
                      <p>Sem interpretação automática dos valores.</p>
                    </div>
                  </div>
                  <div className="vital-fields">
                    {vitalFields.map((f) => (
                      <Field key={f.key} label={`${f.label} (${f.unit})`}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={f.key === 'weight' || f.key === 'height' ? f.step : 0}
                          max={f.max}
                          step={f.step}
                          value={values[f.key] ?? ''}
                          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                          placeholder="Não aferido"
                        />
                      </Field>
                    ))}
                  </div>
                  <Field
                    label="Observações da escuta"
                    hint="Contexto relatado e observações da equipe. Use apenas dados fictícios."
                  >
                    <textarea
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      maxLength={4000}
                      rows={3}
                    />
                  </Field>
                </fieldset>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                    {error.includes('dados') && (
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          repository.refresh();
                          setBaseRevision(repository.getRevision());
                          setError('');
                          notify(
                            'Histórico atualizado. Confira os registros antes de salvar novamente.',
                          );
                        }}
                      >
                        Atualizar histórico e manter formulário
                      </Button>
                    )}
                  </div>
                )}
                <div className="clinical-actions">
                  <span>{dirty ? 'Alterações não salvas' : 'Registro local de demonstração'}</span>
                  <div>
                    {correcting && (
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          if (!dirty || window.confirm('Descartar a correção não salva?')) clear();
                        }}
                      >
                        Cancelar correção
                      </Button>
                    )}
                    <Button type="submit" disabled={busy}>
                      <Save size={16} />
                      {correcting
                        ? 'Salvar correção'
                        : records.length
                          ? 'Salvar nova aferição'
                          : 'Salvar escuta'}
                    </Button>
                  </div>
                </div>
              </form>
            </Panel>
          ) : (
            <Notice>
              Atendimento concluído. As informações estão preservadas; correções podem ser
              acrescentadas pelo histórico.
            </Notice>
          )}
          <Panel
            title={`Histórico da escuta · ${records.length} ${records.length === 1 ? 'registro' : 'registros'}`}
            subtitle="Cada aferição mantém seus próprios valores. Uma correção não apaga o registro original."
          >
            {records.length ? (
              <IntakeHistory records={records} onCorrect={busy ? undefined : correct} />
            ) : (
              <EmptyState
                title="O histórico começa aqui"
                description="A escuta ficará disponível para a equipe no atendimento e no histórico da pessoa."
              />
            )}
          </Panel>
        </div>
        <aside>
          <Panel title="Continuidade do cuidado">
            <div className="panel-body">
              <span className="intake-side-icon">
                <ClipboardCheck size={25} />
              </span>
              <h3>
                {latest ? 'Informações disponíveis para a equipe' : 'Escuta ainda não registrada'}
              </h3>
              <p className="muted">
                {latest
                  ? `Último registro às ${clockTime(latest.recordedAt)}. A equipe pode consultá-lo sem copiar os valores para o SOAP.`
                  : 'Preencha o motivo da procura e as informações disponíveis.'}
              </p>
              <Button disabled={busy || dirty} onClick={openConsultation}>
                {completed
                  ? 'Ver atendimento concluído'
                  : encounter.status === 'waiting'
                    ? 'Iniciar atendimento'
                    : 'Continuar atendimento'}
                <ArrowRight size={16} />
              </Button>
              <Link className="button secondary intake-back-queue" to="/escuta">
                Voltar à fila de escuta
              </Link>
              {dirty && (
                <small className="field-hint">
                  Salve o formulário antes de seguir para o atendimento.
                </small>
              )}
            </div>
          </Panel>
          <Panel title="Informações da pessoa">
            <dl className="definition-list panel-body">
              <div>
                <dt>Nome civil</dt>
                <dd>{patient.name}</dd>
              </div>
              <div>
                <dt>Unidade</dt>
                <dd>{data.units.find((u) => u.id === encounter.unitId)?.name}</dd>
              </div>
              <div>
                <dt>Alergias registradas</dt>
                <dd>
                  {patient.allergies.join('; ') ||
                    'Sem informação registrada; ausência não confirmada.'}
                </dd>
              </div>
            </dl>
            <div className="panel-link">
              <Link to={`/pessoas/${patient.id}`}>
                Abrir histórico da pessoa <ArrowRight size={15} />
              </Link>
            </div>
          </Panel>
          <Notice>
            Registro de demonstração, sem classificação de risco, sugestão de conduta ou assinatura
            digital.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
