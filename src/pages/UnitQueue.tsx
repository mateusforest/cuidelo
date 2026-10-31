import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Monitor, Volume2 } from 'lucide-react';
import { useApp } from '../app/context';
import { externalRoute, displayRoute } from '../app/links';
import { can, type Command, type Encounter } from '../domain/model';
import { dateKey, minutesWaiting, clockTime } from '../domain/dates';
import { normalizedName } from '../domain/identification';
import { flowStage, lastReceptionCheck, readyForConsultation } from '../domain/reception';
import { consultRooms, currentStay, roomName, isConsultRoom } from '../domain/unit-queue';
import {
  Badge,
  Button,
  Field,
  Panel,
  PageHeader,
  SearchField,
  EmptyState,
  Modal,
  ActionForm,
  valueOf,
} from '../components/ui';
import { assessmentDeadline } from '../components/QueueAssessment';

export function UnitQueue() {
  const { data, context, repository, notify } = useApp();
  const [now, setNow] = useState(new Date()),
    [search, setSearch] = useState(''),
    [stage, setStage] = useState('all'),
    [call, setCall] = useState<Encounter | null>(null),
    [release, setRelease] = useState<{ e: Encounter; id: string } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const today = dateKey(now),
    clinical = can(context.role, 'clinical');
  const people = new Map(data.patients.map((p) => [p.id, p.socialName || p.name]));
  const directions = new Map(data.queueDirections.map((d) => [d.encounterId, d]));
  const assessments = new Map(data.queueAssessments.map((a) => [a.encounterId, a]));
  const present = data.encounters.filter(
    (e) =>
      e.status === 'waiting' && !e.receptionHold && !(e.intakeStartedAt && !e.intakeCompletedAt),
  );
  const visitors = new Map(
    data.encounters.flatMap((e) => {
      const visit = currentStay(e);
      return visit ? [[visit.roomId, e] as const] : [];
    }),
  );
  const rowStage = (e: Encounter) =>
    directions.get(e.id)?.received
      ? 'receiving'
      : currentStay(e)
        ? 'called'
        : !readyForConsultation(e)
          ? flowStage(e).includes('triagem')
            ? 'triage'
            : 'desk'
          : directions.get(e.id)?.roomId === 'escuta-1'
            ? 'returned'
            : directions.has(e.id)
              ? isConsultRoom(directions.get(e.id)!.roomId)
                ? 'assessed'
                : 'service'
              : lastReceptionCheck(e)?.destination === 'service' &&
                  !consultRooms.some((r) => r.id === lastReceptionCheck(e)?.roomId)
                ? 'service'
                : 'unassessed';
  const labels: Record<string, string> = {
    desk: 'Recepção',
    triage: 'Aguardando triagem',
    assessed: 'Classificação registrada',
    unassessed: 'Sem classificação registrada',
    called: 'Chamada para a sala',
    service: 'Encaminhado a outro setor',
    returned: 'Devolvido à escuta',
    receiving: 'Em atendimento no setor',
  };
  const rows = [
    ...present.map((e) => ({
      id: e.id,
      ticket: e.ticket,
      name: people.get(e.patientId) ?? 'Cadastro',
      arrival: e.arrivedAt,
      stage: rowStage(e),
      priority: e.priority,
      e,
    })),
    ...data.kioskArrivals
      .filter((a) => !a.receptionHold)
      .map((a) => ({
        id: a.id,
        ticket: a.ticket,
        name: 'Identificação no balcão',
        arrival: a.arrivedAt,
        stage: 'desk',
        priority: a.priority,
        e: undefined,
      })),
  ].filter((r) => dateKey(new Date(r.arrival)) === today);
  const waitingToday = rows.filter((r) => r.stage !== 'receiving');
  const list = rows
    .filter(
      (r) =>
        (stage === 'all' ||
          r.stage === stage ||
          (stage === 'review' &&
            r.e &&
            assessments.get(r.id)?.reviewAt &&
            Date.parse(assessments.get(r.id)!.reviewAt!) <= now.getTime())) &&
        normalizedName(r.ticket + ' ' + r.name).includes(normalizedName(search)),
    )
    .sort(
      (a, b) =>
        (directions.get(a.id)?.order ?? Infinity) - (directions.get(b.id)?.order ?? Infinity) ||
        Number(b.priority === 'priority') - Number(a.priority === 'priority') ||
        a.arrival.localeCompare(b.arrival),
    );
  const act = async (cmd: Command, message: string) => {
    setBusy(true);
    try {
      await repository.execute(context, cmd);
      notify(message);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const directed = call ? directions.get(call.id)?.roomId : undefined;
  const free = consultRooms.filter((r) => !visitors.has(r.id));
  const title = stage === 'review' ? 'Reavaliações pendentes' : 'Pessoas na fila';
  return (
    <div className="operations-page unit-queue-workspace">
      <PageHeader
        eyebrow="ATENDIMENTO DA UNIDADE"
        title="Fila e salas"
        description="Acompanhe quem espera, o destino de cada senha e a ocupação dos consultórios."
        action={
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={externalRoute(displayRoute(context.organizationId, context.unitId))}
          >
            <Monitor size={16} /> Abrir TV da unidade
          </a>
        }
      />
      <div className="continuity-metrics">
        <article>
          <span>Senhas em espera hoje</span>
          <strong>{waitingToday.length}</strong>
          <small>Inclui quem aguarda no balcão</small>
        </article>
        <article>
          <span>Espera média atual</span>
          <strong>
            {waitingToday.length
              ? Math.round(
                  waitingToday.reduce((sum, r) => sum + minutesWaiting(r.arrival, now), 0) /
                    waitingToday.length,
                ) + ' min'
              : '—'}
          </strong>
          <small>Desde a chegada à unidade</small>
        </article>
        <article>
          <span>Consultórios ocupados</span>
          <strong>
            {[...visitors.values()].filter((e) => currentStay(e)?.enteredAt).length} /{' '}
            {consultRooms.length}
          </strong>
          <small>Entrada confirmada pela equipe</small>
        </article>
        <article>
          <span>Atendimentos concluídos hoje</span>
          <strong>
            {
              data.encounters.filter(
                (e) => e.completedAt && dateKey(new Date(e.completedAt)) === today,
              ).length
            }
          </strong>
          <small>Inclui orientações e passagens concluídas</small>
        </article>
      </div>
      <Panel
        title="Consultórios da unidade"
        subtitle="A chamada reserva a sala. A ocupação começa quando a equipe confirma a entrada."
      >
        <div className="queue-room-grid">
          {consultRooms.map((r) => {
            const e = visitors.get(r.id),
              v = e && currentStay(e);
            return (
              <article key={r.id} className="queue-room-card">
                <div className="queue-room-head">
                  <strong>
                    <DoorOpen size={17} /> {r.name}
                  </strong>
                  <Badge tone={v?.enteredAt ? 'blue' : v ? 'amber' : 'green'}>
                    {v?.enteredAt ? 'Em atendimento' : v ? 'Reservado' : 'Livre'}
                  </Badge>
                </div>
                {e && v ? (
                  <>
                    <strong>
                      {e.ticket} · {people.get(e.patientId)}
                    </strong>
                    <small>
                      {v.enteredAt ? 'Entrada' : 'Chamada'} às {clockTime(v.enteredAt ?? v.at)} ·{' '}
                      {minutesWaiting(v.enteredAt ?? v.at, now)} min
                    </small>
                    <div className="row-actions">
                      {!v.enteredAt ? (
                        <>
                          <Button
                            variant="secondary"
                            disabled={busy || dateKey(new Date(e.arrivedAt)) !== today}
                            onClick={() =>
                              act(
                                { type: 'queue.call', encounterId: e.id, roomId: r.id },
                                'Senha rechamada na TV.',
                              )
                            }
                          >
                            Rechamar
                          </Button>
                          {clinical && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  { type: 'encounter.start', id: e.id, roomId: r.id },
                                  'Entrada confirmada. Consulta em andamento.',
                                )
                              }
                            >
                              Confirmar entrada
                            </Button>
                          )}
                          <button
                            className="text-button"
                            onClick={() => setRelease({ e, id: v.id })}
                          >
                            Devolver à fila
                          </button>
                        </>
                      ) : clinical ? (
                        <Link to={'/atendimento/' + e.id} className="button secondary">
                          Abrir atendimento
                        </Link>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p>Aguardando chamada da equipe.</p>
                )}
              </article>
            );
          })}
        </div>
      </Panel>
      <Panel
        title={title}
        subtitle="Entre pessoas classificadas, a faixa registrada define a ordem. A preferência administrativa e a chegada desempatam. Pessoas sem classificação aparecem identificadas."
      >
        <div className="table-toolbar">
          <SearchField placeholder="Buscar nome ou senha" value={search} onChange={setSearch} />
          <Field label="Etapa da fila">
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">Todas as etapas</option>
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              {clinical && <option value="review">Reavaliação pendente</option>}
            </select>
          </Field>
        </div>
        <div className="queue-board-list">
          {list.map((r) => {
            const e = r.e,
              d = directions.get(r.id),
              a = assessments.get(r.id);
            const eligible =
              r.stage !== 'service' &&
              r.stage !== 'returned' &&
              r.stage !== 'receiving' &&
              !!e &&
              readyForConsultation(e) &&
              !currentStay(e);
            const unavailable = d ? visitors.has(d.roomId) : !free.length;
            return (
              <article key={r.id}>
                <div>
                  <strong>
                    {r.ticket} · {r.name}
                  </strong>
                  <p>
                    {labels[r.stage]}
                    {d ? ' · ' + roomName(d.roomId) : ''}
                    {r.priority === 'priority' ? ' · Preferencial' : ''}
                  </p>
                  {a && (
                    <small>
                      Faixa {a.rank} · {a.classification}
                      {a.reviewAt ? ' · ' + assessmentDeadline(a, now.getTime()) : ''}
                    </small>
                  )}
                </div>
                <div className="queue-board-duration">
                  <strong>{minutesWaiting(r.arrival, now)} min</strong>
                  <small>Chegada às {clockTime(r.arrival)}</small>
                </div>
                <div className="row-actions">
                  {e && clinical && (
                    <Link to={'/escuta/' + e.id} className="text-link">
                      {a ? 'Ver avaliação' : 'Abrir escuta'}
                    </Link>
                  )}
                  {eligible && (
                    <Button
                      variant="secondary"
                      disabled={busy || unavailable}
                      onClick={() => setCall(e)}
                    >
                      <Volume2 size={15} />
                      {unavailable ? 'Aguardar sala' : 'Chamar senha'}
                    </Button>
                  )}
                  {r.stage === 'desk' && (
                    <Link className="text-link" to="/recepcao">
                      Ir à recepção
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!list.length && (
          <EmptyState
            title="Nenhuma senha neste filtro"
            description="Confira a etapa e a busca, ou registre uma chegada na recepção."
            action={
              <Link to="/recepcao" className="button secondary">
                Abrir recepção
              </Link>
            }
          />
        )}
      </Panel>
      {call && (
        <Modal
          title="Chamar senha para o consultório"
          description={call.ticket + ' · ' + people.get(call.patientId)}
          onClose={() => setCall(null)}
        >
          <ActionForm
            onClose={() => setCall(null)}
            submitLabel="Reservar sala e chamar na TV"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'queue.call',
                encounterId: call.id,
                roomId: valueOf(f, 'room'),
              });
              notify('Consultório reservado. Senha chamada na TV.');
            }}
          >
            <Field label="Sala para chamada">
              <select name="room" required defaultValue={directed ?? free[0]?.id}>
                {consultRooms
                  .filter((r) => !directed || directed === r.id)
                  .map((r) => (
                    <option disabled={visitors.has(r.id)} key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
          </ActionForm>
        </Modal>
      )}
      {release && (
        <Modal
          title="Devolver senha à fila"
          description={release.e.ticket}
          onClose={() => setRelease(null)}
        >
          <ActionForm
            onClose={() => setRelease(null)}
            submitLabel="Liberar sala"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'queue.release-room',
                id: release.e.id,
                stayId: release.id,
                reason: valueOf(f, 'reason'),
              });
              notify('Consultório liberado. A senha conserva a chegada original.');
            }}
          >
            <Field label="Motivo da devolução">
              <textarea name="reason" required rows={3} maxLength={400} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </div>
  );
}
