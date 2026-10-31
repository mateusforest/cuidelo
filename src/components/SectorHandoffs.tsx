import { useState } from 'react';
import { useApp } from '../app/context';
import { clockTime, shortDate } from '../domain/dates';
import type { ServiceTicket } from '../domain/model';
import { roomName } from '../domain/unit-queue';
import { ActionForm, Badge, Button, Field, Modal, Panel, valueOf } from './ui';

export function SectorHandoffs({ roomId }: { roomId: string }) {
  const { context, data, repository, notify } = useApp();
  const [form, setForm] = useState<{ ticket: ServiceTicket; action: 'return' | 'finish' } | null>(
      null,
    ),
    [busy, setBusy] = useState(false);
  const occupied = data.sectorSeats.filter((s) => s.roomId === roomId);
  const blocked = (id: string) => occupied.some((s) => s.encounterId !== id);
  const tickets = data.serviceTickets.filter((t) => t.roomId === roomId);
  if (!tickets.length && !form) return null;
  const receive = async (t: ServiceTicket) => {
    setBusy(true);
    try {
      await repository.execute(context, {
        type: 'queue.service',
        action: 'receive',
        id: t.encounterId,
        assessmentId: t.assessmentId,
        expectedCount: t.count,
        note: '',
      });
      notify('Recebimento confirmado no setor.');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Encaminhamentos ao setor"
      subtitle={
        'Encaminhamentos da recepção ou da escuta para ' +
        roomName(roomId) +
        '. Confira a senha e a identificação na chegada.'
      }
    >
      <div className="queue-board-list">
        {tickets.map((t) => (
          <article key={t.assessmentId}>
            <div>
              <strong>
                {t.ticket} · {t.name}
              </strong>
              <small>
                Encaminhado em {shortDate(t.at)} às {clockTime(t.at)}
              </small>
            </div>
            <Badge tone={t.received ? 'blue' : 'amber'}>
              {t.received
                ? 'Recebido no setor'
                : blocked(t.encounterId)
                  ? 'Aguardar sala'
                  : occupied.some((s) => s.encounterId === t.encounterId)
                    ? 'Sala reservada'
                    : 'Aguardando recebimento'}
            </Badge>
            <div className="row-actions">
              {!t.received && (
                <Button
                  variant="secondary"
                  disabled={busy || blocked(t.encounterId)}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await repository.execute(context, {
                        type: 'queue.call-service',
                        id: t.encounterId,
                        assessmentId: t.assessmentId,
                      });
                      notify('Senha chamada na TV da unidade.');
                    } catch (e) {
                      notify((e as Error).message, 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Chamar na TV
                </Button>
              )}
              {t.received ? (
                <Button onClick={() => setForm({ ticket: t, action: 'finish' })}>
                  Concluir passagem
                </Button>
              ) : (
                <Button disabled={busy || blocked(t.encounterId)} onClick={() => receive(t)}>
                  Confirmar recebimento
                </Button>
              )}
              <button
                className="text-button"
                onClick={() => setForm({ ticket: t, action: 'return' })}
              >
                Devolver à escuta
              </button>
            </div>
          </article>
        ))}
      </div>
      {form && (
        <Modal
          title={form.action === 'return' ? 'Devolver à escuta' : 'Concluir passagem pelo setor'}
          description={form.ticket.ticket + ' · ' + form.ticket.name}
          onClose={() => setForm(null)}
        >
          <ActionForm
            onClose={() => setForm(null)}
            submitLabel={form.action === 'return' ? 'Confirmar devolução' : 'Confirmar conclusão'}
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'queue.service',
                id: form.ticket.encounterId,
                assessmentId: form.ticket.assessmentId,
                expectedCount: form.ticket.count,
                action: form.action,
                note: valueOf(f, 'note'),
              });
              notify(
                form.action === 'return'
                  ? 'Pessoa devolvida à escuta para reavaliação.'
                  : 'Passagem pelo setor concluída.',
              );
            }}
          >
            <p>
              {form.action === 'return'
                ? 'O motivo aparecerá na ficha da equipe que fará a reavaliação.'
                : 'Confira o atendimento prestado antes de encerrar esta passagem. A aplicação de vacinas e a entrega por lote têm registros próprios.'}
            </p>
            <Field
              label={form.action === 'return' ? 'Motivo da devolução' : 'Resultado da passagem'}
            >
              <textarea required rows={3} name="note" maxLength={600} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </Panel>
  );
}
