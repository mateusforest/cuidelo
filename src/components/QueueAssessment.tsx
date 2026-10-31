import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { demoIdentities } from '../domain/access';
import { clockTime, shortDate } from '../domain/dates';
import type { Encounter, QueueAssessment } from '../domain/model';
import { readyForConsultation } from '../domain/reception';
import { destinations, roomName } from '../domain/unit-queue';
import { ActionForm, Badge, Button, Field, Modal, Panel, valueOf } from './ui';

export function assessmentDeadline(a: QueueAssessment, now: number) {
  return a.reviewAt
    ? (Date.parse(a.reviewAt) <= now ? 'Reavaliação pendente' : 'Reavaliar') +
        ' · ' +
        shortDate(a.reviewAt) +
        ' às ' +
        clockTime(a.reviewAt)
    : 'Sem prazo informado';
}
export function AssessmentLog({ records }: { records: QueueAssessment[] }) {
  const { repository, data } = useApp();
  const names = new Map(demoIdentities(repository.directory()).map((p) => [p.sessionId, p.name]));
  return (
    <ol className="assessment-log">
      {records
        .slice()
        .reverse()
        .map((a) => (
          <li key={a.id}>
            <strong>
              {a.classification} · Faixa {a.rank}
            </strong>
            <span>
              {roomName(a.roomId)} · {a.protocol}
            </span>
            <p>{a.reason}</p>
            <small>
              {shortDate(a.at)} às {clockTime(a.at)} · {names.get(a.actorId)} ·{' '}
              {data.units.find((u) => u.id === a.unitId)?.name}
              {a.reviewAt
                ? ' · Reavaliação prevista para ' +
                  shortDate(a.reviewAt) +
                  ' às ' +
                  clockTime(a.reviewAt)
                : ''}
            </small>
            {data.queueServiceEvents
              .filter((ev) => ev.assessmentId === a.id)
              .map((ev) => (
                <p key={ev.id}>
                  <strong>
                    {
                      {
                        receive: 'Recebido no setor',
                        return: 'Devolvido à escuta',
                        finish: 'Passagem concluída',
                      }[ev.action]
                    }
                  </strong>{' '}
                  · {shortDate(ev.at)} às {clockTime(ev.at)} · {names.get(ev.actorId)}{' '}
                  {ev.note && ' · ' + ev.note}
                </p>
              ))}
          </li>
        ))}
    </ol>
  );
}
export function QueueAssessmentPanel({
  encounter,
  allowEdit = false,
  disabled = false,
}: {
  encounter: Encounter;
  allowEdit?: boolean;
  disabled?: boolean;
}) {
  const { data, context, repository, notify } = useApp(),
    [version, setVersion] = useState<number | null>(null);
  const changed = useRef(false);
  const [destination, setDestination] = useState('');
  const options = destinations(data.units.find((u) => u.id === encounter.unitId)!.kind);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const records = data.queueAssessments.filter((a) => a.encounterId === encounter.id);
  const last = records.at(-1),
    hasIntake = data.intakes.some((i) => i.encounterId === encounter.id);
  const editable =
    allowEdit &&
    hasIntake &&
    encounter.status === 'waiting' &&
    readyForConsultation(encounter) &&
    data.queueServiceEvents.filter((ev) => ev.assessmentId === last?.id).at(-1)?.action !==
      'receive';
  if (!allowEdit && !last) return null;
  const close = () => {
    if (!changed.current || window.confirm('Descartar a avaliação ainda não salva?'))
      setVersion(null);
  };
  return (
    <Panel
      title="Classificação e destino"
      subtitle="Registro da avaliação realizada pela equipe assistencial."
    >
      <div className="panel-body assessment-panel">
        {last ? (
          <>
            <div className="assessment-summary">
              <Badge tone="blue">Faixa {last.rank}</Badge>
              <strong>{last.classification}</strong>
              <span>{roomName(last.roomId)}</span>
            </div>
            {encounter.status === 'waiting' && <p>{assessmentDeadline(last, now)}</p>}
            <details>
              <summary>Histórico de classificações ({records.length})</summary>
              <AssessmentLog records={records} />
            </details>
          </>
        ) : (
          <p>
            {hasIntake
              ? 'A escuta já foi registrada. A equipe pode indicar a prioridade e a sala de destino.'
              : 'Salve a escuta para registrar a classificação e o destino.'}
          </p>
        )}
        <div className="row-actions">
          {editable && (
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                changed.current = false;
                setDestination(last?.roomId ?? '');
                setVersion(records.length);
              }}
            >
              {last ? 'Registrar reavaliação' : 'Classificar e encaminhar'}
            </Button>
          )}
          <Link className="text-link" to="/fila">
            Ver fila e salas
          </Link>
        </div>
      </div>
      {version !== null && (
        <Modal
          title={version ? 'Reavaliar pessoa na fila' : 'Classificar e encaminhar'}
          description={
            encounter.ticket +
            ' · ' +
            (data.patients.find((p) => p.id === encounter.patientId)?.name ?? '')
          }
          onClose={close}
        >
          <ActionForm
            onCancel={close}
            onClose={() => setVersion(null)}
            submitLabel={version ? 'Salvar reavaliação' : 'Salvar classificação'}
            onSubmit={async (f) => {
              const minutes = valueOf(f, 'minutes');
              await repository.execute(context, {
                type: 'queue.assess',
                id: encounter.id,
                expectedCount: version,
                classification: valueOf(f, 'classification'),
                protocol: valueOf(f, 'protocol'),
                rank: Number(valueOf(f, 'rank')),
                roomId: valueOf(f, 'room'),
                reason: valueOf(f, 'reason'),
                confirmClosure: f.get('confirmClosure') === 'on',
                ...(minutes ? { reviewMinutes: Number(minutes) } : {}),
              });
              changed.current = false;
              notify('Avaliação registrada. A fila da unidade foi atualizada.');
            }}
          >
            <div
              onChangeCapture={() => {
                changed.current = true;
              }}
            >
              <p>
                Informe a decisão do profissional para este caso fictício. Use a referência da
                unidade e registre um prazo se houver reavaliação prevista.
              </p>
              <Field label="Referência do protocolo">
                <input
                  name="protocol"
                  required
                  maxLength={120}
                  defaultValue={last?.protocol}
                  placeholder="Nome e versão da referência usada no teste"
                />
              </Field>
              <Field label="Classificação registrada">
                <input
                  name="classification"
                  required
                  maxLength={80}
                  placeholder="Denominação atribuída pela equipe"
                />
              </Field>
              <div className="form-grid">
                <Field
                  label="Faixa de chamada"
                  hint="A faixa 1 vem primeiro entre as pessoas avaliadas."
                >
                  <select name="rank" required defaultValue="">
                    <option disabled value="">
                      Selecione a faixa
                    </option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        Faixa {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Destino após a escuta">
                  <select
                    name="room"
                    required
                    value={destination}
                    onChange={(ev) => setDestination(ev.target.value)}
                  >
                    <option disabled value="">
                      Selecione o destino
                    </option>
                    {options.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {destination === 'orientacao' ? (
                <label className="confirmation-check">
                  <input type="checkbox" name="confirmClosure" required /> Confirmo que a orientação
                  foi prestada e que o atendimento fictício pode ser encerrado na escuta.
                </label>
              ) : (
                <Field
                  label="Reavaliar em minutos (opcional)"
                  hint="Preencha o prazo que a equipe definiu para esta avaliação."
                >
                  <input type="number" name="minutes" min="1" max="1440" step="1" />
                </Field>
              )}
              <Field
                label={version ? 'Motivo e resultado da reavaliação' : 'Justificativa da avaliação'}
              >
                <textarea required name="reason" rows={3} maxLength={1000} />
              </Field>
            </div>
          </ActionForm>
        </Modal>
      )}
    </Panel>
  );
}
