import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { clockTime, shortDate } from '../domain/dates';
import type { ClinicalDocument } from '../domain/clinical-documents';
import {
  allocationBalance,
  type Dispensation,
  type DispensationAdjustment,
  type PharmacyPrescription,
} from '../domain/pharmacy';
import { AdjustmentHistory } from './DispensationAdjustments';
import { Button } from './ui';

export function DispensationHistory({
  document,
  onAdjust,
}: {
  document: ClinicalDocument | PharmacyPrescription;
  onAdjust?: (delivery: Dispensation, kind: DispensationAdjustment['kind']) => void;
}) {
  const { data, context } = useApp(),
    list = data.dispensations.filter((d) => d.documentId === document.id);
  if (!list.length)
    return <p className="panel-empty">Nenhuma entrega registrada para esta receita.</p>;
  return (
    <div className="dispensation-history">
      {[...list].reverse().map((d) => {
        const adjustments = data.dispensationAdjustments.filter((a) => a.dispensationId === d.id);
        const canAdjust =
          onAdjust &&
          context.role === 'pharmacy' &&
          context.unitId === d.unitId &&
          context.organizationId === d.organizationId;
        const remaining = d.allocations.some(
          (a) => allocationBalance(a, adjustments).remaining > 0,
        );
        return (
          <article key={d.id} data-testid={'delivery-' + d.id}>
            <div className="clinical-document-heading">
              <div>
                <strong>
                  {d.number} ·{' '}
                  {d.balances.some((b) => b.remaining > 0)
                    ? 'Entrega parcial'
                    : 'Entrega concluída'}
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
            <AdjustmentHistory delivery={d} adjustments={adjustments} />
            {canAdjust &&
              (remaining ? (
                <div className="row-actions pharmacy-adjustment-actions">
                  <Button variant="secondary" onClick={() => onAdjust(d, 'return')}>
                    Registrar devolução
                  </Button>
                  <Button variant="secondary" onClick={() => onAdjust(d, 'reversal')}>
                    Registrar estorno
                  </Button>
                </div>
              ) : (
                <p className="pharmacy-note">Todos os itens desta entrega já foram ajustados.</p>
              ))}
          </article>
        );
      })}
    </div>
  );
}
