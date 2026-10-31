import { useState } from 'react';
import { useApp } from '../app/context';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import {
  allocationBalance,
  reversalInventoryCredits,
  type Dispensation,
  type DispensationAdjustment,
} from '../domain/pharmacy';
import { ActionForm, Field, Modal, Notice, valueOf } from './ui';

export function AdjustmentHistory({
  delivery,
  adjustments,
}: {
  delivery: Dispensation;
  adjustments: DispensationAdjustment[];
}) {
  if (!adjustments.length) return null;
  return (
    <section
      className="pharmacy-adjustment-history"
      aria-label={'Ajustes da entrega ' + delivery.number}
    >
      <h3>Ajustes da entrega {delivery.number}</h3>
      <ol>
        {[...adjustments].reverse().map((entry) => {
          const line = delivery.allocations.find((a) => a.movementId === entry.originalMovementId)!;
          const counted =
            entry.inventoryCredits?.reduce((sum, credit) => sum + credit.quantity, 0) ?? 0;
          return (
            <li key={entry.id}>
              <strong>
                {entry.kind === 'return' ? 'Devolução recebida' : 'Estorno de lançamento'} ·{' '}
                {entry.quantity} {line.quantityUnit}
              </strong>
              <span>
                {line.product} · lote {line.lot} · validade {shortDate(line.expiresAt)}
              </span>
              <span>
                {entry.destination === 'segregated'
                  ? 'Entrada em estoque segregado'
                  : counted === entry.quantity
                    ? 'Saldo do lote preservado'
                    : counted > 0
                      ? 'Reposição complementar no saldo do lote'
                      : 'Reposição no saldo do lote'}{' '}
                · de {entry.balanceBefore} para {entry.balanceAfter} {line.quantityUnit}
              </span>
              {entry.inventoryCredits?.map((credit) => (
                <span key={credit.inventoryId}>
                  Inventário {credit.reference} · {credit.quantity} {line.quantityUnit} já incluídas
                  e atribuídas a esta saída.
                </span>
              ))}
              {counted > 0 && entry.destination === 'segregated' && (
                <span>
                  Da quantidade segregada, {counted} {line.quantityUnit} vieram do saldo vencido já
                  contabilizado.
                </span>
              )}
              <p>{entry.reason}</p>
              <small>
                {shortDate(entry.at)} às {clockTime(entry.at)} · {entry.author}
              </small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function AdjustmentEditor({
  delivery,
  kind,
  person,
  prescriptionNumber,
  cancelled,
  onClose,
}: {
  delivery: Dispensation;
  kind: DispensationAdjustment['kind'];
  person: string;
  prescriptionNumber: string;
  cancelled: boolean;
  onClose: () => void;
}) {
  const { context, data, repository, notify } = useApp();
  const [initial] = useState(() => {
    const history = data.dispensationAdjustments.filter((a) => a.dispensationId === delivery.id);
    return {
      revision: repository.getRevision(),
      expectedAdjustments: history.length,
      requestId: crypto.randomUUID(),
      lines: delivery.allocations
        .map((line) => ({
          line,
          balance: allocationBalance(line, history),
          credits:
            kind === 'reversal'
              ? reversalInventoryCredits(
                  line.movementId,
                  line.lotId,
                  data.movements,
                  data.stockLogistics,
                  data.dispensationAdjustments,
                )
              : [],
        }))
        .filter((r) => r.balance.remaining > 0),
    };
  });
  const [movementId, setMovementId] = useState(initial.lines[0]?.line.movementId ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [creditQuantities, setCreditQuantities] = useState<Record<string, string>>({});
  const selection = initial.lines.find((r) => r.line.movementId === movementId);
  const credits = selection?.credits ?? [];
  const counted = credits.reduce(
    (sum, credit) => sum + Number(creditQuantities[credit.inventoryId] || 0),
    0,
  );
  const allCreditsEntered = credits.every(
    (credit) =>
      creditQuantities[credit.inventoryId] !== undefined &&
      creditQuantities[credit.inventoryId] !== '',
  );
  const physicalReturn = kind === 'return';
  const expired = selection && selection.line.expiresAt < dateKey();
  return (
    <Modal
      title={physicalReturn ? 'Registrar devolução' : 'Registrar estorno'}
      description={person + ' · ' + delivery.number + ' · receita ' + prescriptionNumber}
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel={physicalReturn ? 'Confirmar devolução' : 'Confirmar estorno'}
        onSubmit={async (form) => {
          if (!allCreditsEntered || counted > Number(quantity))
            throw new Error(
              'Confira a parcela atribuída a cada inventário. A soma deve caber na quantidade do estorno.',
            );
          await repository.execute(
            context,
            {
              type: 'pharmacy.adjust',
              dispensationId: delivery.id,
              originalMovementId: movementId,
              kind,
              quantity: Number(valueOf(form, 'quantity')),
              ...(credits.length
                ? {
                    inventoryCredits: credits.map((credit) => ({
                      inventoryId: credit.inventoryId,
                      quantity: Number(creditQuantities[credit.inventoryId]),
                    })),
                  }
                : {}),
              reason: valueOf(form, 'reason'),
              confirmed,
              expectedAdjustments: initial.expectedAdjustments,
              requestId: initial.requestId,
            },
            initial.revision,
          );
          notify(
            physicalReturn
              ? 'Devolução registrada no estoque segregado e vinculada à entrega.'
              : 'Estorno registrado. O saldo e o histórico da entrega foram atualizados.',
          );
        }}
      >
        <Notice tone={physicalReturn ? 'neutral' : 'amber'}>
          {physicalReturn
            ? 'Use quando o medicamento entregue voltar à unidade. A quantidade recebida fica segregada. O saldo da receita permanece igual.'
            : 'Use quando a quantidade foi lançada como entregue, mas permaneceu na unidade. Confira a contagem física antes de corrigir a baixa.'}
        </Notice>
        {repository.getRevision() !== initial.revision && (
          <Notice tone="amber">
            Houve uma atualização desde a abertura. Reabra o ajuste para conferir os saldos atuais.
          </Notice>
        )}
        <Field label="Item e lote da entrega">
          <select
            required
            value={movementId}
            onChange={(e) => {
              setMovementId(e.target.value);
              setQuantity('');
              setCreditQuantities({});
              setConfirmed(false);
            }}
          >
            {initial.lines.map(({ line, balance }) => (
              <option value={line.movementId} key={line.movementId}>
                {line.product} · lote {line.lot} · até {balance.remaining} {line.quantityUnit}
              </option>
            ))}
          </select>
        </Field>
        {selection && (
          <div className="pharmacy-adjustment-balance">
            <strong>
              Lote {selection.line.lot} · validade {shortDate(selection.line.expiresAt)}
            </strong>
            <span>
              Na entrega original: {selection.line.quantity} {selection.line.quantityUnit}.
            </span>
            <span>
              Devolvidos: {selection.balance.returned} · estornados: {selection.balance.reversed} ·
              disponíveis para ajuste: {selection.balance.remaining}.
            </span>
            {!physicalReturn && (
              <span>
                {credits.length
                  ? 'Confira a parcela já contabilizada nas contagens deste lote.'
                  : expired
                    ? 'Lote vencido. A quantidade corrigida irá para o estoque segregado.'
                    : 'A quantidade corrigida voltará ao saldo do lote.'}{' '}
                {cancelled
                  ? 'A receita cancelada continuará bloqueada para entrega.'
                  : 'A receita voltará a apresentar a quantidade estornada como pendente.'}
              </span>
            )}
          </div>
        )}
        <Field
          label="Quantidade do ajuste"
          hint={selection ? 'Unidade de contagem: ' + selection.line.quantityUnit : undefined}
        >
          <input
            key={movementId}
            type="number"
            name="quantity"
            required
            min={1}
            max={selection?.balance.remaining}
            step={1}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setConfirmed(false);
            }}
          />
        </Field>
        {credits.length > 0 && selection && (
          <section className="pharmacy-credit-review" aria-label="Conciliação com o inventário">
            <h3>Conciliação com o inventário</h3>
            <p>
              O inventário acrescentou unidades deste lote depois da saída original. Informe quantas
              unidades deste estorno já foram incluídas em cada contagem. Digite zero quando a
              diferença tiver outra origem.
            </p>
            {credits.map((credit) => (
              <Field
                key={credit.inventoryId}
                label={'Quantidade já contada · ' + credit.reference}
                hint={
                  shortDate(credit.at) +
                  ' às ' +
                  clockTime(credit.at) +
                  ' · até ' +
                  credit.remaining +
                  ' ' +
                  selection.line.quantityUnit +
                  ' desta contagem.'
                }
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  max={Math.min(
                    credit.remaining,
                    quantity === '' ? credit.remaining : Number(quantity),
                  )}
                  required
                  value={creditQuantities[credit.inventoryId] ?? ''}
                  onChange={(e) => {
                    setCreditQuantities({
                      ...creditQuantities,
                      [credit.inventoryId]: e.target.value,
                    });
                    setConfirmed(false);
                  }}
                />
              </Field>
            ))}
            {allCreditsEntered &&
              quantity !== '' &&
              (counted > Number(quantity) ? (
                <Notice tone="amber">A soma atribuída aos inventários ultrapassa o estorno.</Notice>
              ) : (
                <Notice>
                  {counted} {selection.line.quantityUnit} já contabilizadas.{' '}
                  {expired
                    ? 'O lote venceu. O ajuste transfere a parcela já contada do saldo bloqueado para o segregado e registra o restante em segregação.'
                    : 'O estorno acrescentará ' +
                      (Number(quantity) - counted) +
                      ' ' +
                      selection.line.quantityUnit +
                      ' ao saldo do lote.'}
                </Notice>
              ))}
          </section>
        )}
        <Field label="Motivo do ajuste">
          <textarea required name="reason" rows={3} maxLength={500} />
        </Field>
        <label className="document-check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {physicalReturn
            ? 'Conferi o lote e a quantidade recebida para segregação.'
            : credits.length
              ? 'Conferi a baixa por engano e a parcela já contabilizada em cada inventário.'
              : 'Conferi que a quantidade permaneceu na unidade, a baixa foi lançada por engano e a quantidade ainda precisa ser reposta no registro.'}
        </label>
      </ActionForm>
    </Modal>
  );
}
