import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Clock3, Megaphone, Monitor, Ticket, UserCheck } from 'lucide-react';
import { useApp } from '../app/context';
import { demoIdentities } from '../domain/access';
import { displayRoute, externalRoute } from '../app/links';
import {
  ActionForm,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Notice,
  Panel,
  SearchField,
  valueOf,
} from '../components/ui';
import type { Command, Encounter, KioskArrival } from '../domain/model';
import {
  canClosePriorArrival,
  flowStage,
  lastReceptionCheck,
  needsReception,
  type ReceptionTarget,
} from '../domain/reception';
import { formatCpf, normalizedName } from '../domain/identification';
import {
  preferenceLabel,
  preferenceReasons,
  servicesForUnit,
  type PreferenceReason,
} from '../domain/kiosk-options';
import { roomName } from '../domain/unit-queue';
import { roomsForUnit } from '../domain/queue';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import { duration, LiveDuration } from './PatientFlow';
import '../styles/reception.css';

type DeskRow = {
  target: ReceptionTarget;
  row: Encounter | KioskArrival;
  stage: string;
  name: string;
  cpf?: string;
};
const asEncounter = (row: Encounter | KioskArrival) => ('patientId' in row ? row : undefined);

export function ReceptionDesk() {
  const { data, context, repository, notify } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [day, setDay] = useState(dateKey()),
    [selected, setSelected] = useState<DeskRow | null>(null),
    [history, setHistory] = useState<DeskRow | null>(null),
    [closing, setClosing] = useState<Encounter | null>(null),
    [absent, setAbsent] = useState<DeskRow | null>(null),
    [busy, setBusy] = useState('');
  useEffect(() => {
    const timer = setInterval(() => repository.refresh(), 2000);
    return () => clearInterval(timer);
  }, [repository]);
  const rows: DeskRow[] = [
    ...data.kioskArrivals.map((row) => ({
      target: { kind: 'arrival' as const, id: row.id },
      row,
      name: 'Identificação no balcão',
      stage: row.receptionHold
        ? 'Ausente na chamada'
        : row.receptionStartedAt
          ? 'Em conferência'
          : 'Aguardando recepção',
    })),
    ...data.encounters.map((row) => {
      const p = data.patients.find((p) => p.id === row.patientId);
      return {
        target: { kind: 'encounter' as const, id: row.id },
        row,
        name: p?.socialName || p?.name || 'Cadastro',
        cpf: p?.cpf,
        stage: (() => {
          const d = data.queueDirections.find((d) => d.encounterId === row.id);
          if (!d || row.receptionHold) return flowStage(row);
          return d.roomId === 'escuta-1'
            ? 'Devolvido à triagem'
            : (d.received ? 'Recebido no setor · ' : 'Encaminhado · ') + roomName(d.roomId);
        })(),
      };
    }),
  ]
    .filter((r) => dateKey(new Date(r.row.arrivedAt)) === day)
    .sort((a, b) => a.row.arrivedAt.localeCompare(b.row.arrivedAt));
  const todayKey = dateKey();
  const priorDates = data.encounters
    .filter((e) => canClosePriorArrival(e, todayKey))
    .map((e) => dateKey(new Date(e.arrivedAt)))
    .sort();
  const category = (r: DeskRow) =>
    asEncounter(r.row)?.status === 'closed-without-care'
      ? 'closed'
      : r.row.receptionHold
        ? 'absent'
        : r.stage === 'Concluído'
          ? 'closed'
          : r.stage.includes('triagem')
            ? 'triage'
            : !asEncounter(r.row) || needsReception(asEncounter(r.row)!) || r.stage === 'Em espera'
              ? 'desk'
              : 'service';
  const categories = [
    ['all', 'Senhas do dia'],
    ['desk', 'Na recepção'],
    ['triage', 'Na triagem'],
    ['service', 'Em atendimento / espera'],
    ['absent', 'Ausentes'],
  ] as const;
  const visible = rows.filter(
    (r) =>
      (filter === 'all' || category(r) === filter) &&
      normalizedName(`${r.name} ${r.row.ticket} ${r.cpf ?? ''} ${formatCpf(r.cpf ?? '')}`).includes(
        normalizedName(search),
      ),
  );
  const act = async (command: Command, id: string, message: string) => {
    setBusy(id);
    try {
      await repository.execute(context, command);
      notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const open = async (item: DeskRow) => {
    if (
      !item.row.receptionStartedAt &&
      !(await act(
        { type: 'reception.start', target: item.target },
        item.row.id,
        'Conferência iniciada. O tempo no balcão está sendo registrado.',
      ))
    )
      return;
    setSelected(item);
  };
  const call = async (item: DeskRow) => {
    const e = asEncounter(item.row),
      check = e && lastReceptionCheck(e);
    const roomId =
      e && !needsReception(e)
        ? e.intakeCompletedAt
          ? (data.queueDirections.find((d) => d.encounterId === e.id)?.roomId ?? 'consultorio-1')
          : (check?.roomId ?? 'recepcao-1')
        : 'recepcao-1';
    await act(
      e
        ? { type: 'queue.call', encounterId: e.id, roomId }
        : { type: 'queue.call-arrival', arrivalId: item.row.id },
      item.row.id,
      `Senha ${item.row.ticket} enviada ao painel da TV.`,
    );
  };
  return (
    <>
      <div className="desk-filters">
        {categories.map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'selected' : ''}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            <span>{label}</span>
            <strong>{rows.filter((r) => key === 'all' || category(r) === key).length}</strong>
          </button>
        ))}
      </div>
      {priorDates.length > 0 && day === todayKey && (
        <Notice tone="amber">
          Há {priorDates.length} chegada(s) de dias anteriores sem início de atendimento.{' '}
          <button
            className="text-button"
            onClick={() => {
              setDay(priorDates[0]);
              setFilter('all');
              setSearch('');
            }}
          >
            Revisar chegadas anteriores
          </button>
        </Notice>
      )}
      <section className="desk-intro">
        <span className="desk-intro-icon">
          <UserCheck size={22} />
        </span>
        <div>
          <h2>Totem e painel da unidade</h2>
          <p>Teste a chegada e a chamada em outras abas deste navegador.</p>
        </div>
        <div className="row-actions">
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={externalRoute(`/totem?rede=${context.organizationId}&unidade=${context.unitId}`)}
          >
            <Ticket size={17} />
            Abrir totem conectado
          </a>
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={externalRoute(displayRoute(context.organizationId, context.unitId))}
          >
            <Monitor size={17} />
            Abrir TV conectada
          </a>
        </div>
      </section>
      <Panel
        title="Fila da recepção"
        subtitle="Ordem de chegada. A equipe define a sequência de chamada e confere a preferência administrativa."
      >
        <div className="table-toolbar desk-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar senha, nome ou CPF"
          />
          <Field label="Data das senhas">
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <span className="result-count">{visible.length} senhas</span>
        </div>
        <div className="desk-list">
          {visible.map((item) => {
            const { row } = item,
              e = asEncounter(row),
              check = e && lastReceptionCheck(e),
              p = e && data.patients.find((p) => p.id === e.patientId);
            const calls = data.calls.filter(
                (c) => c.encounterId === row.id || c.arrivalId === row.id,
              ),
              lastCall = calls.at(-1);
            const today = day === dateKey(),
              editable = today && (!e || (e.status === 'waiting' && !e.intakeStartedAt));
            const targetLabel =
              !e || needsReception(e) || !check
                ? 'Chamar no guichê'
                : check.destination === 'triage' && !e.intakeCompletedAt
                  ? 'Chamar para triagem'
                  : 'Chamar no painel';
            return (
              <article className="desk-row" key={row.id} data-testid={`desk-${row.ticket}`}>
                <div className="desk-ticket">
                  <strong>{row.ticket}</strong>
                  <small>
                    {e?.source === 'kiosk' || !e ? 'Totem' : 'Recepção'} ·{' '}
                    {clockTime(row.arrivedAt)}
                  </small>
                </div>
                <div className="desk-person">
                  <strong>{item.name}</strong>
                  <span>
                    {p
                      ? `${p.cpf ? formatCpf(p.cpf) : 'CPF não informado'} · ${shortDate(p.birthDate)}`
                      : 'CPF ou nome e nascimento serão conferidos com a pessoa.'}
                  </span>
                  <small>{row.service}</small>
                  <span className="desk-preference">
                    {row.priority === 'priority'
                      ? `Preferencial · ${preferenceLabel(row.preferenceReason)}`
                      : 'Atendimento comum'}
                    {check
                      ? ' · conferido'
                      : e && e.status !== 'waiting'
                        ? ' · conferência não registrada'
                        : ' · a conferir'}
                  </span>
                </div>
                <div className="desk-stage">
                  <Badge tone={row.receptionHold ? 'amber' : check ? 'green' : 'blue'}>
                    {item.stage}
                  </Badge>
                  <small>
                    <Clock3 size={13} />
                    {e?.closedWithoutCare ? (
                      'Encerrado às ' + clockTime(e.closedWithoutCare.at)
                    ) : e?.status === 'completed' ? (
                      'Percurso encerrado'
                    ) : (
                      <>
                        <LiveDuration since={row.arrivedAt} /> desde a chegada
                      </>
                    )}
                  </small>
                  <small>
                    {lastCall
                      ? `Última chamada ${clockTime(lastCall.calledAt)} · ${calls.length} chamada(s)`
                      : 'Ainda sem chamada no painel'}
                  </small>
                </div>
                <div className="desk-actions">
                  {today &&
                    (!e ||
                      (e.status === 'waiting' && !(e.intakeStartedAt && !e.intakeCompletedAt))) &&
                    !row.receptionHold && (
                      <Button variant="secondary" disabled={!!busy} onClick={() => void call(item)}>
                        <Megaphone size={16} />
                        {targetLabel}
                      </Button>
                    )}
                  {editable && !row.receptionHold && (
                    <Button disabled={!!busy} onClick={() => void open(item)}>
                      <ClipboardCheck size={16} />
                      {check ? 'Rever conferência' : 'Conferir chegada'}
                    </Button>
                  )}
                  {editable && row.receptionHold && (
                    <Button
                      disabled={!!busy}
                      onClick={() =>
                        void act(
                          { type: 'reception.return', target: item.target },
                          row.id,
                          'Retorno registrado com a mesma senha e chegada original.',
                        )
                      }
                    >
                      Registrar retorno
                    </Button>
                  )}
                  {e && canClosePriorArrival(e, todayKey) && (
                    <Button variant="secondary" onClick={() => setClosing(e)}>
                      Encerrar chegada anterior
                    </Button>
                  )}
                  <div className="row-actions">
                    <button className="text-button" onClick={() => setHistory(item)}>
                      Ver percurso
                    </button>
                    {editable && !row.receptionHold && !!calls.length && (
                      <button className="text-button" onClick={() => setAbsent(item)}>
                        Registrar ausência
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!visible.length && (
          <EmptyState
            title="Nenhuma senha neste filtro"
            description="Use o totem conectado para retirar uma senha ou ajuste a busca."
          />
        )}
      </Panel>
      <Notice>
        A preferência administrativa é conferida no balcão. A triagem clínica é realizada pela
        equipe assistencial. Para testar a atualização entre telas, abra o totem e a TV pelos botões
        acima, no mesmo navegador e arquivo.
      </Notice>
      {closing && (
        <Modal
          title="Encerrar chegada sem atendimento"
          onClose={() => setClosing(null)}
          description={
            closing.ticket +
            ' · ' +
            shortDate(closing.arrivedAt) +
            ' · ' +
            (data.patients.find((p) => p.id === closing.patientId)?.name ?? '')
          }
        >
          <ActionForm
            onClose={() => setClosing(null)}
            submitLabel="Confirmar encerramento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'reception.close-prior',
                id: closing.id,
                reason: valueOf(f, 'reason'),
              });
              notify('Chegada anterior encerrada. A pessoa pode retirar uma nova senha.');
            }}
          >
            <p>
              Confirme que a pessoa deixou a unidade antes da triagem ou consulta. O motivo ficará
              no percurso da senha.
            </p>
            <Field label="Motivo do encerramento">
              <textarea rows={3} required maxLength={500} name="reason" />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {selected && <CheckArrival item={selected} onClose={() => setSelected(null)} />}
      {history && <Journey item={history} onClose={() => setHistory(null)} />}
      {absent && (
        <Modal
          title={`Ausência · ${absent.row.ticket}`}
          description="A senha e a chegada ficam preservadas. O retorno precisa ser confirmado antes de nova chamada."
          onClose={() => setAbsent(null)}
        >
          <ActionForm
            onClose={() => setAbsent(null)}
            submitLabel="Registrar ausência"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'reception.absent',
                target: absent.target,
                reason: valueOf(f, 'reason'),
              });
              notify('Ausência registrada.');
            }}
          >
            <Field label="Motivo da ausência">
              <textarea
                name="reason"
                required
                maxLength={500}
                placeholder="Ex.: pessoa não localizada após a chamada."
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}

function CheckArrival({ item, onClose }: { item: DeskRow; onClose: () => void }) {
  const { data, context, repository, notify } = useApp();
  const current =
    item.target.kind === 'arrival'
      ? data.kioskArrivals.find((a) => a.id === item.row.id)
      : data.encounters.find((e) => e.id === item.row.id);
  const [patientId, setPatientId] = useState(asEncounter(item.row)?.patientId ?? ''),
    [search, setSearch] = useState(''),
    [method, setMethod] = useState<'cpf' | 'name'>('cpf'),
    [identifier, setIdentifier] = useState(''),
    [birth, setBirth] = useState(''),
    [create, setCreate] = useState(false),
    [priority, setPriority] = useState(item.row.priority),
    [reason, setReason] = useState<PreferenceReason>(item.row.preferenceReason ?? 'reception');
  const e = asEncounter(item.row),
    check = e && lastReceptionCheck(e);
  const unit = data.units.find((u) => u.id === context.unitId)!,
    services = servicesForUnit(unit.kind);
  const [service, setService] = useState(
      services.some((s) => s.value === item.row.service) ? item.row.service : 'Consulta',
    ),
    [destination, setDestination] = useState<'triage' | 'service'>(
      check?.destination ?? (item.row.service === 'Orientação na recepção' ? 'service' : 'triage'),
    ),
    [roomId, setRoomId] = useState(
      check?.roomId ?? (item.row.service === 'Orientação na recepção' ? 'recepcao-1' : 'escuta-1'),
    );
  const patient = data.patients.find((p) => p.id === patientId);
  const candidates = data.patients.filter(
    (p) =>
      !search ||
      normalizedName(
        `${p.name} ${p.socialName} ${p.cpf ?? ''} ${formatCpf(p.cpf ?? '')} ${p.record}`,
      ).includes(normalizedName(search)),
  );
  const setPatient = (id: string) => {
    setPatientId(id);
    setIdentifier('');
    setBirth('');
    setMethod(data.patients.find((p) => p.id === id)?.cpf ? 'cpf' : 'name');
  };
  if (!current)
    return (
      <Modal title="A senha foi atualizada" onClose={onClose}>
        <div className="panel-body">
          <Notice>Reabra a senha na fila para continuar.</Notice>
          <Button onClick={onClose}>Voltar à fila</Button>
        </div>
      </Modal>
    );
  return (
    <Modal
      wide
      title={`Conferir chegada · ${item.row.ticket}`}
      description="Confira os dados presencialmente. A mesma senha acompanha a pessoa até o atendimento."
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel="Conferir e encaminhar"
        onSubmit={async (f) => {
          await repository.execute(context, {
            type: 'reception.complete',
            target: item.target,
            patientId,
            identity: { kind: method, value: identifier, birthDate: birth },
            identityConfirmed: f.get('identityConfirmed') === 'on',
            preferenceConfirmed: f.get('preferenceConfirmed') === 'on',
            priority,
            ...(priority === 'priority' ? { preferenceReason: reason } : {}),
            service,
            destination,
            roomId,
            adjustmentReason: valueOf(f, 'adjustmentReason'),
            expectedChecks: e?.receptionChecks?.length ?? 0,
          });
          notify(
            destination === 'triage'
              ? 'Conferência concluída. Senha encaminhada à triagem; horário de chegada preservado.'
              : 'Conferência concluída. Senha encaminhada ao serviço; horário de chegada preservado.',
          );
        }}
      >
        {!e && (
          <section className="check-section">
            <h3>1 · Localizar o cadastro</h3>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar no cadastro por CPF ou nome"
            />
            <Field label={`Pessoa da senha ${item.row.ticket}`}>
              <select required value={patientId} onChange={(ev) => setPatient(ev.target.value)}>
                <option value="">Selecione o cadastro conferido</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.socialName || p.name} · {shortDate(p.birthDate)} ·{' '}
                    {p.cpf ? formatCpf(p.cpf) : p.record}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="button" variant="secondary" onClick={() => setCreate(true)}>
              Cadastrar nova pessoa
            </Button>
          </section>
        )}
        <section className="check-section">
          <h3>{e ? '1' : '2'} · Conferir identificação</h3>
          {patient && (
            <div className="check-person">
              <strong>{patient.socialName || patient.name}</strong>
              <span>Nome civil: {patient.name}</span>
              <span>
                CPF: {patient.cpf ? formatCpf(patient.cpf) : 'Não informado'} · Nascimento:{' '}
                {shortDate(patient.birthDate)}
              </span>
              <Link target="_blank" to={`/pessoas/${patient.id}`}>
                Ver cadastro completo
              </Link>
            </div>
          )}
          <div className="form-grid">
            <Field label="Conferir por">
              <select
                value={method}
                onChange={(ev) => {
                  setMethod(ev.target.value as 'cpf' | 'name');
                  setIdentifier('');
                }}
              >
                <option value="cpf">CPF</option>
                <option value="name">Nome completo / nome social</option>
              </select>
            </Field>
            <Field
              label={method === 'cpf' ? 'CPF informado pela pessoa' : 'Nome informado pela pessoa'}
            >
              <input
                required
                value={identifier}
                onChange={(ev) =>
                  setIdentifier(method === 'cpf' ? formatCpf(ev.target.value) : ev.target.value)
                }
                inputMode={method === 'cpf' ? 'numeric' : 'text'}
                maxLength={method === 'cpf' ? 14 : 120}
                autoComplete="off"
              />
            </Field>
            <Field label="Nascimento informado pela pessoa">
              <input
                type="date"
                required
                value={birth}
                onChange={(ev) => setBirth(ev.target.value)}
                max={dateKey()}
              />
            </Field>
          </div>
          <label className="check-confirm">
            <input
              type="checkbox"
              name="identityConfirmed"
              required
              key={`identity-${patientId}-${identifier}-${birth}`}
            />
            Conferi a identificação com a pessoa ou responsável
          </label>
        </section>
        <section className="check-section">
          <h3>Preferência e serviço</h3>
          <div className="form-grid">
            <Field label="Atendimento conferido">
              <select
                value={priority}
                onChange={(ev) => setPriority(ev.target.value as 'routine' | 'priority')}
              >
                <option value="routine">Comum</option>
                <option value="priority">Preferencial</option>
              </select>
            </Field>
            {priority === 'priority' && (
              <Field label="Motivo da preferência">
                <select
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value as PreferenceReason)}
                >
                  {preferenceReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Serviço conferido">
              <select value={service} onChange={(ev) => setService(ev.target.value)}>
                {services.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="check-confirm">
            <input
              type="checkbox"
              required
              name="preferenceConfirmed"
              key={`priority-${priority}-${reason}`}
            />
            Conferi a preferência de atendimento com a pessoa
          </label>
          {(priority !== item.row.priority || !!check) && (
            <Field label="Motivo do ajuste">
              <textarea
                name="adjustmentReason"
                maxLength={500}
                required
                placeholder="Explique a alteração, sem inserir informações clínicas."
              />
            </Field>
          )}
        </section>
        <section className="check-section">
          <h3>Próxima etapa</h3>
          <div className="form-grid">
            <Field label="Encaminhar para">
              <select
                value={destination}
                onChange={(ev) => {
                  const d = ev.target.value as 'triage' | 'service';
                  setDestination(d);
                  setRoomId(d === 'triage' ? 'escuta-1' : 'consultorio-1');
                }}
              >
                <option value="triage">Triagem / escuta inicial</option>
                <option value="service">Serviço direto, conforme fluxo da unidade</option>
              </select>
            </Field>
            <Field label="Sala de destino">
              <select value={roomId} onChange={(ev) => setRoomId(ev.target.value)}>
                {roomsForUnit(unit)
                  .filter((r) =>
                    destination === 'triage' ? r.id === 'escuta-1' : r.id !== 'escuta-1',
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <p className="muted">
            Salvar encaminha para a fila. A chamada no painel é feita pelo botão da senha, quando a
            equipe puder receber a pessoa.
          </p>
        </section>
      </ActionForm>
      {create && (
        <Modal title="Novo cadastro da recepção" onClose={() => setCreate(false)}>
          <ActionForm
            onClose={() => setCreate(false)}
            submitLabel="Cadastrar e selecionar"
            onSubmit={async (f) => {
              const id = await repository.execute(context, {
                type: 'patient.create',
                name: valueOf(f, 'name'),
                socialName: valueOf(f, 'socialName'),
                birthDate: valueOf(f, 'birthDate'),
                phone: valueOf(f, 'phone'),
                cpf: valueOf(f, 'cpf'),
              });
              setSearch('');
              setPatientId(id);
              setMethod(valueOf(f, 'cpf') ? 'cpf' : 'name');
              setIdentifier('');
              setBirth('');
              notify('Cadastro criado. Confira os dados antes de encaminhar.');
            }}
          >
            <Field label="Nome completo">
              <input name="name" required maxLength={120} />
            </Field>
            <Field label="Nome social">
              <input name="socialName" maxLength={120} />
            </Field>
            <Field label="CPF do novo cadastro">
              <input name="cpf" inputMode="numeric" maxLength={14} />
            </Field>
            <Field label="Nascimento do novo cadastro">
              <input name="birthDate" type="date" required min="1850-01-01" max={dateKey()} />
            </Field>
            <Field label="Telefone">
              <input name="phone" maxLength={30} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </Modal>
  );
}

function Journey({ item, onClose }: { item: DeskRow; onClose: () => void }) {
  const { data, repository } = useApp();
  const actor = (id?: string) =>
    demoIdentities(repository.directory()).find((i) => i.sessionId === id)?.name ?? 'Equipe';
  const e = data.encounters.find((e) => e.id === item.row.id),
    row = e ?? data.kioskArrivals.find((a) => a.id === item.row.id) ?? item.row;
  const events = [
    { at: row.arrivedAt, label: 'Senha emitida / chegada registrada' },
    ...data.calls
      .filter((c) => c.encounterId === row.id || c.arrivalId === row.id)
      .map((c) => ({
        at: c.calledAt,
        label: `Chamada na TV · ${roomsForUnit(data.units.find((u) => u.id === c.unitId)!).find((r) => r.id === c.roomId)?.name}`,
      })),
    ...(row.receptionStartedAt
      ? [
          {
            at: row.receptionStartedAt,
            label: `Conferência presencial iniciada · ${actor(row.receptionStartedBy)}`,
          },
        ]
      : []),
    ...(row.receptionChecks ?? []).map((c, i) => ({
      at: c.at,
      label: `${i ? 'Conferência revista' : 'Identificação e preferência conferidas'} · ${c.destination === 'triage' ? 'Encaminhado à triagem' : 'Encaminhado ao serviço'} · ${actor(c.actorId)}${c.adjustmentReason ? ' · ' + c.adjustmentReason : ''}`,
    })),
    ...(e
      ? data.queueServiceEvents
          .filter((ev) => ev.encounterId === e.id)
          .map((ev) => ({
            at: ev.at,
            label:
              {
                receive: 'Recebido no setor',
                return: 'Devolvido à escuta',
                finish: 'Passagem concluída',
              }[ev.action] +
              ' · ' +
              actor(ev.actorId),
          }))
      : []),
    ...(e?.roomStays ?? []).flatMap((s) => [
      {
        at: s.at,
        label: 'Consultório vinculado · ' + roomName(s.roomId) + ' · ' + actor(s.actorId),
      },
      ...(s.enteredAt
        ? [{ at: s.enteredAt, label: 'Entrada confirmada · ' + roomName(s.roomId) }]
        : []),
      ...(s.endedAt
        ? [
            {
              at: s.endedAt,
              label:
                'Consultório liberado · ' +
                roomName(s.roomId) +
                ' · ' +
                actor(s.endedBy) +
                (s.reason ? ' · ' + s.reason : ''),
            },
          ]
        : []),
    ]),
    ...(row.receptionEvents ?? []).map((event) => ({
      at: event.at,
      label: `${event.kind === 'absent' ? 'Ausência registrada' : 'Retorno registrado'} · ${event.reason}`,
    })),
    ...(e?.closedWithoutCare
      ? [
          {
            at: e.closedWithoutCare.at,
            label:
              'Encerrado sem atendimento · ' +
              actor(e.closedWithoutCare.actorId) +
              ' · ' +
              e.closedWithoutCare.reason,
          },
        ]
      : []),
    ...(e?.intakeStartedAt ? [{ at: e.intakeStartedAt, label: 'Entrada na triagem' }] : []),
    ...(e?.intakeCompletedAt ? [{ at: e.intakeCompletedAt, label: 'Triagem concluída' }] : []),
    ...(e?.startedAt ? [{ at: e.startedAt, label: 'Consulta iniciada' }] : []),
    ...(e?.completedAt ? [{ at: e.completedAt, label: 'Atendimento concluído' }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const elapsed = (a?: string, b?: string) =>
    a && b ? duration((Date.parse(b) - Date.parse(a)) / 60000) : 'Sem medição';
  return (
    <Modal title={`Percurso · ${row.ticket}`} onClose={onClose}>
      <div className="panel-body">
        <div className="journey-times">
          <span>
            Espera pelo balcão<strong>{elapsed(row.arrivedAt, row.receptionStartedAt)}</strong>
          </span>
          <span>
            Conferência no balcão
            <strong>{elapsed(row.receptionStartedAt, row.receptionChecks?.[0]?.at)}</strong>
          </span>
          <span>
            Espera pela triagem
            <strong>
              {elapsed(
                e && lastReceptionCheck(e)?.destination === 'triage'
                  ? lastReceptionCheck(e)?.at
                  : undefined,
                e?.intakeStartedAt,
              )}
            </strong>
          </span>
        </div>
        <ol className="desk-timeline">
          {events.map((event, index) => (
            <li key={index}>
              <time>{clockTime(event.at)}</time>
              <span>{event.label}</span>
            </li>
          ))}
        </ol>
        <Button variant="secondary" onClick={onClose}>
          Fechar percurso
        </Button>
      </div>
    </Modal>
  );
}
