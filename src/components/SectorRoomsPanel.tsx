import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { currentStay, sectorRooms } from '../domain/unit-queue';
import { clockTime, shortDate } from '../domain/dates';
import { can } from '../domain/model';
import { Panel, Badge, Button, Modal, Field, ActionForm, valueOf } from './ui';

export function SectorRoomsPanel() {
  const { context, data, repository, notify } = useApp();
  const [release, setRelease] = useState<{ id: string; stayId: string; ticket: string } | null>(
    null,
  );
  const clinical = can(context.role, 'clinical'),
    unit = data.units.find((u) => u.id === context.unitId);
  if (!unit) return null;
  return (
    <Panel
      title="Salas dos setores"
      subtitle="A chamada reserva o espaço. A entrada ocupa a sala até a conclusão ou a devolução da passagem."
    >
      <div className="queue-room-grid">
        {sectorRooms(unit.kind).map((room) => {
          const seats = data.sectorSeats.filter((s) => s.roomId === room.id);
          return (
            <article className="queue-room-card" key={room.id}>
              <div className="queue-room-head">
                <strong>{room.name}</strong>
                <Badge
                  tone={seats.some((s) => s.entered) ? 'blue' : seats.length ? 'amber' : 'green'}
                >
                  {seats.some((s) => s.entered)
                    ? 'Em atendimento'
                    : seats.length
                      ? 'Reservado'
                      : 'Livre'}
                </Badge>
              </div>
              {!seats.length && <p>Aguardando chamada da equipe.</p>}
              {seats.map((s) => {
                const e = data.encounters.find((e) => e.id === s.encounterId);
                if (!e) return null;
                const stay = currentStay(e);
                const route =
                  room.id === 'escuta-1'
                    ? '/escuta/' + e.id
                    : room.id === 'vacina-1'
                      ? '/vacinacao'
                      : room.id === 'farmacia-1'
                        ? '/farmacia'
                        : '/escuta';
                return (
                  <div key={e.id}>
                    <strong>
                      {e.ticket} · {data.patients.find((p) => p.id === e.patientId)?.name}
                    </strong>
                    <p>
                      {s.entered ? 'Entrada' : 'Chamada'} em {shortDate(s.since)} às{' '}
                      {clockTime(s.since)}
                      {s.legacy ? ' · registro anterior à versão 0.15' : ''}
                    </p>
                    <div className="row-actions">
                      {clinical && room.id !== 'farmacia-1' && (
                        <Link className="button secondary" to={route}>
                          Abrir setor
                        </Link>
                      )}
                      {!s.entered && stay && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setRelease({ id: e.id, stayId: stay.id, ticket: e.ticket })
                          }
                        >
                          Liberar reserva
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
      {release && (
        <Modal
          title="Liberar reserva do setor"
          description={release.ticket}
          onClose={() => setRelease(null)}
        >
          <ActionForm
            onClose={() => setRelease(null)}
            submitLabel="Devolver à fila"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'queue.release-room',
                id: release.id,
                stayId: release.stayId,
                reason: valueOf(f, 'reason'),
              });
              notify('Sala liberada. A chegada original foi preservada.');
            }}
          >
            <Field label="Motivo da liberação">
              <textarea name="reason" required maxLength={400} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </Panel>
  );
}
