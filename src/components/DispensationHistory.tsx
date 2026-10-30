import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { clockTime, shortDate } from '../domain/dates';
import type { ClinicalDocument } from '../domain/clinical-documents';
import type { PharmacyPrescription } from '../domain/pharmacy';

export function DispensationHistory({
  document,
}: {
  document: ClinicalDocument | PharmacyPrescription;
}) {
  const { data } = useApp(),
    list = data.dispensations.filter((d) => d.documentId === document.id);
  if (!list.length)
    return <p className="panel-empty">Nenhuma entrega registrada para esta receita.</p>;
  return (
    <div className="dispensation-history">
      {[...list].reverse().map((d) => (
        <article key={d.id}>
          <div className="clinical-document-heading">
            <div>
              <strong>
                {d.number} ·{' '}
                {d.balances.some((b) => b.remaining > 0) ? 'Entrega parcial' : 'Entrega concluída'}
              </strong>
              <small>
                {shortDate(d.at)} · {clockTime(d.at)} · {d.author}
              </small>
            </div>
            <Link className="button secondary" target="_blank" to={`/dispensacoes/${d.id}`}>
              Abrir comprovante
            </Link>
          </div>
          <p>
            Recebido por {d.recipient.name}
            {d.recipient.kind === 'representative' ? ' · representante' : ' · pessoa da receita'}.
          </p>
          <ul>
            {d.allocations.map((a) => (
              <li key={a.movementId}>
                <strong>{a.product}</strong> · {a.quantity} {a.quantityUnit} · lote {a.lot} ·
                validade {shortDate(a.expiresAt)}
              </li>
            ))}
          </ul>
          {d.partialReason && (
            <p>
              <strong>Saldo pendente:</strong> {d.partialReason}
            </p>
          )}
          {d.notes && <p>{d.notes}</p>}
        </article>
      ))}
    </div>
  );
}
