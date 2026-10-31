import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import type { Encounter } from '../domain/model';
import { useApp } from '../app/context';
import { Button } from './ui';
import '../styles/reception.css';
export function TriageCall({
  encounter,
  onChange,
}: {
  encounter: Encounter;
  onChange: () => void;
}) {
  const { context, data, repository, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const blocked = data.sectorSeats.some(
    (s) => s.roomId === 'escuta-1' && s.encounterId !== encounter.id,
  );
  const here = data.sectorSeats.find(
    (s) => s.roomId === 'escuta-1' && s.encounterId === encounter.id,
  );
  const reassessment =
    data.intakes.some((i) => i.encounterId === encounter.id) && encounter.status === 'waiting';
  return (
    <div className="triage-call-bar">
      <div>
        <strong>{encounter.ticket} · Sala 01 · Triagem</strong>
        <p>
          A chamada aparece na TV. O tempo da triagem começa quando a pessoa entra e a equipe
          registra o início.
        </p>
      </div>
      <Button
        variant="secondary"
        disabled={busy || blocked}
        onClick={async () => {
          setBusy(true);
          try {
            await repository.execute(context, {
              type: 'queue.call',
              encounterId: encounter.id,
              roomId: 'escuta-1',
            });
            onChange();
            notify(`Senha ${encounter.ticket} chamada para a triagem.`);
          } catch (e) {
            notify((e as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Megaphone size={17} />
        {blocked ? 'Triagem indisponível' : 'Chamar / rechamar para triagem'}
      </Button>
      {reassessment && !here?.entered && (
        <Button
          disabled={busy || blocked}
          onClick={async () => {
            setBusy(true);
            try {
              await repository.execute(context, {
                type: 'intake.review-start',
                encounterId: encounter.id,
              });
              onChange();
              notify('Entrada na sala de triagem registrada.');
            } catch (e) {
              notify((e as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          Registrar entrada para reavaliação
        </Button>
      )}
    </div>
  );
}
