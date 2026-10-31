import { consultRooms, currentStay, roomName, isConsultRoom } from '../domain/unit-queue';
import { activeEncounter } from '../domain/model';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Play, Clock3 } from 'lucide-react';
import { useApp } from '../app/context';
import { demoIdentities } from '../domain/access';
import { readyForConsultation } from '../domain/reception';
import type { Encounter } from '../domain/model';

import { clockTime, dateKey } from '../domain/dates';
import {
  Button,
  Field,
  Notice,
  PageHeader,
  Panel,
  EmptyState,
  Modal,
  ActionForm,
  valueOf,
  UnitRequired,
} from '../components/ui';

export function duration(minutes: number | null) {
  if (minutes === null) return 'Sem medição';
  if (minutes < 1) return '< 1 min';
  return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${Math.floor(minutes % 60)} min`;
}
export function LiveDuration({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{duration(Math.max(0, (now - Date.parse(since)) / 60000))}</span>;
}
export function DoctorCall({
  encounter,
  onChange,
}: {
  encounter: Encounter;
  onChange?: (previousRevision: number) => void;
}) {
  const { data, context, repository, notify } = useApp();
  const assigned =
    currentStay(encounter)?.roomId ??
    data.queueDirections.find((d) => d.encounterId === encounter.id)?.roomId;
  const [selectedRoom, setRoom] = useState(''),
    [busy, setBusy] = useState(false),
    [releasing, setReleasing] = useState(false);
  const occupied = new Set(
    data.encounters.filter((e) => e.id !== encounter.id).map((e) => currentStay(e)?.roomId),
  );
  const room =
    assigned ?? (selectedRoom || consultRooms.find((r) => !occupied.has(r.id))?.id || '');
  const active = data.careSegments.find((s) => s.encounterId === encounter.id && !s.endedAt);
  const otherVisit = data.careSegments.some(
    (s) => s.professionalId === context.sessionId && !s.endedAt && s.encounterId !== encounter.id,
  );
  const stay = currentStay(encounter);
  const reserved = stay && !stay.enteredAt && isConsultRoom(stay.roomId);
  const lastCall = reserved ? data.calls.filter((c) => c.roomStayId === stay.id).at(-1) : undefined;
  const owner = demoIdentities(repository.directory()).find(
    (i) => i.sessionId === active?.professionalId,
  );
  const act = async (start: boolean) => {
    setBusy(true);
    const previousRevision = repository.getRevision();
    try {
      await repository.execute(
        context,
        start
          ? { type: 'encounter.start', id: encounter.id, roomId: room }
          : { type: 'queue.call', encounterId: encounter.id, roomId: room },
      );
      onChange?.(previousRevision);
      notify(
        start
          ? 'Entrada no consultório registrada. Cronômetro iniciado.'
          : `Senha ${encounter.ticket} enviada para a TV.`,
      );
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="doctor-call">
      <div>
        <span className="eyebrow">
          {encounter.ticket} · CHEGADA {clockTime(encounter.arrivedAt)}
        </span>
        <p>
          {active ? (
            <>
              {currentStay(encounter) ? roomName(currentStay(encounter)!.roomId) + ' · ' : ''}
              {owner?.name} · <LiveDuration since={active.startedAt} /> em consulta
            </>
          ) : encounter.status === 'completed' ? (
            'Atendimento concluído'
          ) : encounter.status === 'observation' ? (
            'Em observação'
          ) : encounter.status === 'in-care' ? (
            'Atendimento anterior · confirme o profissional responsável'
          ) : reserved ? (
            'Aguardando entrada · senha chamada às ' + clockTime(lastCall?.calledAt ?? stay.at)
          ) : otherVisit ? (
            'Conclua o atendimento em curso para iniciar outro.'
          ) : (
            'Aguardando entrada no consultório'
          )}
        </p>
      </div>
      {releasing && reserved && (
        <Modal
          title="Devolver senha à fila"
          description={encounter.ticket + ' · ' + roomName(stay.roomId)}
          onClose={() => setReleasing(false)}
        >
          <ActionForm
            submitLabel="Confirmar devolução"
            onClose={() => setReleasing(false)}
            onSubmit={async (f) => {
              const rev = repository.getRevision();
              await repository.execute(context, {
                type: 'queue.release-room',
                id: encounter.id,
                stayId: stay.id,
                reason: valueOf(f, 'reason'),
              });
              onChange?.(rev);
              notify('Reserva liberada. A chegada foi preservada.');
            }}
          >
            <Field label="Motivo da devolução">
              <textarea name="reason" required maxLength={400} />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {activeEncounter(encounter) && (
        <>
          <Field label="Destino da chamada">
            <select value={room} disabled={!!assigned} onChange={(e) => setRoom(e.target.value)}>
              {!room && <option value="">Sem sala livre</option>}
              {consultRooms.map((r) => (
                <option key={r.id} value={r.id} disabled={occupied.has(r.id)}>
                  {r.name}
                  {occupied.has(r.id) ? ' · indisponível' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Button
            variant="secondary"
            disabled={
              busy ||
              otherVisit ||
              !isConsultRoom(room) ||
              occupied.has(room) ||
              !!(active && active.professionalId !== context.sessionId)
            }
            onClick={() => act(false)}
          >
            <Megaphone size={18} />
            Chamar / rechamar na TV
          </Button>
          {reserved && (
            <Button variant="secondary" onClick={() => setReleasing(true)}>
              Devolver senha à fila
            </Button>
          )}
          {!active && (
            <Button
              disabled={busy || otherVisit || !isConsultRoom(room) || occupied.has(room)}
              onClick={() => act(true)}
            >
              <Play size={16} />
              {encounter.status === 'in-care' ? 'Assumir atendimento' : 'Pessoa entrou · iniciar'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
export function ConsultingRoom() {
  const { context, data } = useApp();
  const active = data.careSegments.find(
    (s) => s.professionalId === context.sessionId && !s.endedAt,
  );
  const order = new Map(data.queueDirections.map((d) => [d.encounterId, d.order]));
  const routed = new Map(data.queueDirections.map((d) => [d.encounterId, d.roomId]));
  const waiting = data.encounters
    .filter(
      (e) =>
        (e.status === 'waiting' &&
          readyForConsultation(e) &&
          (!currentStay(e) || isConsultRoom(currentStay(e)!.roomId)) &&
          (!routed.has(e.id) || isConsultRoom(routed.get(e.id)!))) ||
        e.status === 'observation' ||
        (e.status === 'in-care' &&
          !data.careSegments.some((s) => s.encounterId === e.id && !s.endedAt)),
    )
    .sort(
      (a, b) =>
        (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
        Number(b.priority === 'priority') - Number(a.priority === 'priority') ||
        a.arrivedAt.localeCompare(b.arrivedAt),
    );
  const completedToday = data.encounters
    .filter(
      (e) =>
        e.status === 'completed' &&
        e.professionalId === context.sessionId &&
        e.completedAt &&
        dateKey(new Date(e.completedAt)) === dateKey(),
    )
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const person = (e: Encounter) => {
    const p = data.patients.find((p) => p.id === e.patientId);
    return p?.socialName || p?.name;
  };
  return (
    <div className="operations-page consulting-workspace">
      <PageHeader
        eyebrow="EQUIPE ASSISTENCIAL"
        title="Meu consultório"
        description="Chame a senha sem sair da sua estação. Registre o início quando a pessoa entrar no consultório."
      />
      <UnitRequired>
        <div className="operations-metrics" aria-label="Resumo do consultório">
          <article>
            <span>Para acompanhar</span>
            <strong>{waiting.length}</strong>
            <small>Na fila desta unidade</small>
          </article>
          <article>
            <span>Meu atendimento</span>
            <strong>{active ? 'Em consulta' : 'Disponível'}</strong>
            <small>
              {active ? 'Tempo de consulta em registro' : 'Inicie quando a pessoa entrar'}
            </small>
          </article>
          <article>
            <span>Em observação</span>
            <strong>{waiting.filter((e) => e.status === 'observation').length}</strong>
            <small>Entre as pessoas para acompanhar</small>
          </article>
        </div>
        {active &&
          (() => {
            const e = data.encounters.find((e) => e.id === active.encounterId)!;
            return (
              <Panel className="consulting-active" title={`Em atendimento · ${person(e)}`}>
                <div className="panel-body">
                  <DoctorCall encounter={e} />
                  <Link className="button primary" to={`/atendimento/${e.id}`}>
                    Continuar registro clínico
                  </Link>
                </div>
              </Panel>
            );
          })()}
        <Panel
          title="Fila e atendimentos para acompanhar"
          subtitle="Classificados pela faixa indicada na escuta. A preferência administrativa e a chegada ordenam os empates. As pessoas sem avaliação ficam identificadas separadamente."
        >
          <div className="consulting-list">
            {waiting.map((e) => (
              <article key={e.id}>
                <div className="consulting-person">
                  <strong>{person(e)}</strong>
                  <small>
                    {order.has(e.id) ? 'Classificação registrada' : 'Sem classificação registrada'}
                  </small>
                  <span>
                    {e.service} ·{' '}
                    {e.priority === 'priority' ? 'Preferência administrativa' : 'Fluxo habitual'} ·{' '}
                    <Clock3 size={14} />
                    <LiveDuration since={e.arrivedAt} />
                    <span>na unidade</span>
                  </span>
                  <Link to={`/atendimento/${e.id}`}>Abrir ficha e histórico</Link>
                </div>
                <DoctorCall encounter={e} />
              </article>
            ))}
          </div>
          {!waiting.length && (
            <EmptyState
              title="Nenhuma pessoa aguardando"
              description="As chegadas registradas na recepção ou no totem aparecem aqui."
            />
          )}
        </Panel>
        {completedToday.length > 0 && (
          <Panel
            title="Minhas consultas concluídas hoje"
            subtitle="Abra o registro preservado ou consulte o histórico da pessoa."
          >
            <div className="panel-body">
              {completedToday.map((e) => (
                <p key={e.id}>
                  <Link to={'/atendimento/' + e.id}>
                    {e.ticket} · {person(e)}
                  </Link>{' '}
                  · {clockTime(e.completedAt!)}
                </p>
              ))}
            </div>
          </Panel>
        )}
        <Notice>
          Chamar ou rechamar a senha não inicia o atendimento. O tempo de consulta começa em “Pessoa
          entrou · iniciar” e termina na conclusão ou no encaminhamento à observação.
        </Notice>
      </UnitRequired>
    </div>
  );
}
export function Performance() {
  const { repository, context, revision } = useApp();
  const [from, setFrom] = useState(dateKey()),
    [to, setTo] = useState(dateKey()),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  void revision;
  void clock;
  const valid = !!from && !!to && from <= to;
  const report = valid ? repository.performance(context, from, to) : null;
  const download = () => {
    if (!report) return;
    const rows = [
      [
        'Profissional',
        'Unidade',
        'Pessoas',
        'Períodos encerrados',
        'Média em minutos',
        'Em consulta',
      ],
      ...report.byProfessional.map((p) => [
        p.name,
        p.unitName,
        p.patients,
        p.duration.count,
        p.duration.average ?? '',
        p.active,
      ]),
      [],
      ['Etapa', 'Medições completas', 'Média em minutos'],
      ...(
        [
          ['Espera pelo balcão', report.beforeReception],
          ['Conferência na recepção', report.desk],
          ['Espera pela triagem', report.beforeTriage],
          ['Duração da triagem', report.intake],
          ['Espera pela consulta', report.beforeConsult],
        ] as const
      ).map(([label, s]) => [label, s.count, s.average ?? '']),
      [],
      [
        'Profissional da recepção',
        'Unidade',
        'Conferências concluídas',
        'Medições completas',
        'Média em minutos',
      ],
      ...report.byReception.map((p) => [
        p.name,
        p.unitName,
        p.checked,
        p.duration.count,
        p.duration.average ?? '',
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
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
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cuidelo-tempos-${from}-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeader
        eyebrow="ACOMPANHAMENTO DA OPERAÇÃO"
        title="Tempos e desempenho"
        description={
          context.role === 'manager'
            ? 'Indicadores das unidades da sua prefeitura.'
            : context.role === 'admin'
              ? 'Indicadores da unidade vinculada à sua sessão.'
              : 'Seus atendimentos e períodos de consulta.'
        }
        action={
          <Button variant="secondary" onClick={download} disabled={!report}>
            Exportar tempos e profissionais
          </Button>
        }
      />
      <div className="access-filters">
        <Field label="Chegadas a partir de">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Chegadas até">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {!report ? (
        <Notice tone="amber">Escolha um período válido.</Notice>
      ) : (
        <>
          <div className="flow-stats">
            {[
              ['Pessoas no período', String(report.arrivals)],
              ['Ainda em espera', String(report.waiting)],
              ['Espera atual média', duration(report.currentWait.average)],
              ['Permanência concluída', duration(report.total.average)],
            ].map(([label, value]) => (
              <article key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <Panel title="Etapas da jornada">
            <div className="flow-stats journey-stats">
              {[
                ['Chegada → balcão', report.beforeReception],
                ['Conferência na recepção', report.desk],
                ['Encaminhamento → triagem', report.beforeTriage],
                ['Chegada → início da escuta', report.reception],
                ['Duração da escuta', report.intake],
                ['Fim da escuta → consulta', report.beforeConsult],
              ].map(([label, value]) => {
                const v = value as typeof report.intake;
                return (
                  <article key={String(label)}>
                    <small>{String(label)}</small>
                    <strong>{duration(v.average)}</strong>
                    <span>{v.count} medições completas</span>
                  </article>
                );
              })}
            </div>
          </Panel>
          <Panel
            title="Tempo por profissional"
            subtitle="Média por período de consulta encerrado. Observação e tempo de espera não entram nessa duração."
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Profissional / unidade</th>
                    <th>Pessoas</th>
                    <th>Períodos encerrados</th>
                    <th>Média em consulta</th>
                    <th>Em consulta agora</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProfessional.map((p) => (
                    <tr key={p.professionalId}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="table-subtitle">{p.unitName}</small>
                      </td>
                      <td>{p.patients}</td>
                      <td>{p.duration.count}</td>
                      <td>{duration(p.duration.average)}</td>
                      <td>
                        {p.active} · {duration(p.activeMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report.byProfessional.length && (
              <EmptyState
                title="Ainda não há consultas com autoria registrada"
                description="Inicie um atendimento pelo consultório para começar a medir."
              />
            )}
          </Panel>
          {!!report.byReception.length && (
            <Panel
              title="Conferência por profissional da recepção"
              subtitle="Agrupado por quem iniciou a conferência. Período entre a chegada ao balcão e a primeira conferência concluída."
            >
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Profissional / unidade</th>
                      <th>Conferências concluídas</th>
                      <th>Tempo médio no balcão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byReception.map((p) => (
                      <tr key={p.actorId}>
                        <td>
                          <strong>{p.name}</strong>
                          <small className="table-subtitle">{p.unitName}</small>
                        </td>
                        <td>{p.checked}</td>
                        <td>
                          {duration(p.duration.average)} · {p.duration.count} medições
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          <Panel title="Movimento por unidade">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Chegadas</th>
                    <th>Em espera</th>
                    <th>Concluídos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byUnit.map((u) => (
                    <tr key={u.name}>
                      <td>{u.name}</td>
                      <td>{u.arrivals}</td>
                      <td>{u.waiting}</td>
                      <td>{u.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Notice>
            {report.unidentifiedWaiting} senhas do totem ainda aguardam identificação e não entram
            nas médias por pessoa. O período considera a data da chegada. Registros antigos sem
            marcação de etapas não geram tempos estimados: {report.unassigned} atendimentos sem
            período de consulta atribuído. Se não houver escuta, a espera na recepção termina na
            primeira entrada em consulta. Estes indicadores descrevem a operação e não avaliam
            qualidade clínica.
          </Notice>
        </>
      )}
    </>
  );
}
