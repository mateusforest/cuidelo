import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardCheck, HeartPulse, Save } from 'lucide-react';
import { useApp } from '../app/context';
import type { IntakeRecord, Vitals } from '../domain/model';
import { activeIntakes, vitalFields } from '../domain/intake';
import { ageAt, clockTime } from '../domain/dates';
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
    [filter, setFilter] = useState('pending');
  const hasRecord = (id: string) => data.intakes.some((r) => r.encounterId === id);
  const pending = data.encounters.filter((e) => e.status !== 'completed' && !hasRecord(e.id));
  const recorded = data.encounters.filter((e) => e.status !== 'completed' && hasRecord(e.id));
  const list = data.encounters
    .filter((e) => {
      const p = data.patients.find((p) => p.id === e.patientId);
      return (
        (filter === 'all' ||
          (filter === 'pending' ? pending : recorded).some((item) => item.id === e.id)) &&
        `${p?.name} ${p?.socialName} ${e.ticket}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR'))
      );
    })
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  return (
    <>
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
        <div className="intake-overview">
          <HeartPulse size={30} />
          <div>
            <strong>Da chegada ao cuidado, com o histórico por perto.</strong>
            <p>
              Escuta inicial, novas aferições e correções ficam vinculadas à mesma pessoa e ao mesmo
              atendimento.
            </p>
          </div>
          <Badge tone="green">Novo na demonstração</Badge>
        </div>
        <div className="queue-stats intake-stats">
          {(
            [
              ['pending', 'Aguardando escuta', pending.length],
              ['recorded', 'Com escuta registrada', recorded.length],
              ['all', 'Todos os atendimentos', data.encounters.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              className={filter === key ? 'selected' : ''}
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
            <span className="result-count">{list.length} atendimentos</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Senha / pessoa</th>
                  <th>Serviço</th>
                  <th>Chegada</th>
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
                      <td>{clockTime(e.arrivedAt)}</td>
                      <td>
                        <Badge tone={hasRecord(e.id) ? 'green' : 'neutral'}>
                          {hasRecord(e.id) ? 'Registrada' : 'Não registrada'}
                        </Badge>
                        {e.status === 'completed' && (
                          <small className="cell-secondary">Atendimento concluído</small>
                        )}
                      </td>
                      <td>
                        <Link
                          className={`button ${hasRecord(e.id) || e.status === 'completed' ? 'secondary' : 'primary'}`}
                          to={`/escuta/${e.id}`}
                        >
                          {hasRecord(e.id) || e.status === 'completed'
                            ? 'Abrir histórico'
                            : 'Registrar escuta'}
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
    </>
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
    <>
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
              : 'Aguardando escuta'}
        </Badge>
      </div>
      <div className="care-steps">
        <span className="done">1 · Chegada registrada</span>
        <span className="active">2 · Escuta e aferições</span>
        <span>3 · Atendimento e acompanhamento</span>
      </div>
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
                <fieldset className="intake-fields" disabled={busy}>
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
    </>
  );
}
